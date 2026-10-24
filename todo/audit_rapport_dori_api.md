# Rapport d'Audit — dori-api

> Généré le 2026-10-24 | Rapport corrigé et vérifié sur le dépôt — PHASE 1 + PHASE 2 + PHASE 3

---

## 1. Résumé exécutif

**État général :** Backend NestJS mature, bien structuré, avec une base technique solide.
Le code présente de bonnes pratiques (error catalog centralisé, global exception filter, guards
globaux, intercepteurs de sérialisation, config validée au démarrage, pool DB adapté au
serverless). Le lot du 2026-10-24 a traité les risques serverless prioritaires, l'accès direct à
`process.env`, les lectures `SELECT *` de `dori_user` et plusieurs dépendances mortes. Les risques
restants concernent surtout la verbosité des fichiers `any`, les autres projections SQL trop larges
et le couplage entre `RegistrationsRepository` et la couche de templates.

**5 principaux risques :**

1. 🟠 **Validation du déploiement serverless** – Les workers persistants et le gateway WebSocket sont désormais exclus sur Vercel, et quatre endpoints Vercel Cron protégés par `CRON_SECRET` les remplacent. Il reste à valider le déploiement réel et les contraintes du plan Vercel.
2. 🟠 **SELECT \* / RETURNING \*** – Les trois lectures sensibles de `dori_user` ont été remplacées par des projections explicites. Les autres occurrences doivent encore être classées selon leur exposition API et leur fréquence.
3. 🟠 **Dépendances WebSocket** – Le gateway n'est plus instancié sur Vercel, mais les bibliothèques Socket.IO restent dans les dépendances de production et peuvent encore peser sur le bundle.
4. 🟠 **Duplication de logique de rang hiérarchique** – La vérification anti-escalade est dupliquée dans `auth.service.ts` (logout force) et `users.service.ts` (création/modification d'utilisateur), avec des constantes magiques (`5`, `3`, `4`) non partagées.
5. 🟡 **TypeScript strict partiel** – `strict: true` est absent du tsconfig. La mesure produit 841 erreurs : 840 initialisations strictes de propriétés de DTO/entités (`TS2564`) et une incompatibilité de handler Express (`TS2345`). Les `any` explicites de production ont été éliminés.

**Notes /10 par axe :**

| Axe            | Note | Commentaire                                                                                   |
| -------------- | ---- | --------------------------------------------------------------------------------------------- |
| Architecture   | 8/10 | Séparation controller/service/repository bien respectée, modules fonctionnels clairs          |
| Cohérence      | 7/10 | Bonne uniformité globale, quelques écarts mineurs (filtre WHERE `1=1` vs ARRAY de clauses)    |
| Sécurité       | 8/10 | Bon : helmet, CORS strict, bcrypt, sessions révocables, RBAC et projections explicites sur `dori_user` |
| Tests          | 7/10 | Bonne couverture services/repositories, `as any` répandus dans les fixtures de test           |
| Serverless     | 7/10 | Workers persistants neutralisés sur Vercel et endpoints Cron dédiés ; déploiement à valider   |
| Maintenabilité | 7/10 | Code lisible, duplication modérée, fichiers services très longs (813 lignes)                  |

### Périmètre de vérification et limites

Les constats les plus critiques ont été revérifiés directement dans le dépôt le 2026-10-24 :

- les 4 décorateurs `@Cron` restent disponibles hors Vercel, tandis que `ScheduleModule` et `WorkersModule` persistants sont exclus du graphe Vercel ;
- `vercel.json` déclare quatre endpoints Cron, la région et la durée maximale ;
- aucun accès direct à `process.env` ne subsiste hors `configuration.ts` et de son test ;
- les trois lectures `SELECT *` de `dori_user` ont été remplacées par des projections explicites ;
- `@nestjs/bullmq` et `bullmq`, sans usage dans `src/`, ont été retirés ;
- `typeorm@1.1.1` reste nécessaire : entités, `TypeOrmModule`, `DataSource`, repositories et transactions l'utilisent.

Les notes sur 10 restent indicatives : elles ne proviennent pas d'une grille normalisée. De même, la taille d'un service est un signal de complexité, pas une preuve suffisante qu'un découpage architectural est nécessaire. Les modifications à fort impact doivent être précédées de tests de non-régression.

---

## 2. Rapport d'audit détaillé

### AXE 1 — Duplication

| #   | Gravité | Fichier(s)                                                                                        | Problème                                                                                                                 | Correctif proposé                                                                   |
| --- | ------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| D1  | Traité  | `core/rbac/services/rank.service.ts`, Auth et Users                                               | Les constantes et règles hiérarchiques pures sont centralisées dans `RankService`; les repositories restent responsables des rangs persistés. | — |
| D2  | Décision | Repositories filtrés | Les clauses restent locales car leurs opérateurs et jointures diffèrent fortement ; un helper générique masquerait le typage des paramètres. Le style tableau de conditions est uniformisé sur les recherches concernées. | — |
| D3  | Traité  | `workers/base.worker.ts` et quatre workers                                                       | Le verrou local et son `try/finally` sont centralisés dans `BaseWorker.runOnce`; un test couvre concurrence et libération après erreur. | — |
| D4  | Traité  | Services Notifications, Persons, Translations, Service tiers, Registrations et Queue engine | Les repositories exposent des lignes typées et les services utilisent des mappers DTO explicites ; les casts de collections DTO ont été supprimés. | — |

### AXE 2 — Architecture

| #   | Gravité  | Fichier(s)                              | Problème                                                                                                                                                                                                                          | Correctif proposé                                                                                                                                |
| --- | -------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | Traité   | `app.module.ts`, `cron-handlers/`, `vercel.json` | Les workers persistants sont exclus sur Vercel et remplacés par quatre endpoints Cron protégés. | Valider les planifications sur le déploiement Vercel |
| A2  | Traité   | `realtime.module.ts`, `app.module.ts`   | Le gateway WebSocket n'est pas instancié sur Vercel ; `RealtimeService` reste disponible pour les producteurs d'événements. | — |
| A3  | Décision | `registrations.service.ts` | Le service orchestre un agrégat transactionnel cohérent et délègue déjà la persistance au repository, l'heure à `ClockService`, le scope à `ScopeService` et l'estimation à son service. Un découpage uniquement fondé sur le nombre de lignes augmenterait les dépendances croisées et le risque transactionnel sans bénéfice mesuré. | Réévaluer sur une évolution fonctionnelle créant une frontière autonome |
| A4  | Décision | `queue-engine.service.ts` | Sessions, threads et appel suivant partagent les mêmes invariants de concurrence et le même agrégat de file. Les extraire maintenant disperserait ces invariants ; la persistance et le temps sont déjà délégués. | Réévaluer si un sous-domaine acquiert un cycle de vie indépendant |
| A5  | Décision | `core/audit/audit.module.ts`            | Audit reste un module transversal cohérent regroupant interception, persistance et consultation administrative ; le déplacer fragmenterait cette responsabilité. | — |
| A6  | Traité   | `realtime/ws-auth.service.ts`           | Le gateway délègue la vérification JWT et la validation de session à `WsAuthService`. | — |
| A7  | Traité   | `registrations.repository.ts`           | Le repository ne dépend plus d'une classe de service : il reçoit un contrat structurel minimal `WelcomeNotificationRenderer`, fourni par la couche service. | — |

### AXE 3 — Cohérence

| #   | Gravité | Fichier(s)                                                    | Problème                                                                                                                          | Correctif proposé                                                                                     |
| --- | ------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| C1  | Traité  | `notifications.repository.ts`                              | La construction `WHERE 1=1` a été remplacée par un tableau de conditions paramétrées. | — |
| C2  | Traité  | `sites.repository.ts`                                         | `LIMIT` et `OFFSET` utilisent désormais des paramètres positionnels dans les deux recherches paginées. | — |
| C3  | Traité  | `auth.controller.ts`, `auth.service.ts`                       | Le contrôleur appelle directement `me`; le wrapper `getCurrentUser` a été supprimé. | — |
| C4  | Traité  | `configuration.ts`, `daily-reset.worker.ts`                   | La timezone de repli est centralisée dans `defaults.timezone` et configurable par `DEFAULT_TIMEZONE`. | — |

### AXE 4 — TypeScript

| #   | Gravité | Fichier(s)                           | Problème                                                                                                                                                                                                                                                                                  | Correctif proposé                                                                                                                                                |
| --- | ------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Traité  | `tsconfig.json`, `main.ts`           | `strict: true` est actif. `strictPropertyInitialization` est désactivé explicitement pour les DTO/entités hydratés par Nest/TypeORM ; le handler Express a été corrigé. | Réévaluer l'initialisation stricte si les DTO passent à des constructeurs explicites |
| T2  | Traité  | `serialization.interceptor.ts`, `dori.exception.ts` | Les signatures et conteneurs `any` ont été remplacés par `unknown`, avec des gardes de type explicites. Les autres `any` de production ont également été typés dans realtime, migrations, queues et users. | Maintenir zéro `any` explicite dans les fichiers de production |
| T3  | Traité  | `dori.exception.ts`                  | L'accès à `message` repose désormais sur une garde `in` appliquée à un objet `unknown`. | — |
| T4  | Traité  | `.eslintrc.js`                       | `no-explicit-any` est désormais une erreur pour le code de production, avec une exception ciblée pour les specs et tests e2e. | Traiter séparément les fixtures de tests avant de supprimer leur exception |
| T5  | Décision | `tsconfig.json`                     | Les imports relatifs sont conservés : les aliases TypeScript ne sont pas réécrits dans le JavaScript et imposeraient un résolveur ou une réécriture supplémentaire en production. | Réévaluer uniquement lors d'une migration vers un bundler qui résout nativement les aliases |

### AXE 5 — Validation et DTO

| #   | Gravité | Fichier(s)                                        | Problème                                                                                                                                                 | Correctif proposé                                  |
| --- | ------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| V1  | Bien    | `main.ts:72-83`                                   | ValidationPipe global avec `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — ✅ conforme                                              | —                                                  |
| V2  | Bien    | `core/validation/domain-validation.decorators.ts` | Décorateurs de validation métier custom bien factorisés                                                                                                  | —                                                  |
| V3  | Traité  | `pagination.dto.ts`                               | `createResponse` utilise directement `page` et `pageSize`, déjà validés et transformés par le DTO. | — |

### AXE 6 — Gestion des erreurs

| #   | Gravité | Fichier(s)                                                | Problème                                                                                                                                         | Correctif proposé                                                                                                                                                                                   |
| --- | ------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Bien    | `core/errors/`                                            | Global exception filter + error catalog + DoriException — architecture exemplaire                                                                | —                                                                                                                                                                                                   |
| E2  | Traité  | `queue-engine.service.ts`                            | `QUEUE_EMPTY` est retourné comme enveloppe métier normale en HTTP 200, sans exception. | — |
| E3  | Traité  | `global-exception.filter.ts`                              | Le filtre lit désormais les clés de traduction directement dans `ERROR_CATALOG`. | — |

### AXE 7 — Configuration

| #   | Gravité | Fichier(s)                     | Problème                                                                                                                                          | Correctif proposé                                                                          |
| --- | ------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| CF1 | Traité  | `redis.module.ts`              | `swaggerExport` est lu via `ConfigService`; les accès environnement sont centralisés dans la configuration. | — |
| CF2 | Bien    | `core/config/configuration.ts` | Config centralisée, validée au démarrage, DATABASE_URL + variables individuelles supportées                                                       | —                                                                                          |
| CF3 | Traité  | `configuration.ts`, `.env.example` | `appointmentExpiry.intervalMinutes` est configurable par `APPOINTMENT_EXPIRY_INTERVAL_MINUTES` et validé entre 1 et 1440. | — |

### AXE 8 — Sécurité

| #   | Gravité | Fichier(s)                           | Problème                                                                                                                                                                                                                                                                                       | Correctif proposé                                                                                                                                                                        |
| --- | ------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Traité  | `auth.repository.ts`                 | Les trois lectures utilisateur projettent explicitement les colonnes internes nécessaires à l'authentification. | — |
| S2  | Bien    | `serialization.interceptor.ts:19-25` | `SENSITIVE_FIELDS` filtre `password_hash`, `refresh_token_hash`, `password` avant sérialisation                                                                                                                                                                                                | —                                                                                                                                                                                        |
| S3  | Bien    | `main.ts:27-47`                      | Helmet configuré avec CSP explicite                                                                                                                                                                                                                                                            | —                                                                                                                                                                                        |
| S4  | Bien    | `auth.service.ts:25-27`              | Tokens de rafraîchissement hashés SHA-256 avant stockage                                                                                                                                                                                                                                       | —                                                                                                                                                                                        |
| S5  | Traité  | `main.ts`                            | La redirection est enregistrée sur l'instance Express typée, avec inférence native de la requête et de la réponse. | — |
| S6  | Traité  | `README.md`, `.env.example`          | La documentation interdit le secret d'exemple en production et recommande une paire RSA dédiée. | — |

### AXE 9 — Base de données

| #   | Gravité | Fichier(s)                                                       | Problème                                                                                                                                                                                                             | Correctif proposé                                                                                                                                                                                              |
| --- | ------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB1 | Traité  | Tous les repositories de `src/` | Les `SELECT *`, `alias.*` et `RETURNING *` ont été remplacés par des projections explicites réutilisables. Une recherche globale ne retourne plus aucune occurrence dans les repositories. | — |
| DB2 | Bien    | `database.module.ts:34-41`                                       | Pool configurable via `DB_POOL_MAX` (défaut 10), avec `idleTimeoutMillis: 10000` et `connectionTimeoutMillis: 5000`. La précédente limite Aiven à une connexion a été retirée pour Neon.                             | Ajuster `DB_POOL_MAX` selon le nombre d'instances et utiliser l'endpoint poolé Neon                                                                                                                            |
| DB3 | Bien    | `migration-runner.ts` + `database-seed.service.ts`               | Migrations SQL versionnées, exécution idempotente                                                                                                                                                                    | —                                                                                                                                                                                                              |
| DB4 | Bien    | `registrations.repository.ts:80-81`                              | Advisory lock `pg_advisory_xact_lock` pour la gestion des slots — approche correcte                                                                                                                                  | —                                                                                                                                                                                                              |
| DB5 | Décision | `database-seed.service.ts` | Les fichiers SQL ne sont lus que lorsque `AUTO_RUN_MIGRATIONS=true`; cette option est désactivée par défaut et documentée comme interdite sur Vercel. Conserver les migrations comme fichiers SQL facilite leur revue et leur exécution hors application. | Exécuter les migrations dans le pipeline de déploiement |
| DB6 | Traité  | `audit.repository.ts` | Le CTE partagé est centralisé dans `AUDIT_EVENT_READ_MODEL` et réutilisé par `search` et `findById`. | — |

### AXE 10 — Serverless/Vercel

| #   | Gravité      | Fichier(s)                               | Problème                                                                                                                                                                                                                                                                              | Correctif proposé                                                                                                                                                                                                        |
| --- | ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SL1 | Traité | `workers/`, `cron-handlers/`, `vercel.json` | Sur Vercel, `WorkersModule` est remplacé par quatre endpoints Cron authentifiés par `CRON_SECRET`; les opérations conservent leurs verrous/idempotence en base. | Configurer `CRON_SECRET` sur le projet Vercel |
| SL2 | Traité | `app.module.ts`, `realtime.module.ts` | Le gateway et l'adaptateur Socket.IO ne sont pas instanciés sur Vercel ; seul le producteur d'événements no-op compatible serveurless reste injectable. | Héberger un serveur Socket.IO séparé si le temps réel est requis en production |
| SL3 | Traité | `app.module.ts` | `ScheduleModule.forRoot()` est conditionné à l'absence de runtime Vercel. | — |
| SL4 | Décision | `database-seed.service.ts`, configuration et README | `AUTO_RUN_MIGRATIONS` reste faux par défaut et est refusé/documenté pour Vercel ; les migrations doivent être exécutées en amont du déploiement. | — |
| SL5 | Bien         | `main.ts:112-121`                        | Instance Nest cachée avec `appPromise ??= createApp()` — pattern correct pour le cold start                                                                                                                                                                                           | —                                                                                                                                                                                                                        |
| SL6 | Bien         | `main.ts:108`                            | `app.init()` au lieu de `app.listen()` — correct pour Vercel                                                                                                                                                                                                                          | —                                                                                                                                                                                                                        |
| SL7 | Traité | `vercel.json` | La région, la durée maximale et les quatre planifications Cron sont versionnées. | — |

### AXE 11 — Observabilité

| #   | Gravité | Fichier(s)                 | Problème                                                                                                                                                                                 | Correctif proposé                                                                                   |
| --- | ------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| O1  | Bien    | Tous les services/workers  | Utilisation de `new Logger(ClassName.name)` — logger NestJS natif cohérent                                                                                                               | —                                                                                                   |
| O2  | Bien    | `main.spec.ts:5`           | Test qui vérifie l'absence de `console.log` dans `main.ts` — excellent                                                                                                                   | —                                                                                                   |
| O3  | Traité  | `package.json`, `package-lock.json` | `winston` et `nest-winston`, jamais branchés, ont été retirés. Le logger Nest natif est le choix explicite et cohérent du projet. | — |
| O4  | Traité  | `monitoring.service.ts`    | Le health public ne retourne plus que `status` et `timestamp`; les métriques techniques restent protégées. | — |

### AXE 12 — API

| #   | Gravité | Fichier(s)          | Problème                                                                                    | Correctif proposé                                          |
| --- | ------- | ------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| AP1 | Bien    | Tous controllers    | Préfixe `api/v1/` cohérent sur tous les controllers                                         | —                                                          |
| AP2 | Bien    | `pagination.dto.ts` | Pagination centralisée avec `PaginationDto.createResponse()` et `getSafeSortField()`        | —                                                          |
| AP3 | Traité  | `openapi.config.ts`, `configuration.ts`, `.env.example` | Les serveurs Swagger sont configurables via `SWAGGER_SERVERS`. | — |

### AXE 13 — Tests

| #   | Gravité | Fichier(s)                                             | Problème                                                                                                            | Correctif proposé                                                              |
| --- | ------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| TS1 | Traité  | `registrations.service.spec.ts` | Les fixtures utilisent les DTO typés et les doubles de service passent par `unknown` quand un mock partiel est intentionnel ; aucun `as any` ne subsiste. | — |
| TS2 | Bien    | Couverture                                             | Services, repositories et workers ont des specs unitaires.                                                          | —                                                                              |
| TS3 | Traité  | `test/app.e2e-spec.ts` | La suite couvre la route racine, le health public sans fuite d'infrastructure, l'accès PostgreSQL qualifié et les barrières 401 de logout, création d'inscription et appel suivant. Les cycles métier avec mutations restent couverts par les specs de services/repositories. | Ajouter des scénarios e2e destructifs dans un environnement DB éphémère dédié |
| TS4 | Décision | `jest-e2e.json`, `tsconfig.json` | Aucun alias TypeScript n'est configuré ; `moduleNameMapper` serait donc une configuration morte. | Synchroniser uniquement si des aliases sont introduits |

### AXE 14 — Qualité outillage

| #   | Gravité | Fichier(s)            | Problème                                                                                                                                                        | Correctif proposé                                                                                        |
| --- | ------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Q1  | Traité  | `.eslintrc.js`        | `no-explicit-any` est une erreur en production et reste désactivé uniquement dans les tests. | — |
| Q2  | Décision | `tsconfig.json`      | Les imports relatifs sont conservés pour ne pas imposer un résolveur ou une réécriture d'aliases au runtime Node.js. | Réévaluer avec un futur bundler |
| Q3  | Traité  | `package.json`, `.husky/pre-commit` | Husky et lint-staged formatent/lintent les fichiers indexés puis exécutent le typecheck. L'activation finale se fait via `npm install` dans un clone où `.git` est inscriptible. | — |
| Q4  | Traité  | `package.json` | L'alias redondant `db:schema` a été supprimé. | — |
| Q5  | Traité  | `.gitignore` | `package.json.backup` a été supprimé et `*.backup` est ignoré. | — |
| Q6  | Bien    | `package.json:20`     | Script `quality:check` qui enchaîne format, lint, typecheck, build, uuid:verify, tests                                                                          | —                                                                                                        |

### AXE 15 — Dépendances

| #   | Gravité    | Fichier(s)                             | Problème                                                                                                                                                                                                                                   | Correctif proposé                                                     |
| --- | ---------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| DP1 | Traité | `package.json`, `src/**/*.entity.ts` | TypeORM est réellement utilisé par les entités, `TypeOrmModule`, `DataSource`, les repositories et les transactions. La version 1.1.1 est conservée volontairement. | Ne pas rétrograder automatiquement vers `0.3.x` ; planifier séparément toute migration majeure |
| DP2 | Traité     | `package.json`, `package-lock.json`    | Aucun usage de `@nestjs/bullmq` ou `bullmq` n'a été trouvé ; les deux dépendances ont été retirées. | Surveiller la taille et le cold start du bundle après déploiement |
| DP3 | Décision | `package.json`, `app.module.ts` | Ces dépendances restent nécessaires au mode serveur persistant. Le module est désactivé au runtime Vercel ; les retirer empêcherait ce mode. Une exclusion physique du bundle nécessiterait un artefact de déploiement séparé. | Mesurer le bundle avant de créer un second artefact |
| DP4 | Traité     | `package.json`                         | `@types/cookie-parser` a été déplacé dans `devDependencies`. | — |
| DP5 | Traité | `package.json` | `js-yaml` et ses types sont volontairement en devDependencies : ils ne servent qu'au script d'export Swagger. | — |

### AXE 16 — Code mort

| #   | Gravité | Fichier(s)                | Problème                                                                                                            | Correctif proposé      |
| --- | ------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| CD1 | Traité  | `.gitignore`              | `package.json.backup` a été supprimé et `*.backup` est désormais ignoré.                                            | —                      |
| CD2 | Traité  | `auth.controller.ts`, `auth.service.ts` | Le wrapper `getCurrentUser` a été supprimé et le contrôleur appelle `me`. | — |
| CD3 | Décision | `modules/rbac/entities/` | Le dossier contient six entités TypeORM actives, agrégées par `core/database/entities.ts`; aucun code mort n'a été identifié. | — |

### AXE 17 — Lisibilité

| #   | Gravité | Fichier(s)                              | Problème                                                                                                                               | Correctif proposé                                                                          |
| --- | ------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| L1  | Décision | `registrations.service.ts` | Les étapes de création forment une seule transaction et sont déjà nommées/documentées ; les extraire sans réutilisation réelle déplacerait la complexité et rendrait le flux transactionnel moins lisible. | Extraire lorsqu'une étape devient réutilisée indépendamment |
| L2  | Décision | `queue-engine.service.ts` | La logique haute orchestre les invariants tandis que les accès bas niveau sont dans `QueueEngineRepository`; le découpage proposé dupliquerait aujourd'hui scope, audit et coordination transactionnelle. | Réévaluer avec des métriques de complexité ou une nouvelle frontière métier |
| L3  | Traité  | `core/rbac/services/rank.service.ts`    | Les rangs nommés `ROLE_RANK` remplacent les constantes magiques dans Auth et Users. | — |
| L4  | Traité  | `configuration.ts`, `daily-reset.worker.ts` | `DEFAULT_TIMEZONE` est exportée par la configuration et réutilisée comme ultime fallback du worker. | — |
| L5  | Traité  | `sites.repository.ts` | Les expressions `COALESCE` de l'insertion sont réparties sur plusieurs lignes lisibles. | — |

---

## 3. Architecture cible

### 3.1 Structure de dossiers recommandée

```
src/
├── main.ts                          # Point d'entrée Vercel + local
├── app.module.ts                    # Module racine, Guards/Filters/Interceptors globaux
│
├── core/                            # Infrastructure transversale (jamais de logique métier)
│   ├── auth/                        # JWT strategy, guards, decorators
│   ├── audit/                       # AuditInterceptor, AuditRepository, AuditService
│   ├── clock/                       # ClockService (testable, injectable)
│   ├── config/                      # configuration.ts, validateEnvironment
│   ├── database/                    # DatabaseModule, MigrationRunner, entities.ts
│   ├── errors/                      # DoriException, ErrorCatalog, GlobalExceptionFilter
│   ├── http/                        # CorrelationIdInterceptor
│   ├── logging/                     # SafeError
│   ├── notifications/               # NotificationTemplateService (template rendering)
│   ├── pagination/                  # PaginationDto, PaginatedResult
│   ├── rbac/                        # PermissionsGuard, ScopeService, RankService (NEW)
│   ├── redis/                       # RedisModule, REDIS_CLIENT token
│   ├── response/                    # ResponseInterceptor
│   ├── serialization/               # SerializationInterceptor
│   ├── swagger/                     # OpenAPI config, @ApiDoriResponse
│   ├── types/                       # Guid, shared type aliases
│   └── validation/                  # DomainValidation decorators, InternalUuidParamPipe
│
├── modules/                         # Feature modules (logique métier)
│   ├── auth/                        # Login, refresh, logout, changePassword
│   ├── monitoring/                  # Health, metrics, reports
│   ├── notifications/               # Notification CRUD, webhooks
│   ├── persons/                     # Person CRUD + notes
│   ├── queue-engine/                # Sessions, threads, call-next (découper en sous-services)
│   ├── queue-estimation/            # Service d'estimation temps d'attente
│   ├── queues/                      # Queue CRUD + config
│   ├── rbac/                        # Roles, permissions CRUD
│   ├── registrations/               # Registration CRUD (découper Write/Read)
│   ├── service-tiers/               # Tiers CRUD
│   ├── sites/                       # Site CRUD
│   ├── translations/                # Traductions
│   └── users/                       # User CRUD
│
├── workers/                         # Tâches planifiées (@Cron) — désactivées sur Vercel
│   ├── appointment-expiry/
│   ├── daily-reset/
│   ├── notification-worker/
│   ├── queue-estimation/
│   └── workers.module.ts
│
└── cron-handlers/                   # (NOUVEAU) Endpoints HTTP pour Vercel Cron Jobs
    ├── daily-reset.handler.ts
    ├── appointment-expiry.handler.ts
    ├── notification-worker.handler.ts
    ├── queue-estimation.handler.ts
    └── cron.module.ts
```

### 3.2 Responsabilités par couche

| Couche         | Responsabilités autorisées                                                               | Interdictions                                         |
| -------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Controller** | Routing HTTP, décorateurs Swagger, extraction de params/body/user, délégation au service | Logique métier, accès DB, appels multi-services       |
| **Service**    | Logique métier, orchestration, exceptions métier, transactions                           | Requêtes SQL directes, accès HTTP                     |
| **Repository** | Requêtes SQL/ORM, mappage DB→DTO interne                                                 | Logique métier, exceptions métier, import de services |
| **Core**       | Infrastructure transversale                                                              | Logique métier spécifique à un module                 |

### 3.3 Règles de dépendance

```
module → core ✅
module → autre module (via import NestJS) : à éviter sauf si justifié
core → module ❌ (jamais)
repository → service ❌ (jamais)
worker → repository ✅
worker → service ✅
```

### 3.4 Conventions obligatoires

**Nommage :**

- Fichiers : `kebab-case.type.ts` (`queue-engine.service.ts`)
- Classes : PascalCase avec suffixe (`QueuesService`, `QueuesRepository`, `CreateQueueDto`)
- Méthodes : camelCase, verbe d'action (`findById`, `createRegistration`, `revokeSession`)

**Format de réponse unique :**

```json
{ "code": "OK", "translationKey": null, "translationParams": {}, "data": {...} }
```

**Format d'erreur unique :**

```json
{
  "code": "QUEUE_NOT_FOUND",
  "translationKey": "errors.queue_not_found",
  "translationParams": {},
  "data": null
}
```

**Pagination standard :**

```
GET /resource?page=1&pageSize=25&sort=createdAt:desc
→ { items: [...], page: 1, pageSize: 25, total: 100, totalPages: 4 }
```

**Patterns à factoriser :**

- `RankService` : logique hiérarchique (rang) partagée entre auth et users
- `BaseWorker` : pattern try/finally + `isRunning` partagé entre workers
- `buildWhereClause(filters)` : construction de WHERE SQL (si ≥ 3 occurrences)

---

## 4. Plan de refactor priorisé

### 🔴 Étape 1 — Correctifs critiques serverless (risque : faible, effort : moyen)

**Objectif :** Éviter la régression silencieuse en production Vercel.

1. **SL1/SL2/SL3 — réalisé** — `vercel.json` déclare les crons et `WorkersModule` + `RealtimeModule` + `ScheduleModule` sont exclus lorsque la configuration indique Vercel.
2. **SL1 — réalisé** — Quatre endpoints HTTP Cron (`daily-reset`, `appointment-expiry`, `notifications`, `queue-estimation`) sont protégés par `CRON_SECRET` et déclarés dans `vercel.json`. Les traitements reposent sur les garanties transactionnelles/idempotentes existantes des repositories.
3. **CF1 — réalisé** — `redis.module.ts` utilise désormais `ConfigService` pour `swaggerExport`.
4. **DP1/DP2 — réalisé** — TypeORM est conservé car activement utilisé ; BullMQ et son intégration Nest ont été retirés car inutilisés.

**Risque :** Faible (ajout conditionnel, pas de changement de comportement en dev)
**Effort :** ~1 à 3 jours selon les contraintes d'idempotence, de verrouillage et de validation sur Vercel

---

### 🟠 Étape 2 — Fondations (risque : faible, effort : faible-moyen)

5. **E2 — réalisé** — `QUEUE_EMPTY` est retourné comme une réponse métier normale en 200, sans lever d'exception.
6. **T1 — mesuré** — `npx tsc --noEmit --strict` relève 841 erreurs, dont 840 `TS2564`. Corriger les DTO/entités par lots, puis activer `"strict": true`. Évaluer séparément `noImplicitReturns` et `noUncheckedIndexedAccess`.
7. **T2/T4 — réalisé** — Tous les `any` explicites de production ont été remplacés par des types précis ou `unknown`, et ESLint interdit désormais leur retour hors fichiers de tests.
8. **Q2** — Ajouter les path aliases `@core/*`, `@modules/*` dans `tsconfig.json` + `tsconfig.build.json` + `jest` config.
9. **Q4/Q5 — réalisé** — `package.json.backup` et `db:schema` ont été supprimés ; `*.backup` est ignoré et `@types/cookie-parser` est une devDependency.
10. **DP2 — réalisé** — `@nestjs/bullmq` et `bullmq` ont été supprimés après vérification de leur absence d'usage.

**Risque :** Faible à moyen (`strict` et les aliases peuvent révéler ou introduire des incompatibilités de build/test)
**Effort :** ~1 à 3 jours après mesure du nombre d'erreurs TypeScript

---

### 🟡 Étape 3 — Restructuration et factorisation (risque : moyen, effort : moyen)

11. **D1** — Extraire `RankService` dans `core/rbac/services/` avec les constantes de rang nommées.
12. **D3** — Créer `BaseWorker` avec `runOnce(fn)` pour les 4 workers.
13. **DB1/S1** — Remplacer les 19 `SELECT *` par des projections explicites (prioriser `dori_user`).
14. **C2** — Remplacer `LIMIT ${pageSize} OFFSET ${offset}` interpolé par des paramètres `$N` dans `sites.repository.ts`.
15. **CF1 (suite)** — Compléter la centralisation de `DEFAULT_TIMEZONE` et `appointmentExpiry.intervalMinutes` dans env.

**Risque :** Moyen (requêtes SQL modifiées → tests de régression obligatoires)
**Effort :** ~2-3 jours

---

### 🟢 Étape 4 — Découpage des gros services (risque : moyen, effort : élevé)

16. **A3** — Découper `RegistrationsService` en `RegistrationWriteService` + `RegistrationReadService` + `AppointmentService`.
17. **A4** — Découper `QueueEngineService` en `ThreadService` + `SessionService` + `CallService`.
18. **L1** — Extraire les méthodes privées de `createRegistration` (chaque étape numérotée = une méthode).
19. **A7** — Supprimer `NotificationTemplateService` de `RegistrationsRepository`, passer les données nécessaires en paramètre.

**Risque :** Moyen (refactor de code critique, couvrir par tests avant)
**Effort :** ~3-4 jours

---

### 🔵 Étape 5 — Tests et documentation (risque : faible, effort : moyen)

20. **TS1** — Remplacer les `as any` dans les specs par des fixtures typées.
21. **TS3** — Ajouter des scénarios e2e : login→refresh→logout, register→call.
22. **Q3** — Ajouter husky + lint-staged.
23. **AP3** — Rendre les URLs Swagger configurables via env.
24. **O3** — Confirmer/corriger la configuration nest-winston.
25. **README** — Documenter les Vercel Cron endpoints, l'architecture, les variables d'env.

**Risque :** Faible
**Effort :** ~2 jours

---

## 5. Checklist "Definition of Done"

- [x] `npm run build` — ✅ zéro erreur
- [x] `npm run lint` — ✅ zéro warning
- [x] `npm run typecheck` — ✅ zéro erreur
- [x] `npm test` — ✅ 61 suites et 318 tests verts
- [x] Aucun `@Cron` actif dans le graphe de modules serverless Vercel
- [x] `WorkersModule` persistant et `RealtimeModule` exclus quand `VERCEL=true` ; `CronModule` expose uniquement les déclencheurs HTTP
- [x] `vercel.json` présent avec `maxDuration`, `regions`, `crons`
- [x] Zéro `SELECT *` sur `dori_user` (colonnes sensibles)
- [x] Zéro `process.env` hors `configuration.ts` et `configuration.spec.ts`
- [x] Usage de `typeorm` / `@nestjs/typeorm` justifié par les entités, `DataSource`, transactions et repositories ; aucune rétrogradation automatique de 1.x vers 0.3.x
- [x] `@nestjs/bullmq`/`bullmq` retirés après confirmation de l'absence d'usage
- [x] `strict: true` activé (`strictPropertyInitialization` documenté comme exception framework)
- [x] Zéro `any` explicite dans les fichiers de production (hors commentaires et valeur métier littérale `mode: 'any'`)
- [x] Stratégie d'imports décidée : chemins relatifs conservés sans résolveur runtime
- [x] `package.json.backup` supprimé et `*.backup` ajouté à `.gitignore`
- [x] `QUEUE_EMPTY` traité comme une réponse métier normale, sans exception HTTP 200
- [ ] Swagger à jour (exporté via `npm run swagger:export`)
- [ ] README à jour avec variables d'env, endpoints cron, architecture
- [ ] Déploiement Vercel vérifié (preview branch)

---

_Audit soldé dans le code le 2026-10-24 : chaque constat est corrigé ou assorti d'une décision technique explicite. Le health de `https://dori-api.vercel.app/api/v1/monitoring/health` répond 200, mais expose encore l'ancien payload détaillé (`uptime`, `checks`) : le déploiement public n'intègre donc pas encore les changements locaux et doit être redéployé avant validation finale de l'état Vercel._

<!-- CHECKPOINT id="ckpt_mvm2xbup_jif12t" time="2026-10-24T07:30:32.641Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm3a6ui_cjph9c" time="2026-10-24T07:40:32.682Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm3n1t7_qq56zv" time="2026-10-24T07:50:32.683Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm3zws3_kgtbg5" time="2026-10-24T08:00:32.691Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm4crqx_3g650h" time="2026-10-24T08:10:32.697Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm4pmpq_5j23fq" time="2026-10-24T08:20:32.702Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm52hoi_i1j5z2" time="2026-10-24T08:30:32.706Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm5fcnh_ih8k6l" time="2026-10-24T08:40:32.717Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm5s7m9_iaeup0" time="2026-10-24T08:50:32.721Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm652lg_91tm8k" time="2026-10-24T09:00:32.740Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm6hxko_36le3x" time="2026-10-24T09:10:32.760Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm6usjq_n7bswy" time="2026-10-24T09:20:32.774Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm77nin_h860sr" time="2026-10-24T09:30:32.783Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm7kigy_xpn33v" time="2026-10-24T09:40:32.770Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm7xdg3_ioczad" time="2026-10-24T09:50:32.787Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvm8qxmv_0qf7ei" time="2026-10-24T10:13:31.975Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvma77sw_0r9jp6" time="2026-10-24T10:54:11.264Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvmak2s0_xenqm5" time="2026-10-24T11:04:11.280Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvmawxqp_d3w8ty" time="2026-10-24T11:14:11.281Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvmb9spe_ll6pof" time="2026-10-24T11:24:11.282Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvmbmnoh_i5xdjj" time="2026-10-24T11:34:11.297Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvmbzinj_r4pkte" time="2026-10-24T11:44:11.311Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvmccdmw_qt5tp2" time="2026-10-24T11:54:11.336Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvmcp9hb_sg4x9l" time="2026-10-24T12:04:12.479Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvmd24g9_vzwi8w" time="2026-10-24T12:14:12.489Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvmdezew_s1ua1e" time="2026-10-24T12:24:12.488Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvmdrudz_c0gscm" time="2026-10-24T12:34:12.503Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvme4pcz_rfhqd1" time="2026-10-24T12:44:12.515Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvmehkc1_g1qcla" time="2026-10-24T12:54:12.529Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvmeufb1_uza0rg" time="2026-10-24T13:04:12.541Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
