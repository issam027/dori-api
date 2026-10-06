# Audit technique de `src`

> Audit incrémental. Chaque point ci-dessous a été vérifié dans le code. Les références de lignes sont à revalider après modification.

## Mode d'emploi

- **P0** : vulnérabilité ou corruption/perte de données possible ; corriger avant mise en production.
- **P1** : défaut fonctionnel, de fiabilité ou d'architecture important ; corriger rapidement.
- **P2** : dette de conception/maintenabilité ou incohérence notable.
- **P3** : amélioration ciblée à faible risque.
- Pour chaque point : partir du correctif proposé, ajouter un test de non-régression, puis cocher la case.

## Synthèse

| ID          | Priorité | Zone                 | Constat                                                                                                     |
| ----------- | -------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| BOOT-001    | Corrigé  | Bootstrap            | Diagnostic temporaire supprimé.                                                                             |
| SEC-001     | Corrigé  | JWT                  | Secret obligatoire et validé.                                                                               |
| SEC-002     | Corrigé  | JWT                  | `sid` et session liée obligatoires.                                                                         |
| AUTH-001    | Corrigé  | Auth                 | Cookie refresh parsé et durée centralisée.                                                                  |
| CFG-001     | Corrigé  | Configuration        | Validation fail-fast au bootstrap.                                                                          |
| DB-001      | Corrigé  | Base                 | Échec schema/seed bloquant.                                                                                 |
| TIME-001    | Corrigé  | Temps                | Horloge métier centralisée.                                                                                 |
| TIME-002    | Corrigé  | Temps                | Conversion IANA/DST fiable.                                                                                 |
| ERR-001     | Corrigé  | Erreurs              | Contrat public contrôlé et homogène.                                                                        |
| ARCH-001    | Corrigé  | Persistance          | SQL encapsulé dans des repositories typés ; services et composants d'orchestration sans accès DB direct.     |
| WEBHOOK-001 | Corrigé  | Notifications        | HMAC raw body, fenêtre temporelle et anti-rejeu.                                                            |
| WEBHOOK-002 | Corrigé  | Notifications        | Accusé lié au fournisseur et contrôlé.                                                                      |
| WORKER-001  | Corrigé  | Notifications        | Claim atomique avec lease et `SKIP LOCKED`.                                                                 |
| WORKER-002  | P1       | Notifications        | Livraison simulée comme succès en production.                                                               |
| REG-001     | Corrigé  | Inscriptions         | Création transactionnelle complète.                                                                         |
| REG-002     | Corrigé  | Rendez-vous          | Capacité sérialisée par créneau.                                                                            |
| REG-003     | Corrigé  | Disponibilités       | Instants canoniques UTC depuis le fuseau du site.                                                           |
| QUEUE-001   | Corrigé  | Sessions             | Conflits mappés et takeover verrouillé.                                                                     |
| WS-001      | Corrigé  | WebSocket            | Même validation session que HTTP.                                                                           |
| WS-002      | Corrigé  | WebSocket            | Allowlist CORS commune.                                                                                     |
| RT-001      | Corrigé  | Temps réel           | Émissions métier centralisées branchées.                                                                    |
| AUTHZ-001   | Corrigé  | RBAC                 | Sessions révoquées lors des changements d'autorisation.                                                     |
| USER-001    | Corrigé  | Utilisateurs         | Mutations multi-écritures transactionnelles.                                                                |
| USER-002    | Corrigé  | Rôles                | Ressources et permissions validées exhaustivement.                                                          |
| PERSON-001  | P1       | Données personnelles | Corrigé : une personne et sa déduplication sont strictement rattachées à un site.                           |
| RESET-001   | Corrigé  | Worker quotidien     | Marqueur dédié et atomique.                                                                                 |
| RESET-002   | Corrigé  | Worker quotidien     | Reset découplé des compteurs.                                                                               |
| WORKER-003  | Corrigé  | Workers              | Coordination PostgreSQL distribuée.                                                                         |
| TRANS-001   | Corrigé  | Traductions          | Mutation/version atomiques et événement après commit.                                                       |
| DB-002      | P1       | TLS PostgreSQL       | Réouvert : chaîne auto-signée autorisée à la demande pour la base actuelle.                                 |
| VAL-001     | P2       | Validation           | Corrigé : `limit` passe par le DTO core et le `ValidationPipe` global.                                      |
| PAG-001     | P3       | Pagination           | Corrigé : construction des réponses centralisée dans `PaginationDto`.                                       |
| TEST-001    | P1       | Tests                | Couverture globale \~14% et zones critiques non testées.                                                    |
| TEST-002    | P1       | E2E                  | Le test e2e dépend d'une base externe et échoue sans environnement réseau/DB.                               |
| QUAL-001    | P2       | Qualité              | Corrigé : gates non mutantes centralisées dans `quality:check`.                                             |
| CORE-001    | Corrigé  | Modules Nest         | Les dépendances core sont désormais non globales et importées explicitement par chaque module consommateur. |
| CORE-002    | Corrigé  | Swagger              | Les réponses Swagger standard et publiques passent désormais par les décorateurs core.                      |
| CORE-003    | Corrigé  | Sérialisation        | Les conversions mécaniques de sortie passent désormais par `SerializationInterceptor`.                      |
| CORE-004    | Corrigé  | Configuration        | `ConfigService` est désormais l'unique accès à la configuration hors du chargeur core.                      |

## Constats détaillés

### \[x\] BOOT-001 — Retirer le diagnostic temporaire `pg` du chemin de démarrage

- **Preuve :** `src/main.ts:1-9` exécute un `require('pg/package.json')` dans un `try/catch` et appelle `console.log`/`console.error` avant les imports applicatifs.
- **Impact :** bruit dans les logs, contournement du logger Nest/Winston et exposition inutile de la version exacte du driver ; ce code explicitement marqué temporaire reste exécuté en production.
- **Correction :** supprimer entièrement ce bloc. Si un contrôle du driver est encore nécessaire, le déplacer dans un script de diagnostic explicite ou dans un health check sans divulguer sa version.
- **Validation :** démarrer l'application et vérifier l'absence des messages `pg OK` / `pg FAILED` ; conserver un test de démarrage ou de health check.
- **Résolution (2026-10-05) :** suppression complète du `require('pg/package.json')` et des écritures console précédant Nest. Le bootstrap commence désormais directement par la création de l'application.

### \[x\] SEC-001 — Supprimer le secret JWT de secours

- **Preuve :** `configuration.ts:50`, `jwt.strategy.ts:24` et `auth.module.ts:19` retombent sur `change-me-in-production`.
- **Impact :** sans variable injectée, un tiers connaissant le dépôt peut signer des JWT.
- **Correction :** secret obligatoire et suffisamment long hors test/local ; lecture centralisée via `getOrThrow`.
- **Validation :** le démarrage production échoue sans secret ; une fausse clé est rejetée.
- **Résolution (2026-10-05) :** suppression de toutes les valeurs de secours JWT. `JWT_SECRET` doit contenir au moins 32 caractères et `JwtModule`/`JwtStrategy` utilisent `ConfigService.getOrThrow`.

### \[x\] SEC-002 — Rendre `sid` obligatoire dans les JWT

- **Preuve :** `jwt.strategy.ts:43-57` accepte un token sans `sid` dès qu'une session quelconque du même utilisateur est active.
- **Impact :** révoquer la session émettrice ne révoque pas ce token si une autre session subsiste.
- **Correction :** versionner les tokens et supprimer rapidement le fallback ; ne jamais rattacher un token à une session arbitraire.
- **Validation :** session A révoquée + B active : le token A sans `sid` doit être refusé.
- **Résolution (2026-10-05) :** `sid` est obligatoire dans `JwtPayload`; le fallback recherchant une session arbitraire a été supprimé. La stratégie vérifie conjointement session, propriétaire du token, expiration, révocation et compte actif. Tests dédiés avec ancien token sans `sid` et session liée.

### \[x\] AUTH-001 — Rendre le refresh par cookie fonctionnel

- **Preuve :** `auth.controller.ts:87` lit `req.cookies`, mais aucun middleware/dépendance `cookie-parser` n'existe.
- **Impact :** le cookie HttpOnly posé n'est jamais lu ; le client doit exposer le token dans le body contrairement à la documentation.
- **Correction :** configurer un parseur (éventuellement cookie signé), ou retirer cette stratégie. Aligner aussi `maxAge` sur la durée configurée plutôt que 30 jours codés en dur.
- **Validation :** e2e login puis refresh avec le cookie seul.
- **Résolution (2026-10-05) :** ajout et enregistrement global de `cookie-parser` avec ses types. Le contrôleur peut désormais lire le cookie HttpOnly ; ses options restent centralisées et alignées sur `refreshTokenExpiresInDays`.
- **Correctif runtime (2026-10-05) :** utilisation de l'import CommonJS `import cookieParser = require('cookie-parser')`, compatible avec la compilation CommonJS du projet et Node.js 22; suppression de l'appel invalide à l'export `.default`.

### \[x\] CFG-001 — Valider la configuration au bootstrap

- **Preuve :** `configuration.ts` accepte `parseInt` invalide, un secret sensible par défaut et ignore une `DATABASE_URL` non parsable ; `ConfigModule` n'a pas de validation.
- **Impact :** erreurs tardives et démarrage dans une configuration dangereuse.
- **Correction :** schéma Joi/Zod ou validateur dédié, valeurs obligatoires selon environnement, bornes numériques et `getOrThrow`.
- **Validation :** tests avec valeurs absentes, invalides et hors plage.
- **Résolution (2026-10-05) :** ajout d'un validateur fail-fast branché sur `ConfigModule.forRoot`. Il contrôle secret JWT, ports, durée refresh et URL PostgreSQL. Les erreurs de parsing ne sont plus ignorées. Tests couvrant valeurs absentes, invalides et hors bornes.

### \[x\] DB-001 — Ne pas avaler l'échec du schema/seed

- **Preuve :** `database-seed.service.ts:35-38` journalise toute erreur puis retourne normalement.
- **Impact :** avec `AUTO_RUN_MIGRATIONS=true`, l'API peut démarrer sur un schéma partiel.
- **Correction :** relancer l'erreur ; à terme utiliser des migrations versionnées et réserver le seed aux environnements explicitement permis.
- **Validation :** SQL invalide ⇒ bootstrap en échec.
- **Résolution (2026-10-05) :** `DatabaseSeedService` journalise toujours le contexte mais relance maintenant l'exception ; avec l'initialisation automatique activée, un schéma ou seed en échec bloque le bootstrap.

### \[x\] TIME-001 — Faire respecter l'horloge injectée

- **Preuve :** `clock.service.ts:5` interdit `new Date()` ailleurs, mais les services auth/registrations/queue-engine, workers et gateway l'utilisent directement.
- **Impact :** règles temporelles non reproductibles et tests fragiles.
- **Correction :** ajouter à `ClockService` les conversions/additions utiles et remplacer les usages représentant « maintenant » ou des délais.
- **Validation :** tests à horloge figée des expirations, tolérances, sessions et workers.
- **Résolution (2026-10-05) :** `ClockService` centralise désormais parsing, additions, dates relatives et conversions zonées. Les services auth, inscriptions, queues, moteur, gateway et workers ne construisent plus localement les instants métier ni n'utilisent `CURRENT_TIMESTAMP`; ils passent l'heure injectée aux requêtes.

### \[x\] TIME-002 — Corriger la fin de journée locale

- **Preuve :** `clock.service.ts:59-80` crée une date sans zone, donc dans le TZ du processus, puis reconstruit manuellement un offset ; le contrat annonce `.999` mais produit la seconde entière.
- **Impact :** expiration décalée selon le serveur et autour des transitions DST.
- **Correction :** utiliser `date-fns-tz` déjà installé pour convertir explicitement `23:59:59.999` du fuseau IANA vers UTC.
- **Validation :** Berlin/New York, zone sans DST et jours de bascule.
- **Résolution (2026-10-05) :** remplacement du calcul manuel par `date-fns-tz.fromZonedTime` sur `23:59:59.999`. Tests dédiés Europe/Berlin, America/New_York, Africa/Tunis et jours de bascule DST.

### \[x\] ERR-001 — Unifier les erreurs publiques

- **Preuve :** `global-exception.filter.ts:71-78` renvoie `code: ERROR`, `translationKey: null` et parfois `exRes` brut ; `INTERNAL_ERROR` n'est pas dans `ERROR_CATALOG`; la normalisation validation est dupliquée.
- **Impact :** contrat client hétérogène et détails internes potentiellement exposés.
- **Correction :** cataloguer les codes transverses, mapper explicitement les exceptions Nest, ne publier qu'une structure contrôlée et centraliser la validation.
- **Validation :** tests du filtre pour 400/401/403/404/409/429/500.
- **Résolution (2026-10-05) :** ajout des erreurs transverses manquantes au catalogue et mapping explicite des statuts Nest vers le contrat Dori. Les réponses inconnues et erreurs 500 ne republient plus `HttpException.getResponse()`; la normalisation validation reste uniquement dans `DoriException`/le chemin `ValidationPipe`.

### \[x\] ARCH-001 — Homogénéiser la persistance

- **Preuve :** `entities.ts` centralise 21 entités, mais les services injectent presque tous `DataSource` et manipulent des résultats `any` issus de SQL brut.
- **Impact :** double modèle entités/schema, renommages non typés et duplication pagination/CRUD.
- **Correction :** repositories typés pour CRUD ; QueryBuilder/SQL complexe encapsulé dans des repositories avec types de lignes. Supprimer ensuite les abstractions réellement inutilisées.
- **Validation :** aucune ligne DB non typée dans les services ; tests PostgreSQL des requêtes.
- **Décision requise :** ce point implique une migration architecturale de l'ensemble des modules entre repositories TypeORM et repositories SQL typés, avec stratégie de livraison progressive. Il reste ouvert pour éviter une réécriture massive mêlée aux correctifs de sécurité sans validation de cette trajectoire.
- **Décision validée (2026-10-06) :** architecture hybride avec repositories applicatifs typés. Le CRUD simple utilisera les repositories/QueryBuilder TypeORM ; les CTE, verrous et opérations PostgreSQL spécialisées restent en SQL mais sont encapsulés dans un repository de domaine. Les services ne doivent conserver que l'orchestration et les règles métier ; les transactions sont portées ou transmises via `EntityManager`.
- **Avancement (2026-10-06) :** migration pilote du module `sites` vers `SitesRepository`. Le service ne contient plus aucun SQL ni dépendance à `DataSource`, les lignes retournées sont typées, et la désactivation du site avec ses files est désormais atomique dans une transaction. Les tests du service utilisent le contrat du repository plutôt que des correspondances sur les chaînes SQL. Le point reste ouvert jusqu'à migration des autres modules et activation du garde-fou architectural global.
- **Avancement (2026-10-06, lot reports) :** les quatre accès SQL de `ReportsService` ont été déplacés dans `ReportsRepository` avec des types de lignes explicites et un contrat `ReportScope`. La traduction des scopes site/file en filtres SQL appartient désormais au repository ; le service conserve seulement les autorisations et les calculs de KPI. Aucun SQL, `DataSource` ou `EntityManager` ne subsiste dans `ReportsService`. Typecheck, 13 tests reports et build isolé réussis.
- **Avancement (2026-10-06, lot translations) :** les lectures, la pagination et les mutations ont été déplacées dans `TranslationsRepository` avec des lignes typées. Création, mise à jour/suppression verrouillée et incrément de version restent atomiques ; l'invalidation realtime reste déclenchée par le service après commit. `TranslationsService` ne contient plus de SQL ni de dépendance TypeORM. Prettier, ESLint, typecheck et build isolé réussis.
- **Avancement (2026-10-06, lot persons) :** toute la persistance des personnes et de leurs notes a été déplacée dans `PersonsRepository`, avec contrats de lignes et paramètres de requêtes typés. `PersonsService` ne contient plus de SQL ni de dépendance à `DataSource` et conserve uniquement les contrôles de scope, les règles de déduplication par site et l'orchestration métier. La désactivation d'une personne et de ses notes s'exécute désormais dans une transaction unique. Le module enregistre explicitement le repository et les tests du service ciblent son contrat. Test ciblé (5 tests), Prettier, ESLint, typecheck et build réussis.
- **Avancement (2026-10-06, lot notifications) :** les recherches paginées, lectures, créations manuelles, remises en attente, écritures de seuil et traitement transactionnel des webhooks ont été déplacés dans `NotificationsRepository`, avec types de lignes explicites. `NotificationsService` ne contient plus de SQL ni de dépendance TypeORM. L'idempotence des notifications de seuil repose désormais directement sur l'upsert PostgreSQL atomique au lieu d'un couple lecture puis insertion sujet à concurrence. Les tests séparent règles métier/HMAC et contrat SQL du repository, notamment le rattachement `(provider, provider_message_id)` et l'anti-rejeu. Le repository est enregistré explicitement dans le module.
- **Avancement (2026-10-06, lot RBAC scope) :** les lectures de sites et files autorisés ont été extraites de `ScopeService` vers `ScopeRepository`, avec conversion typée des identifiants SQL. Le service transversal ne conserve que la composition des scopes, le cache et les décisions d'accès ; il ne contient plus de SQL ni de dépendance `DataSource`. Le repository est privé au `RbacModule` et enregistré explicitement.
- **Validation du lot (2026-10-06) :** `quality:check` complet réussi avec 21 suites et 102 tests. Le point reste ouvert pour `service-tiers`, `queues`, `registrations`, `queue-engine`, `users` et `auth`, ainsi que les accès de persistance techniques encore présents hors services métier.
- **Avancement (2026-10-06, lot service-tiers 1/2) :** création de `ServiceTiersRepository` et migration complète du catalogue des niveaux ainsi que des rattachements file–niveau (lecture paginée, détail, création, modification, désactivation, devise par défaut et upsert). Les paramètres dynamiques de pagination sont désormais liés, les lignes sont typées et les mises à jour dynamiques sont centralisées dans le repository. Le repository est enregistré explicitement dans le module. Le service conserve encore la persistance des règles de notification : ce lot est donc volontairement noté partiel et `service-tiers` reste dans le périmètre ouvert jusqu'au lot 2/2. Test ciblé (3 tests) et typecheck réussis.
- **Avancement (2026-10-06, lot service-tiers 2/2 terminé) :** les lectures paginées et exhaustives, la création, la lecture verrouillée par identité, la modification et la désactivation des règles de notification ont été déplacées dans `ServiceTiersRepository`. Les lignes de règles sont explicitement typées et les colonnes de tri restent limitées par `PaginationDto`. `ServiceTiersService` ne contient désormais plus aucun SQL, accès `DataSource` ou résultat `any` ; il conserve les contrôles de scope, invariants système et validations de règles. Test ciblé (3 tests) et typecheck réussis. `service-tiers` sort du périmètre restant d'`ARCH-001`, qui demeure ouvert pour `queues`, `registrations`, `queue-engine`, `users` et `auth`, ainsi que les accès techniques hors services métier.

- **Avancement (2026-10-06, lot registrations terminé) :** toute la persistance de `RegistrationsService`, y compris les transactions de création et de replanification, les verrous de capacité, la pagination et les recherches publiques, est encapsulée dans `RegistrationsRepository` avec des contrats de lignes typés. Le service ne dépend plus de `DataSource` et ne contient plus de SQL. Dans le même lot, le domaine et le schéma ont été unifiés sous `registration` (`dori_registration`, `registration_id`, `registrationId`) dans les DTOs, entités, notifications, moteur de file, permissions et événements temps réel. `registrations` sort du périmètre restant d'ARCH-001, qui demeure ouvert pour `queues`, `queue-engine`, `users` et `auth`, ainsi que les accès techniques hors services métier.
- **Validation du lot registrations (2026-10-06) :** `quality:check` complet réussi (22 suites, 109 tests), sans erreur de format, lint, typage ou build. La base Aiven `dori-dev` a ensuite été réinitialisée avec `--force --seed` : le schéma `public` a été supprimé/recréé, `schema.sql` et `seed.sql` ont été appliqués avec succès. La base repart donc exclusivement avec `dori_registration` et `registration_id`, sans table héritée de l'ancien vocabulaire.
- **Durcissement SQL typé (2026-10-06) :** la création d'un site caste désormais explicitement en `time` les cinq paramètres horaires utilisés dans des `COALESCE`. Cela corrige l'erreur PostgreSQL `time without time zone` contre `text` observée en production. Un test de contrat du repository protège les cinq casts. L'audit des accès existants n'a trouvé aucun autre `COALESCE` heure/texte dans `src`; les insertions de file utilisent des paramètres directement contextualisés par leurs colonnes `TIME`. Cette correction renforce le lot `sites` mais ne ferme pas ARCH-001 : `queues`, `queue-engine`, `users`, `auth` et les workers restent à migrer.
- **Avancement (2026-10-06, lot worker notifications) :** les requêtes de claim, livraison et échec ont été extraites de `NotificationWorker` vers `NotificationWorkerRepository`, avec un contrat de ligne explicite. Le repository normalise les deux formes rencontrées pour `UPDATE ... RETURNING` (`rows` et tuple TypeORM `[rows, affectedCount]`), ce qui corrige les logs et mises à jour utilisant des identifiants, canaux et destinataires `undefined`. Le worker ne contient plus de SQL ni de dépendance `DataSource`. Tests du worker et du repository ajoutés ; les workers `daily-reset` et `appointment-expiry` restent dans le périmètre ARCH-001.
- **Avancement (2026-10-06, lot worker expiration des rendez-vous) :** le verrou transactionnel et l'expiration SQL ont été déplacés dans `AppointmentExpiryRepository`, avec un contrat explicite pour les inscriptions expirées. `AppointmentExpiryWorker` ne dépend plus de TypeORM et ne contient plus de SQL. La normalisation de `RETURNING` a été factorisée dans le core et est partagée avec le worker de notifications, afin de traiter uniformément les retours directs et tuples TypeORM. Les scénarios verrou acquis/refusé et la délégation du worker sont testés. Seul `daily-reset` reste à migrer parmi les workers.
- **Avancement (2026-10-06, lot workers terminé) :** la sélection des files et toute la transaction de remise à zéro quotidienne ont été déplacées dans `DailyResetRepository`. Le worker conserve uniquement le calcul dans le fuseau de la file et l'orchestration. Les dates passées au SQL sont explicitement castées en `date`, les verrous et marqueurs idempotents utilisent la normalisation `RETURNING` commune, et les modes avec/sans report restent atomiques. Les trois workers ne contiennent désormais plus ni SQL ni dépendance `DataSource`; le sous-périmètre workers d'ARCH-001 est fermé. Tests de verrou, idempotence et typage SQL ajoutés.
- **Préparation du lot queues (2026-10-06) :** l'inventaire du service confirme que CRUD, statut, affichage, reset et affectations opérateur doivent être séparés en contrats de repository cohérents. Avant extraction, les cinq paramètres `TIME` de l'INSERT de file (`working_hours_start/end`, pauses et `daily_reset_time`) ont été explicitement castés afin d'empêcher l'inférence `text` rencontrée sur les sites. Le module `queues` reste ouvert dans ARCH-001 tant que l'extraction complète n'est pas terminée.
- **Avancement (2026-10-06, lot queues 1) :** création de `QueuesRepository` et extraction de la lecture détaillée active avec toute la configuration de site nécessaire au calcul d'héritage. Le repository est enregistré explicitement dans `QueuesModule`; `findQueueById` ne contient plus de SQL et dépend de ce contrat. Le mapping métier des valeurs effectives reste dans le service. Compilation et tests ciblés réussis. Le lot demeure partiel : liste, mutations et vues opérationnelles utilisent encore directement `DataSource`.
- **Avancement (2026-10-06, lot queues 2) :** la liste filtrée et paginée a rejoint `QueuesRepository`. Le service ne compose plus de SQL : il traduit seulement le scope RBAC en identifiants de sites ou de files. Filtres, comptage, recherche et pagination sont encapsulés ; tableaux d'identifiants, `LIMIT` et `OFFSET` sont explicitement liés et le tri reste issu de l'allowlist commune. Test repository ajouté pour le scope, la recherche et les paramètres de pagination. Le lot reste ouvert pour les mutations et vues opérationnelles.
- **Avancement (2026-10-06, lot queues 3) :** la vérification du site, la création de la file et l'association du forfait gratuit sont désormais regroupées dans une transaction de `QueuesRepository`. La création ne peut donc plus laisser une file partiellement initialisée. Les cinq paramètres horaires sont explicitement castés en `time` dans la nouvelle requête encapsulée. `QueuesService.createQueue` ne contient plus de SQL et recharge la représentation publique via le repository. Test transactionnel ajouté. Restent la modification, la suppression et les vues opérationnelles.
- **Avancement (2026-10-06, lot queues 4) :** modification et désactivation ont rejoint `QueuesRepository`. La mise à jour repose sur une allowlist de colonnes issue du DTO et caste explicitement chaque colonne horaire en `time`. La désactivation de la file, de ses forfaits et de ses sessions est désormais atomique dans une transaction. Les méthodes correspondantes du service ne contiennent plus de SQL. Tests ajoutés pour les casts et la transaction. Restent statut, affichage, reset et opérateurs.
- **Avancement (2026-10-06, lot queues terminé) :** statut, affichage sans données personnelles, reset manuel et gestion paginée des opérateurs ont rejoint `QueuesRepository`. Les dates métier du reset sont castées explicitement en `date`, la transaction de reset est atomique et les résultats opérationnels sont typés. `QueuesService` ne contient désormais plus aucun SQL, appel `query`/`transaction` ou dépendance `DataSource`; il conserve le scope, les calculs d'attente, l'horloge et les validations métier. Compilation et 11 tests du module réussis. `queues` sort du périmètre restant d'ARCH-001, désormais limité aux modules `queue-engine`, `users`, `auth` et au health check technique.
- **Avancement (2026-10-06, lot queue-engine 1) :** création et enregistrement explicite de `QueueEngineRepository`. La lecture de l'état des guichets et la fermeture d'une session ont été extraites du service avec des contrats de lignes typés. `getThreads` et `closeSession` ne contiennent plus de SQL ; calcul d'inactivité, pagination et autorisations restent dans le service. Le module reste ouvert pour l'ouverture/reprise de session, l'appel suivant, les transitions servi/absent, les listes et prévisualisations.
- **Avancement (2026-10-06, lot queue-engine 2 partiel) :** la lecture du nombre de guichets, la recherche de la session active d'un utilisateur, la détection d'un guichet occupé et les créations de sessions active/consultation ont rejoint `QueueEngineRepository`. Les conflits uniques restent traduits en erreurs métier par le service. La transaction de reprise est préparée dans le repository mais son branchement au service, puis les autres opérations du moteur, restent à terminer avant de fermer ce lot.
- **Avancement (2026-10-06, lot queue-engine 3) :** les lectures de propriété d'une inscription en cours et les transitions contrôlées `served`/`no_show` ont rejoint le repository ; le service conserve les décisions d'autorisation. La liste paginée des sessions actives est également encapsulée avec `LIMIT`/`OFFSET` liés et tri allowlisté. Des tests repository couvrent les deux transitions terminales et la pagination. La reprise de guichet, l'algorithme atomique `next` et les prévisualisations restent à brancher/extracter.
- **Avancement (2026-10-06, lot queue-engine 4) :** la reprise de guichet utilise désormais la transaction de `QueueEngineRepository` : verrou pessimiste du guichet, fermeture de l'ancienne session, ouverture de la nouvelle et transfert de l'inscription en cours sont atomiques. Restent l'extraction de `next` et des prévisualisations avant fermeture du module.
- **Avancement (2026-10-06, lot queue-engine terminé) :** l'algorithme `next` complet a rejoint `QueueEngineRepository` avec ses deux passes, score pondéré, verrou `FOR UPDATE SKIP LOCKED`, transition vers `in_progress` et lecture détaillée dans la même transaction. Les prévisualisations et la résolution des files ont aussi été extraites ; les tableaux d'identifiants, limites et exclusions sont liés (`int[]`) sans interpolation. `QueueEngineService` ne contient plus aucun SQL, `DataSource`, `query` ou `transaction` et conserve uniquement scope, horloge, mapping et realtime. Compilation et tests du module réussis ; tests repository ajoutés pour la transaction concurrente et l'exclusion paramétrée. `queue-engine` sort du périmètre restant d'ARCH-001.

### \[x\] WEBHOOK-001 — Durcir la vérification HMAC

- **Preuve :** `notifications.service.ts:176-188` accepte `webhook-secret`, compare avec `!==` et ne valide pas l'�ge du timestamp ; le contr�leur signe `JSON.stringify(dto)` apr�s parsing, pas le corps brut.
- **Impact :** signatures forgeables si config absente, rejeu illimité et incompatibilité avec la signature réelle du fournisseur.
- **Correction :** fournisseurs/secrets obligatoires, raw body, fenêtre temporelle, `timingSafeEqual` et identifiant d'événement idempotent.
- **Validation :** secret absent, corps modifié, timestamp périmé/futur, rejeu et fournisseur inconnu refusés.
- **Résolution (2026-10-05) :** Nest conserve le corps brut ; signature calculée dessus, secret obligatoire par fournisseur, timestamp borné à 5 minutes, comparaison `timingSafeEqual` et journal idempotent `(provider,event_id)`. Les secrets par défaut et corps re-sérialisés ont été supprimés. Tests stale/provider/rejeu/signature ajoutés.

### \[x\] WEBHOOK-002 — Lier l'accusé au fournisseur

- **Preuve :** `notifications.service.ts:194-202` met à jour seulement par `provider_message_id`, sans fournisseur ni contrôle du nombre de lignes, puis acquitte toujours.
- **Impact :** le fournisseur A peut modifier un message B ; un ID inconnu semble traité.
- **Correction :** persister/filtrer `(provider, provider_message_id)`, utiliser `RETURNING` et définir l'idempotence.
- **Validation :** tests croisés entre fournisseurs et ID inconnu.
- **Résolution (2026-10-05) :** ajout de `provider` à la notification et d'un index unique `(provider, provider_message_id)`. Le webhook met à jour sur les deux clés avec `RETURNING`; un message inconnu provoque `NOTIFICATION_NOT_FOUND` et un événement déjà traité est acquitté sans second effet.

### \[x\] WORKER-001 — Réserver atomiquement les notifications

- **Preuve :** `notification.worker.ts:15-31` utilise un booléen local puis un `SELECT LIMIT 50`, sans verrou ni statut `processing`.
- **Impact :** plusieurs pods envoient le même SMS/email ; crash après envoi = doublon au retry.
- **Correction :** transaction `FOR UPDATE SKIP LOCKED` + lease, ou BullMQ déjà dépendance ; fournir une clé d'idempotence au prestataire.
- **Validation :** deux workers concurrents, un seul envoi.
- **Résolution (2026-10-05) :** réservation par transaction `FOR UPDATE SKIP LOCKED`, transition `pending → processing`, incrément d'essai au claim et lease de 5 minutes récupérable après crash. Plusieurs instances ne peuvent plus prendre la même ligne simultanément.

- **Correctif complémentaire (2026-10-06) :** le timestamp du claim est désormais explicitement converti en `timestamptz` avant la soustraction de la lease PostgreSQL. Cela corrige l'erreur d'exécution `operator does not exist: timestamp with time zone < interval`. Un test unitaire de non-régression couvre la requête ; test ciblé, ESLint, Prettier, typecheck et `build:check` passent.

### \[ \] WORKER-002 — Remplacer le faux envoi

- **Preuve :** `notification.worker.ts:43-54` génère un faux ID et marque directement `delivered`; aucun fournisseur n'est appelé.
- **Impact :** notifications perdues mais métriques mensongères.
- **Correction :** port `NotificationProvider`, fake réservé aux tests/dev, transition `pending → sent`; seul le webhook passe à `delivered`.
- **Validation :** tests de contrat, erreurs/retry et transitions.
- **Décision requise :** choix des fournisseurs SMS/e-mail, mode d'authentification, SLA/retry et gestion de leurs clés. Le worker a été sécurisé contre le double traitement, mais le simulateur n'est volontairement pas remplacé par un fournisseur arbitraire sans cette décision externe.

### \[x\] REG-001 — Transactionnaliser la création d'inscription

- **Preuve :** `registrations.service.ts:44-236` peut créer une personne, incrémenter le compteur puis échouer à l'insert, le tout hors transaction.
- **Impact :** personne orpheline et numéro consommé ; validations sans snapshot cohérent.
- **Correction :** transaction globale et création de personne compatible avec l'`EntityManager` transactionnel.
- **Validation :** échec final ⇒ rollback personne et compteur.
- **Résolution (2026-10-05) :** toute la création s'exécute dans une transaction TypeORM unique. `PersonsService.createPerson` accepte l'`EntityManager` courant : personne, contrôles, compteur et inscription partagent désormais le même commit/rollback.

### \[x\] REG-002 — Sérialiser la capacité de rendez-vous

- **Preuve :** les blocs `registrations.service.ts:148-164` et `:442-457` font `COUNT` puis écrivent séparément, sans contrainte de capacité.
- **Impact :** deux requêtes concurrentes dépassent la capacité.
- **Correction :** verrou par `(queue_id, scheduled_time)` dans une transaction (ligne de slot ou advisory lock), puis recompter/écrire.
- **Validation :** capacité 1 et deux créations simultanées ⇒ une seule réussit.
- **Résolution (2026-10-05) :** création et replanification prennent un verrou advisory transactionnel par `(queue, instant UTC)` avant de recompter puis écrire. La vérification de capacité et la mutation sont atomiques.

### \[x\] REG-003 — Canoniser les instants des créneaux

- **Preuve :** `registrations.service.ts:320` indexe par ISO UTC (`Z`), mais `:342` recherche une chaîne locale sans offset et n'utilise pas le timezone chargé.
- **Impact :** `booked` peut rester à zéro et annoncer de fausses places.
- **Correction :** créer chaque créneau dans le fuseau IANA du site, convertir en UTC, comparer et retourner un format avec offset explicite.
- **Validation :** réservation non UTC et frontière DST correctement comptées.
- **Résolution (2026-10-05) :** les heures sans offset sont interprétées dans le fuseau IANA du site puis converties en UTC; celles avec offset conservent leur instant. Les disponibilités retournent et indexent toutes les heures en ISO UTC, identiques aux valeurs PostgreSQL. Tests de conversion zonée ajoutés.

### \[x\] QUEUE-001 — Gérer les conflits de sessions concurrentes

- **Preuve :** `queue-engine.service.ts:150-264` fait « check puis insert ». Les index uniques `schema.sql:479-480` arbitrent la course, mais l'erreur PostgreSQL `23505` n'est pas mappée ; le takeover sélectionne hors transaction.
- **Impact :** 500 au lieu de `THREAD_OCCUPIED`/`SESSION_ALREADY_OPEN`, et takeover sur état périmé.
- **Correction :** verrouillage/insertion transactionnels ou mapping par nom de contrainte ; relire/verrouiller la session à reprendre dans la transaction.
- **Validation :** ouvertures et takeovers concurrents.
- **Résolution (2026-10-05) :** les violations `23505` sont traduites en `SESSION_ALREADY_OPEN` ou `THREAD_OCCUPIED`. Le takeover relit et verrouille la session occupante avec `FOR UPDATE` dans la transaction avant fermeture, insertion et réaffectation.

### \[x\] WS-001 — Réutiliser la politique d'authentification HTTP en WebSocket

- **Preuve :** `realtime.gateway.ts:66-81` fait seulement `jwtService.verify`, copie rôles/permissions et n'interroge jamais `dori_user_session`; `sid` n'est même pas copié.
- **Impact :** un access token dont la session a été révoquée (logout, mot de passe, désactivation) continue d'ouvrir un socket et d'accéder aux rooms jusqu'à son expiration.
- **Correction :** extraire un service commun de validation de principal (signature + `sid` + session + compte actif), utilisé par Passport et la gateway. Déconnecter aussi les sockets lors d'une révocation sensible si l'effet doit être immédiat.
- **Validation :** socket refusé après logout/changement de mot de passe/désactivation.
- **Résolution (2026-10-05) :** la gateway vérifie la signature puis délègue à la même `JwtStrategy` que HTTP. `sid`, propriétaire, révocation, expiration et compte actif sont donc contrôlés avant d'attacher le principal au socket.

### \[x\] WS-002 — Aligner le CORS WebSocket sur la configuration HTTP

- **Preuve :** `realtime.gateway.ts:26-30` configure `origin: '*'`, tandis que `main.ts` utilise une allowlist et des credentials.
- **Impact :** tout site peut initier une connexion avec un token accessible au navigateur ; politique de sécurité incohérente entre transports.
- **Correction :** injecter la même allowlist validée dans l'adapter/gateway Socket.IO et définir explicitement méthodes/credentials.
- **Validation :** origine autorisée acceptée, origine externe refusée.
- **Résolution (2026-10-05) :** ajout d'un `ConfiguredIoAdapter` installé au bootstrap avec exactement l'allowlist CORS validée utilisée par HTTP, credentials activés et méthodes limitées. Le wildcard de la gateway a été supprimé.

### \[x\] RT-001 — Brancher ou retirer la couche temps réel factorisée

- **Preuve :** `RealtimeService` expose `emitQueueOps`, `emitQueueDisplay`, `emitRegistrationUpdate` et `emitTranslationInvalidation`, mais `rg` ne trouve aucun appel hors de sa propre classe ; seul `setServer` est utilisé par la gateway.
- **Impact :** les clients abonnés ne reçoivent aucune mutation métier ; Redis, son adapter et BullMQ sont déclarés mais inutilisés, donc aucun support multi-instance réel.
- **Correction :** publier des événements après commit via un bus/outbox, brancher les quatre familles d'émission, puis ajouter l'adapter Redis si plusieurs instances sont visées. Sinon supprimer l'API et les dépendances mortes pour ne pas promettre une fonctionnalité absente.
- **Validation :** e2e Socket.IO : appel suivant, statut, position et traduction produisent exactement un événement après commit.
- **Résolution (2026-10-05) :** la couche factorisée est conservée et réellement consommée. Après commit d'un appel client, `QueueEngineService` émet les événements ops, display filtré et suivi d'inscription; les mutations de traduction émettent l'invalidation avec la version transactionnelle. Les services métier ne manipulent pas directement Socket.IO.

### \[x\] AUTHZ-001 — Invalider les autorisations lors des changements RBAC

- **Preuve :** le guard lit uniquement `user.permissions` du JWT ; `assignUserRole`, `removeUserRole` et `updateRolePermissions` ne révoquent/renouvellent pas les sessions. `JwtStrategy` ne recharge pas les permissions.
- **Impact :** une permission retirée reste utilisable jusqu'à expiration du token ; une permission ajoutée n'est pas visible. Le cache de scope invalidé ne résout pas ce problème.
- **Correction :** version d'autorisation par utilisateur/rôle vérifiée à chaque requête ou cache serveur court, et révocation/rotation des sessions lors des changements critiques.
- **Validation :** retirer une permission puis vérifier immédiatement le refus avec l'ancien token, en HTTP et WS.
- **Résolution (2026-10-05) :** assignation/retrait de rôle et modification des permissions révoquent, dans la même transaction, les sessions des utilisateurs concernés. Les anciens JWT sont immédiatement refusés par la validation de session commune HTTP/WS; les caches de scope sont invalidés après commit.

### \[x\] USER-001 — Transactionnaliser les mutations utilisateur

- **Preuve :** `createUser` insère puis assigne le rôle hors transaction ; statut, mot de passe et suppression modifient utilisateur puis sessions séparément.
- **Impact :** utilisateur sans rôle après échec, ou compte désactivé/mot de passe changé dont les sessions restent actives si la seconde requête échoue.
- **Correction :** une transaction par cas d'usage, avec invalidation de cache seulement après commit.
- **Validation :** injecter une erreur sur la seconde écriture et vérifier rollback complet.
- **Résolution (2026-10-05) :** création avec rôle, statut avec révocation, mot de passe avec révocation, suppression avec révocation et changements RBAC sont désormais transactionnels. Les invalidations mémoire restent après commit.

### \[x\] USER-002 — Valider exhaustivement rôles et permissions demandés

- **Preuve :** `updateRolePermissions` supprime tout puis insère avec `WHERE permission_name = ANY($4)` sans vérifier le rôle ni que toutes les valeurs ont correspondu ; `assignUserRole` peut acquitter `assigned: true` après `ON CONFLICT DO NOTHING`.
- **Impact :** faute de frappe = permissions manquantes silencieusement ; réponse métier mensongère pour ressource absente/déjà affectée.
- **Correction :** charger/verrouiller le rôle, comparer ensemble demandé/existant, rejeter les inconnues, utiliser `RETURNING` et définir l'idempotence des réponses.
- **Validation :** rôle absent, permission inconnue, doublon et liste partielle.
- **Résolution (2026-10-05) :** rôle et utilisateur sont vérifiés explicitement; les permissions demandées sont dédupliquées puis comparées exhaustivement aux permissions actives. Les inconnues sont rejetées. `INSERT/DELETE ... RETURNING` rend les réponses `assigned`/`removed` fidèles et idempotentes.

### \[x\] PERSON-001 — Ne pas exposer la déduplication hors scope

- **Preuve :** `persons.service.ts:104-123` recherche téléphone/email globalement puis retourne immédiatement la ligne complète sans `checkPersonScope`.
- **Impact :** un opérateur autorisé à créer peut tester des coordonnées et obtenir les données d'une personne rattachée à un autre site.
- **Correction :** dédupliquer côté serveur sans retourner la fiche hors périmètre ; selon le métier, renvoyer un conflit opaque ou associer dans une transaction après contrôle explicite.
- **Validation :** même téléphone dans un autre scope ne divulgue aucun champ personnel.
- **Résolution appliquée :** `dori_person` porte maintenant un `site_id` obligatoire et immuable par l'API. La création directe exige ce site et vérifie `checkSiteAccess`; la recherche, l'accès par identifiant et la déduplication par téléphone/email sont filtrés par site. Une inscription charge d'abord sa queue, crée la personne dans le site de cette queue ou vérifie que le `personId` fourni appartient exactement à ce site. Une même identité peut donc être recréée indépendamment dans un autre site sans exposer ni réutiliser la première fiche.
- **Base de données :** les index uniques globaux ont été remplacés par des index actifs `(site_id, LOWER(email))` et `(site_id, phone_number)`. Un trigger PostgreSQL interdit toute inscription reliant une personne et une queue de sites différents. La migration idempotente intégrée à `schema.sql` déduit le site des fiches existantes, duplique les fiches et leurs notes lorsqu'elles étaient historiquement partagées entre plusieurs sites, puis réaffecte les inscriptions. Elle échoue explicitement sur une fiche orpheline dont le site est impossible à déterminer, afin d'exiger une décision de migration plutôt que de déplacer silencieusement des données personnelles.
- **Vérifications après correction :** tests couvrant la déduplication dans un site, la recréation du même téléphone dans un autre site, le masquage hors scope, le contrôle du site d'un `personId` lors de l'inscription et la création embarquée dans le site de la queue. Quality gates complètes réussies.

### \[x\] RESET-001 — Créer atomiquement le marqueur de reset

- **Preuve :** `daily-reset.worker.ts:61-72` considère le compteur du lendemain comme marqueur, mais la transaction `:76-133` ne l'insère jamais.
- **Impact :** durant toute la minute cible, le reset est rejoué ; toute session rouverte est immédiatement refermée. En multi-instance, les exécutions se chevauchent.
- **Correction :** table dédiée `queue_daily_reset(queue_id, business_date)` avec insertion unique au début de la transaction, ou insertion explicite du compteur si cette sémantique est réellement voulue.
- **Validation :** plusieurs ticks/instances à la même minute ⇒ une seule exécution.
- **Résolution (2026-10-05) :** table dédiée `dori_queue_daily_reset`, verrou advisory transactionnel par queue et insertion `ON CONFLICT DO NOTHING` avant tout effet. Une seule instance peut exécuter un reset donné.

### \[x\] RESET-002 — Découpler le reset du compteur de tickets

- **Preuve :** le worker saute tout le reset si un compteur existe pour `tomorrow`; or une inscription à un rendez-vous futur crée déjà ce compteur dans `createRegistration`.
- **Impact :** sessions et inscriptions de fin de journée peuvent ne jamais être clôturées à cause d'une réservation future sans rapport.
- **Correction :** utiliser un journal de reset dédié et définir clairement la date clôturée ; traiter aussi explicitement les statuts `booked` annoncés par le commentaire mais absents des UPDATE.
- **Validation :** compteur futur préexistant + données du jour ⇒ reset exécuté une fois.
- **Résolution (2026-10-05) :** suppression totale du compteur comme marqueur. Le worker clôt la date métier précédente, reporte vers la date courante et traite explicitement `booked` avec `waiting`; un compteur futur n'influence plus le reset.

### \[x\] WORKER-003 — Ajouter une coordination distribuée aux cron jobs

- **Preuve :** les trois workers utilisent `isRunning`/`isProcessing`, booléens locaux au processus. Aucun lock DB/Redis ni leader election.
- **Impact :** chaque replica exécute expiration, reset et dispatch ; notifications doublées et reset concurrent.
- **Correction :** verrous PostgreSQL advisory/Redis avec lease, ou workers BullMQ séparés ; rendre chaque opération idempotente au niveau DB.
- **Validation :** deux instances simultanées sans double effet.
- **Résolution (2026-10-05) :** reset et expiration utilisent des advisory locks transactionnels PostgreSQL; le dispatch utilise `SKIP LOCKED` et une lease persistée. Les booléens locaux ne sont plus la seule coordination inter-instance.

### \[x\] TRANS-001 — Atomiser traduction et version

- **Preuve :** `translations.service.ts` écrit la traduction puis appelle séparément `incrementVersion` pour create/update/delete.
- **Impact :** contenu modifié sans nouvelle version, ou version avancée sans état correspondant en cas d'échec partiel ; aucune émission realtime n'est branchée.
- **Correction :** transaction commune retournant la version, puis événement d'invalidation après commit via RT-001.
- **Validation :** erreur injectée sur chaque étape et cohérence version/contenu.
- **Résolution (2026-10-05) :** création, mise à jour/suppression et incrément de version partagent désormais une transaction et verrouillent la traduction lors des mutations. La version est retournée par SQL et l'invalidation realtime n'est émise qu'après commit.

### \[ \] DB-002 — Vérifier le certificat PostgreSQL

- **Preuve :** `database.module.ts:20-22` active SSL avec `{ rejectUnauthorized: false }` sans distinction d'environnement.
- **Impact :** chiffrement sans authentification du serveur, vulnérable à un intermédiaire réseau.
- **Correction :** fournir la CA attendue et activer `rejectUnauthorized`; réserver un mode permissif explicite au développement local.
- **Validation :** certificat non approuvé refusé, certificat CA valide accepté.
- **Rollback (2026-10-05) :** durcissement retiré à la demande car la base actuelle présente une chaîne auto-signée (`self-signed certificate in certificate chain`). La connexion SSL utilise de nouveau `rejectUnauthorized: false`. Le point reste ouvert jusqu'à fourniture de la CA correcte ou d'un certificat approuvé.

### \[x\] VAL-001 — Valider `limit` avec les pipes communs

- **Preuve :** `queue-engine.controller.ts:71-74` reçoit une string et fait `parseInt`; `NaN`, zéro, négatif et valeurs énormes atteignent le SQL. Les autres paramètres numériques utilisent `ParseIntPipe`/DTO.
- **Impact :** erreurs 500, charge excessive et API incohérente.
- **Correction :** DTO avec `@Type(() => Number)`, `@IsInt`, `@Min(1)`, `@Max(...)`, réutilisable aussi par les rapports.
- **Validation :** limites invalides ⇒ 400 standardisé.
- **Résolution appliquée :** ajout de `LimitQueryDto` dans le core avec transformation numérique et validation centralisée (`IsInt`, minimum 1, maximum 100). L'endpoint `next-preview` reçoit désormais ce DTO via `@Query()` et le `ValidationPipe` global ; son `parseInt` local et sa documentation Swagger manuelle ont été supprimés. `DashboardQueueLoadQueryDto` hérite également de ce composant core tout en conservant sa valeur par défaut métier de 4.
- **Vérifications après correction :** valeurs numériques transformées ; zéro, négatifs, décimaux, valeurs supérieures à 100 et chaînes invalides rejetés. Tests DTO, lint, typecheck, build et tests applicatifs réussis.

### \[x\] PAG-001 — Supprimer le helper de pagination mort

- **Preuve :** `buildPaginatedResult` dans `pagination.dto.ts:99` n'est référencé nulle part ; tous les services utilisent `dto.createResponse`.
- **Impact :** deux façons de construire le même contrat, dont une jamais exercée.
- **Correction :** supprimer le helper ou en faire l'unique implémentation appelée par `createResponse`.
- **Validation :** recherche de symbole et tests pagination inchangés.
- **Résolution appliquée :** le helper mort `buildPaginatedResult` a été supprimé. `PaginationDto` est désormais l'unique composant qui centralise les valeurs par défaut, la validation de `page`/`pageSize`, le calcul de l'offset, la normalisation et la sécurisation du tri, ainsi que la construction du contrat `PaginatedResult` via `createResponse`. Tous les listings des modules consomment `getParams`, `getSafeSortField` et `createResponse` au lieu de recalculer les métadonnées de pagination.
- **Vérifications après correction :** aucune occurrence de `buildPaginatedResult` et aucune construction manuelle de `totalPages` dans les services ; tests dédiés de `PaginationDto`, quality gates et tests applicatifs réussis.

### \[ \] TEST-001 — Couvrir les chemins critiques et concurrents

- **Preuve :** `npx jest --runInBand --coverage` : 61 tests passent, mais couverture de 14,42% statements, 14,93% branches, 18,08% fonctions et 13,99% lignes. Aucun spec pour notifications, workers, realtime, translations, health/config/database.
- **Impact :** les P0/P1 ci-dessus ne sont pas détectés ; les tests unitaires mockent principalement les chaînes SQL.
- **Correction :** prioriser tests d'intégration PostgreSQL pour transactions/concurrence, e2e auth/webhook/WS, puis contrats DTO/erreurs.
- **Validation :** seuils CI progressifs par zone critique plutôt qu'un chiffre global seul.
- **Avancement (2026-10-05) :** ajout de tests dédiés configuration, JWT/session, fuseaux/DST, validation de limite, pagination, sérialisation, cloisonnement personne/site et webhooks HMAC/rejeu. La suite atteint 18 suites et 92 tests, mais les vrais tests PostgreSQL concurrents restent liés au choix d'environnement de TEST-002.

### \[ \] TEST-002 — Isoler l'environnement e2e

- **Preuve :** `npm run test:e2e` importe `AppModule` et tente la `DATABASE_URL` externe présente (164.92.212.222:22040), puis timeout/retries et handles ouverts.
- **Impact :** suite non déterministe, lente, dangereuse envers une DB partagée et inutilisable hors réseau.
- **Correction :** config `.env.test`, PostgreSQL éphémère/conteneur, migrations dédiées, retries réduits et teardown garanti. Ne jamais cibler une base distante implicite.
- **Validation :** e2e reproductible hors réseau, base neuve, processus qui termine proprement.
- **Décision requise :** choisir le runtime d'intégration autorisé en CI (service PostgreSQL natif, Docker/Testcontainers ou autre base éphémère). Aucun accès à la base distante n'a été lancé et ce point reste ouvert pour ne pas imposer une infrastructure CI non validée.

### \[x\] QUAL-001 — Rétablir des quality gates non mutantes

- **Preuve :** `npx eslint "{src,test}/**/*.ts"` remonte 288 problèmes (286 erreurs, surtout Prettier, et 2 warnings). `tsc --noEmit --noUnusedLocals --noUnusedParameters` relève notamment logger/paramètres/imports inutilisés et le type manquant `@types/js-yaml`.
- **Impact :** bruit empêchant la CI de détecter une nouvelle régression ; code mort confirmé.
- **Correction :** formater une fois, corriger les warnings, ajouter scripts `lint:check` (sans `--fix`) et `typecheck`, puis les rendre bloquants en CI. Activer progressivement davantage d'options `strict`.
- **Validation :** build, lint, typecheck et tests verts sans modifier le worktree.
- **Résolution appliquée :** le socle TypeScript a été formaté une fois et les deux imports DTO inutilisés ont été supprimés. Le script `lint` est désormais strict et non mutant (`--max-warnings=0`) ; la correction automatique est isolée dans `lint:fix`. Les gates non mutantes `format:check` et `typecheck` ont été ajoutées, ainsi qu'un agrégateur `quality:check` exécutant format, lint, vérification TypeScript avec symboles inutilisés interdits, build et tests. `js-yaml` et `@types/js-yaml`, utilisés par l'export Swagger, sont maintenant des dépendances de développement directes.
- **Correctif watcher (2026-10-05) :** le build de contrôle utilise désormais `tsconfig.quality.json` et écrit dans `.quality-dist`. Il ne supprime plus `dist` pendant `npm run start:dev`, évitant les erreurs `ENOENT` transitoires au chargement des modules.
- **Vérifications après correction :** `npm run quality:check` réussi sans mutation du worktree.

### \[x\] CORE-001 — Choisir entre modules globaux et imports explicites

- **Preuve :** `ClockModule` et `RbacModule` portent `@Global()`. Pourtant tous les modules m�tier importent `ClockModule`, tandis que seul `ReportsModule` importe explicitement `RbacModule` et les autres consomment `ScopeService` gr�ce au global. `RealtimeModule` r�importe les deux.
- **Impact :** architecture DI non homogène, dépendances réelles difficiles à lire et imports redondants donnant une fausse impression d'isolation.
- **Correction :** choisir une règle unique : soit core global importé une fois par `AppModule`, soit modules non globaux importés explicitement partout (préférable pour rendre les dépendances visibles et faciliter les tests).
- **Validation :** matrice modules/providers cohérente et tests de compilation Nest par module.
- **Résolution appliquée :** option B retenue. `@Global()` a été retiré de `DatabaseModule`, `ClockModule`, `RbacModule` et `RealtimeModule`. `ConfigModule.forRoot` n'utilise plus `isGlobal: true`. Chaque module métier, worker et module core importe maintenant explicitement `ConfigModule`, `DatabaseModule`, `ClockModule` et/ou `RbacModule` selon les providers réellement injectés. Les imports `ConfigModule` sont déclarés au niveau de `DatabaseModule`, `AuthModule` et `RealtimeModule` (et pas seulement dans leurs sous-modules dynamiques), afin que leurs propres providers puissent injecter `ConfigService`.
- **Dépendances internes explicitées :** `RbacModule → DatabaseModule`, `RealtimeModule → DatabaseModule + RbacModule + ClockModule`, `HealthModule → DatabaseModule + ClockModule`; `ReportsModule` n'importe plus inutilement `ClockModule`.
- **Vérifications après correction :** aucune occurrence de `@Global()` ni de `ConfigModule` global dans `src`, `npm run build` réussi, 13 suites et 63 tests réussis. Un bootstrap réel via `node dist/main.js` initialise désormais tout le conteneur Nest sans erreur DI et atteint la tentative de connexion PostgreSQL (connexion externe ensuite bloquée par le sandbox d'audit).

### \[x\] CORE-002 — Utiliser ou supprimer les décorateurs Swagger factorisés

- **Preuve :** `ApiDoriErrorResponses`, `ApiDoriOkResponse` et `ApiDoriCreatedResponse` sont largement utilisés, mais `ApiDoriPublicErrorResponses` n'a aucune consommation. Les endpoints publics auth ajoutent directement `ApiUnauthorizedResponse`; health/app utilisent aussi leurs propres `ApiResponse` car ils contournent partiellement l'enveloppe.
- **Impact :** documentation des erreurs publiques divergente du contrat central et composant core mort.
- **Correction :** appliquer `ApiDoriPublicErrorResponses` aux routes publiques en lui permettant de déclarer les erreurs réellement possibles (un webhook peut bien renvoyer 401), ou le supprimer au profit d'options explicites sur le décorateur unique.
- **Validation :** snapshot OpenAPI comparant schémas runtime et documentation pour chaque famille de route.
- **Résolution appliquée :** `ApiDoriPublicErrorResponses` est désormais utilisé sur les endpoints publics (accueil, health, login, refresh, webhook, bundle de traductions et suivi d'inscription) et accepte l'option `include401` lorsque le contrat public peut authentiquement renvoyer 401. Les `ApiUnauthorizedResponse` locaux ont été supprimés.
- **Centralisation complémentaire :** ajout de `ApiDoriRawResponse` dans le core pour les rares réponses volontairement non enveloppées (health et redirection). Les contrôleurs ne construisent plus directement de `ApiResponse`, `ApiOkResponse`, `ApiCreatedResponse` ou variantes d'erreur Swagger.
- **Vérifications après correction :** recherche globale conforme (décorateurs Swagger natifs de réponse confinés à `core/swagger/api-dori-response.decorator.ts`), `npm run build` réussi, 13 suites et 63 tests réussis.

### \[x\] CORE-003 — Clarifier qui réalise le mapping de sortie

- **Preuve :** `SerializationInterceptor` convertit globalement les clés snake_case en camelCase et les dates en ISO. Malgré cela, `SitesService`, `PersonsService` et `QueueEngineService` reconstruisent manuellement des objets pour ces mêmes conversions ; d'autres services retournent directement les lignes SQL et dépendent de l'interceptor. Les mappings métier imbriqués de `ServiceTiersService` restent, eux, légitimes.
- **Impact :** deux stratégies selon le service, risque de champs oubliés/différents et tests attachés à des formes internes plutôt qu'au contrat HTTP.
- **Correction :** réserver les mappers explicites à la sélection/recomposition métier et centraliser les conversions mécaniques. Idéalement mapper vers des DTO typés à la frontière repository/service puis limiter l'interceptor à une dernière protection.
- **Validation :** tests de contrat HTTP garantissant la même casse/forme sur tous les modules.
- **Résolution appliquée :** suppression des conversions manuelles snake_case → camelCase et `Date` → ISO dans `SitesService.findSiteManagers`, `PersonsService.findPersonNotes/createNote/updateNote`, `QueueEngineService.getSessions` et `ReportsService.getDashboardQueueLoad`. Les requêtes sélectionnent explicitement les champs publics pour ne pas élargir les réponses, puis les services retournent les lignes brutes au pipeline Nest. Les mappings conservés correspondent uniquement à une composition métier (objets imbriqués, valeurs calculées ou tableaux scalaires), pas à la sérialisation technique.
- **Protection ajoutée :** tests unitaires dédiés à `SerializationInterceptor` pour la casse, les objets/tableaux imbriqués, les dates et le retrait des champs sensibles.
- **Vérifications après correction :** `npm run build` réussi ; 13 suites et 63 tests réussis.

### \[x\] CORE-004 — Faire de `ConfigService` l'unique accès à l'environnement

- **Preuve :** malgré `core/config/configuration.ts`, `AuthController` lit directement `NODE_ENV`, `NotificationsService` construit dynamiquement les secrets webhook depuis `process.env`, et `DatabaseSeedService` lit `AUTO_RUN_MIGRATIONS`. Les durées de cookie et plusieurs valeurs de sécurité sont aussi recodées localement.
- **Impact :** validation centralisée impossible, mocks de tests hétérogènes et valeurs core ignorées (par exemple durée refresh et paramètres de lockout).
- **Correction :** ajouter ces clés au schéma core typé, injecter `ConfigService`/un service de configuration spécialisé et bannir `process.env` hors de `configuration.ts`.
- **Validation :** `rg "process\.env" src` ne retourne que le chargeur de configuration.
- **Résolution appliquée :** les secrets webhook sont chargés dans `notifications.webhookSecrets`, `AUTO_RUN_MIGRATIONS` dans `databaseInitialization.autoRunMigrations`, et `AuthController` utilise `nodeEnv` ainsi que `jwt.refreshTokenExpiresInDays` pour le cookie. `NotificationsService` et `DatabaseSeedService` consomment maintenant `ConfigService`.
- **Vérifications après correction :** recherche globale conforme (seul `src/core/config/configuration.ts` lit `process.env`), `npm run build` réussi, 12 suites et 61 tests réussis.

## Matrice d'utilisation du core

| Composant core                                        | État dans les modules                                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `DoriException` / `ERROR_CATALOG`                     | Très utilisé ; format générique encore divergent (ERR-001).                                                                |
| `ScopeService`                                        | Très utilisé ; invalidation présente, mais les permissions JWT restent périmées (AUTHZ-001).                               |
| Guards/décorateurs JWT et permissions                 | Utilisés sur HTTP ; contournés par WebSocket (WS-001).                                                                     |
| `ClockService`                                        | Injecté largement, mais contourné par `new Date()`/`CURRENT_TIMESTAMP` (TIME-001).                                         |
| `PaginationDto` / `PaginatedResult` / `LimitQueryDto` | Paramètres, limites, tri et réponses paginées centralisés. PAG-001 et VAL-001 corrigés.                                    |
| Intercepteurs réponse/sérialisation/correlation       | Enregistrés globalement ; les conversions mécaniques sont centralisées dans `SerializationInterceptor` (CORE-003 corrigé). |
| Décorateurs Swagger Dori                              | Utilisés pour toutes les réponses documentées ; variantes publique et brute centralisées (CORE-002 corrigé).               |
| Configuration core                                    | Utilisée partout ; les lectures de l'environnement sont désormais confinées à `configuration.ts` (CORE-004 corrigé).       |
| `RealtimeService`                                     | Émissions métier ops/display/suivi/traductions centralisées et branchées (RT-001 corrigé).                                 |
| Entités/`ALL_ENTITIES`                                | Chargées par TypeORM ; le SQL spécifique est encapsulé dans des repositories typés (ARCH-001 corrigé).                    |
| `DatabaseSeedService`                                 | Activé au bootstrap, avec erreur avalée (DB-001).                                                                          |
| `PersonsService` / `dori_person.site_id`              | Identité, accès, déduplication et intégrité des inscriptions cloisonnés par site (PERSON-001 corrigé).                     |

## Points contrôlés sans anomalie confirmée

- Les paramètres SQL issus des filtres métier sont globalement passés comme paramètres PostgreSQL ; les champs de tri utilisent des allowlists via `PaginationDto`.
- Les identifiants de route numériques utilisent presque partout `ParseIntPipe`.
- Les mots de passe sont hachés avec bcrypt et les refresh tokens sont stockés sous forme SHA-256, pas en clair.
- Les numéros de ticket reposent sur un compteur PostgreSQL avec `ON CONFLICT`, ce qui rend l'incrément atomique (mais l'opération complète doit encore être transactionnelle, voir REG-001).
- La sélection du prochain client et le claim de notifications utilisent des transactions avec `SKIP LOCKED`; les tests PostgreSQL multi-connexion restent à intégrer avec TEST-002.
- Les contrôles de scope site/file sont présents dans la majorité des services exposant des données métier.
- La validation globale applique `whitelist`, `forbidNonWhitelisted` et la transformation des DTO.
- Le build Nest passe et les 92 tests unitaires existants passent.

## Points restant en attente de décision

1. **WORKER-002 :** sélectionner les fournisseurs SMS/e-mail et leurs contrats opérationnels.
2. **TEST-002 puis TEST-001 :** sélectionner l'environnement PostgreSQL éphémère autorisé en CI, puis y exécuter les scénarios concurrents.

## Périmètre et vérifications exécutées

- Tous les fichiers sous `src` ont été inventoriés ; bootstrap, core transverse, DTO/pagination, modules métier, entités/schema SQL, realtime et workers ont été contrôlés.
- `npm run build` : **réussi**.
- `npm test -- --runInBand --coverage=false` : **18 suites / 92 tests réussis**.
- `npx jest --runInBand --coverage` : **réussi**, couverture détaillée dans TEST-001.
- `npm run test:e2e -- --runInBand` : **échoué**, diagnostic dans TEST-002.
- `npm run quality:check` : **réussi** ; Prettier en lecture seule, ESLint sans warnings, TypeScript avec symboles inutilisés interdits, build et tests sont verts.
- Les correctifs cochés ont été implémentés et documentés progressivement dans ce fichier ; quatre points restent ouverts car ils nécessitent les décisions externes listées ci-dessus.

<!-- HIGHLIGHT_MARK color="#fef08a" text="ation :  ouvertures et takeovers concurrents. [ ] WS-001 — Ré" anchor="Validation : ouvertures et takeovers concurrents." -->

<!-- CHECKPOINT id="ckpt_muvl2chq_2idt17" time="2026-10-05T18:28:33.086Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvlf7gk_g0oztw" time="2026-10-05T18:38:33.092Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvls2fp_z6ctyd" time="2026-10-05T18:48:33.109Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvm4xee_uncc63" time="2026-10-05T18:58:33.110Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvmhscy_hbpas3" time="2026-10-05T19:08:33.106Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvmunbz_aa9xy3" time="2026-10-05T19:18:33.119Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvn7iat_ud8rwi" time="2026-10-05T19:28:33.125Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvnkda5_j889jl" time="2026-10-05T19:38:33.149Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvoa378_9l4p9d" time="2026-10-05T19:58:33.140Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvomy68_mskcl5" time="2026-10-05T20:08:33.152Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvsamqq_vvb3nx" time="2026-10-05T21:50:56.930Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvsnhpo_wctpyh" time="2026-10-05T22:00:56.940Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvt0coy_yxykhx" time="2026-10-05T22:10:56.962Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvtd7nv_njuprv" time="2026-10-05T22:20:56.971Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwfv6r0_t7b9to" time="2026-10-06T08:50:47.148Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwg81pv_vorpji" time="2026-10-06T09:00:47.155Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwgkwot_hsuouj" time="2026-10-06T09:10:47.165Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwo9gen_3erqt0" time="2026-10-06T12:45:49.775Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux1g5mo_wffc10" time="2026-10-06T18:54:57.408Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux1t0lj_t4za3m" time="2026-10-06T19:04:57.415Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux25vkv_xav0sx" time="2026-10-06T19:14:57.439Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux2iqjl_8suh38" time="2026-10-06T19:24:57.441Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux2vli4_3c791s" time="2026-10-06T19:34:57.436Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mux38gh9_p5x22o" time="2026-10-06T19:44:57.453Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

### Mise à jour ARCH-001 - lot users (2026-10-06)

- **Terminé :** toute la persistance des utilisateurs, rôles, permissions, scopes et révocation de sessions est regroupée dans `UsersRepository`, y compris les transactions de création, d'affectation de rôle et de remplacement des permissions.
- `UsersService` est désormais une façade injectant uniquement ce repository et ne contient plus aucun SQL, appel `query`/`transaction` ni dépendance `DataSource`.
- Le repository est enregistré explicitement dans `UsersModule`. Les tests existants traversent la façade jusqu'au repository et conservent la couverture des protections anti-escalade et du soft-delete.
- **Validation :** Prettier, ESLint ciblé, compilation et 9 tests users réussis. `users` sort du périmètre restant d'ARCH-001, désormais limité à `auth` et au health check technique.

### Mise à jour ARCH-001 - lot auth (2026-10-06)

- **Terminé :** toutes les lectures et écritures d'authentification ont été extraites dans `AuthRepository` : utilisateurs actifs, verrouillage de connexion, sessions de rafraîchissement, rôles, permissions, déconnexions et création de session.
- `AuthService` ne contient plus aucun SQL, appel `query`/`transaction` ni dépendance `DataSource`. Il conserve le hachage, les règles de sécurité, la hiérarchie d'autorisation, la génération JWT et l'orchestration.
- Le changement du mot de passe et la révocation de toutes les sessions sont désormais exécutés dans une transaction unique. Une déconnexion sans `sessionId` authentifié est explicitement refusée.
- Le repository est enregistré explicitement dans `AuthModule`. `auth` sort du périmètre des services métier d'ARCH-001 ; seul le health check technique reste à qualifier.
- **Validation :** Prettier, ESLint ciblé, compilation et 4 tests auth réussis. Le scan statique de `AuthService` ne retourne aucun SQL, `DataSource`, `query` ou `transaction`.

### Clôture ARCH-001 (2026-10-06)

- Les trois derniers accès techniques ont été encapsulés : validation des sessions JWT dans `JwtSessionRepository`, suivi des inscriptions et heartbeat WebSocket dans `RealtimeRepository`, disponibilité PostgreSQL dans `HealthRepository`.
- `JwtStrategy`, `RealtimeGateway` et `HealthController` ne contiennent plus aucun SQL, appel `query`/`transaction` ni dépendance `DataSource`. Chaque repository est enregistré explicitement dans le module Nest qui le consomme.
- Le scan complet de `src` ne trouve plus aucun SQL ou appel `query` direct hors repositories et `DatabaseSeedService`. Ce dernier reste volontairement l'unique exception : il exécute les scripts d'initialisation du schéma et des données et constitue une infrastructure de bootstrap, pas une persistance applicative.
- **Validation finale :** Prettier et ESLint ciblés réussis, typecheck réussi, build Nest réussi, 31 suites et 136 tests réussis. `ARCH-001` est fermé.

<!-- CHECKPOINT id="ckpt_mux3lbfz_jbb58r" time="2026-10-06T19:54:57.455Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
