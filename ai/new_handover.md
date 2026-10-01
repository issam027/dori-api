# DORI-API — Bugs & Corrections à Réaliser (Trié par facilité)

> **Généré le** : 2026-10-01  
> **Sources** : [`ai/handover.md`](./handover.md), [`ai/handover_2.md`](./handover_2.md), [`ai/api_analysis.md`](./api_analysis.md)  
> **Nombre total d'items non résolus** : 31 (11 backend + 20 contrat Swagger)  
> **Tri** : Du plus rapide à implémenter au plus complexe

---

## Légende

| Effort | Signification | Temps estimé |
|---|---|---|
| 🟢 **Trivial** | 1 fichier, < 5 lignes modifiées, aucun risque de régression | < 5 min |
| 🔵 **Facile** | 1–2 fichiers, modification localisée, tests simples | 10–30 min |
| 🟡 **Modéré** | 3–5 fichiers, DTOs + service + tests, coordination requise | 30 min – 2h |
| 🟠 **Substantiel** | Refactoring transversal, plusieurs modules, tests d'intégration | 2–6h |
| 🔴 **Lourd** | Architecture, migration de données, choix stratégique | > 1 jour |

Sévérité : **[C]** Critique · **[I]** Important · **[M]** Mineur

---

## Checklist

- [x] 🟢 #01 — API-04 · `@Public()` sur `GET /translations/bundle` ✅ *2026-10-01*
- [x] 🟢 #02 — WRK-01 · Corriger la déstructuration SQL dans `AppointmentExpiryWorker` ✅ *2026-10-01*
- [x] 🟢 #03 — SW-03 · Rendre `AssignOperatorDto.userId` requis ✅ *2026-10-01*
- [x] 🟢 #04 — SW-18 · Déclarer `servers`, `tags`, retirer les identifiants root de la doc ✅ *2026-10-01*
- [x] 🟢 #05 — SW-13 · Supprimer les `default` des `Update*Dto` ✅ *2026-10-01*
- [x] 🟢 #06 — SW-04 · Utiliser `registration-token` au lieu de `bearer` sur la position publique ✅ *2026-10-01*
- [ ] 🔵 #07 — WRK-03 · Ajouter `FOR UPDATE SKIP LOCKED` dans `NotificationWorker`
- [ ] 🔵 #08 — SEC-05 · Vérifier la session active dans `RealtimeGateway.handleConnection`
- [ ] 🔵 #09 — VAL-MD · Ajouter le typage `Promise<PaginatedResult<T>>` sur 5 services
- [ ] 🔵 #10 — SW-19 · Corriger la pagination inutile de `/queues/{id}/availability`
- [ ] 🔵 #11 — SW-12 · Typer les identifiants en `integer` (pas `number`) dans les DTOs
- [ ] 🔵 #12 — SW-17 · Corriger les exemples incohérents dans Swagger
- [ ] 🔵 #13 — VAL-MC · Exposer la pagination sur `GET /notification-rules`
- [ ] 🔵 #14 — SW-20 · Uniformiser la nomenclature des DTOs
- [ ] 🟡 #15 — SW-11 · Adopter camelCase uniformément (Users + Translations)
- [ ] 🟡 #16 — SW-07 · Rendre la config files relisible dans `QueueDetailResponseDto`
- [ ] 🟡 #17 — SW-15 · Ajouter `format`, `maxLength`, `nullable` sur les DTOs
- [ ] 🟡 #18 — WRK-02 · Capturer `req.rawBody` pour la vérification HMAC webhook
- [ ] 🟡 #19 — SW-02 · Définir le schéma de sécurité HMAC dans Swagger
- [ ] 🟡 #20 — SW-05 · Aligner les forfaits par file (isActive/isEnabled, currency, displayOrder)
- [ ] 🟡 #21 — SW-10 · Fixer les formats de dates/heures et documenter les fuseaux
- [ ] 🟡 #22 — DAT-01 · Corriger l'idempotence du DailyResetWorker
- [ ] 🟠 #23 — SW-06 · Unifier les règles de notification (vocabulaire + corriger `trakingLink`)
- [ ] 🟠 #24 — SW-08 · Clarifier `customerId` vs `registrationId`
- [ ] 🟠 #25 — SW-09 · Unifier les 7 formats de réponse d'action
- [ ] 🟠 #26 — DAT-02 + DAT-03 · Transaction atomique + `FOR UPDATE` sur `registerCustomer`
- [ ] 🟠 #27 — SW-14 · Factoriser l'enveloppe de réponse `StandardResponseDto<T>`
- [ ] 🟠 #28 — SW-01 · Définir le contrat d'erreur global (400/401/403/404/409/422/423/429)
- [x] 🟠 #29 — SW-16 · Rationaliser les endpoints redondants ✅ *2026-10-01*
- [ ] 🔴 #30 — DAT-04 · Homogénéiser TypeORM vs SQL brut
- [ ] 🔴 #31 — RGPD · Validation juridique données personnelles / notes médicales

---

## 🟢 Trivial (< 5 min chacun)

### #01 — API-04 · `@Public()` sur `GET /translations/bundle` [I]
> ✅ **RÉSOLU le 2026-10-01** — Ajout du décorateur `@Public()` sur `getBundle` et déplacement de `@ApiBearerAuth('bearer')` uniquement sur les routes protégées dans `TranslationsController`.

**Source** : handover_2.md  
**1 fichier · 1 ligne**

Le bundle de traductions est inaccessible aux bornes et écrans avant login.

```diff
 // src/modules/translations/translations.controller.ts
+@Public()
 @Get('bundle')
 async getBundle(...) { ... }
```

---

### #02 — WRK-01 · Corriger la déstructuration SQL dans `AppointmentExpiryWorker` [M]
> ✅ **RÉSOLU le 2026-10-01** — Remplacement de `const [rows, affected]` par `const rows` et vérification de `rows && rows.length > 0` pour les logs de suivi.

**Source** : handover_2.md  
**1 fichier · 2 lignes**

`affected` est toujours `undefined` ; le bloc de log ne s'exécute jamais.

```diff
-const [rows, affected] = await this.dataSource.query(`UPDATE ... RETURNING ...`);
-if (affected && affected.length > 0) { ... }
+const rows = await this.dataSource.query(`UPDATE ... RETURNING ...`);
+if (rows && rows.length > 0) { ... }
```

**Fichier** : `src/workers/appointment-expiry/appointment-expiry.worker.ts`

---

### #03 — SW-03 · `AssignOperatorDto.userId` doit être requis [C]
> ✅ **RÉSOLU le 2026-10-01** — Remplacement de `@ApiPropertyOptional` par `@ApiProperty` et ajout du validateur `@IsNotEmpty()` sur `AssignOperatorDto.userId` (aligné également sur `AssignManagerDto`).

**Source** : api_analysis.md  
**1 fichier · 1 décorateur**

```diff
 // src/modules/queues/dto/queue.dto.ts (ou AssignOperatorDto)
+@IsNotEmpty()
+@IsInt()
 userId?: number;
```

→ Retirer le `?` et aligner avec `AssignManagerDto`.

---

### #04 — SW-18 · `servers`, `tags`, identifiants root [M]
> ✅ **RÉSOLU le 2026-10-01** — Configuration enrichie dans `main.ts` avec servers (local + prod), tags descriptifs, contact et licence. Nettoyage des identifiants et mots de passe root (`root / Root@123456`) dans la documentation OpenAPI et les exemples DTO (`LoginDto`, `ChangePasswordDto`, `AuthUserDto`).

**Source** : api_analysis.md  
**1 fichier**

Dans `src/main.ts`, ajouter au `DocumentBuilder` :
- `.addServer('https://api.example.com', 'Production')`
- `.addTag('Sites', 'Gestion des sites')` × 12 tags
- Retirer `root / Root@123456` des exemples partout

---

### #05 — SW-13 · Supprimer les `default` des `Update*Dto` [I]
> ✅ **RÉSOLU le 2026-10-01** — Remplacement de tous les `default: ...` par `example: ...` dans `CreateSiteDto` et `CreateQueueDto`, évitant ainsi la propagation involontaire de valeurs par défaut dans `UpdateSiteDto` et `UpdateQueueDto` via `PartialType`.

**Source** : api_analysis.md  
**2 fichiers · Retrait de `default: ...` sur les `@ApiProperty`**

Un client généré envoie ces valeurs par défaut et écrase la config existante involontairement.

**Fichiers** :
- `src/modules/queues/dto/queue.dto.ts` — `UpdateQueueDto`
- `src/modules/sites/dto/site.dto.ts` — `UpdateSiteDto`

---

### #06 — SW-04 · Utiliser `registration-token` sur la position publique [C]
> ✅ **RÉSOLU le 2026-10-01** — Déplacement de `@ApiBearerAuth('bearer')` au niveau méthode sur les routes protégées de `RegistrationsController`, et déclaration de `@ApiSecurity('registration-token')` avec `@Public()` sur `GET /public/registrations/position`.

**Source** : api_analysis.md  
**1 fichier · 2 décorateurs**

```diff
 // src/modules/registrations/registrations.controller.ts (endpoint public position)
-@ApiBearerAuth()
+@Public()
+@ApiSecurity('registration-token')
 @Get('public/registrations/position')
```

---

## 🔵 Facile (10–30 min chacun)

### #07 — WRK-03 · `FOR UPDATE SKIP LOCKED` dans `NotificationWorker` [M]

**Source** : handover_2.md  
**1 fichier**

Envelopper dans une transaction et ajouter `FOR UPDATE SKIP LOCKED` :

```sql
SELECT ... FROM dori_notification
WHERE notification_status = 'pending'
ORDER BY created_at ASC
LIMIT 50
FOR UPDATE SKIP LOCKED
```

**Fichier** : `src/workers/notification-worker/notification.worker.ts`

---

### #08 — SEC-05 · Vérifier la session active dans `RealtimeGateway.handleConnection` [M]

**Source** : handover_2.md  
**1 fichier**

Après `jwtService.verify()`, vérifier en base :
```sql
SELECT session_id FROM dori_user_session
WHERE session_id = $1
  AND revoked_reason IS NULL AND revoked_at IS NULL
  AND expires_at > NOW()
```
Et `dori_user.is_active = TRUE AND deleted_at IS NULL`. Déconnecter le socket sinon.

**Fichier** : `src/core/realtime/realtime.gateway.ts`

---

### #09 — VAL-MD · Typage `Promise<PaginatedResult<T>>` sur 5 services [M]

**Source** : handover_2.md  
**5 fichiers · Annotation de type de retour uniquement**

Ajouter `: Promise<PaginatedResult<T>>` sur :
- `users.service.ts` — `findUsers`, `getRoles`
- `registrations.service.ts` — `findRegistrations`
- `notifications.service.ts` — `findNotifications`
- `translations.service.ts` — `findTranslations`
- `service-tiers.service.ts` — `findTiers`

---

### #10 — SW-19 · Pagination inutile de `/queues/{id}/availability` [M]

**Source** : api_analysis.md  
**1–2 fichiers**

L'endpoint accepte `page/pageSize/sort` mais renvoie `{slots[]}` non paginé. Soit paginer réellement, soit supprimer les paramètres.

---

### #11 — SW-12 · Identifiants en `integer` (pas `number`) [I]

**Source** : api_analysis.md  
**~20 fichiers DTOs · Modifications mécaniques**

Ajouter `@ApiProperty({ type: 'integer' })` sur tous les champs ID, count, minutes, position. Vérifier `@IsInt()` sur les DTOs d'entrée.

---

### #12 — SW-17 · Exemples incohérents [M]

**Source** : api_analysis.md  
**~5 fichiers DTOs**

- Corriger les compteurs `DailyQueueVolumeDto` (87 ≠ 85)
- Enum `userType` : `{human, kiosk}` (pas `internal`)
- Retirer mots de passe réels des exemples
- Documenter le format de ticket

---

### #13 — VAL-MC · Pagination sur `GET /notification-rules` [M]

**Source** : handover_2.md  
**2 fichiers**

Exposer `@Query() pagination: PaginationDto` sur `ServiceTiersController.getRules` et déléguer à `findNotificationRules`.

**Fichiers** :
- `src/modules/service-tiers/service-tiers.controller.ts`
- `src/modules/service-tiers/service-tiers.service.ts`

---

### #14 — SW-20 · Nomenclature des DTOs [M]

**Source** : api_analysis.md  
**~10 fichiers DTOs · Renommage mécanique**

Convention : `{Resource}DetailDto` (détail), `{Resource}ResponseDto` (action), `Paginated{Resource}ResponseDto` (paginé).

---

## 🟡 Modéré (30 min – 2h chacun)

### #15 — SW-11 · camelCase uniforme sur Users et Translations [I]

**Source** : api_analysis.md  
**2–4 fichiers + tests**

- `TranslationDetailDto` : `translation_key` → `translationKey`, `is_active` → `isActive`, etc.
- `UserDetailDto` : `user_id` → `userId`, `created_at` → `createdAt`, etc.
- Impact : les services doivent mapper en camelCase dans les retours SQL.

**Fichiers** :
- `src/modules/translations/dto/translation-response.dto.ts`
- `src/modules/translations/translations.service.ts`
- `src/modules/users/dto/user-response.dto.ts`
- `src/modules/users/users.service.ts`

---

### #16 — SW-07 · Config files relisible dans `QueueDetailResponseDto` [I]

**Source** : api_analysis.md  
**3 fichiers**

Ajouter `escalationRateWalkin`, `escalationRateAppointment`, `carryOverWaiting`, `dailyResetMode`, `dailyResetTime` dans `QueueDetailResponseDto`. Documenter si `null` = hérité du site.

**Fichiers** :
- `src/modules/queues/dto/queue-response.dto.ts`
- `src/modules/queues/dto/queue.dto.ts`
- `src/modules/queues/queues.service.ts`

---

### #17 — SW-15 · `format`, `maxLength`, `nullable` [I]

**Source** : api_analysis.md  
**~15 fichiers DTOs**

- `@IsEmail()` + `format: 'email'` sur 12 champs email
- `maxLength` sur ~80 champs texte
- `nullable: true` sur `disconnectedAt`, `failureReason`, etc.

---

### #18 — WRK-02 · `req.rawBody` pour HMAC webhook [I]

**Source** : handover_2.md  
**2 fichiers**

1. `src/main.ts` — `NestFactory.create(AppModule, { rawBody: true })`
2. `src/modules/notifications/notifications.controller.ts` — `req.rawBody` au lieu de `JSON.stringify(dto)`

---

### #19 — SW-02 · Schéma de sécurité HMAC webhook dans Swagger [C]

**Source** : api_analysis.md  
**1 fichier + contrôleur**

Définir `hmacSignature` dans `securitySchemes`. Retirer les headers `authorization`/`x-signature`/`x-timestamp` des paramètres. Documenter la tolérance temporelle et les providers.

---

### #20 — SW-05 · Forfaits par file : isActive/isEnabled, currency, displayOrder [I]

**Source** : api_analysis.md  
**3 fichiers**

Unifier `isActive`/`isEnabled`. Ajouter `isDefault` settable. Retourner `currency`, `displayOrder`.

**Fichiers** :
- `src/modules/service-tiers/dto/tier.dto.ts`
- `src/modules/service-tiers/dto/tier-response.dto.ts`
- `src/modules/service-tiers/service-tiers.service.ts`

---

### #21 — SW-10 · Formats de dates/heures + fuseaux [I]

**Source** : api_analysis.md  
**~5 fichiers DTOs + services**

Unifier `HH:mm` / `HH:mm:ss` / ISO 8601. Documenter UTC vs heure locale. Ajouter `format: date-time` / `date` / `email` / `uuid`.

---

### #22 — DAT-01 · Idempotence du DailyResetWorker ⚠️ CRITIQUE [C]

**Source** : handover_2.md  
**1 fichier + migration SQL**

Créer `dori_queue_daily_reset_log` ou ajouter `last_daily_reset_date` sur `dori_site_queue_thread`. Découpler l'idempotence de `dori_queue_counter`.

**Fichier** : `src/workers/daily-reset/daily-reset.worker.ts`

---

## 🟠 Substantiel (2–6h chacun)

### #23 — SW-06 · Vocabulaire des règles de notification + `trakingLink` [I]

**Source** : api_analysis.md  
**3 fichiers + migration de données**

Corriger `trakingLink` → `trackingLink`. Aligner `notificationType`/`triggerEvent`, `thresholdPosition`+`thresholdMinutes`/`thresholdType`+`thresholdValue`. Ajouter validation XOR.

---

### #24 — SW-08 · `customerId` vs `registrationId` [I]

**Source** : api_analysis.md  
**~8 fichiers DTOs**

Mapper `customerId` (DB) → `registrationId` (API) dans tous les DTOs de réponse. Corriger la description contradictoire de `SendManualNotificationDto.customerId`.

---

### #25 — SW-09 · Unifier les 7 formats de réponse d'action [I]

**Source** : api_analysis.md  
**~10 fichiers contrôleurs/DTOs**

Définir `ActionResponseDto` standard ou adopter `204 No Content`. Uniformiser `deleted`/`removed`/`assigned`/`success`/`closed`/etc.

---

### #26 — DAT-02 + DAT-03 · Transaction atomique + FOR UPDATE sur `registerCustomer` [I]

**Source** : handover_2.md  
**1 fichier + tests**

Envelopper `createRegistration` dans `dataSource.transaction(...)`. Ajouter `SELECT ... FOR UPDATE` sur le créneau avant le count de capacité. À tester avec concurrence.

**Fichier** : `src/modules/registrations/registrations.service.ts`

---

### #27 — SW-14 · Factoriser l'enveloppe `StandardResponseDto<T>` [I]

**Source** : api_analysis.md  
**~10 fichiers swagger**

Définir `StandardResponseDto<T>` comme composant réutilisable. Utiliser `$ref` dans les 89 réponses. Ajouter `type: object` explicite.

---

### #28 — SW-01 · Contrat d'erreur global [C]

**Source** : api_analysis.md  
**~15 fichiers contrôleurs + DTOs**

Créer `ErrorResponseDto`. Ajouter `@ApiResponse({ status: 400/401/403/404/409/422/423/429 })` sur toutes les opérations. Publier le catalogue des codes d'erreur métier.

---

### #29 — SW-16 · Rationaliser les endpoints redondants [M]
> ✅ **RÉSOLU le 2026-10-01** — Suppression de l'opération redondante `GET /api/v1/sites/:siteId/queues` dans `SitesController` et de `findSiteQueues` dans `SitesService`. Les files d'un site sont désormais consultées de façon centralisée via `GET /api/v1/queues?siteId=:siteId`. Clarification des périmètres métier distincts pour les autres paires (soft-delete vs suspension de compte vs déconnexion de session ; borne lookup vs recherche superviseur ; état opérationnel temps réel vs rapport supervision).

**Source** : api_analysis.md  
**2 fichiers modifiés** (`sites.controller.ts`, `sites.service.ts`)

- Suppression de `GET /api/v1/sites/:siteId/queues` et nettoyage de l'import `PaginatedQueueResponseDto`.
- Suppression de la méthode `findSiteQueues` dans `SitesService`.
- Centralisation sur `GET /api/v1/queues?siteId=`.

---

## 🔴 Lourd (> 1 jour)

### #30 — DAT-04 · Homogénéiser TypeORM vs SQL brut [M]

**Source** : handover_2.md  
**200+ appels `dataSource.query()`, 21 entités TypeORM**

**Recommandation** : Option B — assumer le SQL brut, supprimer les entités mortes, créer des interfaces TypeScript de typage pour les retours SQL.

**Impact** : ensemble du codebase.

---

### #31 — RGPD / INPDP · Données personnelles [M]

**Source** : api_analysis.md  
**Décision juridique requise**

- Notes « médicales » visibles par tous les opérateurs
- Pas d'anonymisation ni d'effacement définitif
- `birthDate`, téléphone, email exposés sans garde-fou
- `/registrations/lookup` retourne le `registrationTrackingToken`

→ **À valider avec le juriste avant toute implémentation.**

---

## Résumé par effort

| Effort | Items | Temps total estimé |
|---|---|---|
| 🟢 Trivial | 6 items (#01–#06) | ~30 min |
| 🔵 Facile | 8 items (#07–#14) | ~2–4h |
| 🟡 Modéré | 8 items (#15–#22) | ~8–16h |
| 🟠 Substantiel | 7 items (#23–#29) | ~14–42h |
| 🔴 Lourd | 2 items (#30–#31) | > 2 jours + décision stratégique |
| **Total** | **31 items** | **~4–8 jours de dev** |

---

> **Suggestion** : Commencer par les 6 items 🟢 en une session de 30 min, puis enchaîner avec les 8 items 🔵. À eux seuls, ces 14 premiers items couvrent tous les bugs triviaux et les quick wins sécurité, tout en éliminant les incohérences Swagger les plus visibles.
