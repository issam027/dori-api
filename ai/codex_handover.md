# Handover technique vérifié de `src`

Dernier double contrôle : **2026-10-06**.

Ce document décrit l'état réellement observé dans le code. Les anciens journaux incrémentaux ont été remplacés par une synthèse exploitable. Un point est coché uniquement lorsque son implémentation est encore présente et cohérente au moment du contrôle.

## Comment reprendre les travaux

- **P0** : risque immédiat de sécurité, corruption ou perte de données.
- **P1** : défaut fonctionnel, de sécurité ou de fiabilité important.
- **P2** : dette d'architecture ou de maintenabilité significative.
- **P3** : amélioration ciblée à faible risque.
- Les points marqués **Partiel** ont déjà une base correcte, mais leur objectif complet n'est pas atteint.
- Après chaque correction : ajouter le test de non-régression indiqué, exécuter `npm run quality:check`, puis actualiser ce fichier.

## Reste à faire, par ordre conseillé

| Ordre | ID | Priorité | État vérifié | Travail restant |
| ---: | --- | --- | --- | --- |
| 1 | WORKER-002 | P1 | Ouvert | Brancher de vrais fournisseurs SMS/e-mail et ne marquer livré qu'après confirmation réelle. |
| 2 | DB-002 | P1 | Ouvert, décision requise | Fournir la CA PostgreSQL correcte avant de réactiver `rejectUnauthorized`. |
| 3 | TEST-002 | P1 | Ouvert, décision requise | Choisir et provisionner un PostgreSQL éphémère pour les tests e2e/concurrents. |
| 4 | TEST-001 | P1 | Partiel | Étendre la couverture des chemins critiques ; couverture actuelle : 24,86 % statements. |

Les autres points ont été revérifiés et sont détaillés ci-dessous.

## Vérifications exécutées pendant ce double contrôle

- `npm run typecheck` : réussi.
- `npm run build` et `npm run build:check` : réussis.
- Tests unitaires : **31 suites, 136 tests réussis**.
- Couverture Jest : **24,86 % statements, 30,25 % branches, 27,94 % fonctions, 24,19 % lignes**.
- `npm run format:check` / `npm run lint` : réussis sans erreur après standardisation LF (`.gitattributes` et `.prettierrc`).
- Scan de persistance : aucun SQL direct dans les services, workers, contrôleurs, gateways ou stratégies. `DatabaseSeedService` reste l'exception volontaire d'infrastructure.
- Scan de configuration : accès direct à `process.env` strictement limité à `src/core/config/configuration.ts`. Aucun appel direct dans `main.ts` ni dans le reste de l'application.
- Scan Swagger : aucun décorateur de réponse natif (`@ApiResponse`, `@ApiOkResponse`, etc.) hors de `core/swagger`.

## Contrôle point par point

### [x] BOOT-001 — Retirer les diagnostics temporaires du bootstrap

- **État vérifié : corrigé (2026-10-06).** Le `console.log` de diagnostic Vercel a été supprimé de `main.ts`. Aucun log de diagnostic ni version technique n'est émis avant le logger Nest.
- **Test de non-régression :** `src/main.spec.ts` valide l'absence de tout `console.log` ou marqueur `[boot]` dans le fichier de bootstrap.
- **Reste à faire :** rien pour ce point.

### [x] SEC-001 — Supprimer le secret JWT de secours

- **État vérifié : corrigé.** `validateEnvironment` exige un `JWT_SECRET` d'au moins 32 caractères ; `JwtModule` et `JwtStrategy` utilisent `getOrThrow`.
- **Contrôle :** aucune occurrence de l'ancien secret `change-me-in-production` dans `src`.
- **Reste à faire :** rien pour ce point.

### [x] SEC-002 — Rendre `sid` obligatoire dans les JWT

- **État vérifié : corrigé.** `JwtStrategy` refuse un payload sans `sid` et `JwtSessionRepository` vérifie ensemble session, utilisateur, révocation, expiration et compte actif.
- **Tests présents :** token sans `sid` refusé et session liée acceptée.
- **Reste à faire :** rien pour ce point.

### [x] AUTH-001 — Rendre le refresh par cookie fonctionnel

- **État vérifié : corrigé.** `cookie-parser` utilise l'import CommonJS compatible Node 22 ; login et refresh partagent les options de cookie calculées depuis `ConfigService`.
- **Limite de test :** aucun e2e navigateur/cookie réel ; cette lacune relève de TEST-001/TEST-002.
- **Reste à faire :** rien dans l'implémentation de ce point.

### [x] AUTH-002 — Atomiser la rotation du refresh token

- **État vérifié : corrigé le 2026-10-06.** `AuthRepository.rotateRefreshSession` exécute toute la consommation dans une transaction : sélection de l'ancienne session avec `FOR UPDATE`, validation de l'expiration et du compte, révocation conditionnelle puis insertion de la nouvelle session avant commit.
- **Protection contre le rejeu :** une seconde rotation attend le verrou, observe ensuite `revoked_at`, révoque les autres sessions actives de l'utilisateur et retourne un résultat `reused`; aucun nouveau JWT n'est signé.
- **Séparation des responsabilités :** `AuthService` génère le secret aléatoire et signe le JWT uniquement après le succès transactionnel retournant le nouveau `sessionId`; le repository ne manipule que la persistance atomique.
- **Tests ajoutés :** contrat SQL du verrou et de la transaction, branche de rejeu, orchestration de succès, rejet des statuts `invalid`/`reused` sans signature. Typecheck, build, ESLint ciblé et 9 tests auth réussis.
- **Reste recommandé :** le scénario à deux connexions PostgreSQL réelles demeure à ajouter dans TEST-001/TEST-002 ; l'implémentation applicative de ce point est terminée.

### [x] CFG-001 — Valider la configuration au bootstrap

- **État vérifié : corrigé.** Validation fail-fast du secret JWT, des ports, de la durée refresh et de `DATABASE_URL`.
- **Tests présents :** variables absentes, invalides et hors bornes.
- **Reste à faire :** la centralisation de `VERCEL` relève de CORE-004, pas de ce validateur général.

### [x] DB-001 — Ne pas avaler l'échec du schema/seed

- **État vérifié : corrigé.** `DatabaseSeedService` journalise puis relance l'exception.
- **Reste à faire :** ajouter ultérieurement un test bootstrap avec SQL invalide dans TEST-001 ; aucun changement fonctionnel requis ici.

### [x] TIME-001 — Faire respecter l'horloge injectée

- **État vérifié : corrigé (2026-10-06).** L'ensemble des services, workers et contrôles de sécurité utilisent désormais l'horloge injectée `ClockService`.
- **Modifications apportées :**
  - `JwtSessionRepository.findValidSessionId` prend désormais en paramètre `now: Date` et compare `s.expires_at > $3` (suppression complète de `NOW()` en SQL).
  - `JwtStrategy` injecte `ClockService` et transmet `this.clockService.now()` au repository lors de la validation du JWT.
  - Tests unitaires mis à jour dans `src/core/auth/strategies/jwt.strategy.spec.ts` pour valider l'utilisation de l'horloge injectée.
  - Ajout de `src/core/auth/repositories/jwt-session.repository.spec.ts` garantissant que la requête utilise `$3` et ne contient aucun appel natif `NOW()`.
- **Reste à faire :** rien pour ce point.

### [x] TIME-002 — Corriger la fin de journée locale

- **État vérifié : corrigé.** `ClockService` utilise `date-fns-tz` et produit la borne locale `23:59:59.999` convertie en UTC.
- **Tests présents :** Berlin, New York, Tunis et transitions DST.
- **Reste à faire :** rien pour ce point.

### [x] ERR-001 — Unifier les erreurs publiques

- **État vérifié : corrigé dans le code.** `GlobalExceptionFilter` retourne des codes et clés de traduction contrôlés et masque les détails des erreurs inconnues.
- **Lacune :** le filtre lui-même n'a pas de spec dédié couvrant 400/401/403/404/409/429/500.
- **Reste à faire :** ajouter ces tests dans TEST-001, sans rouvrir le contrat d'erreur.

### [x] ARCH-001 — Homogénéiser la persistance

- **État vérifié : corrigé (2026-10-06).** Tous les repositories applicatifs sont des couches pures d'accès aux données dépendant uniquement de `DataSource` et manipulant du SQL typé.
- **Modifications apportées :**
  - **`UsersRepository` :** suppression de toutes les dépendances applicatives (`ScopeService`, `ClockService`, `ConfigService`, `bcryptjs`, `DoriException`). Le repository ne dépend plus que de `DataSource` et fournit des méthodes d'accès brut aux données et transactions atomiques.
  - **`UsersService` :** prise en charge complète de la logique métier, des règles anti-escalade de privilèges, du hachage de mot de passe bcrypt, de la résolution des scopes et de l'invalidation de cache.
  - **`TranslationsRepository` :** suppression de l'inversion de dépendance via le callback métier `validate`. La validation des paramètres de template est désormais effectuée directement par `TranslationsService`.
  - **Tests :** ajout de suites dédiées ([`users.repository.spec.ts`](file:///d:/work/workspaces/dori/dori-api/src/modules/users/users.repository.spec.ts), [`translations.service.spec.ts`](file:///d:/work/workspaces/dori/dori-api/src/modules/translations/translations.service.spec.ts)) et mise à jour de [`users.service.spec.ts`](file:///d:/work/workspaces/dori/dori-api/src/modules/users/users.service.spec.ts).
- **Reste à faire :** rien pour ce point.

### [x] WEBHOOK-001 — Durcir la vérification HMAC

- **État vérifié : corrigé.** Signature calculée sur le raw body et le timestamp, fenêtre temporelle configurable, comparaison `timingSafeEqual` et événement anti-rejeu.
- **Tests présents :** signature, ancien timestamp et rejeu.
- **Reste à faire :** les tests HTTP sur raw body réel relèvent de TEST-002.

### [x] WEBHOOK-002 — Lier l'accusé au fournisseur

- **État vérifié : corrigé.** La mise à jour cible `(provider, provider_message_id)` et l'événement anti-rejeu est également partitionné par fournisseur.
- **Tests repository présents :** fournisseur correct et message manquant.
- **Reste à faire :** rien pour ce point.

### [x] WORKER-001 — Réserver atomiquement les notifications

- **État vérifié : corrigé.** Claim transactionnel avec `FOR UPDATE SKIP LOCKED`, statut `processing`, lease et récupération des traitements abandonnés.
- **Tests présents :** normalisation des retours `UPDATE ... RETURNING`.
- **Reste à faire :** test concurrent PostgreSQL réel dans TEST-001/TEST-002.

### [ ] WORKER-002 — Remplacer le faux envoi

- **État vérifié : toujours ouvert.** `NotificationWorker` génère un faux identifiant `msg_*`, puis `markDelivered` stocke `provider = 'simulation'` sans appel externe.
- **Risque :** une notification est annoncée livrée alors qu'aucun SMS/e-mail n'a été envoyé.
- **Décision requise :** choisir les fournisseurs SMS et e-mail, leurs credentials, timeouts, statuts et politique de retry.
- **Correction recommandée :** interface `NotificationProvider`, adaptateurs par canal, idempotency key, séparation `sent`/`delivered`, mapping explicite des erreurs temporaires/définitives.
- **Tests requis :** succès fournisseur, timeout, retry, erreur définitive et webhook de livraison.

### [x] REG-001 — Transactionnaliser la création d'inscription

- **État vérifié : corrigé.** Personne, capacité, compteur, inscription et données associées partagent `RegistrationsRepository.transaction`.
- **Reste à faire :** uniquement le test PostgreSQL d'échec injecté et rollback réel dans TEST-001/TEST-002.

### [x] REG-002 — Sérialiser la capacité de rendez-vous

- **État vérifié : corrigé.** Verrou advisory transactionnel par file/créneau avant comptage et insertion/replanification.
- **Reste à faire :** prouver la concurrence avec deux connexions PostgreSQL réelles dans TEST-001/TEST-002.

### [x] REG-003 — Canoniser les instants des créneaux

- **État vérifié : corrigé.** Les heures locales sont converties par `ClockService`, puis stockées/comparées comme instants UTC ; la date métier est calculée dans le fuseau du site.
- **Reste à faire :** compléter les e2e DST dans TEST-002.

### [x] QUEUE-001 — Gérer les conflits de sessions concurrentes

- **État vérifié : corrigé.** Contraintes uniques traduites en erreurs métier et takeover protégé par transaction et `FOR UPDATE`.
- **Reste à faire :** test concurrent réel de deux ouvertures/takeovers dans TEST-001/TEST-002.

### [x] WS-001 — Réutiliser la politique d'authentification HTTP en WebSocket

- **État vérifié : corrigé.** `RealtimeGateway` vérifie le JWT puis appelle `JwtStrategy.validate`; la session liée est donc contrôlée comme en HTTP.
- **Reste à faire :** ajouter un test gateway avec session révoquée dans TEST-001.

### [x] WS-002 — Aligner le CORS WebSocket sur HTTP

- **État vérifié : corrigé.** La même liste `cors.allowedOrigins` est fournie à `enableCors` et `ConfiguredIoAdapter`.
- **Reste à faire :** la lecture directe de `VERCEL` dans `main.ts` relève de CORE-004.

### [x] RT-001 — Brancher la couche temps réel factorisée

- **État vérifié : corrigé.** Émissions centralisées pour opérations de file, affichage public, suivi d'inscription et invalidation des traductions.
- **Sécurité présente :** `emitQueueDisplay` filtre les données personnelles.
- **Reste à faire :** tests unitaires/e2e des rooms et payloads dans TEST-001.

### [x] AUTHZ-001 — Invalider les autorisations lors des changements RBAC

- **État vérifié : corrigé.** Affectation/retrait de rôle et remplacement des permissions révoquent les sessions concernées et invalident le cache de scope.
- **Reste à faire :** test d'intégration avec un ancien JWT dans TEST-001/TEST-002.

### [x] USER-001 — Transactionnaliser les mutations utilisateur

- **État vérifié : corrigé.** Création avec rôle, statut avec révocation, changement de mot de passe, rôle et suppression utilisent des transactions lorsque plusieurs écritures doivent réussir ensemble.
- **Reste à faire :** la relocalisation des règles métier hors repository appartient à ARCH-001.

### [x] USER-002 — Valider exhaustivement rôles et permissions

- **État vérifié : corrigé.** Rôle actif vérifié sous transaction ; permissions demandées dédupliquées et toute permission inconnue provoque `PERMISSION_NOT_FOUND`.
- **Reste à faire :** rien fonctionnel pour ce point.

### [x] PERSON-001 — Ne pas exposer la déduplication hors scope

- **État vérifié : corrigé.** `dori_person.site_id` est obligatoire ; recherche et déduplication téléphone/e-mail sont filtrées par site.
- **Base vérifiée :** index actifs uniques par site et trigger interdisant de relier une personne à une file d'un autre site.
- **Validation métier :** nom et téléphone obligatoires dans le DTO et le schéma.
- **Reste à faire :** rien pour ce point.

### [x] RESET-001 — Créer atomiquement le marqueur de reset

- **État vérifié : corrigé.** `dori_queue_daily_reset`, advisory lock transactionnel et `ON CONFLICT DO NOTHING` garantissent un marqueur unique.
- **Reste à faire :** test multi-connexion réel dans TEST-002.

### [x] RESET-002 — Découpler le reset du compteur de tickets

- **État vérifié : corrigé.** Le marqueur dédié remplace le compteur ; le reset traite explicitement `waiting` et `booked` selon le mode de report.
- **Reste à faire :** rien fonctionnel pour ce point.

### [x] WORKER-003 — Coordonner les cron jobs entre instances

- **État vérifié : corrigé.** Reset et expiration utilisent des advisory locks PostgreSQL ; les notifications utilisent `SKIP LOCKED` et une lease.
- **Note :** les booléens locaux restent une optimisation intra-processus, pas le mécanisme distribué principal.
- **Reste à faire :** preuve multi-instance réelle dans TEST-002.

### [x] TRANS-001 — Atomiser traduction et version

- **État vérifié : corrigé.** Mutation et incrément de version partagent une transaction ; l'événement realtime est émis après retour de transaction.
- **Reste à faire :** déplacer le callback de validation hors repository dans ARCH-001 et ajouter des tests de rollback dans TEST-001.

### [ ] DB-002 — Vérifier le certificat PostgreSQL

- **État vérifié : ouvert volontairement.** Lorsque SSL est actif, `DatabaseModule` utilise `{ rejectUnauthorized: false }`.
- **Contexte :** le durcissement précédent a été annulé parce que la base actuelle présente une chaîne auto-signée.
- **Décision requise :** obtenir la CA Aiven/du fournisseur ou un certificat publiquement approuvé.
- **Correction recommandée :** configuration `database.sslCa`, chargement via `ConfigService`, `rejectUnauthorized: true` hors mode local explicitement autorisé.
- **Test requis :** CA incorrecte refusée et CA attendue acceptée.

### [x] VAL-001 — Valider `limit` avec les pipes communs

- **État vérifié : corrigé.** `LimitQueryDto` centralise transformation, entier, minimum 1 et maximum 100 via le `ValidationPipe` global.
- **Tests présents :** zéro, négatif, décimal, dépassement et texte invalide.
- **Reste à faire :** rien pour ce point.

### [x] PAG-001 — Centraliser la pagination

- **État vérifié : corrigé.** `PaginationDto` centralise paramètres, offset, tri allowlisté et contrat `createResponse`; l'ancien helper mort n'existe plus.
- **Contrôle :** aucune construction manuelle de `totalPages` dans les services.
- **Reste à faire :** certaines requêtes interpolent encore `LIMIT/OFFSET` après validation ; acceptable fonctionnellement, mais une liaison SQL uniforme peut être faite lors d'un durcissement futur.

### [ ] TEST-001 — Couvrir les chemins critiques et concurrents

- **État vérifié : progression réelle mais insuffisante.** 31 suites et 136 tests passent.
- **Couverture actuelle :** 24,86 % statements, 30,25 % branches, 27,94 % fonctions, 24,19 % lignes.
- **Zones à 0 % ou presque :** bootstrap/AppModule, health, realtime gateway/repository, global exception filter, translations, plusieurs contrôleurs et repositories métier.
- **Priorité de tests :** rotation refresh concurrente, workers multi-instance, capacité RDV, takeover de guichet, filtre d'erreurs, rooms WebSocket, health et transactions traductions.
- **Reste à faire :** définir des seuils progressifs par zone critique ; ne pas fermer sur le seul nombre global de tests.

### [ ] TEST-002 — Isoler l'environnement e2e

- **État vérifié : toujours ouvert.** `test/app.e2e-spec.ts` importe `AppModule` et utilise donc la configuration PostgreSQL réelle si elle est présente.
- **Risque :** test lent/non déterministe et possibilité de toucher une base partagée.
- **Décision requise :** PostgreSQL CI natif, Docker/Testcontainers ou autre instance éphémère autorisée.
- **Reste à faire :** `.env.test`, schéma neuf par exécution, seed minimal, timeout/retries courts et teardown garanti.

### [x] QUAL-001 — Maintenir des quality gates non mutantes

- **État vérifié : corrigé (2026-10-06).** `.gitattributes` a été créé pour forcer `eol=lf` de manière uniforme sur Git, et `.prettierrc` explicite `endOfLine: 'lf'`. Tous les fichiers ont été normalisés une fois.
- **Résultat vérifié :** `npm run format:check` et `npm run lint` (avec `--max-warnings=0`) passent avec 0 erreur.
- **Quality check global :** `npm run quality:check` (format, lint, typecheck, build:check et tests) réussit avec le code de sortie 0 sans modifier le worktree.
- **Reste à faire :** rien pour ce point.

### [x] CORE-001 — Utiliser des imports Nest explicites

- **État vérifié : corrigé.** Aucun `@Global()` ni `ConfigModule` global ; chaque module importe explicitement les modules fournissant ses dépendances.
- **Validation :** compilation complète réussie après ajout des repositories JWT, realtime et health.
- **Reste à faire :** rien pour ce point.

### [x] CORE-002 — Utiliser les décorateurs Swagger centralisés

- **État vérifié : corrigé (2026-10-06).** Le décorateur `ApiDoriNotModifiedResponse` a été ajouté dans `src/core/swagger/api-dori-response.decorator.ts`. `translations.controller.ts` l'utilise désormais pour la réponse 304 de l'endpoint bundle et n'importe plus `ApiResponse` directement.
- **Tests de non-régression :** `src/core/swagger/api-dori-response.decorator.spec.ts` valide les métadonnées de la réponse 304 et intègre un scan architectural garantissant qu'aucun contrôleur métier n'importe de décorateur de réponse natif Swagger.
- **Reste à faire :** rien pour ce point.

### [x] CORE-003 — Centraliser la sérialisation mécanique

- **État vérifié : corrigé.** `SerializationInterceptor` est global et assure snake_case → camelCase, dates ISO et retrait des champs sensibles.
- **Mappings conservés légitimement :** compositions métier, héritage site/file, agrégats KPI et objets imbriqués.
- **Tests présents :** objets/tableaux imbriqués, dates, casse et champs sensibles.
- **Reste à faire :** renforcer les tests HTTP de contrat dans TEST-001.

### [x] CORE-004 — Faire de `ConfigService` l'unique accès à l'environnement

- **État vérifié : corrigé (2026-10-06).** `process.env` est strictement cantonné à `src/core/config/configuration.ts`.
- **Modifications apportées :**
  - Ajout de la clé `platform.isVercel` dans `src/core/config/configuration.ts`.
  - Suppression de tout accès direct à `process.env` dans `src/main.ts` : la détection Vercel (pour le bootstrap sans `listen` et l'exportation du handler serveur) interroge `configService.get<boolean>('platform.isVercel')`.
  - Ajout d'un test unitaire dans `src/core/config/configuration.spec.ts` pour la clé `platform.isVercel`.
  - Ajout d'un test architectural de non-régression dans `src/main.spec.ts` validant qu'aucun appel à `process.env` n'est présent dans `src/main.ts`.
- **Reste à faire :** rien pour ce point.

## Matrice finale des composants core

| Composant | État vérifié | Observation |
| --- | --- | --- |
| Configuration | Conforme | Centralisée via `ConfigService` (`platform.isVercel` inclus), sans accès direct dans `main.ts`. |
| Horloge | Conforme | Centralisée via `ClockService` partout, aucun `NOW()` SQL résiduel. |
| Pagination | Conforme | DTO central utilisé pour validation, tri et réponses. |
| Erreurs | Conforme, tests incomplets | Contrat central actif ; ajouter des tests directs du filtre. |
| Swagger | Conforme | Réponses documentées via les décorateurs core (dont 304 Not Modified). |
| Sérialisation/réponse | Conforme | Intercepteurs globaux enregistrés dans `AppModule`. |
| Persistance | Conforme | Couche repository 100 % pure (SQL/DataSource), règles métier, sécurité et orchestration isolées dans les services. |
| RBAC | Conforme | Guard, scope et invalidation des sessions/cache branchés. |
| Realtime | Conforme, tests incomplets | Auth HTTP réutilisée, CORS commun et émissions centralisées. |
| Validation | Conforme | Pipe global, identifiants positifs et DTOs communs. |

## Décisions utilisateur encore nécessaires

1. **WORKER-002 :** fournisseurs SMS et e-mail, contrats, credentials et stratégie de retry.
2. **DB-002 :** CA/certificat PostgreSQL à utiliser et politique autorisée en local.
3. **TEST-002 :** runtime PostgreSQL éphémère disponible en CI.

Tous les autres travaux ouverts peuvent être réalisés sans nouvelle décision fonctionnelle.

<!-- CHECKPOINT id="ckpt_mux4nwco_0sml2j" time="2026-10-06T20:24:57.480Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux50rbk_fgqxou" time="2026-10-06T20:34:57.488Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux5dmah_dihv1x" time="2026-10-06T20:44:57.497Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux5qh9h_a585ln" time="2026-10-06T20:54:57.509Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux63c8c_ra41tn" time="2026-10-06T21:04:57.516Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux6g776_50cbz8" time="2026-10-06T21:14:57.522Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux6t25z_q5rmac" time="2026-10-06T21:24:57.527Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux75x4z_r2m9bf" time="2026-10-06T21:34:57.539Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux7is41_vcdj4j" time="2026-10-06T21:44:57.553Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux7vn30_6yf24s" time="2026-10-06T21:54:57.564Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux88i1s_w4rruv" time="2026-10-06T22:04:57.568Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
