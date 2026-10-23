# Handover — Migration complète des identifiants numériques vers UUID/GUID

## 1. Objectif et règle de périmètre

Migrer tous les identifiants techniques internes actuellement représentés par des `SERIAL`, `BIGSERIAL` ou `INT` vers le type PostgreSQL natif `UUID`, sur le même principe que `dori_audit_event.event_id` (`UUID DEFAULT gen_random_uuid()`).

Cette évolution est une rupture de contrat majeure. Elle touche simultanément la base, le seed, le backend, les JWT, le temps réel, OpenAPI, les clients générés, les scripts et les tests. Elle ne doit pas être livrée comme une simple modification TypeScript `number -> string`.

Décision recommandée : utiliser `UUID DEFAULT gen_random_uuid()` (UUID v4), cohérent avec l'audit existant. Si un UUID v7 triable est préféré, le décider avant toute migration et valider le support PostgreSQL/extension ; ne pas mélanger v4 et v7 sans règle documentée.

### Ce qui doit devenir UUID

- toutes les clés primaires techniques numériques ;
- toutes leurs clés étrangères, y compris les colonnes d'audit `created_by_user_id` et `updated_by_user_id` ;
- toutes les clés composites contenant un identifiant ;
- tous les identifiants exposés par l'API, les JWT, WebSocket et événements internes ;
- les références textuelles de l'audit pour les nouveaux événements.

### Ce qui ne doit pas devenir UUID

- pagination, compteurs, rangs, ordre d'affichage, priorités, positions, durées et montants ;
- `thread_number`, `last_number`, `attempt_count`, versions de traduction et statistiques ;
- `ticket_number`, `queue_code`, catégories et clés métier ;
- `dori_webhook_event.event_id`, identifiant opaque fourni par un prestataire ;
- `provider_message_id`, autre identifiant externe opaque ;
- `registration_tracking_token`, déjà UUID mais qui reste un jeton public et non la PK métier ;
- `dori_audit_event.event_id`, déjà UUID ;
- les dates, statuts et énumérations.

---

## 2. État actuel constaté

### Identifiants principaux à convertir

| Table | PK actuelle | Dépendances directes importantes | Cible |
|---|---|---|---|
| `dori_site` | `site_id SERIAL` | queue, person, affectations, stats, audit scope | `site_id UUID` |
| `dori_user` | `user_id SERIAL` | RBAC, sessions, affectations, toutes les colonnes created/updated/served/closed by, audit actor | `user_id UUID` |
| `dori_role` | `role_id SERIAL` | user_role, role_permission | `role_id UUID` |
| `dori_permission` | `permission_id SERIAL` | role_permission | `permission_id UUID` |
| `dori_queue` | `queue_id SERIAL` | affectations, tiers, sessions, inscriptions, compteurs, stats | `queue_id UUID` |
| `dori_person` | `person_id SERIAL` | notes, inscriptions | `person_id UUID` |
| `dori_person_note` | `note_id SERIAL` | routes et audit | `note_id UUID` |
| `dori_service_tier` | `tier_id SERIAL` | queue_service_tier, règles, inscriptions | `tier_id UUID` |
| `dori_queue_tier_notification_rule` | `rule_id SERIAL` | notifications | `rule_id UUID` |
| `dori_operator_session` | `session_id SERIAL` | inscriptions, moteur de file | `session_id UUID` |
| `dori_registration` | `registration_id SERIAL` | notifications, moteur, temps réel | `registration_id UUID` |
| `dori_notification` | `notification_id SERIAL` | workers et API | `notification_id UUID` |
| `dori_translation` | `translation_id SERIAL` | API de traduction | `translation_id UUID` |
| `dori_user_session` | `session_id SERIAL` | JWT `sid`, refresh/logout | `session_id UUID` |
| `dori_queue_estimation_stats` | `estimation_stats_id BIGSERIAL` | workers/statistiques | `estimation_stats_id UUID` ou conservation interne à décider |

### Tables à clés composites à convertir

- `dori_role_permission (role_id, permission_id)` ;
- `dori_user_role (user_id, role_id)` ;
- `dori_user_site_assignment (user_id, site_id)` ;
- `dori_user_queue_assignment (user_id, queue_id)` ;
- `dori_queue_service_tier (queue_id, tier_id)` ;
- `dori_queue_daily_ticket_counter (queue_id, business_date)` ;
- `dori_queue_daily_reset_execution (queue_id, business_date)` ;
- toutes les contraintes uniques/index incluant ces colonnes.

### UUID déjà présents ou identifiants à ne pas confondre

- `dori_audit_event.event_id UUID` : modèle à suivre ;
- `dori_registration.registration_tracking_token UUID` : jeton public, distinct de `registration_id` ;
- `dori_webhook_event.event_id VARCHAR(255)` : identifiant du fournisseur, à conserver en chaîne ;
- `correlationId` : chaîne opaque, pas obligatoirement UUID ;
- `dori_user_session.session_id` est encore `SERIAL` dans le SQL et l'entité TypeORM, alors que les commentaires JWT le présentent déjà comme UUID. Cette incohérence doit être corrigée explicitement pendant la migration.

---

## 3. Décisions obligatoires avant développement

- [ ] Choisir UUID v4 (`gen_random_uuid()`, recommandé pour cohérence) ou UUID v7.
- [ ] Confirmer si `estimation_stats_id` doit être exposé. S'il est strictement interne, documenter une éventuelle exception ; sinon le convertir.
- [ ] Choisir la stratégie de livraison : expand/contract sans interruption (recommandé) ou bascule avec maintenance.
- [ ] Décider si une période de compatibilité API accepte encore les anciens IDs numériques.
- [ ] Décider du versionnement de l'API : `/api/v2` recommandé si des consommateurs externes existent.
- [ ] Décider du traitement des événements d'audit historiques contenant des IDs numériques dans `target_id`/`secondary_target_id`.
- [ ] Inventorier les consommateurs externes : frontend, application borne, affichage, intégrations, exports, BI et scripts opératoires.
- [ ] Réaliser une sauvegarde et tester intégralement la restauration avant la bascule.

---

## 4. Stratégie de migration base recommandée

Ne pas tenter une conversion directe `ALTER COLUMN ... TYPE UUID USING ...` : un entier ne possède pas de conversion sémantique naturelle en UUID et les nombreuses FK rendent cette approche risquée.

### Phase A — Expansion

- [ ] Activer/vérifier `pgcrypto` pour `gen_random_uuid()`.
- [ ] Ajouter une colonne UUID parallèle pour chaque PK, par exemple `site_guid UUID DEFAULT gen_random_uuid()`.
- [ ] Ajouter les colonnes UUID parallèles pour chaque FK sans supprimer les colonnes numériques.
- [ ] Backfiller toutes les PK UUID.
- [ ] Backfiller toutes les FK UUID par jointure sur l'ancienne FK numérique.
- [ ] Ajouter les index UUID avec `CREATE INDEX CONCURRENTLY` si la plateforme le permet.
- [ ] Ajouter les nouvelles contraintes FK en `NOT VALID`, puis les valider séparément.
- [ ] Ajouter temporairement des triggers ou du dual-write applicatif pour maintenir les colonnes numérique/UUID synchronisées.
- [ ] Ajouter des contrôles SQL prouvant qu'aucune FK UUID n'est orpheline ou nulle à tort.

### Phase B — Compatibilité applicative

- [ ] Déployer un backend capable de lire les deux formes pendant la transition.
- [ ] Retourner les UUID dans les nouvelles réponses/API v2.
- [ ] Accepter temporairement l'ancien identifiant uniquement si la compatibilité est requise.
- [ ] Migrer tous les producteurs/consommateurs avant la suppression des anciennes colonnes.
- [ ] Surveiller les usages des anciennes colonnes et les erreurs de résolution.

### Phase C — Contract

- [ ] Arrêter les écritures utilisant les IDs numériques.
- [ ] Remplacer les PK/FK et contraintes composites par leurs versions UUID.
- [ ] Renommer les colonnes UUID vers les noms définitifs (`site_id`, etc.).
- [ ] Supprimer les anciennes colonnes numériques et les séquences `*_seq` devenues inutiles.
- [ ] Recréer/valider tous les triggers, fonctions, index, vues et contraintes.
- [ ] Exécuter `ANALYZE` sur les tables migrées.
- [ ] Conserver une table de correspondance ancien ID → UUID pendant la durée de rollback/support définie.

### Ordre logique de traitement

Les références circulaires (`site.created_by_user_id` vers user, user auto-référencé, etc.) interdisent une migration naïve table après table. Ajouter d'abord toutes les colonnes UUID, puis backfiller par couches :

1. PK de toutes les tables ;
2. références user/role/permission et auto-références user ;
3. site, queue, person, tier ;
4. tables de liaison et clés composites ;
5. règles, sessions opérateur, inscriptions ;
6. notifications, compteurs, reset, estimation ;
7. sessions JWT ;
8. audit (`actor_user_id`, `site_scope_id` et résolution des cibles).

---

## 5. Base de données : checklist détaillée

### Schéma et migrations

- [ ] Créer des migrations nouvelles ; ne jamais réécrire les migrations `001` à `018` déjà appliquées.
- [ ] Remplacer chaque `SERIAL/BIGSERIAL` cible par `UUID DEFAULT gen_random_uuid()` dans le schéma final.
- [ ] Convertir toutes les colonnes FK `INT`, y compris :
  - `created_by_user_id`, `updated_by_user_id`, `assigned_by_user_id` ;
  - `closed_by_user_id`, `served_by_user_id`, `served_by_session_id` ;
  - `actor_user_id`, `site_scope_id` de l'audit ;
  - toutes les FK des tables de liaison.
- [ ] Recréer les PK composites et FK composites, notamment `(queue_id, tier_id)`.
- [ ] Mettre à jour les variables PL/pgSQL actuellement déclarées `INT` (`cloned_person_id`, `session_user_id`, `person_site_id`, `queue_site_id`, etc.).
- [ ] Mettre à jour les fonctions/triggers : cohérence personne/site, cohérence served-by, append-only audit, reset et clonage de personne.
- [ ] Remplacer les casts d'identifiants `::int`, `::int[]` par `::uuid`, `::uuid[]` uniquement pour les IDs ; conserver les `::int` de compteurs et agrégats.
- [ ] Recréer tous les index partiels, uniques et couvrants sur les colonnes UUID.
- [ ] Vérifier les plans d'exécution après augmentation de la largeur des clés/index.
- [ ] Vérifier les tailles de sauvegarde, index, mémoire et caches.

### Audit

- [ ] Convertir `actor_user_id` et `site_scope_id` en UUID.
- [ ] Conserver `event_id` tel quel.
- [ ] Maintenir `target_id` et `secondary_target_id` en texte pour supporter plusieurs types de cible.
- [ ] Faire évoluer `AUDIT_EVENT_READ_MODEL` : reconnaître à la fois les anciens IDs numériques et les nouveaux UUID pendant la transition.
- [ ] Remplacer les regex `^[0-9]+$` et casts `::int` par une résolution compatible UUID.
- [ ] Préserver les événements historiques ; ne pas réécrire leur sens.
- [ ] Tester la résolution des libellés pour les deux générations d'événements.
- [ ] Mettre à jour le calcul du scope site pour site, queue, person, registration, notification et session.
- [ ] Respecter le trigger append-only lors d'un backfill contrôlé et documenter toute désactivation temporaire.

### Seed et données de démonstration

- [ ] Mettre à jour `src/core/database/sql/seed.sql`.
- [ ] Utiliser des UUID fixes et documentés pour les ressources structurelles du seed (rôles, permissions, root), sinon chaque réexécution créerait de nouvelles identités.
- [ ] Conserver les `ON CONFLICT` fondés autant que possible sur les clés naturelles (`role_name`, `permission_name`, `username`).
- [ ] Ne jamais dépendre de `currval`, d'un ordre d'insertion ou d'une valeur numérique implicite.
- [ ] Mettre à jour `database-seed.service.ts`.
- [ ] Mettre à jour `scripts/sample-data/example-site-september-october-2026.sql` et ses variables/casts `INT` liés aux IDs.
- [ ] Vérifier les seeds de tests, fixtures et mocks.
- [ ] Ajouter un test d'idempotence : deux exécutions du seed ne créent aucun doublon et conservent les mêmes UUID.

---

## 6. TypeScript, TypeORM, repositories et services

### Types partagés

- [ ] Introduire un alias explicite, par exemple `type Guid = string`, ou des types marqués (`UserId`, `SiteId`) pour empêcher le mélange des UUID.
- [ ] Changer tous les champs d'identité `number` en `string` dans interfaces, paramètres et retours.
- [ ] Ne pas convertir aveuglément tous les `number` : conserver métriques, durées, prix, positions, rangs et pagination.
- [ ] Changer `JwtPayload.sub`, `AuthenticatedUser.userId`, scopes `siteIds/queueIds` et IDs de session en chaînes.
- [ ] Corriger le commentaire/contrat de `dori_user_session.session_id` pour qu'il corresponde réellement au schéma.

### Entités TypeORM

Pour toutes les entités listées dans `src/core/database/entities.ts` :

- [ ] Remplacer `@PrimaryGeneratedColumn()` par `@PrimaryGeneratedColumn('uuid')` ou `@PrimaryColumn({ type: 'uuid' })` selon la stratégie.
- [ ] Remplacer les colonnes FK `type: 'int'` par `type: 'uuid'`.
- [ ] Mettre à jour les types de propriétés `number -> string`.
- [ ] Mettre à jour toutes les entités de jointure à PK composite.
- [ ] Traiter séparément `translation-version` et les autres PK métier non numériques, qui ne doivent pas être converties.
- [ ] Vérifier que `synchronize` reste désactivé : les migrations SQL doivent rester la source de vérité.

### Repositories SQL

Revue obligatoire de tous les repositories sous `src/core`, `src/modules` et `src/workers` :

- [ ] paramètres et types de lignes `number -> string` pour les IDs ;
- [ ] suppression des `Number(row.*_id)`, `parseInt` et `map(Number)` appliqués aux IDs ;
- [ ] remplacement de `ANY($n::int[])`/`ALL($n::int[])` par `uuid[]` ;
- [ ] casts `$n::int` d'identifiants vers `$n::uuid` ;
- [ ] `RETURNING *_id` typé chaîne ;
- [ ] transactions, verrous `FOR UPDATE/SKIP LOCKED` et CTE ;
- [ ] jointures et comparaisons sur toutes les FK ;
- [ ] maps/sets indexés par ID : clés `string`, sans conversion numérique ;
- [ ] SQL dynamique de reporting et monitoring ;
- [ ] repositories des workers et du temps réel.

Fichiers particulièrement sensibles :

- `src/core/rbac/repositories/scope.repository.ts` et `scope.service.ts` ;
- `src/core/auth/repositories/jwt-session.repository.ts` ;
- `src/core/audit/audit.repository.ts` et `audit.interceptor.ts` ;
- `src/core/realtime/realtime.gateway.ts` (regex numériques et `parseInt`) ;
- `src/modules/auth/auth.repository.ts` et `auth.service.ts` ;
- `src/modules/queue-engine/queue-engine.repository.ts` ;
- `src/modules/registrations/registrations.repository.ts` ;
- `src/modules/monitoring/reports.repository.ts` (`int[]`) ;
- tous les repositories sites, queues, persons, users, tiers, notifications et traductions ;
- tous les repositories des workers.

### Services et logique métier

- [ ] Changer toutes les signatures acceptant ou retournant un ID.
- [ ] Retirer `Number(...)` uniquement lorsqu'il concerne un identifiant.
- [ ] Mettre à jour les contrôles d'égalité (`===`) entre IDs.
- [ ] Mettre à jour `Set<number>`, `Map<number, ...>` et tableaux d'IDs.
- [ ] Vérifier la hiérarchie RBAC, l'accès site/queue et les affectations.
- [ ] Vérifier les déconnexions ciblées, sessions JWT, appels de file et served-by.
- [ ] Vérifier les calculs de reporting groupés par ID.
- [ ] Vérifier les jobs planifiés, retries et payloads en mémoire.

---

## 7. Contrôleurs, validation et contrats HTTP

### Paramètres de routes

- [ ] Remplacer le pipe global `PositiveIdParamPipe`, qui transforme actuellement tout `*Id` en nombre.
- [ ] Créer un pipe UUID explicite ou utiliser `ParseUUIDPipe` sur toutes les routes d'identifiants internes.
- [ ] Ne pas appliquer ce pipe aux IDs externes opaques (`provider`, webhook `eventId`, correlation ID).
- [ ] Mettre à jour les types des paramètres de contrôleur `number -> string`.
- [ ] Vérifier toutes les routes `siteId`, `queueId`, `userId`, `personId`, `noteId`, `tierId`, `ruleId`, `sessionId`, `registrationId`, `notificationId`, `translationId`, `roleId`, `permissionId`.
- [ ] Adapter les listes CSV d'IDs (`queueIds`, `userIds`, `tierIds`) : validation UUID séparée par virgules.

### DTO et class-validator

- [ ] Remplacer `@IsInt()`, `@Min(1)` et `@Type(() => Number)` uniquement sur les champs identifiants par `@IsUUID()`.
- [ ] Laisser ces décorateurs sur les vrais nombres métier.
- [ ] Passer toutes les propriétés d'ID des DTO de requête/réponse en `string`.
- [ ] Mettre à jour les DTO imbriqués, filtres, affectations et tableaux d'IDs.
- [ ] Vérifier les champs facultatifs/nullables et les unions.

### Swagger/OpenAPI

- [ ] Remplacer tous les `@ApiParam({ type: Number, minimum: 1 })` d'identifiants par `{ type: String, format: 'uuid' }`.
- [ ] Remplacer les `@ApiProperty`/`@ApiPropertyOptional` correspondants.
- [ ] Modifier `normalizeOpenApiDocument` : il force actuellement tout paramètre finissant par `Id` en entier positif, sauf `eventId`/`correlationId`.
- [ ] La nouvelle convention doit produire `type: string, format: uuid` pour la liste blanche des IDs internes.
- [ ] Ne pas marquer `correlationId`, webhook `eventId`, `providerMessageId` ou autres IDs opaques comme UUID.
- [ ] Modifier la convention des tableaux/CSV d'IDs.
- [ ] Régénérer `openapi.json`, `openapi.yaml` et `ai/docs-json.json`.
- [ ] Régénérer les SDK/clients frontend ; supprimer les contournements `number|string`.
- [ ] Ajouter un test OpenAPI qui échoue si un identifiant interne est encore documenté en `integer`.

---

## 8. Authentification, JWT, sessions et sécurité

- [ ] Passer `JwtPayload.sub` de `number` à `string`.
- [ ] Passer `AuthenticatedUser.userId` et `sessionId` à UUID string.
- [ ] Passer la PK de `dori_user_session` et toutes ses opérations de refresh/logout à UUID.
- [ ] Invalider ou gérer explicitement tous les JWT existants lors de la bascule : leurs `sub`/`sid` numériques ne seront plus compatibles.
- [ ] Prévoir une rotation de sessions et une communication utilisateur si déconnexion globale.
- [ ] Vérifier rate limiting, traces, audit login/refresh/logout et corrélation.
- [ ] Ne jamais inclure token ou mot de passe dans les tables de correspondance ou logs de migration.
- [ ] Vérifier les règles de force logout et comparaisons de cible/caller.

---

## 9. Temps réel, workers, caches et intégrations

- [ ] Mettre à jour `realtime.gateway.ts` : regex d'URL numériques, `parseInt`, état client `registrationId`, rooms/canaux et payloads.
- [ ] Définir un format stable de room (`queue:<uuid>`, `registration:<uuid>`).
- [ ] Purger/versionner les clés de cache Redis contenant un ancien ID numérique.
- [ ] Mettre à jour les payloads des workers et leurs interfaces.
- [ ] Vérifier notification worker, queue estimation, appointment expiry et daily reset.
- [ ] Vérifier les données persistées dans files de messages/retries avant déploiement.
- [ ] Mettre à jour webhooks sortants et documentation consommateur si des UUID internes sont exposés.
- [ ] Conserver les IDs externes des fournisseurs comme chaînes opaques.

---

## 10. Tests à modifier et à ajouter

### Tests unitaires existants

- [ ] Remplacer les fixtures numériques d'identité (`1`, `42`) par des UUID valides constants.
- [ ] Mettre à jour les attentes SQL `::int`, `int[]`, `Number(...)` vers UUID.
- [ ] Mettre à jour les mocks JWT, scopes et utilisateurs authentifiés.
- [ ] Mettre à jour les tests des contrôleurs et pipes.
- [ ] Mettre à jour les snapshots/attentes OpenAPI.
- [ ] Ne pas remplacer les nombres métier (compteurs, rangs, prix, durées).

### Nouveaux tests indispensables

- [ ] migration sur copie anonymisée d'une base contenant des données ;
- [ ] aucune PK/FK UUID nulle après backfill ;
- [ ] aucune FK orpheline ;
- [ ] cardinalité avant/après identique pour chaque table ;
- [ ] unicité de tous les UUID ;
- [ ] seed idempotent et UUID stables ;
- [ ] routes : UUID valide accepté, UUID invalide rejeté en 400, UUID absent en 404 ;
- [ ] JWT avec UUID fonctionnel ; anciens JWT traités selon la stratégie choisie ;
- [ ] scope manager site/queue avec UUID ;
- [ ] audit success/failure et résolution des libellés UUID ;
- [ ] login, refresh, logout et changement de mot de passe ;
- [ ] CRUD complet de chaque module ;
- [ ] temps réel : abonnement/reconnexion/rooms UUID ;
- [ ] workers sur données UUID ;
- [ ] rapports avec listes `uuid[]` ;
- [ ] rollback répété sur environnement de staging.

### Gate qualité

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build:check`
- [ ] `npm test -- --runInBand --coverage=false`
- [ ] `npm run swagger:export`
- [ ] `npm run db:verify`
- [ ] tests E2E API et frontend généré
- [ ] test de restauration de sauvegarde

---

## 11. Contrôles automatisés anti-oubli

Ajouter un script de vérification CI qui inspecte `information_schema` et `pg_catalog`.

- [ ] aucune PK technique ciblée de type `smallint/integer/bigint` ;
- [ ] aucune FK vers une PK UUID avec un type différent ;
- [ ] aucune séquence encore possédée par une ancienne colonne ID ;
- [ ] aucune colonne d'identité cible restante en `SERIAL/BIGSERIAL` ;
- [ ] toutes les contraintes FK validées ;
- [ ] aucun doublon UUID ;
- [ ] aucun `NULL` introduit ;
- [ ] toutes les tables ont la même cardinalité avant/après ;
- [ ] aucun `::int[]` appliqué à une liste d'identifiants dans les repositories ;
- [ ] aucun `Number(row.*_id)`, `parseInt(...Id)` ou `@IsInt()` sur un identifiant interne ;
- [ ] aucun `@ApiParam type: Number` pour un identifiant interne ;
- [ ] aucun schéma OpenAPI d'identifiant interne en `integer`.

Recherches CI suggérées (à affiner pour éviter les faux positifs) :

```powershell
rg -n "PrimaryGeneratedColumn\(\)|PrimaryColumn\(\{ type: 'int'" src/modules
rg -n "Number\(.*_id|parseInt\(.*Id|::int\[\]" src
rg -n "ApiParam.*type: Number|minimum: 1.*Id" src
rg -n "@IsInt\(\).*Id|@Type\(\(\) => Number\).*Id" src
rg -n "SERIAL|BIGSERIAL|_id INT" src/core/database/sql
```

Chaque résultat doit être classé : identifiant à migrer, nombre métier légitime, identifiant externe opaque ou dette restante.

---

## 12. Déploiement, observabilité et rollback

### Avant production

- [ ] mesurer volume et temps de backfill par table ;
- [ ] mesurer les verrous lors de la création/validation des contraintes ;
- [ ] sauvegarde vérifiée et restauration chronométrée ;
- [ ] répéter la migration complète sur staging avec copie représentative ;
- [ ] geler temporairement les évolutions de schéma concurrentes ;
- [ ] définir les métriques : erreurs 400/404, erreurs SQL de cast, échecs JWT, erreurs WebSocket, latence DB, taille index.

### Pendant la bascule

- [ ] activer le dual-write ou la fenêtre de maintenance prévue ;
- [ ] contrôler les compteurs de lignes et FK après chaque phase ;
- [ ] ne pas supprimer les anciennes colonnes avant validation de tous les consommateurs ;
- [ ] surveiller logs API/workers et métriques DB ;
- [ ] conserver la correspondance ancien ID → UUID.

### Rollback

- [ ] rollback applicatif compatible avec les deux colonnes ;
- [ ] procédure SQL testée pour revenir aux lectures numériques avant le contract ;
- [ ] après suppression des colonnes numériques, rollback uniquement via restauration/table de correspondance : fixer clairement le point de non-retour ;
- [ ] documenter le propriétaire de la décision go/no-go.

---

## 13. Séquencement proposé en lots

### Lot 0 — Préparation

- [ ] décisions d'architecture ;
- [ ] inventaire automatique DB/API/consommateurs ;
- [ ] sauvegarde/restauration ;
- [ ] tests de caractérisation.

### Lot 1 — Fondations

- [ ] types GUID partagés ;
- [ ] pipe UUID et convention Swagger ;
- [ ] migrations d'expansion et tables de correspondance ;
- [ ] seed UUID idempotent.

### Lot 2 — Identité et sécurité

- [ ] user, role, permission, sessions JWT ;
- [ ] RBAC, scope et audit actor ;
- [ ] invalidation/rotation JWT.

### Lot 3 — Périmètre métier

- [ ] site, queue, person, notes ;
- [ ] affectations ;
- [ ] service tiers et règles.

### Lot 4 — Flux opérationnels

- [ ] sessions opérateur ;
- [ ] registrations ;
- [ ] notifications ;
- [ ] compteurs, reset, estimations et workers.

### Lot 5 — Interfaces

- [ ] contrôleurs/DTO/OpenAPI ;
- [ ] frontend et clients générés ;
- [ ] WebSocket/caches/intégrations.

### Lot 6 — Contract

- [ ] suppression compatibilité numérique ;
- [ ] suppression anciennes colonnes/séquences ;
- [ ] validation finale et documentation.

---

## 14. Critères de fin

La migration n'est terminée que lorsque tous les points suivants sont vrais :

- [ ] toutes les PK/FK techniques décidées sont réellement `UUID` en base ;
- [ ] aucune relation, contrainte, fonction, trigger ou index ne référence l'ancien type ;
- [ ] le seed est stable et idempotent ;
- [ ] le backend ne traite plus les identifiants internes comme des nombres ;
- [ ] JWT, scopes, audit, temps réel, workers et rapports fonctionnent avec UUID ;
- [ ] OpenAPI expose tous les IDs internes en `string/uuid` ;
- [ ] tous les clients ont été régénérés et déployés ;
- [ ] les événements d'audit historiques restent lisibles ;
- [ ] les tests unitaires, intégration, E2E, migration et rollback passent ;
- [ ] les contrôles `pg_catalog` et recherches CI ne signalent aucun oubli ;
- [ ] la documentation opérationnelle et le runbook de rollback sont approuvés.

## 15. Point d'attention final

Le terme « tous les IDs » ne doit pas conduire à convertir aveuglément toute colonne terminant par `_id`. Certaines sont des identifiants externes opaques, et certains nombres ne sont pas des identifiants. La migration doit être pilotée par la matrice de dépendances ci-dessus et validée automatiquement contre le schéma réel. Le plus gros risque n'est pas la génération de l'UUID, mais la coexistence temporaire des deux identités, les clés composites, les JWT déjà émis, l'audit historique et les consommateurs hors dépôt.