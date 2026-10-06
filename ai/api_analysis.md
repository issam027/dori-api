# DORI-API — Analyse du Contrat OpenAPI / Swagger

> **Généré le** : 2026-09-30  
> **Source** : Analyse automatique du swagger généré (`@nestjs/swagger`)  
> **Périmètre** : OpenAPI 3.0.0 — 60 chemins, 90 opérations, 112 schémas, 12 tags  
> **Verdict global** : Couverture fonctionnelle bonne, mais contrat **incohérent** entre requêtes et réponses sur plusieurs domaines. Aucun contrat d'erreur.

Gravité : **[C]** Critique (contrat faux ou inutilisable) · **[I]** Important (source de bugs) · **[M]** Mineur

---

## Checklist globale de résolution (ordre de priorité)

- [ ] **SW-01** [C] Définir un contrat d'erreur global (schémas + codes HTTP)
- [ ] **SW-02** [C] Corriger la sécurité des endpoints publics et du webhook
- [x] **SW-03** [C] `AssignOperatorDto.userId` doit être requis ✅ *2026-10-01*
- [x] **SW-04** [C] `GET /public/registrations/position` : utiliser le schéma `registration-token` ✅ *2026-10-01*
- [ ] **SW-05** [I] Aligner les forfaits par file (`isActive`/`isEnabled`, `currency`, `displayOrder`)
- [ ] **SW-06** [I] Unifier les règles de notification (vocabulaire requête ↔ réponse, corriger `trakingLink`)
- [ ] **SW-07** [I] Rendre la configuration des files relisible dans `QueueDetailResponseDto`
- [x] **SW-08** [I] Unifier l'identifiant d'inscription sous `registrationId` ✅ *2026-10-06*
- [ ] **SW-09** [I] Unifier les réponses d'action (`deleted`/`removed`/`success`/`assigned`…)
- [ ] **SW-10** [I] Fixer les formats de dates/heures et documenter les fuseaux horaires
- [ ] **SW-11** [I] Choisir une casse unique (camelCase) — corriger Users et Translations
- [ ] **SW-12** [I] Typer tous les identifiants en `integer` (pas `number`)
- [x] **SW-13** [I] Supprimer les `default` des `Update*Dto` (dangereux en PATCH) ✅ *2026-10-01*
- [ ] **SW-14** [I] Factoriser l'enveloppe de réponse en composant réutilisable
- [ ] **SW-15** [I] Ajouter `format`, `maxLength`, `nullable` là où ils sont absents
- [x] **SW-16** [M] Rationaliser les endpoints redondants ✅ *2026-10-01*
- [ ] **SW-17** [M] Corriger les incohérences dans les exemples
- [x] **SW-18** [M] Déclarer `servers`, `tags` et retirer les identifiants root de la doc ✅ *2026-10-01*
- [ ] **SW-19** [M] Corriger la pagination de `/queues/{id}/availability`
- [ ] **SW-20** [M] Uniformiser la nomenclature des DTOs

---

## 1. Contrat d'erreur — AUCUN schéma défini [C]

### SW-01 — Définir le contrat d'erreur global

**Problème** : Sur 90 opérations, seuls `401` (login/refresh) et `503` (health) sont documentés. Zéro 400, 403, 404, 409, 422, 423, 429.

**Actions** :
1. Créer un composant `ErrorResponseDto` en schéma OpenAPI :
   ```yaml
   ErrorResponseDto:
     type: object
     properties:
       code: { type: string, example: PERSON_NOT_FOUND }
       translationKey: { type: string, example: errors.person_not_found }
       translationParams: { type: object }
       data: { type: object, nullable: true }
   ```
2. Ajouter sur **toutes** les opérations protégées les réponses :
   - `400` — `VALIDATION_ERROR` (paramètre invalide, DTO rejeté)
   - `401` — `UNAUTHORIZED` (token absent, expiré, session révoquée)
   - `403` — `FORBIDDEN_PERMISSION` / `FORBIDDEN_ROLE_ESCALATION`
   - `404` — `*_NOT_FOUND` (ressource inexistante)
   - `409` — Conflict (doublon, capacité dépassée, créneau indisponible)
   - `422` — `VALIDATION_ERROR` (paramètre invalide, DTO rejeté)
   - `423` — `LOCKED` (account locked)
   - `429` — Rate limit / anti-bruteforce (login)
3. Publier le catalogue complet des `code` d'erreur métier dans la description de l'API.

**Fichiers à modifier** :
- `src/core/errors/dori.exception.ts` — vérifier l'exhaustivité des codes
- `src/core/swagger/` — décorer tous les contrôleurs avec `@ApiResponse({ status: 400, type: ErrorResponseDto })` etc.
- Chaque contrôleur — ajouter les `@ApiResponse` manquants

---

## 2. Sécurité des endpoints

### SW-02 — Webhook : schéma HMAC non défini [C]

**Problème** : Le webhook est déclaré sous `bearer` ET avec des headers `authorization`, `x-signature`, `x-timestamp` en paramètres ordinaires (ignorés par Swagger UI). Aucun schéma de sécurité HMAC n'est défini.

**Actions** :
1. Définir un schéma de sécurité `hmacSignature` dans `components.securitySchemes`.
2. Retirer les headers `authorization` / `x-signature` / `x-timestamp` déclarés en `parameters` — les déplacer dans la description de l'opération ou un schéma de sécurité dédié.
3. Documenter la tolérance temporelle (anti-rejeu) et l'enum des `provider` (ex: `twilio`, `infobip`).

**Fichiers à modifier** :
- `src/modules/notifications/notifications.controller.ts` — `@ApiSecurity`, `@ApiHeader` → description

---

### SW-04 — Position publique : `registration-token` défini mais jamais utilisé [C]

**Problème** : `GET /public/registrations/position` déclare `security: [bearer]` alors que le patient n'a pas de JWT. Le schéma `registration-token` (header `X-Registration-Token`) est défini dans `securitySchemes` mais n'est jamais référencé.

**Actions** :
1. Retirer `@ApiBearerAuth()` de `getPublicPosition`.
2. Ajouter `@ApiSecurity('registration-token')` sur cet endpoint.
3. Documenter `X-Registration-Token` : format, durée de vie, comment l'obtenir (`registrationTrackingToken` retourné par `POST /registrations`).

**Fichiers à modifier** :
- `src/modules/registrations/registrations.controller.ts` (ou le contrôleur public)

---

### SW-03 — `AssignOperatorDto.userId` optionnel alors qu'il est indispensable [C]

**Problème** : `AssignOperatorDto.userId` n'est pas `required`, contrairement à `AssignManagerDto`. Le comportement sans `userId` n'est pas défini.

**Actions** :
1. Ajouter `@IsNotEmpty()` et `required: ['userId']` dans `AssignOperatorDto`.
2. Documenter explicitement que sans `userId` une erreur `VALIDATION_ERROR` est renvoyée.

**Fichiers à modifier** :
- `src/modules/queues/dto/queue.dto.ts` (ou l'équivalent `AssignOperatorDto`)

---

## 3. Forfaits par file (`/queues/{id}/tiers`) [I]

### SW-05 — Champs incohérents entre écriture et lecture

**Problèmes** :
- `isEnabled` et `isDefault` sont **retournés** mais **jamais settables** (`AssociateQueueTierDto` ne les contient pas).
- `isActive` en écriture ≠ `isEnabled` en lecture — deux noms pour le même concept.
- `currency` et `displayOrder` sont acceptés en entrée mais **jamais retournés**.
- Description contradictoire : « Tarif en devise de la file » alors que la file n'a pas de devise (seul le site a `defaultCurrency`).
- `UpdateQueueTierDto` mentionne « état par défaut » mais `isDefault` est absent.

**Actions** :
1. Unifier `isActive`/`isEnabled` → choisir un nom (`isActive`) et l'utiliser partout.
2. Ajouter `isDefault` dans `AssociateQueueTierDto` / `UpdateQueueTierDto`.
3. Retourner `currency`, `displayOrder` dans `QueueTierDetailDto`.
4. Clarifier où vit la devise : remplacer « devise de la file » par « devise du site (`site.defaultCurrency`) ».

**Fichiers à modifier** :
- `src/modules/service-tiers/dto/tier.dto.ts`
- `src/modules/service-tiers/dto/tier-response.dto.ts`
- `src/modules/service-tiers/service-tiers.service.ts`

---

## 4. Règles de notification [I]

### SW-06 — Deux vocabulaires sans correspondance + faute de frappe figée dans un enum

**Problèmes** :

| Écriture (`CreateNotificationRuleDto`) | Lecture (`NotificationRuleDetailDto`) |
|---|---|
| `notificationType` : `welcome / threshold / trakingLink` | `triggerEvent` : `welcome / threshold / near_turn` |
| `thresholdPosition` + `thresholdMinutes` (deux champs distincts) | `thresholdType` (`position`/`estimated_time`) + `thresholdValue` |
| `includeTrackingLink` | absent |
| — | `templateKey` (non settable) |

- **`trakingLink` est une faute de frappe** (→ `trackingLink`) figée dans l'enum : elle sera gravée dans les clients générés.
- Aucune correspondance documentée (`near_turn` = `trakingLink` ?).
- Rien n'explicite le comportement si `thresholdPosition` ET `thresholdMinutes` sont fournis ensemble.

**Actions** :
1. Corriger `trakingLink` → `trackingLink` dans l'enum (migration de données si nécessaire).
2. Aligner le vocabulaire requête/réponse : adopter `triggerEvent`, `thresholdType`, `thresholdValue` partout.
3. Documenter la correspondance `near_turn` ↔ `trackingLink`.
4. Ajouter une règle de validation : `thresholdPosition` XOR `thresholdMinutes` (pas les deux).
5. Rendre `templateKey` visible en lecture et éventuellement settable.

**Fichiers à modifier** :
- `src/modules/service-tiers/dto/tier.dto.ts` — `CreateNotificationRuleDto`
- `src/modules/service-tiers/dto/tier-response.dto.ts` — `NotificationRuleDetailDto`
- `src/modules/service-tiers/service-tiers.service.ts`

---

## 5. Configuration des files [I]

### SW-07 — Champs de configuration non relisibles dans `QueueDetailResponseDto`

**Problème** : `CreateQueueDto` accepte `escalationRateWalkin`, `escalationRateAppointment`, `carryOverWaiting`, `dailyResetMode`, `dailyResetTime`. **`QueueDetailResponseDto` ne les retourne pas.** On peut les écrire mais pas les relire.

**Problèmes additionnels** :
- `UpdateSiteDto` et `UpdateQueueDto` portent des `default` en PATCH — un client généré peut écraser la config involontairement.
- `averageWaitTime` a deux définitions contradictoires (« attente estimée » vs « temps de prise en charge »).

**Actions** :
1. Ajouter dans `QueueDetailResponseDto` : `escalationRateWalkin`, `escalationRateAppointment`, `carryOverWaiting`, `dailyResetMode`, `dailyResetTime`.
2. Supprimer les `default` de `UpdateQueueDto` et `UpdateSiteDto`.
3. Uniformiser la description de `averageWaitTime`.
4. Documenter si `null` permet de repasser à « hérité du site ».

**Fichiers à modifier** :
- `src/modules/queues/dto/queue-response.dto.ts`
- `src/modules/queues/dto/queue.dto.ts`
- `src/modules/sites/dto/site.dto.ts`

---

## 6. Identifiants et nommage [I]

### SW-08 — Unifier l'identifiant sous `registrationId` [I]

**Résolution (2026-10-06)** : le domaine utilise désormais exclusivement le terme `registration`. Le contrat API,
les DTOs, les services, les permissions, les événements temps réel, les entités et le schéma PostgreSQL exposent
`registrationId` / `registration_id`. La table canonique est `dori_registration`; l'ancien modèle et ses noms ont
été supprimés. La persistance du module est encapsulée dans `RegistrationsRepository`, conformément à ARCH-001.

---
### SW-11 — Casse mixte dans le même domaine [I]

**Problème** :
- `TranslationDetailDto` en snake_case (`translation_key`, `is_active`) ↔ `CreateTranslationDto` en camelCase.
- `UserDetailDto` en snake_case (`user_id`, `created_at`) ↔ `UpdateUserStatusResponseDto` en camelCase (`userId`, `isActive`).
- `AuthUserDto` en camelCase, mais des champs identiques en snake_case ailleurs.

**Actions** :
1. Adopter **camelCase** uniformément pour tous les DTOs exposés en API.
2. Corriger `TranslationDetailDto` et `UserDetailDto` (et variantes).
3. Vérifier la cohérence `userId`/`user_id`, `languagePreference`/`language_preference`, `preferredLanguage`.

**Fichiers à modifier** :
- `src/modules/translations/dto/translation-response.dto.ts`
- `src/modules/users/dto/user-response.dto.ts`

---

## 7. Réponses d'actions [I]

### SW-09 — 7 formats différents pour exprimer le résultat d'une action

**Problème** : Les DELETE et actions répondent avec des clés différentes selon l'endpoint :
`deleted`, `removed`, `assigned`, `success`, `closed`, `passwordUpdated`, `permissionsUpdated`, `received`.
La clé d'identifiant varie aussi : `siteId`, `queueId`, `id`, `registrationId`, `translationId`, `userId`.

**Actions** :
1. Définir un composant `ActionResponseDto` standard :
   ```ts
   { id: number; action: 'deleted' | 'removed' | 'assigned' | 'closed' | ...; }
   ```
   Ou utiliser simplement `204 No Content` pour les suppressions/dissociations.
2. Appliquer uniformément à tous les endpoints d'action.

**Fichiers à modifier** :
- DTOs de réponse de tous les contrôleurs (sites, queues, persons, users, service-tiers, registrations, translations)

---

## 8. Formats de données [I]

### SW-10 — Formats de dates incohérents, fuseaux non documentés

**Problèmes** :
- Heures d'ouverture : `HH:mm` en écriture, `HH:mm:ss` en lecture.
- `scheduledTime` : ISO 8601 complet en écriture (`2026-10-01T09:00:00Z`), heure seule en lecture (`10:30:00`).
- Créneau `time` : `HH:mm`.
- → **Trois formats pour la même notion.**
- Les horaires de file sont en heure locale du site (`timezone` IANA), mais `scheduledTime` est en UTC — non documenté.
- Aucune propriété n'a de `format` OpenAPI (`date`, `date-time`, `email`, `uuid`) sur ~550 champs.

**Actions** :
1. Choisir un format universel pour les heures : `HH:mm:ss` (ISO 8601 partiel) en lecture ET écriture.
2. Choisir `date-time` ISO 8601 pour `scheduledTime` en lecture aussi.
3. Documenter la règle de fuseau horaire (UTC en API, conversion en heure locale du site en affichage).
4. Ajouter `format: date-time` / `date` / `email` / `uuid` sur tous les champs appropriés.

**Fichiers à modifier** :
- `src/modules/registrations/dto/registration.dto.ts`
- `src/modules/queues/dto/queue.dto.ts`
- `src/modules/sites/dto/site.dto.ts`

---

### SW-12 — Identifiants typés `number` au lieu de `integer` [I]

**Problème** : Tous les IDs, compteurs et durées sont typés `number` (0 `integer` dans tout le document). Les générateurs de SDK produiront `float`/`double` pour des IDs.

**Actions** :
1. Ajouter `@ApiProperty({ type: 'integer' })` sur tous les champs ID, count, minutes, position.
2. Vérifier `@IsInt()` sur les DTO d'entrée correspondants.

---

### SW-13 — `default` dans les `Update*Dto` (dangereux en PATCH) [I]

**Problème** : `UpdateSiteDto` et `UpdateQueueDto` déclarent des valeurs `default`. Un client généré peut renvoyer ces valeurs et écraser la configuration existante involontairement.

**Actions** :
1. Supprimer tous les `default` de `UpdateQueueDto` et `UpdateSiteDto`.
2. Vérifier que le service traite correctement les champs `undefined` (ne pas écraser si absent du body).

**Fichiers à modifier** :
- `src/modules/queues/dto/queue.dto.ts`
- `src/modules/sites/dto/site.dto.ts`

---

## 9. Structure OpenAPI [I/M]

### SW-14 — Enveloppe de réponse non factorisée [I]

**Problème** : L'enveloppe `{code, translationKey, translationParams, data}` est recopiée en ligne dans les 89 réponses. Les générateurs de SDK produisent 89 types anonymes.

**Actions** :
1. Définir `StandardResponseDto<T>` comme composant réutilisable dans `components.schemas`.
2. Utiliser `$ref` dans toutes les réponses.
3. Ajouter `type: object` explicite sur tous les schémas inline (certains n'ont que `properties`).

---

### SW-15 — `format`, `maxLength`, `nullable` absents [I]

**Problème** :
- `nullable: true` absent sur `disconnectedAt`, `failureReason` (qui ont `example: null`).
- ~80 champs de saisie sans `maxLength` (noms, notes, contenus de notification).
- Aucun `format: email` sur les 12 champs email.
- Aucun `format: uuid` sur les tokens de tracking.

**Actions** :
1. Ajouter `@IsEmail()` + `@ApiProperty({ format: 'email' })` sur tous les champs email.
2. Ajouter `maxLength` sur tous les champs texte libres (min. 255 pour les noms, 2000 pour les notes).
3. Corriger `nullable` sur tous les champs explicitement nullables.

---

## 10. Endpoints redondants [M]

### SW-16 — Rationaliser les doublons d'endpoints

**Doublons identifiés** :

| Endpoints | Problème |
|---|---|
| `GET /sites/{id}/queues` = `GET /queues?siteId=` | Même contrat, filtres différents |
| `DELETE /users/{id}` + `PATCH .../status` + `POST /auth/logout {userId}` | Trois chemins pour désactiver un user |
| `POST /users` (avec `roleId`) vs `POST /users/{id}/roles` | Création avec rôle vs assignation séparée |
| `/registrations/lookup` vs `/registrations?search=` | Deux façons de chercher une inscription |
| `GET /queues/{id}/status` vs `GET /reports/dashboard/queue-load` | Temps réel vs rapport |

**Actions** :
1. Documenter explicitement la différence entre chaque paire (ne pas forcément supprimer).
2. Déprécier `GET /sites/{id}/queues` avec `@ApiDeprecated()` en faveur de `GET /queues?siteId=`.
3. Clarifier que `DELETE /users` = soft-delete ≠ `PATCH /status` = toggle.

---

## 11. Exemples incohérents [M]

### SW-17 — Données d'exemples incorrectes ou contradictoires

**Problèmes** :
- `DailyQueueVolumeDto` : 70 + 5 + 3 + 7 + 2 = **87** ≠ `totalRegistered` = **85**.
- `SiteManagerResponseDto.userType` = `"internal"` alors que l'enum global est `{human, kiosk}`.
- `CreateNotificationRuleDto` : `thresholdPosition: 3` ET `thresholdMinutes: 10` donnés ensemble (interdit).
- Mots de passe réels dans les exemples (`Root@123456`, `Secure@Pass2026`).
- Formats de tickets variés (`A-012`, `A-007`, `MED-0042`, `A042`) — règle non documentée.

**Actions** :
1. Corriger les compteurs du `DailyQueueVolumeDto`.
2. Ajouter l'enum `{human, kiosk}` sur `SiteManagerResponseDto.userType`.
3. Remplacer les mots de passe réels par `"password": "••••••••••"` ou `"REDACTED"`.
4. Documenter le format de génération des tickets (ex: `{queueCode}-{padded_number}`).

---

## 12. Documentation de base [M]

### SW-18 — `servers`, `tags` et identifiants root à corriger

**Problèmes** :
- `servers: []` — aucune URL de base déclarée.
- `tags: []` — 12 tags utilisés mais jamais déclarés ni décrits.
- Identifiants root par défaut (`root / Root@123456`) présents dans les exemples.
- `contact: {}` vide.

**Actions** :
1. Déclarer `servers` avec les URLs de dev/staging/prod.
2. Déclarer et décrire chacun des 12 tags.
3. **Retirer immédiatement** les identifiants root des exemples.
4. Remplir `contact` et `license` dans `info`.

**Fichiers à modifier** :
- `src/main.ts` — configuration `DocumentBuilder`

---

## 13. Pagination [M]

### SW-19 — `/queues/{id}/availability` : paramètres de pagination inutiles

**Problème** : L'endpoint accepte `page/pageSize/sort` mais renvoie un objet `{slots[]}` non paginé. Les paramètres sont déclarés mais ignorés.

**Actions** :
1. Soit paginer réellement la réponse (`PaginatedResult<SlotDto>`).
2. Soit supprimer les paramètres `page`, `pageSize`, `sort` de cet endpoint.
3. Documenter `next-preview.limit` avec une valeur par défaut et une borne max.

---

## 14. Nomenclature des DTOs [M]

### SW-20 — Nommage incohérent des schémas

**Problèmes** :
- `QueueDetailResponseDto` vs `PersonDetailDto` (avec/sans `Response`).
- `TierDeleteResponseDto` vs `DeleteTranslationResponseDto` (ordre inversé).
- `QueuePreviewResponseDto` retourné en tableau → devrait être au pluriel ou préfixé `Paginated`.
- `allOf` à un seul élément (artefact NestJS) sur 5 schémas : `user`, `tier`, `volume`, `kpis`, `person`.

**Actions** :
1. Adopter la convention `{Resource}DetailDto` (liste), `{Resource}ResponseDto` (action), `Paginated{Resource}ResponseDto` (paginé).
2. Supprimer les `allOf` à un seul élément (via `@ApiProperty({ allOf: [] })` → `type: () => X`).

---

## 15. Données personnelles [M]

**Points à valider avec le juriste** :
- Notes « médicales ou administratives » : visibles par tous les opérateurs, sans permission dédiée.
- Pas d'anonymisation, d'effacement définitif, ni d'export (soft-delete uniquement).
- `birthDate`, téléphone et email exposés via `GET /persons?search=` sans garde-fou.
- `/registrations/lookup` par nom + heure retourne le `registrationTrackingToken`.
- Conformité à valider : **INPDP** (Tunisie) et/ou **RGPD** si des ressortissants UE sont concernés.

---

## Tableau de suivi

| ID | Gravité | Domaine | Titre court | Statut |
|---|---|---|---|---|
| SW-01 | C | Erreurs | Contrat d'erreur global manquant | ⬜ À faire |
| SW-02 | C | Sécurité | Schéma HMAC webhook non défini | ⬜ À faire |
| SW-03 | C | Queues | `AssignOperatorDto.userId` doit être requis | ✅ Résolu (2026-10-01) |
| SW-04 | C | Public | `registration-token` jamais utilisé | ✅ Résolu (2026-10-01) |
| SW-05 | I | Tiers | `isActive`/`isEnabled`, currency, displayOrder incohérents | ⬜ À faire |
| SW-06 | I | Notifs | Vocabulaire règles notif + faute `trakingLink` | ⬜ À faire |
| SW-07 | I | Queues | Config files non relisible dans `QueueDetailResponseDto` | ⬜ À faire |
| SW-08 | I | Registrations | Identifiant unifié sous `registrationId` | ✅ Corrigé 2026-10-06 |
| SW-09 | I | Tous | 7 formats de réponse d'action | ⬜ À faire |
| SW-10 | I | Formats | Dates/heures incohérentes, fuseaux non documentés | ⬜ À faire |
| SW-11 | I | Nommage | Casse mixte Users et Translations | ⬜ À faire |
| SW-12 | I | Types | IDs typés `number` au lieu de `integer` | ⬜ À faire |
| SW-13 | I | DTOs | `default` dangereux dans `Update*Dto` | ✅ Résolu (2026-10-01) |
| SW-14 | I | OpenAPI | Enveloppe de réponse non factorisée | ⬜ À faire |
| SW-15 | I | OpenAPI | `format`, `maxLength`, `nullable` absents | ⬜ À faire |
| SW-16 | M | Routing | Endpoints redondants | ✅ Résolu (2026-10-01) |
| SW-17 | M | Exemples | Données d'exemples incorrectes | ⬜ À faire |
| SW-18 | M | OpenAPI | `servers`, `tags`, identifiants root | ✅ Résolu (2026-10-01) |
| SW-19 | M | Pagination | `/availability` : paramètres inutiles | ⬜ À faire |
| SW-20 | M | DTOs | Nomenclature des schémas incohérente | ⬜ À faire |
