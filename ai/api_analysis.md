# DORI-API — Analyse du Contrat OpenAPI / Swagger

> **Généré le** : 2026-09-30 — **réévalué sur le code le 2026-10-06**
> **Source** : analyse du code et de la configuration Swagger (`@nestjs/swagger`)
> **Verdict global actualisé** : les fondations transverses sont maintenant présentes (réponses standardisées,
> erreurs centralisées, sérialisation camelCase, configuration OpenAPI commune). Plusieurs incohérences de domaine
> restent toutefois ouvertes ou seulement partiellement corrigées.

Gravité : **[C]** Critique (contrat faux ou inutilisable) · **[I]** Important (source de bugs) · **[M]** Mineur

Statuts : **[x]** corrigé · **[~]** partiellement corrigé · **[ ]** toujours d'actualité

---

## Checklist globale de résolution (ordre de priorité)
- [~] **SW-01** [C] Contrat d'erreur global centralisé ; statuts métier encore trop génériques
- [~] **SW-02** [C] Webhook sécurisé à l'exécution ; schéma OpenAPI HMAC encore absent
- [x] **SW-03** [C] `AssignOperatorDto.userId` doit être requis ✅ *2026-10-01*
- [x] **SW-04** [C] `GET /public/registrations/position` : utiliser le schéma `registration-token` ✅ *2026-10-01*
- [x] **SW-05** [I] Écriture/lecture des forfaits alignées et devise héritée dynamiquement ✅ *2026-10-06*
- [x] **SW-06** [I] Deux types de notification et contrat écriture/lecture unifié ✅ *2026-10-06*
- [x] **SW-07** [I] Configuration effective des files relisible avec origine d'héritage ✅ *2026-10-06*
- [x] **SW-08** [I] Unifier l'identifiant d'inscription sous `registrationId` ✅ *2026-10-06*
- [ ] **SW-09** [I] Unifier les réponses d'action (`deleted`/`removed`/`success`/`assigned`…)
- [~] **SW-10** [I] Plusieurs formats OpenAPI ajoutés ; conventions heure/fuseau encore incomplètes
- [x] **SW-11** [I] DTOs Users/Translations et sérialisation uniformisés en camelCase ✅ *2026-10-06*
- [~] **SW-12** [I] Paramètres de route normalisés en `integer` ; propriétés de DTO encore hétérogènes
- [x] **SW-13** [I] Supprimer les `default` des `Update*Dto` (dangereux en PATCH) ✅ *2026-10-01*
- [~] **SW-14** [I] Décorateurs centralisés ; enveloppe encore générée inline plutôt qu'en composant générique `$ref`
- [~] **SW-15** [I] Contraintes ajoutées sur plusieurs DTOs ; couverture encore incomplète
- [x] **SW-16** [M] Rationaliser les endpoints redondants ✅ *2026-10-01*
- [~] **SW-17** [M] Plusieurs exemples corrigés ; mot de passe root et formats de tickets restent incohérents
- [~] **SW-18** [M] `servers`, tags, contact et licence ajoutés ; identifiant root encore présent dans un exemple
- [x] **SW-19** [M] Pagination retirée de `/availability` et `next-preview.limit` borné ✅ *2026-10-06*
- [x] **SW-20** [M] Convention globale des DTOs appliquée et contrôlée automatiquement ✅ *2026-10-06*

---

## 1. Contrat d'erreur — AUCUN schéma défini [C]

### SW-01 — Définir le contrat d'erreur global

**Réévaluation 2026-10-06 — Partiel :** `ErrorResponseDto` et les décorateurs `ApiDoriErrorResponses` / `ApiDoriPublicErrorResponses` sont centralisés et appliqués aux contrôleurs. Le catalogue d'erreurs n'est toutefois pas publié dans le contrat et les décorateurs de classe omettent par défaut `404`, `409` et `422`, sans composition systématique par endpoint.

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

**Réévaluation 2026-10-06 — Partiel :** la route est publique, refuse le Bearer et valide désormais signature, timestamp, identifiant d'événement et corps brut. En revanche, aucun `securityScheme` HMAC n'est déclaré : Swagger utilise encore des `ApiHeader` ordinaires et le fournisseur n'a pas d'enum documenté.

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

**Résolution 2026-10-06 — Corrigé :** écriture et lecture utilisent désormais `isActive`, `isDefault`, `currency` et `displayOrder`. `isDefault` est persisté sur l'association, unique parmi les forfaits actifs d'une file, et son remplacement est transactionnel. La devise suit la hiérarchie dynamique surcharge association → surcharge file → `site.defaultCurrency`. Une valeur `null` rétablit l'héritage. La réponse expose `currency`, `currencyOverride` et `currencyOrigin`.

**État final :**

- `AssociateQueueTierDto` et `UpdateQueueTierDto` acceptent `isDefault`, `isActive`, `currency` et `displayOrder` selon leur rôle.
- `QueueTierResponseDto` restitue les mêmes concepts sans alias `isEnabled`.
- La base garantit au plus un forfait actif par défaut pour chaque file.
- La devise n'est plus copiée depuis le site : elle est résolue à chaque lecture, ce qui conserve l'héritage dynamique.
- La migration idempotente a été appliquée sur `dori-dev` le 2026-10-06 sans reset ni perte de données.

---
## 4. Règles de notification [I]

### SW-06 — Deux vocabulaires sans correspondance + faute de frappe figée dans un enum

**Résolu le 2026-10-06.** Le domaine ne comporte plus que deux événements :

| Champ | Contrat |
| --- | --- |
| `notificationType` | `welcome` ou `threshold` |
| `thresholdType` | `position` ou `estimatedTime`, requis pour `threshold` |
| `thresholdValue` | entier ≥ 1, requis pour `threshold` |
| `includeTrackingLink` | booléen indépendant, autorisé pour les deux types |

La lecture et l'écriture utilisent désormais exactement ce vocabulaire. Les champs concurrents `triggerEvent`, `thresholdPosition`, `thresholdMinutes` et `templateKey` ont été retirés du contrat public. Le service réalise une seule conversion vers les deux colonnes SQL internes de seuil, et le repository ne réimplémente pas les règles métier.

La base impose `welcome` sans seuil et `threshold` avec exactement un seuil. La migration idempotente convertit les anciens `trakingLink` en `threshold` lorsqu'un seuil existe, sinon en `welcome`; le booléen `include_tracking_link` est conservé. Les notifications historiques `trakingLink`, qui ne portent pas de seuil, deviennent `welcome`.

**Validation :** compilation réussie, 24 suites / 119 tests réussis, et schéma appliqué avec succès le 2026-10-06 sur la base configurée `dori-dev` (sans reset ni seed). Les tests du service couvrent le lien de suivi sur les deux types ainsi que le rejet d'un seuil incomplet.

- `src/modules/service-tiers/dto/tier.dto.ts` — `CreateNotificationRuleDto`
- `src/modules/service-tiers/dto/tier-response.dto.ts` — `NotificationRuleDetailDto`
- `src/modules/service-tiers/service-tiers.service.ts`

---

## 5. Configuration des files [I]

### SW-07 — Configuration des files relisible et héritable

**Résolution 2026-10-06 — Corrigé :** toutes les propriétés `default_*` du site ont un override nullable côté file, y compris désormais `currency` et `locale`. `QueueResponseDto` expose les valeurs effectives et `configOrigins` indique pour chaque champ s'il est `inherited` ou `overridden`. Liste, détail, création et modification utilisent la même projection sérialisée.

**Règle d'héritage :** absence ou `null` sur la file = valeur `default_*` du site ; valeur non nulle = surcharge propre à la file. Cette règle couvre devise, locale, rendez-vous, créneaux, horaires, pauses, tolérance, pondérations, escalade et reset journalier.

---
## 6. Identifiants et nommage [I]

### SW-08 — Unifier l'identifiant sous `registrationId` [I]

**Résolution (2026-10-06)** : le domaine utilise désormais exclusivement le terme `registration`. Le contrat API, les DTOs, les services, les permissions, les événements temps réel, les entités et le schéma PostgreSQL exposent `registrationId` / `registration_id`. La table canonique est `dori_registration`; l'ancien modèle et ses noms ont été supprimés. La persistance du module est encapsulée dans `RegistrationsRepository`, conformément à ARCH-001.

---

### SW-11 — Casse mixte dans le même domaine [I]

**Réévaluation 2026-10-06 — Corrigé :** les DTOs Users et Translations sont en camelCase et la conversion des lignes SQL est centralisée par `SerializationInterceptor`. Les anciens champs publics snake_case ne subsistent plus.

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

**Réévaluation 2026-10-06 — Toujours d'actualité :** l'enveloppe HTTP est homogène, mais son champ `data` contient toujours des DTOs d'action incompatibles (`deleted`, `removed`, `assigned`, `closed`, etc.).

**Problème** : Les DELETE et actions répondent avec des clés différentes selon l'endpoint : `deleted`, `removed`, `assigned`, `success`, `closed`, `passwordUpdated`, `permissionsUpdated`, `received`. La clé d'identifiant varie aussi : `siteId`, `queueId`, `id`, `registrationId`, `translationId`, `userId`.

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

**Réévaluation 2026-10-06 — Partiel :** `normalizeOpenApiDocument` ajoute automatiquement plusieurs formats `date`/`date-time` et des DTOs déclarent désormais `nullable`. Les formats d'heure locale, le fuseau du site et les exemples `scheduledTime` restent néanmoins hétérogènes.

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

**Réévaluation 2026-10-06 — Partiel :** le normaliseur force les paramètres dont le nom finit par `Id` en `integer` avec `minimum: 1`. Il ne convertit pas les propriétés numériques des schémas DTO, qui restent largement inférées comme `number`.

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

**Réévaluation 2026-10-06 — Partiel :** tous les contrôleurs passent désormais par les décorateurs centralisés `ApiDoriOkResponse` / `ApiDoriCreatedResponse`, cohérents avec le `SerializationInterceptor`. Le builder réinjecte cependant une enveloppe inline pour chaque réponse et ne référence pas encore un composant générique partagé.

**Problème** : L'enveloppe `{code, translationKey, translationParams, data}` est recopiée en ligne dans les 89 réponses. Les générateurs de SDK produisent 89 types anonymes.

**Actions** :

1. Définir `StandardResponseDto<T>` comme composant réutilisable dans `components.schemas`.
2. Utiliser `$ref` dans toutes les réponses.
3. Ajouter `type: object` explicite sur tous les schémas inline (certains n'ont que `properties`).

---

### SW-15 — `format`, `maxLength`, `nullable` absents [I]

**Réévaluation 2026-10-06 — Partiel :** des `MaxLength`, formats `date-time`, champs `nullable` et validations email ont été ajoutés, complétés par le normaliseur OpenAPI. La couverture n'est pas exhaustive, notamment pour les emails, tokens et champs texte historiques.

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
| --- | --- |
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

**Réévaluation 2026-10-06 — Partiel :** plusieurs DTOs ont été alignés, mais `LoginDto` expose encore `Root@123456` et les exemples de tickets emploient toujours plusieurs conventions non documentées.

**Problèmes** :

- `DailyQueueVolumeDto` : 70 + 5 + 3 + 7 + 2 = **87** ≠ `totalRegistered` = **85**.
- `SiteManagerResponseDto.userType` = `"internal"` alors que l'enum global est `{human, kiosk}`.
- L'ancien exemple de règle avec deux seuils a été supprimé par le contrat SW-06 (`thresholdType` + `thresholdValue`).
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

**Réévaluation 2026-10-06 — Partiel :** `createOpenApiConfig` fournit désormais serveurs, 12 tags décrits, contact, licence et schémas d'authentification. Le mot de passe root reste toutefois présent dans l'exemple de login ; le point ne peut donc plus être considéré comme entièrement résolu.

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

**Réévaluation 2026-10-06 — Corrigé :** `RegistrationAvailabilityQueryDto` ne contient plus que `date`.
`next-preview.limit` utilise le pipe commun avec valeur par défaut et borne maximale.

**Problème** : L'endpoint accepte `page/pageSize/sort` mais renvoie un objet `{slots[]}` non paginé. Les paramètres sont déclarés mais ignorés.

**Actions** :

1. Soit paginer réellement la réponse (`PaginatedResult<SlotDto>`).
2. Soit supprimer les paramètres `page`, `pageSize`, `sort` de cet endpoint.
3. Documenter `next-preview.limit` avec une valeur par défaut et une borne max.

---

## 14. Nomenclature des DTOs [M]

### SW-20 — Convention globale de nommage des schémas

**Résolution 2026-10-06 — Corrigé :** les schémas publics ont été renommés sans modifier leurs propriétés JSON.
Les variantes `DetailDto`, `DetailResponseDto`, les actions inversées comme `TierDeleteResponseDto` et les noms
ambigus comme `QueuePreviewResponseDto` ont été supprimés. Les imports, contrôleurs, services et tests utilisent les
nouveaux noms.

**Convention globale obligatoire :**

| Rôle | Convention | Exemple |
|---|---|---|
| Commande d'entrée | `{Action}{Resource}Dto` | `CreatePersonDto`, `RescheduleRegistrationDto` |
| Filtre de collection | `{Resource}FilterDto` | `RegistrationFilterDto` |
| Paramètres de lecture | `{Resource}{Purpose}QueryDto` | `RegistrationAvailabilityQueryDto` |
| Ressource retournée | `{Resource}ResponseDto` | `PersonResponseDto` |
| Collection paginée | `Paginated{Resource}ResponseDto` | `PaginatedPersonResponseDto` |
| Résultat d'action | `{Action}{Resource}ResponseDto` | `DeleteRegistrationResponseDto` |
| Élément imbriqué/tableau | `{Concept}ItemDto` | `QueuePreviewItemDto` |
| Objet interne ou base non exposée seul | `{Concept}Dto` | `PersonIdentityDto` |

Les mots `Detail` et `Data` ne doivent pas servir à distinguer artificiellement un schéma public. Le suffixe décrit
le rôle réel du type, tandis que l'action précède toujours la ressource.

**Garde-fou :** `ApiDoriOkResponse`, `ApiDoriCreatedResponse` et `ApiDoriRawResponse` appellent désormais
`assertPublicResponseDtoName`. Tout DTO directement exposé qui ne finit pas par `ResponseDto` ou `ItemDto` provoque
une erreur explicite au chargement. Un test couvre les noms admis et le rejet de l'ancien modèle `PersonDetailDto`.

---

## 15. Données personnelles [M]

**Réévaluation 2026-10-06 — Risque réduit mais toujours à arbitrer juridiquement :** les recherches de personnes et de rendez-vous sont désormais protégées par permission et limitées au scope site/file ; la déduplication d'une personne est également cloisonnée par site. Les notes n'ont cependant toujours pas de permission dédiée, le modèle reste fondé sur le soft-delete sans export/effacement définitif, et le lookup autorisé retourne encore le jeton de suivi. Les questions INPDP/RGPD restent donc d'actualité.

**Points à valider avec le juriste** :

- Notes « médicales ou administratives » : accessibles sous la permission générale personne/inscription, sans permission dédiée aux notes sensibles.
- Pas d'anonymisation, d'effacement définitif, ni d'export (soft-delete uniquement).
- `birthDate`, téléphone et email restent exposés via `GET /persons?search=` aux utilisateurs autorisés du scope.
- `/registrations/lookup` est protégé et scopé, mais retourne le `registrationTrackingToken`.
- Conformité à valider : **INPDP** (Tunisie) et/ou **RGPD** si des ressortissants UE sont concernés.

---

## Tableau de suivi

| ID | Gravité | Domaine | Titre court | Statut |
| --- | --- | --- | --- | --- |
| SW-01 | C | Erreurs | Contrat centralisé, couverture métier incomplète | 🟨 Partiel (2026-10-06) |
| SW-02 | C | Sécurité | Runtime HMAC durci, schéma OpenAPI absent | 🟨 Partiel (2026-10-06) |
| SW-03 | C | Queues | `AssignOperatorDto.userId` doit être requis | ✅ Résolu (2026-10-01) |
| SW-04 | C | Public | `registration-token` appliqué au suivi public | ✅ Résolu (2026-10-01) |
| SW-05 | I | Tiers | Écriture/lecture alignées, devise héritée dynamiquement | ✅ Corrigé (2026-10-06) |
| SW-06 | I | Notifs | Deux types, vocabulaire unifié et contraintes SQL cohérentes | ✅ Corrigé (2026-10-06) |
| SW-07 | I | Queues | Configuration effective et origine exposées | ✅ Corrigé (2026-10-06) |
| SW-08 | I | Registrations | Identifiant unifié sous `registrationId` | ✅ Corrigé 2026-10-06 |
| SW-09 | I | Tous | DTOs d'action toujours hétérogènes | ⬜ Toujours d'actualité |
| SW-10 | I | Formats | Formats partiellement normalisés, fuseaux incomplets | 🟨 Partiel (2026-10-06) |
| SW-11 | I | Nommage | Users et Translations en camelCase | ✅ Corrigé (2026-10-06) |
| SW-12 | I | Types | Paramètres ID normalisés, propriétés DTO restantes | 🟨 Partiel (2026-10-06) |
| SW-13 | I | DTOs | `default` dangereux dans `Update*Dto` | ✅ Résolu (2026-10-01) |
| SW-14 | I | OpenAPI | Décorateurs factorisés, schéma encore inline | 🟨 Partiel (2026-10-06) |
| SW-15 | I | OpenAPI | Contraintes présentes mais non exhaustives | 🟨 Partiel (2026-10-06) |
| SW-16 | M | Routing | Endpoints redondants | ✅ Résolu (2026-10-01) |
| SW-17 | M | Exemples | Corrections partielles, password/tickets restants | 🟨 Partiel (2026-10-06) |
| SW-18 | M | OpenAPI | Base documentée, secret root encore exposé en exemple | 🟨 Partiel (réévalué 2026-10-06) |
| SW-19 | M | Pagination | Paramètres inutiles retirés de `/availability` | ✅ Corrigé (2026-10-06) |
| SW-20 | M | DTOs | Convention globale appliquée avec garde-fou | ✅ Corrigé (2026-10-06) |

<!-- CHECKPOINT id="ckpt_muwq1r8q_xlupd2" time="2026-10-06T13:35:49.802Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwqem7n_8dtmyp" time="2026-10-06T13:45:49.811Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwqrh6f_cpouct" time="2026-10-06T13:55:49.815Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwr4c5l_4z3h6i" time="2026-10-06T14:05:49.833Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwrh74k_o3cn38" time="2026-10-06T14:15:49.844Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwrw9zp_kwm9ea" time="2026-10-06T14:27:33.397Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muws94ye_eqxsj8" time="2026-10-06T14:37:33.398Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwslzx4_uvppxn" time="2026-10-06T14:47:33.400Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwsyuw6_5j7gjq" time="2026-10-06T14:57:33.414Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
