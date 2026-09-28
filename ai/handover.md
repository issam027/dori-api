# DORI-API — Rapport d'Audit & Document de Reprise IA (Handover)

> **Date** : 2026-09-28  
> **Projet** : API NestJS de gestion de files d'attente (dori-api)  
> **Objectif** : Ce document consigne l'ensemble des incohérences, vulnérabilités, failles d'homogénéité et dysfonctionnements identifiés sur la base de code pour permettre une reprise et une résolution systématique par une IA ou un développeur.

---

## Sommaire

1. [Matrice de Priorisation](#matrice-de-priorisation)
2. [Sécurité, Authentification & Périmètre RBAC](#1-sécurité-authentification--périmètre-rbac)
3. [Architecture, Modèle de Données & Concurrence](#2-architecture-modèle-de-données--concurrence)
4. [Validation, Tri, Pagination & Filtrage](#3-validation-tri-pagination--filtrage)
5. [Contrats d'API, Documentation Swagger / OpenAPI & Routage](#4-contrats-dapi-documentation-swagger--openapi--routage)
6. [Gestion des Erreurs & Formats de Réponse](#5-gestion-des-erreurs--formats-de-réponse)
7. [Workers & Tâches d'Arrière-Plan](#6-workers--tâches-darrière-plan)
8. [Checklist Globale de Résolution IA](#7-checklist-globale-de-résolution-ia)

---

## Matrice de Priorisation

| Réf | Catégorie | Intitulé | Sévérité | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Sécurité | Endpoints utilisateurs sans aucun guard `@RequirePermission` | **Critique** | Élévation de privilèges, accès non restreint |
| **SEC-02** | Sécurité | Vérification de session active JWT décorrélée de l'appareil | **Élevé** | Déconnexion inopérante sur JWT actif |
| **SEC-03** | Sécurité | Logout révoque toutes les sessions en l'absence de cookie | **Élevé** | Déconnexion involontaire multi-appareils (mobile/SPA) |
| **SEC-04** | Sécurité | Asymétrie rôle manager vs opérateur lors de l'assignation | **Élevé** | Assignation illégitime d'opérateurs sur les files |
| **SEC-05** | Sécurité | WebSocket accepte les utilisateurs dont la session est révoquée | **Moyen** | Fuite d'événements temps réel |
| **DAT-01** | Données | `DailyResetWorker` saute la réinitialisation si un RDV existe demain | **Critique** | Blocage complet du reset quotidien |
| **DAT-02** | Données | Absence de transaction sur l'inscription client (`registerCustomer`) | **Élevé** | Incohérence des compteurs et états orphelins |
| **DAT-03** | Données | Race condition sur la capacité des créneaux de RDV | **Élevé** | Surréservation de créneaux |
| **DAT-04** | Données | Entités TypeORM définies mais inutilisées (100% SQL brut) | **Moyen** | Dette technique et maintenance confuse |
| **DAT-05** | Données | Soft delete incomplet (User et Person non supprimables) | **Moyen** | Impossibilité de supprimer comptes et profils |
| **VAL-01** | Validation | Risque d'injection SQL & crash sur le tri `?sort=field:dir` | **Élevé** | Crash 500 sur `?sort=id:asc` et injection SQL |
| **VAL-02** | Validation | Fausse pagination / tronquage invisible à 25 éléments | **Moyen** | Données invisibles pour les clients d'API |
| **VAL-03** | Validation | Paramètres libres non typés dans `ReportsController` | **Moyen** | Risque d'erreurs SQL sur format de date invalide |
| **API-01** | Swagger | Contrats Swagger contradictoires (Tableau déclaré vs Objet paginé) | **Élevé** | Clients d'API et SDKs générés cassés |
| **API-02** | Swagger | Absence totale de Swagger sur `Users` et `Translations` | **Moyen** | Documentation incomplète pour le front |
| **API-03** | Routage | Doublon des routes Health check (`/health` vs `/api/v1/health`) | **Mineur** | Confusion DevOps |
| **API-04** | Routage | `Translations/bundle` non public | **Moyen** | Blocage des écrans et bornes avant login |
| **WRK-01** | Workers | `AppointmentExpiryWorker` : variable `affected` toujours undefined | **Moyen** | Absence de suivi et logs d'expiration |
| **WRK-02** | Workers | Vérification HMAC du webhook par `JSON.stringify(dto)` | **Élevé** | Rejet systématique des accusés de remise SMS/Email |
| **WRK-03** | Workers | `NotificationWorker` sans `SKIP LOCKED` (concurrence cluster) | **Moyen** | Doublons d'envoi de SMS en environnement distribué |
| **WRK-04** | Architecture | Violation de l'obligation d'utiliser `ClockService` (`new Date()`) | **Mineur** | Impossibilité de tester le temps de façon déterministe |

---

## 1. Sécurité, Authentification & Périmètre RBAC

### SEC-01 — Endpoints de gestion des utilisateurs sans protection RBAC
* **Fichier impacté** : `src/modules/users/users.controller.ts`
* **Problème constaté** :  
  Seul l'endpoint `updateRolePermissions` possède `@RequirePermission('system_manage')`.  
  Les endpoints suivants sont dépourvus de `@RequirePermission` :
  * `GET /api/v1/users` (`findUsers`)
  * `POST /api/v1/users` (`createUser`)
  * `GET /api/v1/users/:userId` (`findUserById`)
  * `PATCH /api/v1/users/:userId` (`updateUser`)
  * `PATCH /api/v1/users/:userId/status` (`updateUserStatus`)
  * `PATCH /api/v1/users/:userId/password` (`setUserPassword`)
  * `POST /api/v1/users/:userId/roles` (`assignUserRole`)
  * `DELETE /api/v1/users/:userId/roles/:roleId` (`removeUserRole`)
  * `GET /api/v1/roles` (`getRoles`)
* **Comportement attendu** :  
  Appliquer les permissions prévues dans le catalogue (`user_manage_kiosk`, `user_manage_hostess`, `user_manage_manager`, `user_manage_admin`, `user_queue_assign`, `user_site_assign`) conformément à `seed.sql`.

### SEC-02 — Déconnexion unitaire inopérante pour le JWT actif
* **Fichiers impactés** :
  * `src/core/auth/strategies/jwt.strategy.ts` (lignes 28–38)
  * `src/modules/auth/auth.service.ts` (lignes 327–355)
* **Problème constaté** :  
  `JwtStrategy` exécute :
  ```sql
  SELECT session_id FROM dori_user_session
  WHERE user_id = $1 AND revoked_reason IS NULL AND revoked_at IS NULL
    AND expires_at > NOW() LIMIT 1
  ```
  Le JWT ne contient pas de lien vers son `session_id`. Si l'utilisateur est connecté sur un ordinateur et un téléphone et se déconnecte du téléphone, le token du téléphone reste valide tant que la session de l'ordinateur existe.
* **Comportement attendu** :  
  Inclure `sessionId` dans le payload JWT et vérifier dans `JwtStrategy` que la session spécifique (`session_id = payload.sid`) n'est ni révoquée ni expirée.

### SEC-03 — Révocation globale involontaire lors du logout
* **Fichiers impactés** :
  * `src/modules/auth/auth.controller.ts` (lignes 110–118)
  * `src/modules/auth/auth.service.ts` (lignes 183–200)
* **Problème constaté** :  
  `AuthController.logout` extrait `req.cookies?.refreshToken`. Si l'application consommatrice est une application mobile ou une SPA qui ne transmet pas de cookie mais des tokens JSON/Bearer, `refreshToken` vaut `undefined`.  
  Dans ce cas, `AuthService.logout` exécute :
  ```sql
  UPDATE dori_user_session SET revoked_at = $1, revoked_reason = 'logout'
  WHERE user_id = $2 AND revoked_at IS NULL
  ```
  Cela révoque toutes les sessions de l'utilisateur sur tous ses appareils au lieu de la session courante.
* **Comportement attendu** :  
  Permettre de transmettre `refreshToken` également dans le corps de la requête (`LogoutDto`) ou cibler la session correspondant au JWT porteur.

### SEC-04 — Asymétrie de contrôle de rôle lors des affectations
* **Fichiers impactés** :
  * `src/modules/sites/sites.service.ts` (lignes 283–302)
  * `src/modules/queues/queues.service.ts` (lignes 559–587)
* **Problème constaté** :  
  `assignSiteManager` vérifie explicitement que `targetUserId` possède bien le rôle `manager` actif.  
  En revanche, `assignOperator` dans `queues.service.ts` insère directement dans `dori_user_queue` sans vérifier :
  1. Si `targetUserId` existe et est actif dans `dori_user`.
  2. Si `targetUserId` possède le rôle requis (`hotesse` / opérateur).
* **Comportement attendu** :  
  Valider l'existence de l'utilisateur et son rôle avant insertion dans `dori_user_queue`.

### SEC-05 — Absence de vérification de session active sur WebSocket
* **Fichier impacté** : `src/core/realtime/realtime.gateway.ts` (lignes 67–84)
* **Problème constaté** :  
  La passerelle WebSocket vérifie le token JWT via `jwtService.verify()` mais ne consulte pas la table `dori_user_session` ni `dori_user.is_active`. Un utilisateur révoqué ou désactivé peut maintenir ou ouvrir une socket tant que la signature du token reste valide.
* **Comportement attendu** :  
  Appliquer la même règle que `JwtStrategy` lors de `handleConnection`.

---

## 2. Architecture, Modèle de Données & Concurrence

### DAT-01 — Bug bloquant de réinitialisation quotidienne (`DailyResetWorker`)
* **Fichier impacté** : `src/workers/daily-reset/daily-reset.worker.ts` (lignes 60–70, 75–135)
* **Problème constaté** :  
  Le worker utilise cette condition d'idempotence :
  ```ts
  const counter = await this.dataSource.query(
    `SELECT last_number FROM dori_queue_counter WHERE queue_id = $1 AND business_date = $2`,
    [q.queue_id, tomorrow],
  );
  if (counter && counter.length > 0) continue;
  ```
  1. Si un usager a réservé un rendez-vous pour demain au cours de la journée, `dori_queue_counter` existe déjà pour `tomorrow`. Le reset est alors **définitivement ignoré** pour cette file.
  2. La transaction du worker ne crée même pas la ligne dans `dori_queue_counter` pour `tomorrow`.
* **Comportement attendu** :  
  Créer une table ou colonne dédiée d'audit des resets (ex : `dori_queue_daily_reset_log` ou `last_daily_reset_date` sur la file) pour garantir l'idempotence indépendamment de la présence de compteurs futurs.

### DAT-02 — Absence de transaction sur l'inscription client
* **Fichier impacté** : `src/modules/registrations/registrations.service.ts` (lignes 154–220)
* **Problème constaté** :  
  `registerCustomer` enchaîne :
  1. Incrément du compteur (`dori_queue_counter`)
  2. Création éventuelle de la personne (`dori_person`)
  3. Insertion de l'inscription (`dori_customer`)
  4. Création de la notification de bienvenue (`dori_notification`)
  Ces opérations ne sont pas entourées d'un `this.dataSource.transaction(...)`. Si l'étape 3 ou 4 échoue, le numéro de ticket a déjà été consommé et les entités restent désynchronisées.
* **Comportement attendu** :  
  Encapsuler l'ensemble du flux dans une transaction atomique.

### DAT-03 — Surréservation concurrente des créneaux de RDV
* **Fichier impacté** : `src/modules/registrations/registrations.service.ts` (lignes 135–146)
* **Problème constaté** :  
  Le contrôle `SELECT COUNT(*)::int as count FROM dori_customer WHERE queue_id = $1 AND scheduled_time = $2 ...` est exécuté sans verrouillage. Deux requêtes simultanées liront le même effectif sous le seuil et réserveront en parallèle, violant `slot_capacity`.
* **Comportement attendu** :  
  Utiliser un verrou applicatif ou transactionnel (`SELECT ... FOR UPDATE` sur le créneau ou contrainte d'exclusion).

### DAT-04 — Découplage complet TypeORM / SQL brut
* **Fichiers impactés** :
  * `src/core/database/entities.ts`
  * `src/core/database/database.module.ts`
  * Tous les services de modules (`sites.service.ts`, `queues.service.ts`, etc.)
* **Problème constaté** :  
  21 fichiers d'entités TypeORM sont maintenus et synchronisés dans `entities.ts`, mais le code applicatif utilise exclusivement `dataSource.query(...)`. Cela crée un risque de divergence entre les types TypeScript des entités et le schéma SQL réel de `schema.sql`.
* **Comportement attendu** :  
  Homogénéiser : soit adopter les `Repository<T>` TypeORM pour les opérations CRUD simples, soit assumer une couche SQL légère en maintenant des interfaces de typage strictes sur les retours SQL.

### DAT-05 — Incohérence des suppressions (Soft Delete)
* **Fichiers impactés** :
  * `src/modules/users/users.service.ts` (colonne `deleted_at` présente en base, aucune méthode de suppression)
  * `src/modules/persons/persons.service.ts` (colonne `deleted_at` présente en base, aucune méthode de suppression)
  * `src/modules/queues/queues.service.ts` (`deleteQueue` ne vérifie pas l'existence et ne cascade pas)
* **Comportement attendu** :  
  Fournir des endpoints de désactivation / soft-delete uniformes pour les utilisateurs et les personnes, et vérifier l'existence avant d'appliquer un UPDATE de suppression.

---

## 3. Validation, Tri, Pagination & Filtrage

### VAL-01 — Concaténation de `sortField` dans les clauses SQL (Risque d'injection & crash)
* **Fichiers impactés** :
  * `src/core/pagination/pagination.dto.ts` (lignes 9–49)
  * `src/modules/sites/sites.service.ts` (lignes 40, 237, 265)
  * `src/modules/queues/queues.service.ts` (lignes 65, 552)
  * `src/modules/users/users.service.ts` (ligne 123)
* **Problème constaté** :  
  1. `PaginationDto.parsedSort` convertit la chaîne en snake_case mais ne valide pas si le champ existe dans la table cible.
  2. Dans `sites.service.ts` (`findSites`), le code exécute :
     ```ts
     query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`;
     ```
     Si le client appelle `GET /api/v1/sites?sort=id:desc`, l'API tente `ORDER BY id DESC` et échoue en 500 car la colonne s'appelle `site_id`.
  3. Dans `users.service.ts` ou `queues.service.ts`, des rustines manuelles `sortField === 'id' ? 'queue_id' : sortField` ont été dispersées sans standardisation.
* **Comportement attendu** :  
  Implémenter une liste blanche des champs de tri autorisés par ressource (allowlist) dans chaque service ou étendre `PaginationDto` pour rejeter les champs non autorisés.

### VAL-02 — Fausse pagination et tronquage masqué
* **Fichiers impactés** :
  * `src/modules/sites/sites.service.ts` (`findSiteManagers` vs `getSiteManagers`)
  * `src/modules/persons/persons.service.ts` (`findPersonNotes` vs `getNotes`)
  * `src/modules/service-tiers/service-tiers.service.ts` (`findQueueTiers` vs `getQueueTiers`)
* **Problème constaté** :  
  Les méthodes de contrôleurs appellent des wrappers internes qui exécutent la méthode paginée avec `new PaginationDto()` en dur, puis renvoient `res.items`.  
  Conséquence : si une personne a 30 notes ou un site 30 managers, les éléments au-delà du 25ème sont masqués et le client d'API n'a aucun moyen de demander la page 2.
* **Comportement attendu** :  
  Exposer explicitement `@Query() pagination: PaginationDto` sur les routes de sous-ressources ou renvoyer la totalité sans pagination si le volume est garanti restreint.

### VAL-03 — Paramètres de requête libres dans `ReportsController`
* **Fichier impacté** : `src/modules/reports/reports.controller.ts` (lignes 48–54, 73–81, 107–116)
* **Problème constaté** :  
  Les paramètres `date`, `siteId`, `limit` sont injectés via `@Query('date') date: string` et convertis par `parseInt(limit, 10)` au lieu d'utiliser un DTO de validation (`ReportQueryDto`). Une date non conforme (ex: `date=foo`) est transmise directement à la clause SQL `$2` de PostgreSQL.
* **Comportement attendu** :  
  Créer des DTOs de filtres avec `@IsDateString()`, `@IsInt()`, `@Type(() => Number)` validés par le `ValidationPipe` global.

---

## 4. Contrats d'API, Documentation Swagger / OpenAPI & Routage

### API-01 — Contradiction entre Swagger et réponse réelle
* **Fichiers impactés** :
  * `src/modules/sites/sites.controller.ts` (ligne 132 : `getQueues`)
  * `src/modules/service-tiers/service-tiers.controller.ts` (ligne 58 : `findTiers`)
  * `src/modules/queues/queues.controller.ts` (ligne 190 : `getOperators`)
* **Problème constaté** :  
  Les contrôleurs déclarent `@ApiDoriOkResponse([MonDto])` (un tableau d'objets), mais la méthode de service retourne `pagination.createResponse(items, total)` :
  ```json
  {
    "items": [...],
    "page": 1,
    "pageSize": 25,
    "total": 3,
    "totalPages": 1
  }
  ```
  Le contrat Swagger est faux, ce qui fait échouer les générateurs de SDK front (ex: openapi-generator / orval).
* **Comportement attendu** :  
  Déclarer les DTOs paginés correspondants (`PaginatedQueueResponseDto`, etc.) dans les décorateurs Swagger.

### API-02 — Contrôleurs sans documentation Swagger
* **Fichiers impactés** :
  * `src/modules/users/users.controller.ts`
  * `src/modules/translations/translations.controller.ts`
* **Problème constaté** :  
  Aucun endpoint de ces deux contrôleurs n'a d'annotations `@ApiOperation`, `@ApiParam`, `@ApiDoriOkResponse` ou `@ApiDoriCreatedResponse`.
* **Comportement attendu** :  
  Ajouter la documentation Swagger complète pour homogénéiser avec les autres modules (`sites`, `queues`, `registrations`).

### API-03 — Doublon d'endpoints Health Check
* **Fichiers impactés** :
  * `src/app.controller.ts` (`GET /health`)
  * `src/core/health/health.controller.ts` (`GET /api/v1/health`)
* **Problème constaté** :  
  Deux endpoints de santé concurrents coexistent dans l'application, l'un sans préfixe d'API renvoyant un simple `{ status: 'ok' }`, l'autre complet avec statut DB et mémoire sous `/api/v1/health`.
* **Comportement attendu** :  
  Supprimer l'endpoint doublon de `AppController` et unifier sur `/api/v1/health` (avec une redirection éventuelle depuis `/health`).

### API-04 — Bundle de traductions inaccessible aux clients anonymes
* **Fichier impacté** : `src/modules/translations/translations.controller.ts` (ligne 35)
* **Problème constaté** :  
  `GET /api/v1/translations/bundle` ne possède pas le décorateur `@Public()`. Le contrôleur étant sous `@ApiBearerAuth('bearer')` et gardé par `JwtAuthGuard` global, les bornes interactives et écrans d'affichage en salle ne peuvent pas charger le catalogue de langues avant la connexion d'un utilisateur.
* **Comportement attendu** :  
  Ajouter `@Public()` sur `getBundle`.

### API-05 — Paramètre obligatoire déclaré optionnel dans Swagger
* **Fichier impacté** : `src/modules/queue-engine/queue-engine.controller.ts` (lignes 51–56)
* **Problème constaté** :  
  Pour `@Get('sites/:siteId/next-preview')`, Swagger déclare `@ApiParam({ name: 'siteId', required: false })`. Or, `:siteId` dans le chemin est obligatoire et le `ParseIntPipe` génère une erreur 400 s'il n'est pas fourni.
* **Comportement attendu** :  
  Mettre `required: true`.

---

## 5. Gestion des Erreurs & Formats de Réponse

### ERR-01 — Format divergent pour l'erreur `VALIDATION_ERROR`
* **Fichiers impactés** :
  * `src/core/errors/global-exception.filter.ts` (lignes 48–54)
  * `src/modules/registrations/registrations.service.ts` (lignes 49, 123, 416, 474)
  * `src/modules/queue-engine/queue-engine.service.ts` (lignes 121, 135)
* **Problème constaté** :  
  * Rejet par le `ValidationPipe` (class-validator) :
    ```json
    {
      "code": "VALIDATION_ERROR",
      "translationKey": "errors.validation_error",
      "translationParams": {},
      "data": { "errors": ["queueId must be an integer"] }
    }
    ```
  * Rejet manuel dans le code : `throw new DoriException('VALIDATION_ERROR', { message: '...' })` place le message dans `translationParams` et laisse `data: null`.
* **Comportement attendu** :  
  Standardiser la signature de `DoriException` pour que les détails d'erreurs soient toujours placés dans `data.errors` ou `data.message`.

### ERR-02 — Erreur de clé étrangère PostgreSQL transformée en 500
* **Fichier impacté** : `src/modules/registrations/registrations.service.ts` (lignes 46–58)
* **Problème constaté** :  
  Dans `registerCustomer`, si le client fournit un `dto.personId = 999999` qui n'existe pas en base, aucune vérification n'est faite. La tentative d'insertion dans `dori_customer` échoue sur la contrainte `fk_customer_person` et renvoie une erreur 500 `INTERNAL_ERROR`.
* **Comportement attendu** :  
  Vérifier l'existence de la personne et lever `PERSON_NOT_FOUND` (404).

### ERR-03 — Hachage de mot de passe non uniforme
* **Fichiers impactés** :
  * `src/modules/users/users.service.ts` (ligne 182 : coût 12 en dur)
  * `src/modules/auth/auth.service.ts` (ligne 264 : coût lu via `ConfigService`)
* **Comportement attendu** :  
  Injecter et utiliser systématiquement la valeur configurée dans `ConfigService` (`security.bcryptRounds`).

---

## 6. Workers & Tâches d'Arrière-Plan

### WRK-01 — Détection du retour SQL erronée dans `AppointmentExpiryWorker`
* **Fichier impacté** : `src/workers/appointment-expiry/appointment-expiry.worker.ts` (lignes 21–41)
* **Problème constaté** :  
  Le worker écrit :
  ```ts
  const [rows, affected] = await this.dataSource.query(`UPDATE ... RETURNING ...`);
  if (affected && affected.length > 0) { ... }
  ```
  Sous TypeORM avec le pilote PostgreSQL, `dataSource.query()` renvoie un tableau contenant directement les lignes retournées par `RETURNING`. La déstructuration positionne la première ligne dans `rows` et `undefined` dans `affected`. Le bloc de log ne s'exécute jamais.
* **Comportement attendu** :  
  Récupérer `const rows = await this.dataSource.query(...)` et tester `if (rows && rows.length > 0)`.

### WRK-02 — Vérification HMAC Webhook avec `JSON.stringify(dto)`
* **Fichier impacté** : `src/modules/notifications/notifications.controller.ts` (lignes 165–172)
* **Problème constaté** :  
  Le calcul HMAC s'appuie sur `JSON.stringify(dto)`. Dès lors qu'un espace, saut de ligne ou ordonnancement de clés diffère entre le payload brut HTTP transmis par Twilio/Infobip et la resérialisation de l'objet TypeScript par V8, la signature calculée est différente et le webhook est rejeté en 401.
* **Comportement attendu** :  
  Capturer et conserver le buffer brut (`req.rawBody`) au niveau du middleware Express et vérifier la signature HMAC sur ce buffer.

### WRK-03 — Concurrence et doublons sur `NotificationWorker`
* **Fichier impacté** : `src/workers/notification-worker/notification.worker.ts` (lignes 20–26)
* **Problème constaté** :  
  La requête de dépilement `SELECT ... FROM dori_notification WHERE notification_status = 'pending' ... LIMIT 50` ne pose aucun verrou. En cas de scaling horizontal (plusieurs pods ou instances Node.js), les deux instances dépilent simultanément les mêmes notifications et envoient des SMS en doublon aux usagers.
* **Comportement attendu** :  
  Ajouter la clause `FOR UPDATE SKIP LOCKED`.

### WRK-04 — Violation de la centralisation temporelle (`ClockService`)
* **Fichiers impactés** :
  * `src/workers/notification-worker/notification.worker.ts` (ligne 35)
  * `src/core/realtime/realtime.service.ts` (lignes 39, 68)
  * `src/core/realtime/realtime.gateway.ts` (lignes 100, 209)
  * `src/core/health/health.controller.ts` (ligne 119)
  * `src/app.controller.ts` (ligne 22)
* **Problème constaté** :  
  Tous ces composants instancient `new Date()` au lieu d'injecter `ClockService.now()`, rendant les tests temporels et les simulations d'horodatage impossibles.
* **Comportement attendu** :  
  Injecter `ClockService` et remplacer tous les `new Date()`.

---

## 7. Checklist Globale de Résolution IA

Cette checklist est prête pour l'exécution tâche par tâche par un agent IA :

- [ ] **Phase 1 — Sécurité & RBAC**
  - [ ] SEC-01 : Poser les décorateurs `@RequirePermission` sur tous les endpoints de `UsersController`.
  - [ ] SEC-02 : Ajouter le `sessionId` au payload JWT et vérifier la session spécifique dans `JwtStrategy`.
  - [ ] SEC-03 : Ajouter `LogoutDto` avec `refreshToken` optionnel pour supporter le logout mobile/SPA sans cookie.
  - [ ] SEC-04 : Valider l'existence et le rôle `hotesse`/opérateur dans `QueuesService.assignOperator`.
  - [ ] SEC-05 : Valider l'état de la session dans `RealtimeGateway.handleConnection`.

- [ ] **Phase 2 — Workers & Robustesse Données**
  - [ ] DAT-01 : Corriger l'idempotence du `DailyResetWorker` (découpler de `dori_queue_counter`).
  - [ ] DAT-02 : Envelopper `RegistrationsService.registerCustomer` dans une transaction atomique.
  - [ ] DAT-03 : Verrouiller la vérification de capacité des créneaux de RDV (`FOR UPDATE`).
  - [ ] WRK-01 : Corriger la lecture du résultat de la requête SQL dans `AppointmentExpiryWorker`.
  - [ ] WRK-02 : Conserver `req.rawBody` et l'utiliser pour la signature HMAC dans `NotificationsController`.
  - [ ] WRK-03 : Ajouter `FOR UPDATE SKIP LOCKED` sur la sélection de `NotificationWorker`.
  - [ ] WRK-04 : Remplacer les `new Date()` restants par `ClockService`.

- [ ] **Phase 3 — Filtres, Tri & Pagination**
  - [ ] VAL-01 : Implémenter une allowlist de colonnes autorisées pour le tri dans `PaginationDto` et sécuriser les clauses `ORDER BY`.
  - [ ] VAL-02 : Transformer `getNotes`, `getSiteManagers`, `getQueueTiers` pour accepter la pagination ou renvoyer un contrat explicite.
  - [ ] VAL-03 : Créer les DTOs de filtres validés pour `ReportsController`.
  - [ ] ERR-02 : Vérifier l'existence de `personId` dans `registerCustomer` et renvoyer 404 si inexistant.
  - [ ] ERR-03 : Utiliser la configuration `bcryptRounds` dans `UsersService`.

- [ ] **Phase 4 — OpenAPI / Swagger & Harmonisation Contrats**
  - [ ] API-01 : Corriger les décorateurs Swagger retournant des tableaux au lieu des objets paginés (`SitesController`, `ServiceTiersController`, `QueuesController`).
  - [ ] API-02 : Documenter intégralement `UsersController` et `TranslationsController` avec Swagger.
  - [ ] API-03 : Supprimer le doublon `/health` dans `AppController` au profit de `HealthController`.
  - [ ] API-04 : Rendre public `GET /api/v1/translations/bundle` (`@Public()`).
  - [ ] API-05 : Corriger `required: true` sur le paramètre `:siteId` dans `QueueEngineController`.
  - [ ] DAT-05 : Créer les endpoints et méthodes de soft-delete pour `User` et `Person`.
