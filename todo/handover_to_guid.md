# Handover — Migration complète des identifiants numériques vers UUID

## 1. Décisions définitives

Ce document décrit une reconstruction immédiate du schéma et du code autour d'identifiants UUID. Il ne s'agit pas d'une migration progressive de données existantes.

Les décisions suivantes sont prises et ne doivent plus être rouvertes pendant l'implémentation :

- tous les identifiants techniques internes deviennent des UUID v4 PostgreSQL générés avec `gen_random_uuid()` ;
- `dori_queue_estimation_stats.estimation_stats_id` devient lui aussi un UUID, sans exception ;
- l'API reste en `/api/v1` et son contrat change directement de nombres vers des chaînes UUID ;
- aucune compatibilité avec les anciens identifiants numériques n'est requise ;
- aucune route, aucun DTO et aucun repository ne doit accepter `number | string` pour faciliter une transition ;
- aucune donnée applicative, session ou donnée d'audit existante ne doit être migrée ;
- le schéma `dorify` est supprimé/réinitialisé, puis recréé à partir d'un schéma final propre ; la base PostgreSQL elle-même n'est pas supprimée ;
- tous les nouveaux objets applicatifs sont créés dans le schéma PostgreSQL `dorify` ;
- le schéma `public` et tous les objets qu'il contient restent strictement intacts : la migration ne doit ni les modifier, ni les supprimer, ni les déplacer ;
- seules les données d'initialisation définies par le seed sont recréées ;
- les anciens JWT et refresh tokens sont considérés comme invalides ; aucune stratégie de compatibilité n'est nécessaire ;
- les anciennes migrations sont consolidées en une migration baseline unique représentant directement le schéma UUID final ;
- il n'y a ni colonnes parallèles, ni table de correspondance, ni dual-write, ni phase expand/contract ;
- les migrations restent transactionnelles. Sur une base vide, les index sont créés normalement avec `CREATE INDEX`, sans `CONCURRENTLY`.

Cette approche est autorisée uniquement parce que le produit est encore en développement et qu'aucune donnée présente dans `dorify` ne doit être conservée. Cette autorisation de remise à zéro ne s'étend jamais au schéma `public`.

---

## 2. Première étape obligatoire — remise à zéro et consolidation SQL

Cette étape doit être réalisée avant toute modification applicative afin que le schéma SQL final reste la source de vérité.

- [x] Vérifier une dernière fois qu'aucun environnement contenant des données à conserver ne sera ciblé.
- [x] Arrêter l'API, les workers et toute instance susceptible d'écrire en base.
- [x] Ne pas supprimer ni recréer la base PostgreSQL, car cette opération affecterait également `public`.
- [x] Ne jamais exécuter `DROP SCHEMA public`, `CREATE SCHEMA public`, `ALTER` sur un objet de `public`, ni aucune opération de nettoyage dans `public`.
- [x] Supprimer uniquement `dorify` s'il existe, puis le recréer explicitement avec `CREATE SCHEMA dorify`.
- [x] Définir explicitement le schéma applicatif par défaut sur `dorify`, sans utiliser `public` comme destination implicite de création d'objets.
- [x] Configurer TypeORM et les connexions SQL applicatives pour utiliser `dorify` comme schéma par défaut.
- [x] Supprimer le contenu Redis associé à l'environnement : sessions, caches RBAC, rooms/états temps réel, files BullMQ et retries.
- [x] Supprimer les anciennes migrations SQL `001` à `018` du dépôt après consolidation.
- [x] Produire une seule migration baseline, par exemple `001_uuid_baseline.sql`, contenant directement le schéma final en UUID.
- [x] Qualifier les objets de la baseline avec le schéma `dorify` lorsque leur résolution ne doit pas dépendre du `search_path`.
- [x] Vérifier que la baseline inclut toutes les tables, contraintes, fonctions, triggers, vues et index actuellement répartis dans les migrations historiques.
- [x] Ne placer aucun `ALTER TABLE` de transition numérique vers UUID dans cette baseline : les tables doivent être créées directement avec leurs types finaux.
- [x] Réinitialiser la table `dori_schema_migration` avec la base ; ne pas fabriquer artificiellement un historique des anciennes migrations.
- [x] Exécuter la baseline dans la transaction déjà fournie par `migration-runner.ts`.
- [x] Utiliser des `CREATE INDEX` ordinaires. `CREATE INDEX CONCURRENTLY` est inutile sur une base vide et incompatible avec la transaction du runner.
- [x] Exécuter ensuite le seed d'initialisation UUID.
- [x] Vérifier qu'une seconde exécution du démarrage/migration ne modifie pas le schéma et qu'une seconde exécution du seed ne crée aucun doublon.

Le runner de migrations peut donc conserver son modèle actuel : une transaction par fichier et contrôle de checksum. Aucun mode de migration non transactionnel n'est nécessaire pour cette opération.

La table de suivi `dori_schema_migration` doit elle aussi être créée dans `dorify`. La détection de baseline du runner doit chercher les tables exclusivement dans `dorify` et ne plus utiliser implicitement `public`, notamment en remplaçant toute référence telle que `public.dori_registration` par `dorify.dori_registration`. Le runner ne doit effectuer aucune écriture dans `public`.

---

## 3. Périmètre exact des identifiants

### Identifiants à convertir en UUID

Toutes les clés primaires techniques et toutes les références qui les ciblent doivent être de type PostgreSQL `UUID` :

| Table | Clé cible |
|---|---|
| `dori_site` | `site_id UUID DEFAULT gen_random_uuid()` |
| `dori_user` | `user_id UUID DEFAULT gen_random_uuid()` |
| `dori_role` | `role_id UUID DEFAULT gen_random_uuid()` |
| `dori_permission` | `permission_id UUID DEFAULT gen_random_uuid()` |
| `dori_queue` | `queue_id UUID DEFAULT gen_random_uuid()` |
| `dori_person` | `person_id UUID DEFAULT gen_random_uuid()` |
| `dori_person_note` | `note_id UUID DEFAULT gen_random_uuid()` |
| `dori_service_tier` | `tier_id UUID DEFAULT gen_random_uuid()` |
| `dori_queue_tier_notification_rule` | `rule_id UUID DEFAULT gen_random_uuid()` |
| `dori_operator_session` | `session_id UUID DEFAULT gen_random_uuid()` |
| `dori_registration` | `registration_id UUID DEFAULT gen_random_uuid()` |
| `dori_notification` | `notification_id UUID DEFAULT gen_random_uuid()` |
| `dori_translation` | `translation_id UUID DEFAULT gen_random_uuid()` |
| `dori_user_session` | `session_id UUID DEFAULT gen_random_uuid()` |
| `dori_queue_estimation_stats` | `estimation_stats_id UUID DEFAULT gen_random_uuid()` |

Cela inclut également :

- toutes les FK correspondantes ;
- `created_by_user_id`, `updated_by_user_id` et `assigned_by_user_id` ;
- `closed_by_user_id`, `served_by_user_id` et `served_by_session_id` ;
- `actor_user_id` et `site_scope_id` dans l'audit ;
- toutes les clés composites et tous les index contenant ces identifiants ;
- les identifiants transportés par JWT, WebSocket, événements internes, jobs et caches.

### Clés composites à reconstruire avec des UUID

- `dori_role_permission (role_id, permission_id)` ;
- `dori_user_role (user_id, role_id)` ;
- `dori_user_site_assignment (user_id, site_id)` ;
- `dori_user_queue_assignment (user_id, queue_id)` ;
- `dori_queue_service_tier (queue_id, tier_id)` ;
- `dori_queue_daily_ticket_counter (queue_id, business_date)` ;
- `dori_queue_daily_reset_execution (queue_id, business_date)` ;
- toute autre contrainte unique ou FK composite contenant une de ces colonnes.

### Valeurs qui ne deviennent pas des UUID

- pagination, compteurs, rangs, priorités, positions, durées, montants et statistiques ;
- `thread_number`, `last_number`, `attempt_count`, versions et numéros de ticket ;
- `ticket_number`, `queue_code`, catégories et clés métier ;
- `dori_webhook_event.event_id`, identifiant opaque fourni par un prestataire ;
- `provider_message_id` et les autres identifiants externes opaques ;
- `registration_tracking_token`, qui reste un UUID public distinct de la PK `registration_id` ;
- `correlationId`, qui reste une chaîne opaque ;
- `dori_audit_event.event_id`, déjà UUID ;
- dates, statuts et énumérations.

---

## 4. Schéma final, fonctions et triggers

- [x] Déclarer chaque PK technique avec `UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- [x] Créer toutes les tables, séquences éventuelles, vues, fonctions et tables de suivi dans le schéma `dorify`.
- [x] Ne créer, modifier, supprimer ou déplacer aucun objet dans `public`.
- [x] Déclarer chaque FK interne avec le type `UUID`, sans colonne numérique parallèle.
- [x] Recréer toutes les contraintes composites avec les colonnes UUID.
- [x] Recréer les contraintes uniques, index partiels et index couvrants sur les colonnes finales.
- [x] Remplacer par `UUID` les variables PL/pgSQL représentant un identifiant (`cloned_person_id`, `session_user_id`, `person_site_id`, `queue_site_id`, etc.).
- [x] Remplacer les casts d'identifiants `::int` et `::int[]` par `::uuid` et `::uuid[]`.
- [x] Conserver les casts entiers utilisés pour de vrais compteurs, agrégats, rangs ou durées.
- [x] Adapter les fonctions et triggers de cohérence personne/site, served-by, audit append-only, reset et clonage de personne.
- [x] Vérifier que `gen_random_uuid()` fonctionne sur la version PostgreSQL ciblée avant d'exécuter la baseline.
- [x] Garder `synchronize: false` dans TypeORM : la baseline SQL reste la source de vérité.

### Audit

La table d'audit est recréée vide. Aucun événement historique n'est repris.

- [x] Conserver `event_id` en UUID.
- [x] Déclarer `actor_user_id` et `site_scope_id` en UUID.
- [x] Conserver `target_id` et `secondary_target_id` en texte afin de représenter différents types de cible.
- [x] Écrire les nouveaux identifiants UUID sous forme textuelle dans ces deux colonnes.
- [x] Retirer du read model les branches de compatibilité réservées aux anciens IDs numériques.
- [x] Remplacer les regex `^[0-9]+$` et les casts `::int` par une validation/résolution UUID lorsque la cible est interne.
- [x] Mettre à jour le calcul du scope pour site, queue, person, registration, notification et session.
- [x] Conserver le comportement append-only.

---

## 5. Seed d'initialisation

- [x] Réécrire `src/core/database/sql/seed.sql` pour le schéma UUID.
- [x] Exécuter le seed exclusivement dans `dorify` et qualifier ses tables afin qu'il ne puisse ni lire ni alimenter accidentellement `public`.
- [x] Utiliser des UUID v4 constants et documentés pour les ressources structurelles : rôles, permissions et compte root.
- [x] Utiliser également des UUID constants lorsqu'une donnée de seed est référencée explicitement par une autre donnée du seed.
- [x] Conserver les `ON CONFLICT` fondés sur les clés naturelles telles que `role_name`, `permission_name` et `username`.
- [x] Ne dépendre ni de `currval`, ni d'une séquence, ni de l'ordre implicite des insertions.
- [x] Mettre à jour `database-seed.service.ts`.
- [x] Mettre à jour `scripts/sample-data/example-site-september-october-2026.sql` pour utiliser des UUID.
- [x] Mettre à jour les fixtures et mocks de tests.
- [x] Ajouter un test d'idempotence prouvant que deux exécutions du seed conservent les mêmes UUID et ne créent aucun doublon.

---

## 6. TypeScript, TypeORM et accès aux données

### Convention de types

- [x] Introduire un type partagé `Guid = string` pour exprimer le contrat commun.
- [x] Utiliser, lorsque cela évite réellement un mélange, des alias de domaine tels que `UserId`, `SiteId` ou `QueueId`.
- [x] Représenter tous les identifiants internes par des chaînes ; ne jamais les convertir en nombres.
- [x] Conserver `number` pour les métriques, durées, prix, positions, rangs et paramètres de pagination.
- [x] Passer `JwtPayload.sub`, `AuthenticatedUser.userId`, `sessionId`, `siteIds` et `queueIds` en chaînes UUID.

### Entités TypeORM

- [x] Utiliser `@PrimaryGeneratedColumn('uuid')` ou une `@PrimaryColumn({ type: 'uuid' })` alimentée par PostgreSQL selon le besoin de l'entité.
- [x] Déclarer `schema: 'dorify'` dans la configuration TypeORM ou sur les entités selon la convention retenue, avec une seule source de configuration cohérente.
- [x] Déclarer toutes les FK internes avec `type: 'uuid'` et des propriétés TypeScript `string`.
- [x] Mettre à jour toutes les entités de jointure à PK composite.
- [x] Convertir explicitement `DoriQueueEstimationStat.estimation_stats_id` de `bigint` vers `uuid`.
- [x] Ne pas convertir les PK métier ou versions qui ne sont pas des identifiants techniques numériques.

### Repositories et services

- [x] Passer les paramètres, types de lignes et retours d'identifiants de `number` à `string`.
- [x] Supprimer `Number(row.*_id)`, `parseInt` et `map(Number)` lorsqu'ils ciblent un identifiant.
- [x] Remplacer `ANY($n::int[])` et `ALL($n::int[])` d'identifiants par `uuid[]`.
- [x] Remplacer les casts `$n::int` d'identifiants par `$n::uuid`.
- [x] Utiliser `Set<string>`, `Map<string, ...>` et des tableaux de chaînes pour les IDs.
- [x] Vérifier transactions, CTE, jointures, `RETURNING`, verrous `FOR UPDATE/SKIP LOCKED` et SQL de reporting.
- [x] Mettre à jour en priorité l'authentification, RBAC/scope, audit, temps réel, queue engine, registrations, monitoring et tous les workers.

---

## 7. Contrat HTTP et OpenAPI v1

Le préfixe reste `/api/v1`. Les contrats existants sont modifiés directement et aucune variante numérique n'est conservée.

- [x] Remplacer `PositiveIdParamPipe`, qui transforme les `*Id` en nombres.
- [x] Utiliser un pipe UUID explicite ou `ParseUUIDPipe` sur chaque identifiant interne de route.
- [x] Ne pas appliquer ce traitement aux identifiants externes opaques.
- [x] Remplacer dans les DTO d'identifiants `@IsInt()`, `@Min(1)` et `@Type(() => Number)` par `@IsUUID()`.
- [x] Valider séparément chaque élément des listes CSV d'UUID.
- [x] Documenter les IDs internes en OpenAPI avec `type: string` et `format: uuid`.
- [x] Modifier `normalizeOpenApiDocument` afin qu'il ne force plus tous les paramètres finissant par `Id` en entier positif.
- [x] Maintenir une liste explicite des identifiants internes UUID pour éviter de transformer les IDs opaques.
- [x] Régénérer `openapi.json`, `openapi.yaml` et `ai/docs-json.json`.
- [x] Régénérer tous les clients à partir du nouveau contrat v1.
- [x] Supprimer tout contournement `number | string` dans les clients et le backend.
- [x] Ajouter un test qui échoue si un identifiant interne est encore décrit comme `integer` dans OpenAPI.

---

## 8. Authentification, temps réel, workers et caches

### Authentification

- [x] Passer `JwtPayload.sub`, l'utilisateur authentifié et les IDs de session en UUID string.
- [x] Recréer `dori_user_session.session_id` directement en UUID.
- [x] Ne pas accepter les JWT contenant un ancien `sub` ou `sid` numérique.
- [x] Ne pas développer de rotation ou de traduction des anciennes sessions : elles disparaissent avec la remise à zéro.
- [x] Vérifier login, refresh, logout, changement de mot de passe, force logout, rate limiting et audit associé.

### Temps réel et Redis

- [x] Remplacer regex numériques et `parseInt` dans `realtime.gateway.ts`.
- [x] Utiliser des rooms stables telles que `queue:<uuid>` et `registration:<uuid>`.
- [x] Passer les IDs des payloads WebSocket et de l'état client en chaînes UUID.
- [x] Purger Redis avant le premier démarrage du schéma UUID.
- [x] Vérifier les caches RBAC, compteurs, rooms, événements et messages BullMQ.

### Workers et intégrations

- [x] Mettre à jour tous les payloads de jobs et leurs interfaces.
- [x] Vérifier notification worker, queue estimation, appointment expiry et daily reset.
- [x] S'assurer qu'aucun ancien job numérique ne subsiste dans Redis au démarrage.
- [x] Mettre à jour les webhooks sortants qui exposent des identifiants internes.
- [x] Conserver les identifiants fournisseur comme chaînes opaques.

---

## 9. Tests et contrôles anti-oubli

### Tests fonctionnels indispensables

- [x] Remplacer les fixtures d'identité numériques par des UUID v4 constants valides.
- [x] Schéma `dorify` absent ou vierge : la baseline le crée intégralement sans erreur, sans modifier le reste de la base.
- [x] Le schéma `dorify` contient tous les objets applicatifs attendus.
- [x] L'état de `public` est strictement identique avant et après la reconstruction de `dorify`.
- [x] Le seed initial est idempotent et conserve des UUID stables.
- [x] Toutes les PK et FK internes ciblées sont de type UUID.
- [x] Toutes les FK sont valides et aucune relation n'est orpheline.
- [x] UUID de route valide accepté ; UUID invalide rejeté en 400 ; ressource UUID absente renvoyée en 404.
- [x] Login, refresh, logout et scopes RBAC fonctionnent avec des UUID.
- [x] CRUD complet de chaque module avec des UUID.
- [x] Audit success/failure et résolution des libellés UUID.
- [x] Abonnement, reconnexion et rooms WebSocket avec UUID.
- [x] Workers et rapports, notamment les paramètres `uuid[]`.
- [x] OpenAPI et clients générés n'exposent aucun ID interne en entier.

### Contrôles automatisés CI

Ajouter ou étendre `db:verify` afin de contrôler `information_schema` et `pg_catalog` :

- [x] aucune PK technique ciblée en `smallint`, `integer` ou `bigint` ;
- [x] tous les objets applicatifs inspectés appartiennent au schéma `dorify` ;
- [x] aucun objet de `public` n'a été créé, modifié ou supprimé par la baseline, le runner ou le seed ;
- [x] aucune FK vers une PK UUID avec un type différent ;
- [x] aucune séquence possédée par une ancienne colonne ID ;
- [x] aucune colonne cible en `SERIAL` ou `BIGSERIAL` ;
- [x] toutes les contraintes FK validées ;
- [x] aucun doublon ni `NULL` invalide sur les identifiants ;
- [x] aucun cast entier appliqué à un identifiant interne dans les repositories ;
- [x] aucun `Number(row.*_id)`, `parseInt(...Id)` ou validateur entier sur un ID interne ;
- [x] aucun identifiant interne OpenAPI documenté comme nombre entier.

Chaque résultat des recherches statiques doit être classé comme identifiant interne, nombre métier, identifiant externe opaque ou dette restante. Les faux positifs ne doivent pas être masqués par une exclusion trop large.

### Gate qualité

- [x] `npm run format:check`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run build:check`
- [x] `npm test -- --runInBand --coverage=false`
- [x] `npm run swagger:export`
- [x] `npm run db:verify`
- [x] `npm run test:e2e`

---

## 10. Ordre d'implémentation obligatoire

1. Remise à zéro contrôlée du seul schéma `dorify` et de Redis, sans aucune modification de `public`.
2. Consolidation de `001` à `018` en une baseline UUID unique ciblant exclusivement `dorify`.
3. Réécriture et test d'idempotence du seed.
4. Types partagés, entités TypeORM et couches d'accès aux données.
5. Authentification, sessions, RBAC et audit.
6. Sites, queues, persons, notes, affectations, tiers et règles.
7. Sessions opérateur, registrations, notifications, compteurs, estimations et workers.
8. Contrôleurs, validation, OpenAPI v1 et clients générés.
9. WebSocket, Redis, événements et intégrations.
10. Tests complets, contrôles `pg_catalog`, recherches statiques et gate qualité.

Une fois la baseline UUID engagée, aucun nouveau code ne doit être ajouté avec un ID interne numérique.

---

## 11. Critères de fin

La migration est terminée uniquement lorsque :

- [x] un schéma `dorify` absent ou vide peut être intégralement créé avec la baseline unique ;
- [x] tous les objets applicatifs et la table de suivi des migrations sont dans `dorify` ;
- [x] aucun objet de `public` n'est créé, recherché comme objet applicatif, modifié ou supprimé ;
- [x] toutes les PK/FK techniques décidées, y compris `estimation_stats_id`, sont réellement en UUID ;
- [x] aucune colonne, relation, contrainte, fonction, trigger ou index ne dépend d'un ancien ID numérique ;
- [x] aucune ancienne migration incrémentale n'est encore nécessaire ;
- [x] le seed recrée uniquement les données d'initialisation et reste stable/idempotent ;
- [x] le backend ne traite plus aucun identifiant interne comme un nombre ;
- [x] aucun chemin de compatibilité avec les anciens IDs ou JWT n'existe ;
- [x] JWT, scopes, audit, temps réel, workers et rapports fonctionnent avec UUID ;
- [x] `/api/v1` expose tous les identifiants internes en `string/uuid` ;
- [x] les clients ont été régénérés sans unions `number | string` ;
- [x] Redis et les files de jobs ne contiennent aucun état numérique hérité ;
- [x] les tests et tous les gates qualité passent ;
- [x] les vérifications SQL et recherches CI ne signalent aucun oubli réel.

## 12. Règle finale

Le suffixe `_id` ne suffit pas à décider du type d'une colonne. Toute valeur représentant une identité technique interne est un UUID ; les identifiants externes restent des chaînes opaques et les nombres métier restent numériques. En cas de doute pendant l'implémentation, la classification doit être faite à partir de la relation métier et des contraintes du schéma, jamais par remplacement textuel global.

<!-- CHECKPOINT id="ckpt_mvl1eqlv_ktbe5z" time="2026-10-23T14:00:19.507Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvl1rlkj_t4p8k4" time="2026-10-23T14:10:19.507Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvl26ui9_d8bu4g" time="2026-10-23T14:22:10.929Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvl2jph7_qrb0gx" time="2026-10-23T14:32:10.939Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvl2wkfy_uesyfo" time="2026-10-23T14:42:10.942Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvl39fgi_e3ge3q" time="2026-10-23T14:52:11.010Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvl7su5p_01vf4w" time="2026-10-23T16:59:14.989Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvl87594_f49kke" time="2026-10-23T17:10:22.552Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvl8l5o7_qyda49" time="2026-10-23T17:21:16.279Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvl8y0n6_aojot4" time="2026-10-23T17:31:16.290Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvl9avm0_lathxu" time="2026-10-23T17:41:16.296Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

---

## 13. Écarts découverts lors du double contrôle — résolus

Le double contrôle avait rouvert les tâches ci-dessous. Elles sont désormais terminées et validées.

- [x] Supprimer la dépendance au `search_path` pour les requêtes applicatives : toutes les tables utilisées par le SQL brut sont explicitement qualifiées en `dorify.dori_*`.
- [x] Ajouter un test avec une connexion hostile (`search_path = public, pg_catalog`) et prouver que le SQL applicatif qualifié continue à lire exclusivement `dorify`.
- [x] Retenir et implémenter la stratégie compatible avec le pooler Neon : qualification systématique des tables applicatives, sans configuration persistante du rôle ou de la base et sans modification de `public`.
- [x] Ajouter la commande npm non ambiguë `db:reset`, qui transmet `--seed --force` à `scripts/db-init.ts` et supprime/recrée uniquement `dorify`.
- [x] Rejouer la reconstruction complète, vérifier que `public` reste inchangé, vérifier l'idempotence du seed, puis exécuter `db:verify`, `quality:check` et `test:e2e`.
- [x] Refermer les critères de fin relatifs au schéma : aucune résolution implicite d'une table applicative vers `public` ne subsiste dans le SQL brut.

---

## 14. Validation finale d'exécution — 23 octobre 2026

- Reconstruction réelle finale réussie avec `npm run db:reset` : seul le schéma `dorify` a été supprimé/recréé, puis l'unique baseline UUID et le seed ont été appliqués.
- Protection de `public` vérifiée par le script : empreinte avant/après identique ; ses 67 objets `dori_*` préexistants n'ont été ni lus comme objets applicatifs, ni modifiés, ni supprimés.
- Idempotence vérifiée par une seconde exécution de l'initialisation et du seed : une seule migration enregistrée, aucun doublon et UUID de seed stables.
- `db:verify` : 0 PK technique numérique, 0 FK de type incohérent, 0 FK non validée ; audit append-only présent et read model interrogeable ; 8 modèles de notification actifs.
- Stratégie Neon vérifiée : le test e2e force `search_path = public, pg_catalog` et confirme qu'une requête applicative explicitement qualifiée lit encore `dorify`.
- Redis : aucune instance n'était joignable dans cet environnement (`ECONNREFUSED`) ; l'e2e a donc été exécuté avec Redis explicitement désactivé.
- Clients générés : aucun projet client/générateur de client n'est présent dans ce dépôt. Les artefacts de contrat présents ont été régénérés : `openapi.json`, `openapi.yaml`, `ai/docs-json.json`.
- Gates réussis : `format:check`, `lint`, `typecheck`, `build:check`, `uuid:verify`, 61 suites/317 tests unitaires, export Swagger, `db:verify` et 2 tests e2e.

Le script `uuid:verify` est intégré à `quality:check`. Il empêche notamment le retour d'une migration incrémentale, d'une PK interne numérique, de l'ancien pipe numérique, de conversions numériques d'IDs, d'un ID interne OpenAPI déclaré en entier ou d'une table applicative SQL non qualifiée.
<!-- CHECKPOINT id="ckpt_mvl9nqkt_afij3y" time="2026-10-23T17:51:16.301Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvla0ljt_xxdv1l" time="2026-10-23T18:01:16.313Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvladgit_36v1d8" time="2026-10-23T18:11:16.325Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvlaqbhn_xkrisr" time="2026-10-23T18:21:16.331Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvlb36gk_atxowo" time="2026-10-23T18:31:16.340Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvlf9qh6_on8b4k" time="2026-10-23T20:28:20.682Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvlfmlfx_ivsqhs" time="2026-10-23T20:38:20.685Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvlfzgeu_nm7u3j" time="2026-10-23T20:48:20.694Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvlgcbdn_v6phth" time="2026-10-23T20:58:20.699Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvlgp6ct_5j4v11" time="2026-10-23T21:08:20.717Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvlh21c7_3t5g9e" time="2026-10-23T21:18:20.743Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvlhewan_i3w3ve" time="2026-10-23T21:28:20.735Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvlhrr9q_62og3e" time="2026-10-23T21:38:20.750Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvli4m8q_i3rwaz" time="2026-10-23T21:48:20.762Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvlihh7e_j9hd20" time="2026-10-23T21:58:20.762Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvliuc6c_6hmarx" time="2026-10-23T22:08:20.772Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
