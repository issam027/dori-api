# Handover & Audit du Code Mort (`ai/deadcode_handover.md`)

Ce document recense l'audit exhaustif du code mort, orphelin, court-circuité ou non utilisé identifié dans le dossier `src/` de l'API Dori au **2026-10-07**.
Pour chaque élément, l'analyse détaille la localisation précise, la justification technique attestant qu'il s'agit de code mort, et l'explication probable de sa présence initiale (intention fonctionnelle ou divergence d'implémentation).

---

## Sommaire

1. [Méthodes et Logique Métier Invoquées Nulle Part](#1-méthodes-et-logique-métier-invoquées-nulle-part)
2. [Configurations Centralisées Mortes ou Court-Circuitées](#2-configurations-centralisées-mortes-ou-court-circuitées)
3. [Dépendances Externes Fantômes (BullMQ & Redis)](#3-dépendances-externes-fantômes-bullmq--redis)
4. [Entités TypeORM Inutilisées (Architecture 100 % SQL Brut)](#4-entités-typeorm-inutilisées-architecture-100--sql-brut)
5. [Codes d'Erreurs Référencés mais Jamais Déclenchés](#5-codes-derreurs-référencés-mais-jamais-déclenchés)
6. [Exports, Helpers et Interfaces Orphelins](#6-exports-helpers-et-interfaces-orphelins)
7. [Matrice Récapitulative et Recommandations](#7-matrice-récapitulative-et-recommandations)

---

## 1. Méthodes et Logique Métier Invoquées Nulle Part

### 1.1 `NotificationsService.evaluateQueueThresholds()` & cascade de requêtes SQL associées

- **Fichiers concernés :**
  - [`src/modules/notifications/notifications.service.ts`](file:///d:/work/workspaces/dori/dori-api/src/modules/notifications/notifications.service.ts#L188-L256) (lignes 188-256)
  - [`src/modules/notifications/notifications.repository.ts`](file:///d:/work/workspaces/dori/dori-api/src/modules/notifications/notifications.repository.ts#L171-L231) (lignes 171-231)
- **Code mort identifié :**
  1. `NotificationsService.evaluateQueueThresholds(queueId: number)`
  2. `NotificationsRepository.findWaitingRegistrations(queueId: number)`
  3. `NotificationsRepository.countActiveThreads(queueId: number)` (doublon de `RegistrationsRepository.countActiveThreads`)
  4. `NotificationsRepository.findThresholdRules(queueId: number)`
  5. `NotificationsRepository.createThresholdIfAbsent(input: ...)`
- **Justification (preuve d'inutilisation) :**
  - La méthode `evaluateQueueThresholds` n'est appelée par **aucun contrôleur**, **aucun worker**, **aucun cron**, ni par `QueueEngineService`.
  - Les 4 méthodes du repository associées ne sont appelées nulle part ailleurs que dans `evaluateQueueThresholds`.
- **Pourquoi ce code existe-t-il ? (Logique d'origine non respectée) :**
  - Dans la spécification (§4.1 & §4.13), le système doit avertir les usagers lorsque leur position dans la file ou leur temps d'attente estimé passe sous un seuil paramétré (ex: *"votre tour approche, Ticket A-12"*).
  - Le développeur a écrit l'algorithme complet d'évaluation des règles de seuils et de détection d'idempotence, mais a oublié de brancher son déclenchement :
    - Soit lors de l'appel d'un ticket (`QueueEngineService.next()`),
    - Soit périodiquement dans un worker dédié d'évaluation de seuils.

---

### 1.2 `ClockService.nowUtc()`

- **Fichier concerné :** [`src/core/clock/clock.service.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/clock/clock.service.ts#L14-L16)
- **Code mort identifié :**
  ```ts
  nowUtc(): Date {
    return this.now();
  }
  ```
- **Justification :**
  - Zéro appel dans tout le projet `src/` (y compris les tests). Tout le code appelle directement `clockService.now()`.
- **Pourquoi ce code existe-t-il ? :**
  - Créé comme alias d'explicitation sémantique pour souligner que `new Date()` en JavaScript produit un horodatage Unix UTC. Comme `now()` renvoie déjà un objet `Date` en UTC, `nowUtc()` fait doublon et n'a jamais été adopté.

---

### 1.3 `ClockService.minutesSince()`

- **Fichier concerné :** [`src/core/clock/clock.service.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/clock/clock.service.ts#L97-L99)
- **Code mort identifié :**
  ```ts
  minutesSince(past: Date): number {
    return (this.now().getTime() - past.getTime()) / 60_000;
  }
  ```
- **Justification :**
  - Zéro appel dans les services, repositories ou workers.
- **Pourquoi ce code existe-t-il ? :**
  - Prévu initialement pour mesurer les durées d'inactivité des sessions guichets ou la tolérance de retard des rendez-vous. Dans l'implémentation finale, ces calculs de durée ont été effectués soit directement en SQL (`EXTRACT(EPOCH FROM ...) / 60`), soit par soustraction inline de timestamps.

---

## 2. Configurations Centralisées Mortes ou Court-Circuitées

Toutes ces valeurs sont définies et documentées dans [`src/core/config/configuration.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/config/configuration.ts), mais ne sont **jamais injectées ni consommées** par l'application :

### 2.1 Paires de clés asymétriques JWT (`jwt.privateKey` et `jwt.publicKey`)

- **Localisation :** [`src/core/config/configuration.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/config/configuration.ts#L107-L108)
- **Clés d'environnement :** `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`
- **Justification :**
  - [`src/modules/auth/auth.module.ts`](file:///d:/work/workspaces/dori/dori-api/src/modules/auth/auth.module.ts#L23) et [`src/core/auth/strategies/jwt.strategy.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/auth/strategies/jwt.strategy.ts#L22) n'interrogent que `jwt.secret` (algorithme symétrique HS256).
- **Logique d'origine :**
  - Prévision initiale d'un mécanisme de signature asymétrique RS256 / Ed25519 (utile pour les architectures microservices où plusieurs services valident les tokens avec la clé publique sans détenir la clé privée). Le projet étant resté un monolithe modulaire, seul le secret partagé est exploité.

---

### 2.2 Durée et tentatives de verrouillage (`security.maxFailedAttempts` & `security.lockoutMinutes`)

- **Localisation :** [`src/core/config/configuration.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/config/configuration.ts#L162-L163)
- **Justification :**
  - Dans [`src/modules/auth/auth.service.ts`](file:///d:/work/workspaces/dori/dori-api/src/modules/auth/auth.service.ts#L56-L58) :
    ```ts
    if (failedAttempts >= 5) {
      lockedUntil = this.clockService.addMinutes(now, 15);
    }
    ```
  - Les valeurs `5` et `15` sont codées **en dur** dans `AuthService.login()`. La configuration centralisée n'est jamais lue.
- **Logique d'origine :**
  - Règle de sécurité de l'application (§4.12 & §8.3) qui devait être paramétrable par environnement (ex: seuils plus souples en intégration qu'en production).

---

### 2.3 Longueur minimale du mot de passe (`security.minPasswordLength`)

- **Localisation :** [`src/core/config/configuration.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/config/configuration.ts#L164)
- **Justification :**
  - La validation du mot de passe est gérée par les décorateurs `class-validator` : `@MinLength(10)` codé en dur dans [`user.dto.ts`](file:///d:/work/workspaces/dori/dori-api/src/modules/users/dto/user.dto.ts#L44) et [`change-password.dto.ts`](file:///d:/work/workspaces/dori/dori-api/src/modules/auth/dto/change-password.dto.ts#L16).
- **Logique d'origine :**
  - Volonté d'aligner la politique de complexité des mots de passe sur une configuration globale dynamique.

---

### 2.4 Intervalle d'expiration des RDV (`appointmentExpiry.intervalMinutes`)

- **Localisation :** [`src/core/config/configuration.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/config/configuration.ts#L168-L170)
- **Justification :**
  - [`src/workers/appointment-expiry/appointment-expiry.worker.ts`](file:///d:/work/workspaces/dori/dori-api/src/workers/appointment-expiry/appointment-expiry.worker.ts#L15) utilise l'annotation `@Interval(300_000)` (5 minutes hardcodées en millisecondes).
- **Logique d'origine :**
  - Permettre d'ajuster la fréquence d'exécution du worker de purge selon la charge serveur ou la configuration Vercel / serverless.

---

### 2.5 TTL du cache de scope RBAC (`notifications.scopeCacheTtlSeconds`)

- **Localisation :** [`src/core/config/configuration.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/config/configuration.ts#L144)
- **Justification :**
  - Non seulement la clé est placée dans le namespace `notifications` par erreur au lieu de `rbac`, mais dans [`src/core/rbac/services/scope.service.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/rbac/services/scope.service.ts#L19), le TTL est codé en dur :
    ```ts
    private readonly CACHE_TTL_MS = 30 * 1000;
    ```
- **Logique d'origine :**
  - Respect de la section §7.5 exigeant un cache in-memory de 30 secondes pour les scopes utilisateurs.

---

### 2.6 Délai de grâce du tracking ticket (`tracking.closedGraceMinutes`)

- **Localisation :** [`src/core/config/configuration.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/config/configuration.ts#L157-L159)
- **Justification :**
  - Zéro occurrence dans tout `src/`.
- **Logique d'origine :**
  - Fenêtre de grâce après clôture d'un ticket durant laquelle un usager peut encore consulter le statut final de son ticket sur l'écran public de tracking.

---

## 3. Dépendances Externes Fantômes (BullMQ & Redis)

- **Fichiers concernés :**
  - [`package.json`](file:///d:/work/workspaces/dori/dori-api/package.json#L33) (lignes 33, 46, 49, 56)
  - [`src/core/config/configuration.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/config/configuration.ts#L100-L104) (lignes 100-104)
- **Code mort identifié :**
  - Dépendances déclarées dans `package.json` :
    - `@nestjs/bullmq: ^11.0.5`
    - `bullmq: ^6.3.9`
    - `@socket.io/redis-adapter: ^8.3.0`
    - `ioredis: ^5.11.1`
  - Bloc de configuration `redis: { host, port, password }` dans `configuration.ts`.
- **Preuve d'inutilisation :**
  - Aucun fichier TypeScript dans `src/` n'importe `bullmq`, `@nestjs/bullmq`, `@socket.io/redis-adapter`, ni `ioredis`.
  - Aucun appel à `configService.get('redis')` n'existe dans l'application.
- **Pourquoi ce code existe-t-il ? (Divergence d'architecture) :**
  - **Pour BullMQ :** Le dossier d'architecture initial prévoyait de gérer les files de messages et workers d'envoi SMS/e-mail via BullMQ et Redis. En pratique, l'équipe a opté pour un modèle relationnel direct : une table `dori_notification` interrogée par `NotificationWorker` avec un polling `@Interval` et réservation atomique `FOR UPDATE SKIP LOCKED`.
  - **Pour Socket.IO Redis Adapter :** Prévu pour un scaling horizontal multi-instances de l'API WebSocket (synchronisation des rooms entre serveurs). Actuellement, la gateway WebSocket fonctionne en mémoire locale sur une instance unique.

---

## 4. Entités TypeORM Inutilisées (Architecture 100 % SQL Brut)

- **Fichiers concernés :**
  - [`src/core/database/entities.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/database/entities.ts)
  - 21 fichiers d'entités sous `src/modules/*/entities/*.entity.ts` :
    - `user.entity.ts`, `site.entity.ts`, `queue.entity.ts`, `person.entity.ts`, `person-note.entity.ts`
    - `service-tier.entity.ts`, `queue-service-tier.entity.ts`, `tier-notification-rule.entity.ts`
    - `queue-session.entity.ts`, `queue-counter.entity.ts`, `registration.entity.ts`, `notification.entity.ts`
    - `translation.entity.ts`, `translation-version.entity.ts`, `role.entity.ts`, `permission.entity.ts`
    - `role-permission.entity.ts`, `user-role.entity.ts`, `user-site.entity.ts`, `user-queue.entity.ts`, `user-session.entity.ts`
- **Preuve d'inutilisation :**
  - Aucun `@InjectRepository()`, aucun `dataSource.getRepository()`, aucun appel à `manager.save()` ou `manager.find()` n'existe dans `src/`.
  - `database.module.ts` charge `entities: ALL_ENTITIES`, mais avec `synchronize: false`.
  - La totalité des repositories et migrations s'appuie exclusivement sur [`schema.sql`](file:///d:/work/workspaces/dori/dori-api/src/core/database/sql/schema.sql) et `dataSource.query(...)`.
- **Pourquoi ce code existe-t-il ? :**
  - Le projet a démarré avec le scaffolding standard TypeORM d'entités décorées (`@Entity()`, `@Column()`). Plus tard, l'exigence de haute performance et de contrôle strict des transactions atomiques et locks concurrents (`FOR UPDATE SKIP LOCKED`) a poussé vers une persistance SQL native pure. Les classes d'entités n'ont jamais été retirées.

---

## 5. Codes d'Erreurs Référencés mais Jamais Déclenchés

### 5.1 `SESSION_NOT_FOUND`

- **Fichier concerné :** [`src/core/errors/error-catalog.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/errors/error-catalog.ts#L61-L64) (lignes 61-64)
- **Définition dans le catalogue :**
  ```ts
  SESSION_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.session_not_found',
  },
  ```
- **Preuve d'inutilisation :**
  - Aucune instruction `new DoriException('SESSION_NOT_FOUND')` n'existe dans tout le code applicatif.
- **Où cette erreur aurait-elle dû se trouver ? (Manque de rigueur dans l'implémentation) :**
  - Dans [`src/modules/queue-engine/queue-engine.service.ts`](file:///d:/work/workspaces/dori/dori-api/src/modules/queue-engine/queue-engine.service.ts#L251-L267) :
    La route `DELETE /api/v1/queues/:queueId/sessions/:sessionId` (fermeture de guichet) exécute :
    ```ts
    await this.queueEngineRepository.closeSession(queueId, sessionId, user.userId, now);
    return { sessionId, closed: true };
    ```
  - La requête SQL met à jour la session `WHERE session_id = $3 AND disconnected_at IS NULL`. Si la session n'existe pas ou est déjà déconnectée, elle retourne silencieusement `closed: true` (HTTP 200) sans jamais lever l'exception 404 `SESSION_NOT_FOUND` spécifiée dans le contrat d'API.

---

## 6. Exports, Helpers et Interfaces Orphelins

### 6.1 `assertPublicResponseDtoName`

- **Fichier concerné :** [`src/core/swagger/api-dori-response.decorator.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/swagger/api-dori-response.decorator.ts#L23-L31)
- **Justification :**
  - Cette fonction de validation de nom de DTO est exportée et testée dans son fichier de test unitaire, mais n'est **appelée par aucun décorateur Swagger** (`ApiDoriOkResponse`, `ApiDoriCreatedResponse`) ni au runtime.
- **Logique d'origine :**
  - Prévue pour faire respecter automatiquement la convention de nommage des DTOs publics (`*ResponseDto`, `*ItemDto`) au moment de la décoration des contrôleurs, mais son intégration dans le décorateur a été omise.

---

### 6.2 Interfaces de typage SQL exportées inutilement

Plusieurs interfaces TypeScript sont annotées `export` dans les repositories alors qu'elles ne modélisent que des structures internes de requêtes SQL privées au fichier :
- `UserSessionRow` ([`src/modules/auth/auth.repository.ts`](file:///d:/work/workspaces/dori/dori-api/src/modules/auth/auth.repository.ts#L17))
- `RegistrationsTransaction` ([`src/modules/registrations/registrations.repository.ts`](file:///d:/work/workspaces/dori/dori-api/src/modules/registrations/registrations.repository.ts#L21))
- `UserDetailsResult` ([`src/modules/users/users.repository.ts`](file:///d:/work/workspaces/dori/dori-api/src/modules/users/users.repository.ts#L10))
- `TrackingRegistrationRow` ([`src/core/realtime/realtime.repository.ts`](file:///d:/work/workspaces/dori/dori-api/src/core/realtime/realtime.repository.ts#L1))
- `ClaimedNotificationRow` ([`src/workers/notification-worker/notification-worker.repository.ts`](file:///d:/work/workspaces/dori/dori-api/src/workers/notification-worker/notification-worker.repository.ts#L1))

---

## 7. Matrice Récapitulative et Recommandations

| ID | Catégorie | Élément | Action recommandée |
|---|---|---|---|
| **DEAD-001** | Logique métier | `evaluateQueueThresholds()` & SQL repository lié | **À connecter** : brancher dans `QueueEngineService.next()` ou créer un cron dédié, car la fonctionnalité métier est critique (§4.1). |
| **DEAD-002** | Logique métier | `ClockService.nowUtc()` & `minutesSince()` | **À supprimer** : simplifier le service d'horloge. |
| **DEAD-003** | Configuration | `security.maxFailedAttempts` & `lockoutMinutes` | **À connecter** : remplacer les littéraux `5` et `15` dans `AuthService.login` par `configService.get()`. |
| **DEAD-004** | Configuration | `security.minPasswordLength` | **À connecter** ou documenter comme validation statique. |
| **DEAD-005** | Configuration | `appointmentExpiry.intervalMinutes` | **À connecter** au worker ou supprimer si `@Interval` figé. |
| **DEAD-006** | Configuration | `notifications.scopeCacheTtlSeconds` | **À reconnecter** dans `ScopeService` et déplacer sous la clé `rbac.scopeCacheTtlSeconds`. |
| **DEAD-007** | Configuration | `jwt.privateKey`, `jwt.publicKey`, `tracking.closedGraceMinutes` | **À supprimer** pour éviter de fausses attentes de configuration. |
| **DEAD-008** | Dépendances | BullMQ & Redis (`package.json`, `configuration.ts`) | **À retirer** du `package.json` et de la config si le déploiement reste PostgreSQL pur. |
| **DEAD-009** | Persistance | 21 entités TypeORM | **À déprécier / supprimer** : l'infrastructure étant 100 % SQL brut avec `schema.sql`, ces entités n'apportent aucune valeur d'exécution. |
| **DEAD-010** | Erreurs | `SESSION_NOT_FOUND` | **À connecter** : lever `DoriException('SESSION_NOT_FOUND')` dans `QueueEngineService.closeSession()` si aucune session n'est modifiée. |
| **DEAD-011** | Swagger | `assertPublicResponseDtoName()` | **À intégrer** dans `ApiDoriOkResponse` et `ApiDoriCreatedResponse` pour bloquer les DTOs mal nommés dès la compilation/bootstrap. |
