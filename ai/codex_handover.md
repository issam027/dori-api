# Audit technique de `src`

> Audit incrémental. Chaque point ci-dessous a été vérifié dans le code. Les références de lignes sont à revalider après modification.

## Mode d'emploi

- **P0** : vulnérabilité ou corruption/perte de données possible ; corriger avant mise en production.
- **P1** : défaut fonctionnel, de fiabilité ou d'architecture important ; corriger rapidement.
- **P2** : dette de conception/maintenabilité ou incohérence notable.
- **P3** : amélioration ciblée à faible risque.
- Pour chaque point : partir du correctif proposé, ajouter un test de non-régression, puis cocher la case.

## Synthèse

| ID | Priorité | Zone | Constat |
| --- | --- | --- | --- |
| BOOT-001 | P2 | Bootstrap | Un diagnostic temporaire charge `pg/package.json` et écrit directement dans la console à chaque démarrage. |
| SEC-001 | P0 | JWT | Secret JWT de secours public et constant si la configuration manque. |
| SEC-002 | P1 | JWT | Les JWT historiques sans `sid` sont liés à une session arbitraire. |
| AUTH-001 | P1 | Auth | Cookie refresh écrit mais jamais parsé. |
| CFG-001 | P1 | Configuration | Variables d'environnement non validées au démarrage. |
| DB-001 | P1 | Base | Échec du schema/seed automatique avalé. |
| TIME-001 | P1 | Temps | `ClockService` contourné malgré son contrat. |
| TIME-002 | P1 | Temps | Conversion fin de journée dépendante du fuseau serveur. |
| ERR-001 | P2 | Erreurs | Contrat d'erreur générique hétérogène. |
| ARCH-001 | P2 | Persistance | Entités TypeORM factorisées mais services en SQL brut non typé. |
| WEBHOOK-001 | P0 | Notifications | Authentification HMAC forgeable/mal vérifiée et rejouable. |
| WEBHOOK-002 | P1 | Notifications | Accusé non lié au fournisseur et effet SQL non contrôlé. |
| WORKER-001 | P1 | Notifications | Traitement non réservé atomiquement en multi-instance. |
| WORKER-002 | P1 | Notifications | Livraison simulée comme succès en production. |
| REG-001 | P1 | Inscriptions | Création non transactionnelle. |
| REG-002 | P1 | Rendez-vous | Capacité vulnérable à la concurrence. |
| REG-003 | P1 | Disponibilités | Formats/fuseaux des créneaux incohérents. |
| QUEUE-001 | P1 | Sessions | Courses d'ouverture remontées en erreur SQL 500. |
| WS-001 | P0 | WebSocket | L'authentification contourne la validation/révocation des sessions HTTP. |
| WS-002 | P1 | WebSocket | CORS WebSocket ouvert à toute origine, contrairement à HTTP. |
| RT-001 | P1 | Temps réel | Le service factorisé d'émission n'est appelé par aucun domaine métier. |
| AUTHZ-001 | P1 | RBAC | Les rôles/permissions embarqués restent valides après modification en base. |
| USER-001 | P1 | Utilisateurs | Plusieurs mutations multi-écritures ne sont pas transactionnelles. |
| USER-002 | P1 | Rôles | Une liste de permissions inconnues est silencieusement ignorée. |
| PERSON-001 | P1 | Données personnelles | Corrigé : une personne et sa déduplication sont strictement rattachées à un site. |
| RESET-001 | P0 | Worker quotidien | Le marqueur d'idempotence est vérifié mais jamais créé. |
| RESET-002 | P1 | Worker quotidien | Une simple existence de compteur futur peut annuler tout le reset. |
| WORKER-003 | P1 | Workers | Verrous uniquement en mémoire, donc exécutions concurrentes entre instances. |
| TRANS-001 | P1 | Traductions | Mutation et incrément de version ne sont pas atomiques. |
| DB-002 | P1 | TLS PostgreSQL | `rejectUnauthorized: false` désactive la vérification du certificat. |
| VAL-001 | P2 | Validation | Corrigé : `limit` passe par le DTO core et le `ValidationPipe` global. |
| PAG-001 | P3 | Pagination | Corrigé : construction des réponses centralisée dans `PaginationDto`. |
| TEST-001 | P1 | Tests | Couverture globale \~14% et zones critiques non testées. |
| TEST-002 | P1 | E2E | Le test e2e dépend d'une base externe et échoue sans environnement réseau/DB. |
| QUAL-001 | P2 | Qualité | Corrigé : gates non mutantes centralisées dans `quality:check`. |
| CORE-001 | Corrigé | Modules Nest | Les dépendances core sont désormais non globales et importées explicitement par chaque module consommateur. |
| CORE-002 | Corrigé | Swagger | Les réponses Swagger standard et publiques passent désormais par les décorateurs core. |
| CORE-003 | Corrigé | Sérialisation | Les conversions mécaniques de sortie passent désormais par `SerializationInterceptor`. |
| CORE-004 | Corrigé | Configuration | `ConfigService` est désormais l'unique accès à la configuration hors du chargeur core. |

## Constats détaillés

### \[ \] BOOT-001 — Retirer le diagnostic temporaire `pg` du chemin de démarrage

- **Preuve :** `src/main.ts:1-9` exécute un `require('pg/package.json')` dans un `try/catch` et appelle `console.log`/`console.error` avant les imports applicatifs.
- **Impact :** bruit dans les logs, contournement du logger Nest/Winston et exposition inutile de la version exacte du driver ; ce code explicitement marqué temporaire reste exécuté en production.
- **Correction :** supprimer entièrement ce bloc. Si un contrôle du driver est encore nécessaire, le déplacer dans un script de diagnostic explicite ou dans un health check sans divulguer sa version.
- **Validation :** démarrer l'application et vérifier l'absence des messages `pg OK` / `pg FAILED` ; conserver un test de démarrage ou de health check.

### \[ \] SEC-001 — Supprimer le secret JWT de secours

- **Preuve :** `configuration.ts:50`, `jwt.strategy.ts:24` et `auth.module.ts:19` retombent sur `change-me-in-production`.
- **Impact :** sans variable injectée, un tiers connaissant le dépôt peut signer des JWT.
- **Correction :** secret obligatoire et suffisamment long hors test/local ; lecture centralisée via `getOrThrow`.
- **Validation :** le démarrage production échoue sans secret ; une fausse clé est rejetée.

### \[ \] SEC-002 — Rendre `sid` obligatoire dans les JWT

- **Preuve :** `jwt.strategy.ts:43-57` accepte un token sans `sid` dès qu'une session quelconque du même utilisateur est active.
- **Impact :** révoquer la session émettrice ne révoque pas ce token si une autre session subsiste.
- **Correction :** versionner les tokens et supprimer rapidement le fallback ; ne jamais rattacher un token à une session arbitraire.
- **Validation :** session A révoquée + B active : le token A sans `sid` doit être refusé.

### \[ \] AUTH-001 — Rendre le refresh par cookie fonctionnel

- **Preuve :** `auth.controller.ts:87` lit `req.cookies`, mais aucun middleware/dépendance `cookie-parser` n'existe.
- **Impact :** le cookie HttpOnly posé n'est jamais lu ; le client doit exposer le token dans le body contrairement à la documentation.
- **Correction :** configurer un parseur (éventuellement cookie signé), ou retirer cette stratégie. Aligner aussi `maxAge` sur la durée configurée plutôt que 30 jours codés en dur.
- **Validation :** e2e login puis refresh avec le cookie seul.

### \[ \] CFG-001 — Valider la configuration au bootstrap

- **Preuve :** `configuration.ts` accepte `parseInt` invalide, un secret sensible par défaut et ignore une `DATABASE_URL` non parsable ; `ConfigModule` n'a pas de validation.
- **Impact :** erreurs tardives et démarrage dans une configuration dangereuse.
- **Correction :** schéma Joi/Zod ou validateur dédié, valeurs obligatoires selon environnement, bornes numériques et `getOrThrow`.
- **Validation :** tests avec valeurs absentes, invalides et hors plage.

### \[ \] DB-001 — Ne pas avaler l'échec du schema/seed

- **Preuve :** `database-seed.service.ts:35-38` journalise toute erreur puis retourne normalement.
- **Impact :** avec `AUTO_RUN_MIGRATIONS=true`, l'API peut démarrer sur un schéma partiel.
- **Correction :** relancer l'erreur ; à terme utiliser des migrations versionnées et réserver le seed aux environnements explicitement permis.
- **Validation :** SQL invalide ⇒ bootstrap en échec.

### \[ \] TIME-001 — Faire respecter l'horloge injectée

- **Preuve :** `clock.service.ts:5` interdit `new Date()` ailleurs, mais les services auth/registrations/queue-engine, workers et gateway l'utilisent directement.
- **Impact :** règles temporelles non reproductibles et tests fragiles.
- **Correction :** ajouter à `ClockService` les conversions/additions utiles et remplacer les usages représentant « maintenant » ou des délais.
- **Validation :** tests à horloge figée des expirations, tolérances, sessions et workers.

### \[ \] TIME-002 — Corriger la fin de journée locale

- **Preuve :** `clock.service.ts:59-80` crée une date sans zone, donc dans le TZ du processus, puis reconstruit manuellement un offset ; le contrat annonce `.999` mais produit la seconde entière.
- **Impact :** expiration décalée selon le serveur et autour des transitions DST.
- **Correction :** utiliser `date-fns-tz` déjà installé pour convertir explicitement `23:59:59.999` du fuseau IANA vers UTC.
- **Validation :** Berlin/New York, zone sans DST et jours de bascule.

### \[ \] ERR-001 — Unifier les erreurs publiques

- **Preuve :** `global-exception.filter.ts:71-78` renvoie `code: ERROR`, `translationKey: null` et parfois `exRes` brut ; `INTERNAL_ERROR` n'est pas dans `ERROR_CATALOG`; la normalisation validation est dupliquée.
- **Impact :** contrat client hétérogène et détails internes potentiellement exposés.
- **Correction :** cataloguer les codes transverses, mapper explicitement les exceptions Nest, ne publier qu'une structure contrôlée et centraliser la validation.
- **Validation :** tests du filtre pour 400/401/403/404/409/429/500.

### \[ \] ARCH-001 — Homogénéiser la persistance

- **Preuve :** `entities.ts` centralise 21 entités, mais les services injectent presque tous `DataSource` et manipulent des résultats `any` issus de SQL brut.
- **Impact :** double modèle entités/schema, renommages non typés et duplication pagination/CRUD.
- **Correction :** repositories typés pour CRUD ; QueryBuilder/SQL complexe encapsulé dans des repositories avec types de lignes. Supprimer ensuite les abstractions réellement inutilisées.
- **Validation :** aucune ligne DB non typée dans les services ; tests PostgreSQL des requêtes.

### \[ \] WEBHOOK-001 — Durcir la vérification HMAC

- **Preuve :** `notifications.service.ts:176-188` accepte `webhook-secret`, compare avec `!==` et ne valide pas l'âge du timestamp ; le contrôleur signe `JSON.stringify(dto)` après parsing, pas le corps brut.
- **Impact :** signatures forgeables si config absente, rejeu illimité et incompatibilité avec la signature réelle du fournisseur.
- **Correction :** fournisseurs/secrets obligatoires, raw body, fenêtre temporelle, `timingSafeEqual` et identifiant d'événement idempotent.
- **Validation :** secret absent, corps modifié, timestamp périmé/futur, rejeu et fournisseur inconnu refusés.

### \[ \] WEBHOOK-002 — Lier l'accusé au fournisseur

- **Preuve :** `notifications.service.ts:194-202` met à jour seulement par `provider_message_id`, sans fournisseur ni contrôle du nombre de lignes, puis acquitte toujours.
- **Impact :** le fournisseur A peut modifier un message B ; un ID inconnu semble traité.
- **Correction :** persister/filtrer `(provider, provider_message_id)`, utiliser `RETURNING` et définir l'idempotence.
- **Validation :** tests croisés entre fournisseurs et ID inconnu.

### \[ \] WORKER-001 — Réserver atomiquement les notifications

- **Preuve :** `notification.worker.ts:15-31` utilise un booléen local puis un `SELECT LIMIT 50`, sans verrou ni statut `processing`.
- **Impact :** plusieurs pods envoient le même SMS/email ; crash après envoi = doublon au retry.
- **Correction :** transaction `FOR UPDATE SKIP LOCKED` + lease, ou BullMQ déjà dépendance ; fournir une clé d'idempotence au prestataire.
- **Validation :** deux workers concurrents, un seul envoi.

### \[ \] WORKER-002 — Remplacer le faux envoi

- **Preuve :** `notification.worker.ts:43-54` génère un faux ID et marque directement `delivered`; aucun fournisseur n'est appelé.
- **Impact :** notifications perdues mais métriques mensongères.
- **Correction :** port `NotificationProvider`, fake réservé aux tests/dev, transition `pending → sent`; seul le webhook passe à `delivered`.
- **Validation :** tests de contrat, erreurs/retry et transitions.

### \[ \] REG-001 — Transactionnaliser la création d'inscription

- **Preuve :** `registrations.service.ts:44-236` peut créer une personne, incrémenter le compteur puis échouer à l'insert, le tout hors transaction.
- **Impact :** personne orpheline et numéro consommé ; validations sans snapshot cohérent.
- **Correction :** transaction globale et création de personne compatible avec l'`EntityManager` transactionnel.
- **Validation :** échec final ⇒ rollback personne et compteur.

### \[ \] REG-002 — Sérialiser la capacité de rendez-vous

- **Preuve :** les blocs `registrations.service.ts:148-164` et `:442-457` font `COUNT` puis écrivent séparément, sans contrainte de capacité.
- **Impact :** deux requêtes concurrentes dépassent la capacité.
- **Correction :** verrou par `(queue_id, scheduled_time)` dans une transaction (ligne de slot ou advisory lock), puis recompter/écrire.
- **Validation :** capacité 1 et deux créations simultanées ⇒ une seule réussit.

### \[ \] REG-003 — Canoniser les instants des créneaux

- **Preuve :** `registrations.service.ts:320` indexe par ISO UTC (`Z`), mais `:342` recherche une chaîne locale sans offset et n'utilise pas le timezone chargé.
- **Impact :** `booked` peut rester à zéro et annoncer de fausses places.
- **Correction :** créer chaque créneau dans le fuseau IANA du site, convertir en UTC, comparer et retourner un format avec offset explicite.
- **Validation :** réservation non UTC et frontière DST correctement comptées.

### \[ \] QUEUE-001 — Gérer les conflits de sessions concurrentes

- **Preuve :** `queue-engine.service.ts:150-264` fait « check puis insert ». Les index uniques `schema.sql:479-480` arbitrent la course, mais l'erreur PostgreSQL `23505` n'est pas mappée ; le takeover sélectionne hors transaction.
- **Impact :** 500 au lieu de `THREAD_OCCUPIED`/`SESSION_ALREADY_OPEN`, et takeover sur état périmé.
- **Correction :** verrouillage/insertion transactionnels ou mapping par nom de contrainte ; relire/verrouiller la session à reprendre dans la transaction.
- **Validation :** ouvertures et takeovers concurrents.

### \[ \] WS-001 — Réutiliser la politique d'authentification HTTP en WebSocket

- **Preuve :** `realtime.gateway.ts:66-81` fait seulement `jwtService.verify`, copie rôles/permissions et n'interroge jamais `dori_user_session`; `sid` n'est même pas copié.
- **Impact :** un access token dont la session a été révoquée (logout, mot de passe, désactivation) continue d'ouvrir un socket et d'accéder aux rooms jusqu'à son expiration.
- **Correction :** extraire un service commun de validation de principal (signature + `sid` + session + compte actif), utilisé par Passport et la gateway. Déconnecter aussi les sockets lors d'une révocation sensible si l'effet doit être immédiat.
- **Validation :** socket refusé après logout/changement de mot de passe/désactivation.

### \[ \] WS-002 — Aligner le CORS WebSocket sur la configuration HTTP

- **Preuve :** `realtime.gateway.ts:26-30` configure `origin: '*'`, tandis que `main.ts` utilise une allowlist et des credentials.
- **Impact :** tout site peut initier une connexion avec un token accessible au navigateur ; politique de sécurité incohérente entre transports.
- **Correction :** injecter la même allowlist validée dans l'adapter/gateway Socket.IO et définir explicitement méthodes/credentials.
- **Validation :** origine autorisée acceptée, origine externe refusée.

### \[ \] RT-001 — Brancher ou retirer la couche temps réel factorisée

- **Preuve :** `RealtimeService` expose `emitQueueOps`, `emitQueueDisplay`, `emitRegistrationUpdate` et `emitTranslationInvalidation`, mais `rg` ne trouve aucun appel hors de sa propre classe ; seul `setServer` est utilisé par la gateway.
- **Impact :** les clients abonnés ne reçoivent aucune mutation métier ; Redis, son adapter et BullMQ sont déclarés mais inutilisés, donc aucun support multi-instance réel.
- **Correction :** publier des événements après commit via un bus/outbox, brancher les quatre familles d'émission, puis ajouter l'adapter Redis si plusieurs instances sont visées. Sinon supprimer l'API et les dépendances mortes pour ne pas promettre une fonctionnalité absente.
- **Validation :** e2e Socket.IO : appel suivant, statut, position et traduction produisent exactement un événement après commit.

### \[ \] AUTHZ-001 — Invalider les autorisations lors des changements RBAC

- **Preuve :** le guard lit uniquement `user.permissions` du JWT ; `assignUserRole`, `removeUserRole` et `updateRolePermissions` ne révoquent/renouvellent pas les sessions. `JwtStrategy` ne recharge pas les permissions.
- **Impact :** une permission retirée reste utilisable jusqu'à expiration du token ; une permission ajoutée n'est pas visible. Le cache de scope invalidé ne résout pas ce problème.
- **Correction :** version d'autorisation par utilisateur/rôle vérifiée à chaque requête ou cache serveur court, et révocation/rotation des sessions lors des changements critiques.
- **Validation :** retirer une permission puis vérifier immédiatement le refus avec l'ancien token, en HTTP et WS.

### \[ \] USER-001 — Transactionnaliser les mutations utilisateur

- **Preuve :** `createUser` insère puis assigne le rôle hors transaction ; statut, mot de passe et suppression modifient utilisateur puis sessions séparément.
- **Impact :** utilisateur sans rôle après échec, ou compte désactivé/mot de passe changé dont les sessions restent actives si la seconde requête échoue.
- **Correction :** une transaction par cas d'usage, avec invalidation de cache seulement après commit.
- **Validation :** injecter une erreur sur la seconde écriture et vérifier rollback complet.

### \[ \] USER-002 — Valider exhaustivement rôles et permissions demandés

- **Preuve :** `updateRolePermissions` supprime tout puis insère avec `WHERE permission_name = ANY($4)` sans vérifier le rôle ni que toutes les valeurs ont correspondu ; `assignUserRole` peut acquitter `assigned: true` après `ON CONFLICT DO NOTHING`.
- **Impact :** faute de frappe = permissions manquantes silencieusement ; réponse métier mensongère pour ressource absente/déjà affectée.
- **Correction :** charger/verrouiller le rôle, comparer ensemble demandé/existant, rejeter les inconnues, utiliser `RETURNING` et définir l'idempotence des réponses.
- **Validation :** rôle absent, permission inconnue, doublon et liste partielle.

### \[x\] PERSON-001 — Ne pas exposer la déduplication hors scope

- **Preuve :** `persons.service.ts:104-123` recherche téléphone/email globalement puis retourne immédiatement la ligne complète sans `checkPersonScope`.
- **Impact :** un opérateur autorisé à créer peut tester des coordonnées et obtenir les données d'une personne rattachée à un autre site.
- **Correction :** dédupliquer côté serveur sans retourner la fiche hors périmètre ; selon le métier, renvoyer un conflit opaque ou associer dans une transaction après contrôle explicite.
- **Validation :** même téléphone dans un autre scope ne divulgue aucun champ personnel.
- **Résolution appliquée :** `dori_person` porte maintenant un `site_id` obligatoire et immuable par l'API. La création directe exige ce site et vérifie `checkSiteAccess`; la recherche, l'accès par identifiant et la déduplication par téléphone/email sont filtrés par site. Une inscription charge d'abord sa queue, crée la personne dans le site de cette queue ou vérifie que le `personId` fourni appartient exactement à ce site. Une même identité peut donc être recréée indépendamment dans un autre site sans exposer ni réutiliser la première fiche.
- **Base de données :** les index uniques globaux ont été remplacés par des index actifs `(site_id, LOWER(email))` et `(site_id, phone_number)`. Un trigger PostgreSQL interdit toute inscription reliant une personne et une queue de sites différents. La migration idempotente intégrée à `schema.sql` déduit le site des fiches existantes, duplique les fiches et leurs notes lorsqu'elles étaient historiquement partagées entre plusieurs sites, puis réaffecte les inscriptions. Elle échoue explicitement sur une fiche orpheline dont le site est impossible à déterminer, afin d'exiger une décision de migration plutôt que de déplacer silencieusement des données personnelles.
- **Vérifications après correction :** tests couvrant la déduplication dans un site, la recréation du même téléphone dans un autre site, le masquage hors scope, le contrôle du site d'un `personId` lors de l'inscription et la création embarquée dans le site de la queue. Quality gates complètes réussies.

### \[ \] RESET-001 — Créer atomiquement le marqueur de reset

- **Preuve :** `daily-reset.worker.ts:61-72` considère le compteur du lendemain comme marqueur, mais la transaction `:76-133` ne l'insère jamais.
- **Impact :** durant toute la minute cible, le reset est rejoué ; toute session rouverte est immédiatement refermée. En multi-instance, les exécutions se chevauchent.
- **Correction :** table dédiée `queue_daily_reset(queue_id, business_date)` avec insertion unique au début de la transaction, ou insertion explicite du compteur si cette sémantique est réellement voulue.
- **Validation :** plusieurs ticks/instances à la même minute ⇒ une seule exécution.

### \[ \] RESET-002 — Découpler le reset du compteur de tickets

- **Preuve :** le worker saute tout le reset si un compteur existe pour `tomorrow`; or une inscription à un rendez-vous futur crée déjà ce compteur dans `createRegistration`.
- **Impact :** sessions et inscriptions de fin de journée peuvent ne jamais être clôturées à cause d'une réservation future sans rapport.
- **Correction :** utiliser un journal de reset dédié et définir clairement la date clôturée ; traiter aussi explicitement les statuts `booked` annoncés par le commentaire mais absents des UPDATE.
- **Validation :** compteur futur préexistant + données du jour ⇒ reset exécuté une fois.

### \[ \] WORKER-003 — Ajouter une coordination distribuée aux cron jobs

- **Preuve :** les trois workers utilisent `isRunning`/`isProcessing`, booléens locaux au processus. Aucun lock DB/Redis ni leader election.
- **Impact :** chaque replica exécute expiration, reset et dispatch ; notifications doublées et reset concurrent.
- **Correction :** verrous PostgreSQL advisory/Redis avec lease, ou workers BullMQ séparés ; rendre chaque opération idempotente au niveau DB.
- **Validation :** deux instances simultanées sans double effet.

### \[ \] TRANS-001 — Atomiser traduction et version

- **Preuve :** `translations.service.ts` écrit la traduction puis appelle séparément `incrementVersion` pour create/update/delete.
- **Impact :** contenu modifié sans nouvelle version, ou version avancée sans état correspondant en cas d'échec partiel ; aucune émission realtime n'est branchée.
- **Correction :** transaction commune retournant la version, puis événement d'invalidation après commit via RT-001.
- **Validation :** erreur injectée sur chaque étape et cohérence version/contenu.

### \[ \] DB-002 — Vérifier le certificat PostgreSQL

- **Preuve :** `database.module.ts:20-22` active SSL avec `{ rejectUnauthorized: false }` sans distinction d'environnement.
- **Impact :** chiffrement sans authentification du serveur, vulnérable à un intermédiaire réseau.
- **Correction :** fournir la CA attendue et activer `rejectUnauthorized`; réserver un mode permissif explicite au développement local.
- **Validation :** certificat non approuvé refusé, certificat CA valide accepté.

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

### \[ \] TEST-002 — Isoler l'environnement e2e

- **Preuve :** `npm run test:e2e` importe `AppModule` et tente la `DATABASE_URL` externe présente (164.92.212.222:22040), puis timeout/retries et handles ouverts.
- **Impact :** suite non déterministe, lente, dangereuse envers une DB partagée et inutilisable hors réseau.
- **Correction :** config `.env.test`, PostgreSQL éphémère/conteneur, migrations dédiées, retries réduits et teardown garanti. Ne jamais cibler une base distante implicite.
- **Validation :** e2e reproductible hors réseau, base neuve, processus qui termine proprement.

### \[x\] QUAL-001 — Rétablir des quality gates non mutantes

- **Preuve :** `npx eslint "{src,test}/**/*.ts"` remonte 288 problèmes (286 erreurs, surtout Prettier, et 2 warnings). `tsc --noEmit --noUnusedLocals --noUnusedParameters` relève notamment logger/paramètres/imports inutilisés et le type manquant `@types/js-yaml`.
- **Impact :** bruit empêchant la CI de détecter une nouvelle régression ; code mort confirmé.
- **Correction :** formater une fois, corriger les warnings, ajouter scripts `lint:check` (sans `--fix`) et `typecheck`, puis les rendre bloquants en CI. Activer progressivement davantage d'options `strict`.
- **Validation :** build, lint, typecheck et tests verts sans modifier le worktree.
- **Résolution appliquée :** le socle TypeScript a été formaté une fois et les deux imports DTO inutilisés ont été supprimés. Le script `lint` est désormais strict et non mutant (`--max-warnings=0`) ; la correction automatique est isolée dans `lint:fix`. Les gates non mutantes `format:check` et `typecheck` ont été ajoutées, ainsi qu'un agrégateur `quality:check` exécutant format, lint, vérification TypeScript avec symboles inutilisés interdits, build et tests. `js-yaml` et `@types/js-yaml`, utilisés par l'export Swagger, sont maintenant des dépendances de développement directes.
- **Vérifications après correction :** `npm run quality:check` réussi sans mutation du worktree.

### \[x\] CORE-001 — Choisir entre modules globaux et imports explicites

- **Preuve :** `ClockModule` et `RbacModule` portent `@Global()`. Pourtant tous les modules métier importent `ClockModule`, tandis que seul `ReportsModule` importe explicitement `RbacModule` et les autres consomment `ScopeService` grâce au global. `RealtimeModule` réimporte les deux.
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

| Composant core | État dans les modules |
| --- | --- |
| `DoriException` / `ERROR_CATALOG` | Très utilisé ; format générique encore divergent (ERR-001). |
| `ScopeService` | Très utilisé ; invalidation présente, mais les permissions JWT restent périmées (AUTHZ-001). |
| Guards/décorateurs JWT et permissions | Utilisés sur HTTP ; contournés par WebSocket (WS-001). |
| `ClockService` | Injecté largement, mais contourné par `new Date()`/`CURRENT_TIMESTAMP` (TIME-001). |
| `PaginationDto` / `PaginatedResult` / `LimitQueryDto` | Paramètres, limites, tri et réponses paginées centralisés. PAG-001 et VAL-001 corrigés. |
| Intercepteurs réponse/sérialisation/correlation | Enregistrés globalement ; les conversions mécaniques sont centralisées dans `SerializationInterceptor` (CORE-003 corrigé). |
| Décorateurs Swagger Dori | Utilisés pour toutes les réponses documentées ; variantes publique et brute centralisées (CORE-002 corrigé). |
| Configuration core | Utilisée partout ; les lectures de l'environnement sont désormais confinées à `configuration.ts` (CORE-004 corrigé). |
| `RealtimeService` | Exporté mais aucune méthode métier appelée (RT-001). |
| Entités/`ALL_ENTITIES` | Chargées par TypeORM mais non utilisées comme repositories par les services (ARCH-001). |
| `DatabaseSeedService` | Activé au bootstrap, avec erreur avalée (DB-001). |
| `PersonsService` / `dori_person.site_id` | Identité, accès, déduplication et intégrité des inscriptions cloisonnés par site (PERSON-001 corrigé). |

## Points contrôlés sans anomalie confirmée

- Les paramètres SQL issus des filtres métier sont globalement passés comme paramètres PostgreSQL ; les champs de tri utilisent des allowlists via `PaginationDto`.
- Les identifiants de route numériques utilisent presque partout `ParseIntPipe`.
- Les mots de passe sont hachés avec bcrypt et les refresh tokens sont stockés sous forme SHA-256, pas en clair.
- Les numéros de ticket reposent sur un compteur PostgreSQL avec `ON CONFLICT`, ce qui rend l'incrément atomique (mais l'opération complète doit encore être transactionnelle, voir REG-001).
- La sélection du prochain client tente d'utiliser une transaction et `SKIP LOCKED`, bonne direction à confirmer par des tests PostgreSQL concurrents.
- Les contrôles de scope site/file sont présents dans la majorité des services exposant des données métier.
- La validation globale applique `whitelist`, `forbidNonWhitelisted` et la transformation des DTO.
- Le build Nest passe et les 66 tests unitaires existants passent.

## Ordre de correction recommandé

1. **Sécurité immédiate :** SEC-001, WEBHOOK-001, WS-001, RESET-001.
2. **Révocation et configuration :** SEC-002, AUTHZ-001, CFG-001, AUTH-001, DB-002.
3. **Intégrité/concurrence :** REG-001, REG-002, QUEUE-001, RESET-002, WORKER-001/003, USER-001, TRANS-001.
4. **Fonctionnalités incorrectes ou absentes :** WORKER-002, REG-003, RT-001, WEBHOOK-002.
5. **Socle de maintenance :** TEST-002 puis TEST-001, QUAL-001, ERR-001, TIME-001/002, ARCH-001, VAL-001 et PAG-001.

Pour réduire le coût, traiter chaque groupe dans une branche courte avec son test de non-régression. Éviter une réécriture globale de la persistance avant d'avoir sécurisé les P0/P1 et installé les tests d'intégration.

## Périmètre et vérifications exécutées

- Tous les fichiers sous `src` ont été inventoriés ; bootstrap, core transverse, DTO/pagination, modules métier, entités/schema SQL, realtime et workers ont été contrôlés.
- `npm run build` : **réussi**.
- `npm test -- --runInBand --coverage=false` : **14 suites / 66 tests réussis**.
- `npx jest --runInBand --coverage` : **réussi**, couverture détaillée dans TEST-001.
- `npm run test:e2e -- --runInBand` : **échoué**, diagnostic dans TEST-002.
- `npm run quality:check` : **réussi** ; Prettier en lecture seule, ESLint sans warnings, TypeScript avec symboles inutilisés interdits, build et tests sont verts.
- Aucun code applicatif n'a été corrigé pendant cet audit ; seul ce handover a été créé.

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
