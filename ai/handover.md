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
| **DAT-02** | Données | Absence de transaction sur l'inscription client (`registerRegistration`) | **Élevé** | Incohérence des compteurs et états orphelins |
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
> ✅ **RÉSOLU le 2026-09-28** — Endpoints de `UsersController` protégés par RBAC (`@RequireAnyPermission` / `@RequirePermission`), avec contrôle dynamique combinant le profil du modificateur (anti-escalade de rang) et le profil du user à modifier (plafond de permissions selon le rôle).

* **Fichiers modifiés** :
  * `src/core/rbac/decorators/require-permission.decorator.ts` — ajout du décorateur `@RequireAnyPermission(...permissions: string[])`
  * `src/core/rbac/guards/permissions.guard.ts` — prise en charge de `ANY_PERMISSIONS_KEY` (vérifie que l'utilisateur détient au moins une permission autorisée)
  * `src/modules/users/users.controller.ts` — pose des protections `@RequireAnyPermission` sur `findUsers`, `createUser`, `findUserById`, `updateUser`, `updateUserStatus`, `setUserPassword`, `assignUserRole`, `removeUserRole`, `getRoles`
  * `src/modules/users/users.service.ts` — enrichissement de `checkAntiEscalation` et `getCallerMaxManageRank` :
    * Vérification du profil de celui qui modifie : empêche toute modification d'un utilisateur de rang supérieur ou égal (`FORBIDDEN_ROLE_ESCALATION`).
    * Vérification du profil du user à modifier : calcule le plafond de rang accordé par les permissions du modificateur (`user_manage_kiosk` = 1, `user_manage_hostess` = 2, `user_manage_manager` = 3, `user_manage_admin` = 4, `root` / `system_manage` = 5). Si un modificateur ne possède que la permission `user_manage_hostess`, il ne peut pas modifier un utilisateur ayant un profil supérieur à l'hôtesse (`FORBIDDEN_PERMISSION`).
    * Validation stricte étendue aux opérations de mise à jour (`updateUser`, `updateUserStatus`, `setUserPassword`), d'assignation/retrait de rôles (`assignUserRole`, `removeUserRole`), de création (`createUser`) et de consultation détaillée (`findUserById`).
  * `src/modules/users/users.service.spec.ts` & `src/core/rbac/guards/permissions.guard.spec.ts` — suites de tests unitaires validant l'ensemble des règles RBAC et anti-escalade.

### SEC-02 — Déconnexion unitaire inopérante pour le JWT actif
> ✅ **RÉSOLU le 2026-09-28** — `sid` (session UUID) inclus dans le payload JWT ; `JwtStrategy` vérifie désormais la session spécifique.

* **Fichiers modifiés** :
  * `src/core/auth/interfaces/jwt-payload.interface.ts` — ajout de `sid?: string` dans `JwtPayload` et `sessionId?: string` dans `AuthenticatedUser`
  * `src/modules/auth/auth.service.ts` (`generateTokens`) — `INSERT … RETURNING session_id` pour lier la session au JWT via `sid`
  * `src/core/auth/strategies/jwt.strategy.ts` (`validate`) — vérification sur `session_id = payload.sid` (fallback `user_id` pour les anciens tokens sans `sid`)
* **Problème constaté** :  
  `JwtStrategy` exécutait :
  ```sql
  SELECT session_id FROM dori_user_session
  WHERE user_id = $1 AND revoked_reason IS NULL AND revoked_at IS NULL
    AND expires_at > NOW() LIMIT 1
  ```
  Le JWT ne contenait pas de lien vers son `session_id`. Si l'utilisateur était connecté sur un ordinateur et un téléphone et se déconnectait du téléphone, le token du téléphone restait valide tant que la session de l'ordinateur existait.
* **Correction appliquée** :  
  `generateTokens` utilise maintenant `RETURNING session_id` et place l'UUID de session dans le payload JWT sous la clé `sid`. `JwtStrategy.validate` vérifie `WHERE session_id = payload.sid`, ce qui garantit qu'un token révoqué est immédiatement rejeté même si d'autres sessions existent.

### SEC-03 — Révocation globale involontaire lors du logout
> ✅ **RÉSOLU le 2026-09-28** — Support de `LogoutDto` avec `refreshToken` optionnel dans le corps de la requête, et ciblage de la session spécifique liée au JWT porteur (`sessionId` / `sid`) en l'absence de refresh token.
>
> ✅ **COMPLETÉ (BUG2) le 2026-09-29** — Mécanisme de logout entièrement revu : mode session unique, global_logout, et force-disconnect hiérarchique.

* **Fichiers modifiés** :
  * `src/modules/auth/dto/logout.dto.ts` — ajout du champ `userId?: number` (optionnel) permettant de cibler un autre utilisateur
  * `src/modules/auth/auth.controller.ts` — endpoint `logout` passe maintenant le `logoutDto` complet au service
  * `src/modules/auth/auth.service.ts` (`logout`) — logique révisée en 3 cas :
    1. **Pas de `userId` dans le body** : révoque uniquement la session courante du caller (`session_id = caller.sessionId`). Cas nominal de déconnexion simple.
    2. **`userId` == `caller.userId`** : global_logout du caller, révoque toutes ses sessions actives (`user_id = caller.userId`, reason `global_logout`).
    3. **`userId` != `caller.userId`** : force-disconnect d'un autre utilisateur :
       - Vérifie que le caller est `manager`, `admin` ou `root`.
       - Contrôle hiérarchique : `callerMaxRank > targetMaxRank` (un manager rank 3 ne peut déconnecter que rank < 3 ; un admin rank 4 peut déconnecter jusqu'au rank 3).
       - Vérifie que l'utilisateur cible existe et est actif.
       - Révoque toutes les sessions actives de la cible (`reason = 'force_logout'`).

### SEC-04 — Asymétrie de contrôle de rôle lors des affectations
> ✅ **RÉSOLU le 2026-09-29** — Vérification d'existence, d'état actif (`is_active = TRUE` et non supprimé) et de rôle requis (`manager` pour site, `hotesse`/`operator` pour file) ajoutée dans `assignSiteManager` et `assignOperator`.

* **Fichiers modifiés** :
  * `src/modules/sites/sites.service.ts` (`assignSiteManager`) — vérification préalable que `targetUserId` existe et est actif dans `dori_user` avant de vérifier son rôle `manager` actif.
  * `src/modules/queues/queues.service.ts` (`assignOperator`) — vérification préalable que `targetUserId` existe et est actif dans `dori_user`, puis contrôle que l'utilisateur possède bien le rôle `hotesse` (ou `operator`) actif avant d'insérer dans `dori_user_queue`.
  * `src/modules/queues/queues.service.spec.ts` — suite de 4 tests unitaires couvrant : utilisateur inexistant (`USER_NOT_FOUND`), compte inactif (`ACCOUNT_LOCKED`), rôle manquant (`FORBIDDEN_ROLE_ESCALATION`), assignation valide.
  * `src/modules/sites/sites.service.spec.ts` — suite de 4 tests unitaires couvrant : utilisateur inexistant (`USER_NOT_FOUND`), compte inactif (`ACCOUNT_LOCKED`), rôle manquant (`FORBIDDEN_ROLE_ESCALATION`), assignation valide.

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
  `registerRegistration` enchaîne :
  1. Incrément du compteur (`dori_queue_counter`)
  2. Création éventuelle de la personne (`dori_person`)
  3. Insertion de l'inscription (`dori_registration`)
  4. Création de la notification de bienvenue (`dori_notification`)
  Ces opérations ne sont pas entourées d'un `this.dataSource.transaction(...)`. Si l'étape 3 ou 4 échoue, le numéro de ticket a déjà été consommé et les entités restent désynchronisées.
* **Comportement attendu** :  
  Encapsuler l'ensemble du flux dans une transaction atomique.

### DAT-03 — Surréservation concurrente des créneaux de RDV
* **Fichier impacté** : `src/modules/registrations/registrations.service.ts` (lignes 135–146)
* **Problème constaté** :  
  Le contrôle `SELECT COUNT(*)::int as count FROM dori_registration WHERE queue_id = $1 AND scheduled_time = $2 ...` est exécuté sans verrouillage. Deux requêtes simultanées liront le même effectif sous le seuil et réserveront en parallèle, violant `slot_capacity`.
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
> ✅ **RÉSOLU le 2026-09-29** — Mise en œuvre d'un cycle de vie de suppression logique (soft-delete) uniforme pour `User`, `Person` et `Queue`, avec vérification préalable d'existence, validation des permissions / hiérarchie anti-escalade, et cascade de désactivation.

* **Fichiers modifiés** :
  * `src/modules/queues/queues.service.ts` (`deleteQueue`) — vérifie l'existence active via `findQueueById`, applique le soft delete (`is_active = FALSE, deleted_at = now`), cascade la désactivation sur les forfaits de file (`dori_queue_service_tier`) et force la clôture des sessions guichet ouvertes (`dori_queue_session`).
  * `src/modules/persons/persons.service.ts` & `persons.controller.ts` (`deletePerson`, `DELETE /api/v1/persons/:personId`) — vérifie le scope et l'existence active via `findPersonById`, applique le soft delete (`is_active = FALSE, deleted_at = now`) et cascade la désactivation sur les notes rattachées (`dori_person_note`). Protégé par `@RequirePermission('registration_delete')`.
  * `src/modules/users/users.service.ts`, `users.controller.ts` & `dto/user.dto.ts` (`deleteUser`, `DELETE /api/v1/users/:userId`, `UserDeleteResponseDto`) — vérifie la hiérarchie anti-escalade (`checkAntiEscalation`) et l'existence active (`findUserById`), applique le soft delete (`is_active = FALSE, deleted_at = now`), révoque immédiatement toutes les sessions actives en base (`dori_user_session`) et invalide le scope. Protégé par `@RequireAnyPermission('user_manage_kiosk', 'user_manage_hostess', 'user_manage_manager', 'user_manage_admin')`.
  * Suites de tests unitaires dédiées dans `queues.service.spec.ts`, `persons.service.spec.ts` et `users.service.spec.ts`.

---

## 3. Validation, Tri, Pagination & Filtrage

### VAL-01 — Concaténation de `sortField` dans les clauses SQL (Risque d'injection & crash)
> ✅ **RÉSOLU le 2026-09-28** — Méthode `getSafeSortField(allowedFields, defaultField)` ajoutée dans `PaginationDto` ; chaque service déclare son allowlist explicite.

* **Fichiers modifiés** :
  * `src/core/pagination/pagination.dto.ts` — ajout de `getSafeSortField()` (validation par allowlist, fallback silencieux sur la valeur par défaut)
  * `src/modules/sites/sites.service.ts` — `findSites`, `findSiteQueues`, `findSiteManagers` : remplacement de `getParams().sortField` par `getSafeSortField([...])`
  * `src/modules/queues/queues.service.ts` — `findQueues` (suppression de la rustine `=== 'id'`), `getOperators` : idem
  * `src/modules/users/users.service.ts` — `findUsers` (suppression de la rustine `=== 'id'`)
* **Problème constaté** :  
  1. `PaginationDto.parsedSort` convertissait la chaîne en snake_case mais ne validait pas si le champ existait dans la table cible.
  2. Dans `sites.service.ts` (`findSites`), le code exécutait :
     ```ts
     query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`;
     ```
     Si le client appelait `GET /api/v1/sites?sort=id:desc`, l'API tentait `ORDER BY id DESC` et échouait en 500 car la colonne s'appelle `site_id`.
  3. Dans `users.service.ts` ou `queues.service.ts`, des rustines manuelles `sortField === 'id' ? 'queue_id' : sortField` avaient été dispersées sans standardisation.
* **Correction appliquée** :  
  `getSafeSortField(allowedFields, defaultField)` vérifie que le champ demandé est dans l'allowlist avant de le passer à la clause `ORDER BY`. Si le champ est absent, le fallback par défaut est utilisé silencieusement. Chaque service déclare ses colonnes autorisées (noms exacts en base, avec alias de table si nécessaire).

### VAL-02 — Fausse pagination et tronquage masqué
> ✅ **RÉSOLU le 2026-09-29** — Suppression du tronquage masqué et exposition explicite de `@Query() pagination: PaginationDto` sur les sous-ressources (`getSiteManagers`, `getNotes`, `getQueueTiers`, `getQueues`). Création des DTOs de réponse paginés Swagger dédiés et suppression de l'écrêtage arbitraire sur les règles de notification.

* **Fichiers modifiés** :
  * `src/modules/sites/dto/site-response.dto.ts` — ajout de `PaginatedSiteManagerResponseDto` et enrichissement de `SiteManagerResponseDto` (`userType`, `assignedAt`).
  * `src/modules/sites/sites.controller.ts` (`getManagers`, `getQueues`) — exposition de `@Query() pagination: PaginationDto` sur `getManagers` et `getQueues`, documentation Swagger `@ApiDoriOkResponse(PaginatedSiteManagerResponseDto)`.
  * `src/modules/sites/sites.service.ts` (`findSiteManagers`, `getSiteManagers`) — typage strict `Promise<PaginatedResult<SiteManagerResponseDto>>`, mapping explicite des champs camelCase (`userId`, `username`, `email`, `isActive`, `userType`, `assignedAt`), délégation fluide dans `getSiteManagers(siteId, pagination, user)`.
  * `src/modules/persons/dto/person-response.dto.ts` — ajout de `PaginatedPersonNoteResponseDto` et enrichissement de `PersonNoteDetailDto` (`authorUsername`, `updatedAt`).
  * `src/modules/persons/persons.controller.ts` (`getNotes`) — exposition de `@Query() pagination: PaginationDto` et documentation Swagger `@ApiDoriOkResponse(PaginatedPersonNoteResponseDto)`.
  * `src/modules/persons/persons.service.ts` (`findPersonNotes`, `getNotes`) — typage strict `Promise<PaginatedResult<PersonNoteDetailDto>>`, tri sécurisé via allowlist `getSafeSortField`, mapping explicite des notes en camelCase avec `authorUsername`, délégation paginée dans `getNotes`.
  * `src/modules/service-tiers/service-tiers.controller.ts` (`getQueueTiers`) — exposition de `@Query() pagination: PaginationDto` sur `GET /api/v1/queues/:queueId/tiers`.
  * `src/modules/service-tiers/service-tiers.service.ts` (`findQueueTiers`, `getQueueTiers`, `getNotificationRules`) — typage strict `Promise<PaginatedResult<QueueTierDetailDto>>`, tri sécurisé via allowlist, mapping des forfaits de file en `QueueTierDetailDto`, support de la pagination dans `getQueueTiers`, et sélection exhaustive sans faux découpage artificiel dans `getNotificationRules`.
  * Suites de tests unitaires dédiées dans `sites.service.spec.ts`, `persons.service.spec.ts` et création de `service-tiers.service.spec.ts`.
* **Problème constaté** :  
  Les méthodes de contrôleurs appellent des wrappers internes qui exécutent la méthode paginée avec `new PaginationDto()` en dur, puis renvoient `res.items`.  
  Conséquence : si une personne a 30 notes ou un site 30 managers, les éléments au-delà du 25ème sont masqués et le client d'API n'a aucun moyen de demander la page 2.
* **Correction appliquée** :  
  1. Injection et exposition de `@Query() pagination: PaginationDto` sur les endpoints `GET /api/v1/sites/:siteId/managers`, `GET /api/v1/persons/:personId/notes`, `GET /api/v1/queues/:queueId/tiers`, et `GET /api/v1/sites/:siteId/queues`.
  2. Création des DTOs de réponse Swagger paginés `PaginatedSiteManagerResponseDto` et `PaginatedPersonNoteResponseDto`.
  3. Transformation des méthodes des services (`getSiteManagers`, `getNotes`, `getQueueTiers`) pour accepter la pagination avec surcharge rétro-compatible et typage strict des contrats.
  4. Pour `getNotificationRules`, suppression du wrapper avec fausse pagination afin de renvoyer la totalité des règles actives sans limitation arbitraire masquée.

### VAL-03 — Paramètres de requête libres dans `ReportsController`
> ✅ **RÉSOLU le 2026-09-29** — Création des DTOs de validation `DailyQueueReportQueryDto`, `DashboardSummaryQueryDto` et `DashboardQueueLoadQueryDto` (`ReportQueryDto`). Remplacement des `@Query('...')` et `parseInt` manuels par l'injection de ces DTOs validés par le `ValidationPipe` global.

* **Fichiers modifiés** :
  * `src/modules/reports/reports.controller.ts` — remplacement des `@Query('date')`, `@Query('siteId')`, `@Query('limit')` et conversions `parseInt` par les DTOs typés `@Query() query: DailyQueueReportQueryDto`, `@Query() query: DashboardSummaryQueryDto` et `@Query() query: DashboardQueueLoadQueryDto`.
* **Fichiers créés** :
  * `src/modules/reports/dto/report-query.dto.ts` — définition des classes DTO validées avec `@IsDateString()`, `@IsNotEmpty()`, `@IsOptional()`, `@Type(() => Number)`, `@IsInt()`, `@Min(1)` et métadonnées Swagger `@ApiProperty` / `@ApiPropertyOptional`.
  * `src/modules/reports/reports.controller.spec.ts` — suite de tests unitaires couvrant la validation des DTOs (rejet des dates non conformes, typage entier de `siteId` et `limit`) et la bonne transmission des paramètres aux méthodes de `ReportsService`.
* **Problème constaté** :  
  Les paramètres `date`, `siteId`, `limit` étaient injectés via `@Query('date') date: string` et convertis par `parseInt(limit, 10)` au lieu d'utiliser un DTO de validation (`ReportQueryDto`). Une date non conforme (ex: `date=foo`) était transmise directement à la clause SQL `$2` de PostgreSQL.
* **Correction appliquée** :  
  Création et utilisation de DTOs dédiés validés automatiquement par le `ValidationPipe` global. En cas de format invalide, le rejet standardisé `VALIDATION_ERROR` (400) est renvoyé avec les détails dans `data.errors`.

### VAL-04 — Audit Global de l'Adoption de la Pagination Commune (`PaginationDto`)
> 🔍 **AUDIT EFFECTUÉ le 2026-09-29** — Cartographie complète de tous les contrôleurs et services de l'application quant à l'utilisation de `PaginationDto` et `PaginatedResult<T>`.

#### 1. État des Lieux & Services Déjà Conformes
La majorité des modules utilise déjà `PaginationDto` comme classe de base pour les filtres ou en injection directe dans les contrôleurs et services :
* **Sites** :
  * `findSites(pagination: PaginationDto, user)` : paginé avec `PaginationDto` et `getSafeSortField()`.
  * `findSiteQueues(siteId, pagination, user)` : paginé avec `PaginationDto` et `getSafeSortField()`.
  * `findSiteManagers(siteId, pagination, user)` / `getSiteManagers` : paginé avec `PaginationDto`, `getSafeSortField()` et typé `Promise<PaginatedResult<SiteManagerResponseDto>>`.
* **Files d'attente (Queues)** :
  * `findQueues(filter: QueueFilterDto, user)` : `QueueFilterDto` hérite de `PaginationDto`, utilise `getSafeSortField()`.
  * `getOperators(queueId, pagination: PaginationDto, user)` : paginé avec `PaginationDto` et `getSafeSortField()`.
* **Personnes (Persons)** :
  * `findPersons(filter: PersonFilterDto, user)` : `PersonFilterDto` hérite de `PaginationDto`.
  * `findPersonNotes(personId, pagination, user)` / `getNotes` : paginé avec `PaginationDto`, `getSafeSortField()` et typé `Promise<PaginatedResult<PersonNoteDetailDto>>`.
* **Forfaits de service (Service Tiers)** :
  * `findTiers(pagination: PaginationDto, user)` : paginé avec `PaginationDto`.
  * `findQueueTiers(queueId, pagination, user)` / `getQueueTiers` : paginé avec `PaginationDto`, `getSafeSortField()` et typé `Promise<PaginatedResult<QueueTierDetailDto>>`.
* **Inscriptions (Registrations)** :
  * `findRegistrations(filter: RegistrationFilterDto, user)` : `RegistrationFilterDto` hérite de `PaginationDto`.
  * `getAvailability(queueId, query: AvailabilityQueryDto, user)` : `AvailabilityQueryDto` hérite de `PaginationDto` avec pagination en mémoire via `queryDto.getParams()` et `queryDto.createResponse()`.
* **Notifications** :
  * `findNotifications(filter: NotificationFilterDto, user)` : `NotificationFilterDto` hérite de `PaginationDto`.
* **Utilisateurs (Users)** :
  * `findUsers(filter: UserFilterDto, user)` : `UserFilterDto` hérite de `PaginationDto`, utilise `getSafeSortField()`.
  * `getRoles(pagination: PaginationDto)` : paginé avec `PaginationDto`.
* **Traductions (Translations)** :
  * `findTranslations(filter: TranslationFilterDto)` : `TranslationFilterDto` hérite de `PaginationDto`.

---

#### 2. Manquements et Disparités Identifiés (Actions à Réaliser)

* **Manquement A — Absence de pagination sur `GET /api/v1/queues/:queueId/sessions` (`QueueEngineController.getActiveSessions` & `QueueEngineService.getSessions`)** :
  > ✅ **RÉSOLU le 2026-09-29** — Exposition de `@Query() pagination: PaginationDto` sur `getActiveSessions`, typage `Promise<PaginatedResult<QueueSessionDetailDto>>` avec allowlist de tri `getSafeSortField`, et création de `PaginatedQueueSessionResponseDto`.
  * **Fichiers modifiés** :
    * `src/modules/queue-engine/dto/engine-response.dto.ts` — ajout de `PaginatedQueueSessionResponseDto` et champ `username` sur `QueueSessionDetailDto`.
    * `src/modules/queue-engine/queue-engine.controller.ts` — injection de `@Query() pagination: PaginationDto` sur `GET /api/v1/queues/:queueId/sessions` et décorateur Swagger `@ApiDoriOkResponse(PaginatedQueueSessionResponseDto)`.
    * `src/modules/queue-engine/queue-engine.service.ts` — pagination de `getSessions` et `getActiveSessions` (`LIMIT / OFFSET`, `COUNT`, `pagination.createResponse`), tri sécurisé `getSafeSortField(['qs.connected_at', 'qs.session_id', 'qs.thread_number', 'qs.mode', 'u.username'])`, avec surcharge rétro-compatible `(queueId, pagination, user)` / `(queueId, user)`.
  * **Fichier créé** :
    * `src/modules/queue-engine/queue-engine.service.spec.ts` — suite de tests unitaires validant le contrat paginé `PaginatedResult`, la rétrocompatibilité de signature, et la sécurisation du tri via allowlist.

* **Manquement B — Défaut d'utilisation de `getSafeSortField()` pour sécuriser les clauses `ORDER BY` dans 5 services paginés** :
  > ✅ **RÉSOLU le 2026-09-29** — `getSafeSortField(allowlist, default)` utilisé dans les 5 services. Ternaire brut `sortField === 'id' ? ... : sortField` supprimé.
  * **Fichiers modifiés** :
    * `src/modules/service-tiers/service-tiers.service.ts` — `findTiers` : allowlist `['tier_id', 'tier_name', 'tier_code', 'created_at', 'updated_at']`, défaut `tier_id`.
    * `src/modules/persons/persons.service.ts` — `findPersons` : allowlist `['person_id', 'first_name', 'last_name', 'email', 'phone_number', 'created_at', 'updated_at']`, défaut `person_id`.
    * `src/modules/registrations/registrations.service.ts` — `findRegistrations` : allowlist `['registration_id', 'ticket_number', 'business_date', 'status', 'scheduled_time', 'created_at', 'priority_reference_time']`, défaut `registration_id`.
    * `src/modules/notifications/notifications.service.ts` — `findNotifications` : allowlist `['notification_id', 'channel', 'notification_status', 'sent_at', 'created_at']`, défaut `notification_id`.
    * `src/modules/translations/translations.service.ts` — `findTranslations` : allowlist `['translation_id', 'category', 'locale', 'translation_key', 'created_at', 'updated_at']`, défaut `translation_id`.

* **Manquement C — Dualité sur les règles de notification (`ServiceTiersService`)** :
  * **Constat** : `findNotificationRules` accepte `pagination: PaginationDto` et construit un `PaginatedResult`. En revanche, `getNotificationRules` / `ServiceTiersController.getRules` renvoie un tableau complet `[NotificationRuleDetailDto]` sans pagination.
  * **Action recommandée** : Si l'API doit être 100% harmonisée, exposer la pagination optionnelle sur `GET /api/v1/queues/:queueId/tiers/:tierId/notification-rules` et réutiliser `findNotificationRules`.

* **Manquement D — Uniformisation du typage de retour dans les services (`Promise<PaginatedResult<T>>`)** :
  * **Constat** : Certaines méthodes ont un typage explicite de retour (`findSiteManagers`, `findPersonNotes`, `findQueueTiers`), tandis que d'autres s'appuient sur l'inférence TypeScript (`findUsers`, `findRegistrations`, `findNotifications`, `findTranslations`, `findTiers`).
  * **Action recommandée** : Ajouter l'annotation de type explicite `Promise<PaginatedResult<T>>` sur toutes les méthodes exportées de services retournant des collections paginées.

---

## 4. Contrats d'API, Documentation Swagger / OpenAPI & Routage

### API-01 — Contradiction entre Swagger et réponse réelle
> ✅ **RÉSOLU le 2026-09-28** — DTOs paginés créés et décorateurs `@ApiDoriOkResponse` corrigés dans les 3 contrôleurs.

* **Fichiers modifiés** :
  * `src/modules/queues/dto/queue-response.dto.ts` — ajout de `PaginatedQueueOperatorResponseDto`
  * `src/modules/service-tiers/dto/tier-response.dto.ts` — ajout de `PaginatedServiceTierResponseDto` et `PaginatedQueueTierResponseDto`
  * `src/modules/queues/queues.controller.ts` (`getOperators`) — `@ApiDoriOkResponse([QueueOperatorResponseDto])` → `@ApiDoriOkResponse(PaginatedQueueOperatorResponseDto)`
  * `src/modules/service-tiers/service-tiers.controller.ts` (`findTiers`) — `@ApiDoriOkResponse([ServiceTierDetailDto])` → `@ApiDoriOkResponse(PaginatedServiceTierResponseDto)`
  * `src/modules/service-tiers/service-tiers.controller.ts` (`getQueueTiers`) — `@ApiDoriOkResponse([QueueTierDetailDto])` → `@ApiDoriOkResponse(PaginatedQueueTierResponseDto)`
  * `src/modules/sites/sites.controller.ts` (`getQueues`) — `@ApiDoriOkResponse([QueueDetailResponseDto])` → `@ApiDoriOkResponse(PaginatedQueueResponseDto)`

### API-02 — Contrôleurs sans documentation Swagger
> ✅ **RÉSOLU le 2026-09-29** — Documentation Swagger exhaustive ajoutée sur l'ensemble des routes de `UsersController` et `TranslationsController`, avec création des DTOs de réponse dédiés conformes au format d'enveloppe `StandardResponse<T>`.

* **Fichiers créés** :
  * `src/modules/users/dto/user-response.dto.ts` — DTOs de réponse Swagger pour les utilisateurs et rôles (`UserListItemDto`, `PaginatedUserResponseDto`, `UserDetailResponseDto`, `CreateUserResponseDto`, `UpdateUserResponseDto`, `UpdateUserStatusResponseDto`, `SetUserPasswordResponseDto`, `AssignUserRoleResponseDto`, `RemoveUserRoleResponseDto`, `RoleDetailResponseDto`, `PaginatedRoleResponseDto`, `UpdateRolePermissionsResponseDto`).
  * `src/modules/translations/dto/translation-response.dto.ts` — DTOs de réponse Swagger pour les traductions (`TranslationDetailDto`, `PaginatedTranslationResponseDto`, `TranslationBundleResponseDto`, `DeleteTranslationResponseDto`).
* **Fichiers modifiés** :
  * `src/modules/users/users.controller.ts` — Ajout des décorateurs `@ApiOperation`, `@ApiParam`, `@ApiDoriOkResponse`, `@ApiDoriCreatedResponse` sur les 11 routes du contrôleur.
  * `src/modules/translations/translations.controller.ts` — Ajout des décorateurs `@ApiOperation`, `@ApiParam`, `@ApiDoriOkResponse`, `@ApiDoriCreatedResponse` sur les 5 routes du contrôleur.
* **Problème constaté** :  
  Aucun endpoint de ces deux contrôleurs n'a d'annotations `@ApiOperation`, `@ApiParam`, `@ApiDoriOkResponse` ou `@ApiDoriCreatedResponse`.
* **Comportement attendu** :  
  Ajouter la documentation Swagger complète pour homogénéiser avec les autres modules (`sites`, `queues`, `registrations`).

### API-03 — Doublon d'endpoints Health Check
> ✅ **RÉSOLU le 2026-09-29** — Endpoint de santé unifié sur `HealthController` (`/api/v1/health`). Le doublon dans `AppController` a été remplacé par une redirection permanente HTTP 301 vers `/api/v1/health`.

* **Fichiers modifiés** :
  * `src/app.controller.ts` — Remplacement du handler doublon renvoyant un simple `{ status: 'ok' }` par une redirection permanente (`@Redirect('/api/v1/health', HttpStatus.MOVED_PERMANENTLY)`) documentée avec Swagger.
  * `src/app.controller.spec.ts` — Ajout du test unitaire validant la redirection de `getHealth` vers `/api/v1/health`.
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
> ✅ **RÉSOLU le 2026-09-29** — Paramètre `:siteId` déclaré avec `required: true` sur `@ApiParam` dans `QueueEngineController`.

* **Fichier modifé** :
  * `src/modules/queue-engine/queue-engine.controller.ts` (lignes 51–56) — Correction de `required: true` pour le paramètre `:siteId` de `@Get('sites/:siteId/next-preview')`.
* **Problème constaté** :  
  Pour `@Get('sites/:siteId/next-preview')`, Swagger déclare `@ApiParam({ name: 'siteId', required: false })`. Or, `:siteId` dans le chemin est obligatoire et le `ParseIntPipe` génère une erreur 400 s'il n'est pas fourni.
* **Comportement attendu** :  
  Mettre `required: true`.

---

## 5. Gestion des Erreurs & Formats de Réponse

### ERR-01 — Format divergent pour l'erreur `VALIDATION_ERROR`
> ✅ **RÉSOLU le 2026-09-29** — Signature et comportement de `DoriException` et `GlobalExceptionFilter` standardisés pour garantir que les erreurs de validation ont toujours leurs détails dans `data.errors` (`data: { errors: [...] }`), que l'erreur provienne de `ValidationPipe` ou d'un rejet métier manuel.

* **Fichier créé** :
  * `src/core/errors/dori.exception.spec.ts` — Tests unitaires validant la standardisation du format d'enveloppe pour `VALIDATION_ERROR`.
* **Fichiers modifiés** :
  * `src/core/errors/dori.exception.ts` — Normalisation automatique des paramètres lors d'une `VALIDATION_ERROR` pour toujours peupler `data: { errors: string[] }` et vider `translationParams`.
  * `src/core/errors/global-exception.filter.ts` — Garantie supplémentaire de formatage uniforme dans le filtre global si une exception `VALIDATION_ERROR` n'a pas encore la structure `data.errors`.
  * `src/modules/registrations/registrations.service.ts` (lignes 49, 123, 416, 474) — Levée explicite avec `{ errors: [...] }` dans le payload de données.
  * `src/modules/queue-engine/queue-engine.service.ts` (lignes 121, 135) — Levée explicite avec `{ errors: [...] }` dans le payload de données.
  * `src/modules/service-tiers/service-tiers.service.ts` (lignes 312, 322) — Levée explicite avec `{ errors: [...] }` dans le payload de données.
  * `src/modules/notifications/notifications.service.ts` (ligne 120) — Levée explicite avec `{ errors: [...] }` dans le payload de données.
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
> ✅ **RÉSOLU le 2026-09-29** — Ajout d'une vérification d'existence et de validité de la personne (`is_active = TRUE AND deleted_at IS NULL`) dans `createRegistration` lorsque `dto.personId` est fourni, levant `PERSON_NOT_FOUND` (404) avant toute tentative d'insertion.

* **Fichier modifié** :
  * `src/modules/registrations/registrations.service.ts` — vérification de l'existence de la personne dans `dori_person` et levée d'une `DoriException('PERSON_NOT_FOUND', { personId })` si le `personId` est introuvable ou inactif.
* **Fichier créé** :
  * `src/modules/registrations/registrations.service.spec.ts` — tests unitaires validant la levée de 404 `PERSON_NOT_FOUND` pour un `personId` inexistant ou inactif/supprimé.
* **Problème constaté** :  
  Dans `registerRegistration` (`createRegistration`), si le client fournit un `dto.personId = 999999` qui n'existe pas en base, aucune vérification n'était faite. La tentative d'insertion dans `dori_registration` échouait sur la contrainte `fk_registration_person` et renvoyait une erreur 500 `INTERNAL_ERROR`.
* **Comportement attendu** :  
  Vérifier l'existence de la personne et lever `PERSON_NOT_FOUND` (404).

---

### ERR-03 — Hachage de mot de passe non uniforme
> ✅ **RÉSOLU le 2026-09-29** — `ConfigService` injecté dans `UsersService` pour lire dynamiquement la valeur configurée de `security.bcryptRounds` (avec repli sur 12), uniformisant le coût de hachage avec `AuthService`.

* **Fichiers modifiés** :
  * `src/modules/users/users.service.ts` — Injection de `ConfigService` dans le constructeur et utilisation dynamique de `security.bcryptRounds` dans `createUser` et `setUserPassword`.
  * `src/modules/users/users.service.spec.ts` — Ajout du mock `ConfigService` dans la suite de tests unitaires.
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
> ✅ **RÉSOLU le 2026-09-29** — Injection de `ClockService` dans les 4 composants qui instanciaient `new Date()` directement. Les `new Date(value)` de conversion de chaînes ISO depuis la base restent légitimes et n'ont pas été touchés.

* **Fichiers modifiés** :
  * `src/workers/notification-worker/notification.worker.ts` — injection de `ClockService`, remplacement de `const now = new Date()` par `const now = this.clockService.now()`.
  * `src/core/realtime/realtime.service.ts` — injection de `ClockService`, remplacement des `new Date().toISOString()` dans `emitQueueDisplay` et `emitTranslationInvalidation`.
  * `src/core/realtime/realtime.gateway.ts` — injection de `ClockService`, remplacement de `new Date()` dans la vérification du `validUntil` du token de suivi et dans le résultat du heartbeat `acknowledgeHeartbeat`.
  * `src/core/health/health.controller.ts` — injection de `ClockService`, remplacement du `new Date().toISOString()` dans la réponse `GET /api/v1/health`.
  * `src/core/realtime/realtime.module.ts` — ajout de l'import de `ClockModule` pour fournir `ClockService` à `RealtimeService` et `RealtimeGateway`.
  * `src/core/health/health.module.ts` — ajout de l'import de `ClockModule`.
* **Problème constaté** :  
  Tous ces composants instanciaient `new Date()` au lieu d'injecter `ClockService.now()`, rendant les tests temporels et les simulations d'horodatage impossibles.
* **Correction appliquée** :  
  `ClockService` (déjà marqué `@Global()`) était disponible dans les modules consumers. Ses modules ont été enrichis de l'import de `ClockModule` là où nécessaire, puis le service a été injecté via le constructeur. Les `new Date(isoStringFromDb)` (conversions de valeurs persistantes) restent intentionnels et n'ont pas été modifiés.

---

## 7. Checklist Globale de Résolution IA

Cette checklist est prête pour l'exécution tâche par tâche par un agent IA :

- [ ] **Phase 1 — Sécurité & RBAC**
  - [x] SEC-01 : Poser les décorateurs `@RequirePermission` / `@RequireAnyPermission` sur tous les endpoints de `UsersController` et contrôler les profils modificateur / cible. ✅ *2026-09-28*
  - [x] SEC-02 : Ajouter le `sessionId` au payload JWT et vérifier la session spécifique dans `JwtStrategy`. ✅ *2026-09-28*
  - [x] SEC-03 : Ajouter `LogoutDto` avec `refreshToken` optionnel pour supporter le logout mobile/SPA sans cookie et cibler la session active. ✅ *2026-09-28*
  - [x] SEC-03/BUG2 : Révision complète du mécanisme de logout — session unique (défaut), global_logout (userId = soi), force-disconnect hiérarchique (userId = autre, manager/admin/root). ✅ *2026-09-29*
  - [x] SEC-04 : Valider l'existence et le rôle `hotesse`/opérateur dans `QueuesService.assignOperator` et l'existence dans `SitesService.assignSiteManager`. ✅ *2026-09-29*
  - [ ] SEC-05 : Valider l'état de la session dans `RealtimeGateway.handleConnection`.

- [ ] **Phase 2 — Workers & Robustesse Données**
  - [ ] DAT-01 : Corriger l'idempotence du `DailyResetWorker` (découpler de `dori_queue_counter`).
  - [ ] DAT-02 : Envelopper `RegistrationsService.registerRegistration` dans une transaction atomique.
  - [ ] DAT-03 : Verrouiller la vérification de capacité des créneaux de RDV (`FOR UPDATE`).
  - [ ] WRK-01 : Corriger la lecture du résultat de la requête SQL dans `AppointmentExpiryWorker`.
  - [ ] WRK-02 : Conserver `req.rawBody` et l'utiliser pour la signature HMAC dans `NotificationsController`.
  - [ ] WRK-03 : Ajouter `FOR UPDATE SKIP LOCKED` sur la sélection de `NotificationWorker`.
  - [x] WRK-04 : Remplacer les `new Date()` restants par `ClockService`. ✅ *2026-09-29*

- [x] **Phase 3 — Filtres, Tri & Pagination**
  - [x] VAL-01 : Implémenter une allowlist de colonnes autorisées pour le tri dans `PaginationDto` et sécuriser les clauses `ORDER BY`. ✅ *2026-09-28*
  - [x] VAL-02 : Transformer `getNotes`, `getSiteManagers`, `getQueueTiers` pour accepter la pagination ou renvoyer un contrat explicite. ✅ *2026-09-29*
  - [x] VAL-03 : Créer les DTOs de filtres validés pour `ReportsController`. ✅ *2026-09-29*
  - [x] ERR-01 : Standardiser le format de l'erreur `VALIDATION_ERROR` pour toujours peupler `data.errors`. ✅ *2026-09-29*
  - [x] ERR-02 : Vérifier l'existence de `personId` dans `registerRegistration` et renvoyer 404 si inexistant. ✅ *2026-09-29*
  - [x] ERR-03 : Utiliser la configuration `bcryptRounds` dans `UsersService`. ✅ *2026-09-29*
  - [x] VAL-04 : Harmoniser l'adoption globale de `PaginationDto` (sessions actives `queue-engine`, allowlists `getSafeSortField` sur les 5 services restants). ✅ *2026-09-29*

- [ ] **Phase 4 — OpenAPI / Swagger & Harmonisation Contrats**
  - [x] API-01 : Corriger les décorateurs Swagger retournant des tableaux au lieu des objets paginés (`SitesController`, `ServiceTiersController`, `QueuesController`). ✅ *2026-09-28*
  - [x] API-02 : Documenter intégralement `UsersController` et `TranslationsController` avec Swagger. ✅ *2026-09-29*
  - [x] API-03 : Supprimer le doublon `/health` dans `AppController` au profit de `HealthController` (redirection HTTP 301). ✅ *2026-09-29*
  - [ ] API-04 : Rendre public `GET /api/v1/translations/bundle` (`@Public()`).
  - [x] API-05 : Corriger `required: true` sur le paramètre `:siteId` dans `QueueEngineController`. ✅ *2026-09-29*
  - [x] DAT-05 : Créer les endpoints et méthodes de soft-delete pour `User` et `Person`, et cascader `Queue`. ✅ *2026-09-29*

