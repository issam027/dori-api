# DORI-API — Handover v2 : Tâches Restantes

> **Généré le** : 2026-09-30  
> **Basé sur** : [`ai/handover.md`](./handover.md) — audit du 2026-09-28  
> **Statut** : Ce fichier ne contient **que les items non encore résolus**. Les items ✅ ont été retirés pour plus de clarté.

---

## Matrice de Priorisation (items restants)

| Réf | Catégorie | Intitulé | Sévérité |
| :--- | :--- | :--- | :--- |
| **SEC-05** | Sécurité | WebSocket accepte les utilisateurs dont la session est révoquée | **Moyen** |
| **DAT-01** | Données | `DailyResetWorker` saute la réinitialisation si un RDV existe demain | **Critique** |
| **DAT-02** | Données | Absence de transaction sur l'inscription client (`registerCustomer`) | **Élevé** |
| **DAT-03** | Données | Race condition sur la capacité des créneaux de RDV | **Élevé** |
| **DAT-04** | Données | Entités TypeORM définies mais inutilisées (100% SQL brut) | **Moyen** |
| **WRK-01** | Workers | `AppointmentExpiryWorker` : variable `affected` toujours `undefined` | **Moyen** |
| **WRK-02** | Workers | Vérification HMAC du webhook par `JSON.stringify(dto)` | **Élevé** |
| **WRK-03** | Workers | `NotificationWorker` sans `SKIP LOCKED` (concurrence cluster) | **Moyen** |
| **API-04** | Routage | `GET /api/v1/translations/bundle` non public | **Moyen** |
| **VAL-MC** | Pagination | Manquement C — Dualité pagination sur les règles de notification | **Mineur** |
| **VAL-MD** | Pagination | Manquement D — Typage de retour `Promise<PaginatedResult<T>>` non uniforme | **Mineur** |

---

## 1. Sécurité

### SEC-05 — Absence de vérification de session active sur WebSocket

* **Fichier impacté** : `src/core/realtime/realtime.gateway.ts` (méthode `handleConnection`, lignes 67–84)
* **Problème** :  
  La passerelle WebSocket vérifie le token JWT via `jwtService.verify()` mais ne consulte **pas** la table `dori_user_session` ni `dori_user.is_active`. Un utilisateur révoqué ou désactivé peut maintenir ou ouvrir une socket tant que la signature JWT reste valide.
* **Action à réaliser** :  
  Dans `handleConnection`, après `jwtService.verify()`, exécuter la même requête de validation de session que dans `JwtStrategy.validate` :
  ```sql
  SELECT session_id FROM dori_user_session
  WHERE session_id = $1
    AND revoked_reason IS NULL
    AND revoked_at IS NULL
    AND expires_at > NOW()
  ```
  Et vérifier `dori_user.is_active = TRUE AND deleted_at IS NULL`. Déconnecter le socket si l'une des conditions échoue.
* **Fichiers à modifier** :
  * `src/core/realtime/realtime.gateway.ts` — ajout de la vérification en base dans `handleConnection`

---

## 2. Architecture, Modèle de Données & Concurrence

### DAT-01 — Bug bloquant de réinitialisation quotidienne (`DailyResetWorker`) ⚠️ CRITIQUE

* **Fichier impacté** : `src/workers/daily-reset/daily-reset.worker.ts` (lignes 60–70, 75–135)
* **Problème** :  
  La condition d'idempotence du worker repose sur `dori_queue_counter` :
  ```ts
  const counter = await this.dataSource.query(
    `SELECT last_number FROM dori_queue_counter WHERE queue_id = $1 AND business_date = $2`,
    [q.queue_id, tomorrow],
  );
  if (counter && counter.length > 0) continue;
  ```
  Si un usager a réservé un RDV pour demain, `dori_queue_counter` existe déjà pour `tomorrow` → le reset est **définitivement ignoré** pour cette file, bloquant l'incrémentation quotidienne.
* **Action à réaliser** :  
  Créer une table ou colonne d'audit des resets indépendante des compteurs (ex : `dori_queue_daily_reset_log` avec colonnes `queue_id` + `reset_date` + `executed_at`, ou ajouter `last_daily_reset_date` sur la file `dori_site_queue_thread`). Conditionner l'idempotence sur cette table dédiée, pas sur `dori_queue_counter`.
* **Fichiers à modifier** :
  * `src/workers/daily-reset/daily-reset.worker.ts`
  * Migration SQL pour créer la table/colonne d'audit

---

### DAT-02 — Absence de transaction sur l'inscription client

* **Fichier impacté** : `src/modules/registrations/registrations.service.ts` (méthode `createRegistration`, lignes ~45–220)
* **Problème** :  
  `registerCustomer` enchaîne sans transaction :
  1. Incrément du compteur (`dori_queue_counter`)
  2. Création éventuelle de la personne (`dori_person`)
  3. Insertion de l'inscription (`dori_customer`)
  4. Création de la notification de bienvenue (`dori_notification`)

  Si l'étape 3 ou 4 échoue, le numéro de ticket est déjà consommé et les entités restent désynchronisées.
* **Action à réaliser** :  
  Encapsuler l'ensemble du flux dans `this.dataSource.transaction(async (manager) => { ... })` en utilisant le `EntityManager` de transaction pour toutes les requêtes internes.
* **Fichiers à modifier** :
  * `src/modules/registrations/registrations.service.ts`

---

### DAT-03 — Surréservation concurrente des créneaux de RDV

* **Fichier impacté** : `src/modules/registrations/registrations.service.ts` (lignes ~135–146)
* **Problème** :  
  Le contrôle de capacité :
  ```sql
  SELECT COUNT(*)::int as count FROM dori_customer
  WHERE queue_id = $1 AND scheduled_time = $2 ...
  ```
  est exécuté **sans verrou**. Deux requêtes simultanées lisent le même effectif sous le seuil et réservent en parallèle, violant `slot_capacity`.
* **Action à réaliser** :  
  Dans la transaction atomique (DAT-02), verrouiller le créneau avant le count :
  ```sql
  SELECT slot_capacity FROM dori_site_queue_thread WHERE queue_id = $1 FOR UPDATE
  ```
  ou utiliser une contrainte d'exclusion PostgreSQL sur `(queue_id, scheduled_time)`.
* **Fichiers à modifier** :
  * `src/modules/registrations/registrations.service.ts` (à traiter conjointement avec DAT-02)

---

### DAT-04 — Découplage complet TypeORM / SQL brut (Dette technique)

* **Fichiers impactés** :
  * `src/core/database/entities.ts`
  * `src/core/database/database.module.ts`
  * Tous les services de modules (`sites.service.ts`, `queues.service.ts`, etc.)
* **Problème** :  
  21 fichiers d'entités TypeORM sont maintenus mais le code applicatif utilise exclusivement `dataSource.query(...)`. Les types TypeScript des entités peuvent diverger du schéma SQL réel de `schema.sql` sans alerte.
* **Action à réaliser** (au choix, à arbitrer) :  
  - **Option A** : Adopter les `Repository<T>` TypeORM pour les CRUD simples et supprimer progressivement les requêtes SQL brutes.
  - **Option B** : Assumer la couche SQL brute et définir des interfaces TypeScript strictes sur les retours SQL (supprimer les entités TypeORM inutilisées de `entities.ts`).
* **Note** : Choix stratégique — impacte l'ensemble du codebase.

---

## 3. Workers & Tâches d'Arrière-Plan

### WRK-01 — Détection du retour SQL erronée dans `AppointmentExpiryWorker`

* **Fichier impacté** : `src/workers/appointment-expiry/appointment-expiry.worker.ts` (lignes 21–41)
* **Problème** :
  ```ts
  const [rows, affected] = await this.dataSource.query(`UPDATE ... RETURNING ...`);
  if (affected && affected.length > 0) { ... }
  ```
  Sous TypeORM + pilote PostgreSQL, `dataSource.query()` retourne directement le tableau des lignes du `RETURNING`. La déstructuration place la **première ligne** dans `rows` et `undefined` dans `affected`. Le bloc de log ne s'exécute **jamais**.
* **Action à réaliser** :
  ```ts
  const rows = await this.dataSource.query(`UPDATE ... RETURNING ...`);
  if (rows && rows.length > 0) { ... }
  ```
* **Fichiers à modifier** :
  * `src/workers/appointment-expiry/appointment-expiry.worker.ts`

---

### WRK-02 — Vérification HMAC Webhook avec `JSON.stringify(dto)` ⚠️ ÉLEVÉ

* **Fichier impacté** : `src/modules/notifications/notifications.controller.ts` (lignes 165–172)
* **Problème** :  
  La signature HMAC est calculée sur `JSON.stringify(dto)` (objet TypeScript resérialisé), alors que Twilio/Infobip signent le **buffer HTTP brut**. Tout écart d'espacement, d'ordre de clés ou d'encodage entre les deux entraîne un rejet systématique en 401.
* **Action à réaliser** :
  1. Activer la capture du body brut dans le middleware Express (option `rawBody: true` dans `NestFactory.create` ou middleware `express.raw()`).
  2. Récupérer `req.rawBody` dans le handler webhook et calculer le HMAC sur ce buffer.
* **Fichiers à modifier** :
  * `src/main.ts` — activer `rawBody` dans les options `NestFactory`
  * `src/modules/notifications/notifications.controller.ts` — utiliser `req.rawBody` au lieu de `JSON.stringify(dto)`

---

### WRK-03 — Concurrence et doublons sur `NotificationWorker`

* **Fichier impacté** : `src/workers/notification-worker/notification.worker.ts` (lignes 20–26)
* **Problème** :  
  La requête de dépilement :
  ```sql
  SELECT ... FROM dori_notification WHERE notification_status = 'pending' ... LIMIT 50
  ```
  ne pose aucun verrou. En scaling horizontal (plusieurs pods), deux instances dépilent les mêmes notifications et envoient des SMS en doublon.
* **Action à réaliser** :
  ```sql
  SELECT ... FROM dori_notification
  WHERE notification_status = 'pending'
  ORDER BY created_at ASC
  LIMIT 50
  FOR UPDATE SKIP LOCKED
  ```
  À exécuter dans une transaction dédiée.
* **Fichiers à modifier** :
  * `src/workers/notification-worker/notification.worker.ts`

---

## 4. Contrats d'API & Routage

### API-04 — Bundle de traductions inaccessible aux clients anonymes

* **Fichier impacté** : `src/modules/translations/translations.controller.ts` (ligne ~35, méthode `getBundle`)
* **Problème** :  
  `GET /api/v1/translations/bundle` n'a pas le décorateur `@Public()`. Le guard JWT global bloque l'accès. Les bornes interactives et écrans d'affichage ne peuvent pas charger le catalogue de langues avant la connexion d'un utilisateur.
* **Action à réaliser** :  
  Ajouter `@Public()` sur la méthode `getBundle` dans `translations.controller.ts`.
* **Fichiers à modifier** :
  * `src/modules/translations/translations.controller.ts`

---

## 5. Harmonisation Pagination (Manquements résiduels)

### VAL-MC — Dualité sur les règles de notification (`ServiceTiersService`)

* **Constat** :  
  `findNotificationRules` accepte `pagination: PaginationDto` et construit un `PaginatedResult`. En revanche, `getNotificationRules` / `ServiceTiersController.getRules` renvoie un tableau complet `[NotificationRuleDetailDto]` sans pagination.
* **Action à réaliser** :  
  Exposer la pagination sur `GET /api/v1/queues/:queueId/tiers/:tierId/notification-rules` et réutiliser `findNotificationRules` dans le contrôleur.
* **Fichiers à modifier** :
  * `src/modules/service-tiers/service-tiers.controller.ts`
  * `src/modules/service-tiers/service-tiers.service.ts`

---

### VAL-MD — Uniformisation du typage de retour `Promise<PaginatedResult<T>>`

* **Constat** :  
  Certaines méthodes ont un typage explicite (`findSiteManagers`, `findPersonNotes`, `findQueueTiers`), d'autres s'appuient sur l'inférence TypeScript (`findUsers`, `findRegistrations`, `findNotifications`, `findTranslations`, `findTiers`).
* **Action à réaliser** :  
  Ajouter l'annotation `Promise<PaginatedResult<T>>` sur toutes les méthodes exportées de services retournant des collections paginées.
* **Fichiers à modifier** :
  * `src/modules/users/users.service.ts` — `findUsers`, `getRoles`
  * `src/modules/registrations/registrations.service.ts` — `findRegistrations`
  * `src/modules/notifications/notifications.service.ts` — `findNotifications`
  * `src/modules/translations/translations.service.ts` — `findTranslations`
  * `src/modules/service-tiers/service-tiers.service.ts` — `findTiers`

---

## 6. Checklist de Résolution

- [ ] **Phase 1 — Sécurité**
  - [ ] SEC-05 : Valider l'état de la session dans `RealtimeGateway.handleConnection`.

- [ ] **Phase 2 — Workers & Robustesse Données**
  - [ ] DAT-01 : Corriger l'idempotence du `DailyResetWorker` (découpler de `dori_queue_counter`).
  - [ ] DAT-02 : Envelopper `RegistrationsService.registerCustomer` dans une transaction atomique.
  - [ ] DAT-03 : Verrouiller la vérification de capacité des créneaux de RDV (`FOR UPDATE`).
  - [ ] DAT-04 : Décider et homogénéiser TypeORM vs SQL brut (dette technique — décision stratégique).
  - [ ] WRK-01 : Corriger la lecture du résultat SQL dans `AppointmentExpiryWorker`.
  - [ ] WRK-02 : Conserver `req.rawBody` et l'utiliser pour la signature HMAC dans `NotificationsController`.
  - [ ] WRK-03 : Ajouter `FOR UPDATE SKIP LOCKED` sur la sélection de `NotificationWorker`.

- [ ] **Phase 4 — OpenAPI / Swagger & Harmonisation Contrats**
  - [ ] API-04 : Rendre public `GET /api/v1/translations/bundle` (`@Public()`).

- [ ] **Harmonisation Pagination**
  - [ ] VAL-MC : Exposer la pagination sur `GET /queues/:queueId/tiers/:tierId/notification-rules`.
  - [ ] VAL-MD : Ajouter `Promise<PaginatedResult<T>>` sur les 5 méthodes sans typage explicite.

---

> **Ordre de résolution suggéré** :
> 1. **DAT-01** ⚠️ Critique — bloque le reset quotidien en production
> 2. **DAT-02 + DAT-03** — à traiter ensemble dans la même méthode `createRegistration`
> 3. **WRK-02** ⚠️ Élevé — les webhooks SMS/Email sont actuellement tous rejetés en 401
> 4. **SEC-05** — fuite temps réel sur sessions révoquées
> 5. **WRK-01**, **WRK-03** — observabilité et doublons en cluster
> 6. **API-04** — bloque les bornes avant login
> 7. **VAL-MC**, **VAL-MD** — polish et cohérence
> 8. **DAT-04** — décision stratégique à planifier séparément
