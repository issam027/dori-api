# Rapport d'Audit — dori-api
> Généré le 2026-10-24 | Rapport corrigé et vérifié sur le dépôt — PHASE 1 + PHASE 2 + PHASE 3

---

## 1. Résumé exécutif

**État général :** Backend NestJS mature, bien structuré, avec une base technique solide.
Le code présente de bonnes pratiques (error catalog centralisé, global exception filter, guards
globaux, intercepteurs de sérialisation, config validée au démarrage, pool DB adapté au
serverless). Les risques principaux sont concentrés sur la **compatibilité serverless** (workers
`@Cron` + WebSockets incompatibles avec Vercel), quelques fuites de `process.env` hors config, une
verbosité des fichiers `any` dans les tests, des `SELECT *` répandus, et un couplage entre
`RegistrationsRepository` et la couche de templates.

**5 principaux risques :**
1. 🔴 **Serverless** – Les 4 workers `@Cron` (DailyReset, AppointmentExpiry, NotificationWorker, QueueEstimation) et le WebSocket gateway reposent sur une instance NestJS persistante, modèle que Vercel serverless ne garantit pas. Leur exécution est donc absente ou non fiable en production, avec un risque de **régression silencieuse**.
2. 🔴 **process.env hors config** – `redis.module.ts:29` lit `process.env.SWAGGER_EXPORT` directement au lieu de passer par le `ConfigService` injecté.
3. 🟠 **SELECT \* / RETURNING \*** – 36 occurrences textuelles ont été relevées dans `src/`, dont 3 lectures `SELECT *` sur `dori_user`. Le risque prioritaire est la remontée accidentelle de colonnes sensibles ou nouvelles hors du modèle interne ; toutes les occurrences n'ont toutefois pas la même criticité.
4. 🟠 **Duplication de logique de rang hiérarchique** – La vérification anti-escalade est dupliquée dans `auth.service.ts` (logout force) et `users.service.ts` (création/modification d'utilisateur), avec des constantes magiques (`5`, `3`, `4`) non partagées.
5. 🟡 **TypeScript strict partiel** – `strict: true` est absent du tsconfig (seuls `strictNullChecks` + `noImplicitAny` sont activés). `transformKeysToCamel` (serialization.interceptor.ts) utilise des signatures `any` explicites.

**Notes /10 par axe :**

| Axe | Note | Commentaire |
|-----|------|-------------|
| Architecture | 8/10 | Séparation controller/service/repository bien respectée, modules fonctionnels clairs |
| Cohérence | 7/10 | Bonne uniformité globale, quelques écarts mineurs (filtre WHERE `1=1` vs ARRAY de clauses) |
| Sécurité | 8/10 | Bon : helmet, CORS strict, bcrypt, sessions révocables, RBAC. Risque : SELECT * sur dori_user |
| Tests | 7/10 | Bonne couverture services/repositories, `as any` répandus dans les fixtures de test |
| Serverless | 5/10 | Point d'entrée et instance cachée sont excellents ; workers Cron = bombe silencieuse |
| Maintenabilité | 7/10 | Code lisible, duplication modérée, fichiers services très longs (813 lignes) |

### Périmètre de vérification et limites

Les constats les plus critiques ont été revérifiés directement dans le dépôt le 2026-10-24 :

- 4 décorateurs `@Cron` sont présents et `ScheduleModule`, `WorkersModule` et `RealtimeModule` sont importés inconditionnellement dans `AppModule` ;
- aucun `vercel.json` n'est présent ;
- hors configuration et tests, le seul accès direct à `process.env` trouvé est dans `redis.module.ts` ;
- 36 occurrences textuelles de `SELECT *` ou `RETURNING *` sont présentes dans `src/`, dont 3 lectures de `dori_user` ;
- aucune utilisation de `@nestjs/bullmq` ou `bullmq` n'a été trouvée dans `src/` ;
- `typeorm@1.1.1` est réellement installé et verrouillé dans `package-lock.json`.

Les notes sur 10 restent indicatives : elles ne proviennent pas d'une grille normalisée. De même, la taille d'un service est un signal de complexité, pas une preuve suffisante qu'un découpage architectural est nécessaire. Les modifications à fort impact doivent être précédées de tests de non-régression.

---

## 2. Rapport d'audit détaillé

### AXE 1 — Duplication

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| D1 | Majeur | `auth.service.ts:187-212` & `users.service.ts:28-77` | Logique de rang hiérarchique (getCallerMaxRank, anti-escalade) dupliquée avec des constantes magiques `5`, `4`, `3`, `1` | Extraire dans un helper `RankService` ou ajouter un helper partagé dans `core/rbac` |
| D2 | Mineur | `sites.repository.ts:31-42` & `audit.repository.ts:196-214` & `notifications.repository.ts:58-90` | Construction des clauses WHERE avec `params.push / clauses.push` dupliquée dans ~6 repositories | Factoriser un petit helper `buildWhereClause(filters)` |
| D3 | Mineur | `daily-reset.worker.ts:9` & `appointment-expiry.worker.ts:10` & `queue-estimation.worker.ts:10` | Champ `private isRunning = false` dupliqué dans 3 workers + même pattern try/finally | Extraire une classe de base `BaseWorker` avec `runOnce(fn)` |
| D4 | Mineur | `notifications.service.ts:67` & autres services | Cast `result.items as unknown as NotificationResponseDto[]` – bypass du type — apparaît à plusieurs endroits | Typer correctement les méthodes de repository pour éviter le double cast |

### AXE 2 — Architecture

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| A1 | Critique | `app.module.ts:45` + workers /* | `ScheduleModule.forRoot()` et les 4 workers `@Cron` sont chargés dans le module principal, mais **Vercel ne maintient pas de processus persistant** entre les invocations. Les crons ne tournent jamais en production serverless. | Désactiver `ScheduleModule` sur Vercel (`isVercel` flag), migrer vers **Vercel Cron Jobs** (vercel.json) ou un service externe (Inngest, QStash) |
| A2 | Critique | `realtime.module.ts` + `main.ts:54` | Le WebSocket gateway (`@WebSocketGateway`) est importé dans `AppModule` mais désactivé côté adapter sur Vercel. Il est quand même instancié (connexions DB, injection), causant une charge inutile. | Exclure `RealtimeModule` du bundle serverless ou isoler en microservice séparé |
| A3 | Majeur | `registrations.service.ts` (813 lignes) | Service God — combine création, mise à jour, reschedule, lookup, disponibilités, calcul de slots, génération de tokens. La complexité cyclomatique est très élevée. | Découper en `RegistrationWriteService`, `RegistrationReadService`, `AppointmentService` |
| A4 | Majeur | `queue-engine.service.ts` (552 lignes) | Même problème — service trop large combinant threads, sessions, appel suivant, reschedule | Découper en `ThreadService`, `SessionService`, `CallService` |
| A5 | Mineur | `core/audit/audit.module.ts` | `AuditModule` est dans `core/` mais exporte un `AuditController` — mélange responsabilité infrastructure/API | Déplacer le contrôleur dans `modules/audit/` ou accepter l'exception (la colonne audit = cross-cutting) |
| A6 | Mineur | `realtime.gateway.ts:48` | `RealtimeGateway` injecte `JwtStrategy` directement pour valider les tokens WebSocket. Couplage fort entre infrastructure WS et stratégie Passport. | Extraire la validation JWT WS dans un service dédié `WsAuthService` |
| A7 | Mineur | `registrations.repository.ts:8` | `RegistrationsRepository` importe `NotificationTemplateService` (couche service) — violation du sens de dépendance (repository ne doit pas dépendre d'un service) | Passer les templates en paramètre ou déplacer la logique de template dans le service |

### AXE 3 — Cohérence

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| C1 | Mineur | `notifications.repository.ts:59` vs `audit.repository.ts:196` | Deux styles de construction WHERE : `1=1 +` vs array de clauses. Choisir un style et le généraliser. | Standardiser sur le tableau de clauses (plus lisible, pas de condition toujours vraie) |
| C2 | Mineur | `sites.repository.ts:48-49` | LIMIT/OFFSET interpolés directement dans la requête (`LIMIT ${pageSize} OFFSET ${offset}`) au lieu d'utiliser des paramètres `$N` | Utiliser des paramètres positionnels pour la cohérence (même si les valeurs sont des entiers validés) |
| C3 | Mineur | `auth.service.ts:230-231` | `getCurrentUser` est un alias de `me` (appel direct) — méthode redondante inutilisée ou doublon | Supprimer `getCurrentUser` ou `me` et unifier |
| C4 | Mineur | `daily-reset.worker.ts:24` | Chaîne magique `'Africa/Tunis'` comme timezone par défaut codée en dur dans le worker, différente de `configuration.ts` | Centraliser la timezone par défaut dans la configuration |

### AXE 4 — TypeScript

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| T1 | Majeur | `tsconfig.json` | `strict: true` absent. `strictNullChecks`, `noImplicitAny` et `strictBindCallApply` sont activés. `strictPropertyInitialization` et `strictFunctionTypes` seraient activés par `strict`, tandis que `noImplicitReturns` et `noUncheckedIndexedAccess` doivent être configurés séparément. | Exécuter d'abord `npx tsc --noEmit --strict` pour mesurer l'écart, puis activer les options progressivement ; ne pas présumer que le changement est non-breaking |
| T2 | Majeur | `serialization.interceptor.ts:27,38` | `transformKeysToCamel(data: any): any` — signature `any` inutile. TypeScript peut utiliser `unknown` avec des gardes de type. | Remplacer par `(data: unknown): unknown` avec les gardes de type déjà présentes |
| T3 | Mineur | `dori.exception.ts:44` | `(data as any).message` — assertion `any` pour accéder à `.message`. | Utiliser `(data as Record<string, unknown>).message` |
| T4 | Mineur | `.eslintrc.js:23` | `'@typescript-eslint/no-explicit-any': 'off'` — la règle `no-explicit-any` est désactivée. Elle ne détecte donc pas les 17 occurrences de `as any` dans les specs. | Passer en `'warn'` pour les fichiers de production (ne pas toucher aux specs) |
| T5 | Mineur | `tsconfig.json` | Pas de path aliases (`@core/*`, `@modules/*`). Les imports utilisent des chemins relatifs profonds (`../../core/errors/dori.exception`) | Ajouter des aliases dans `tsconfig.json` et `tsconfig.build.json` |

### AXE 5 — Validation et DTO

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| V1 | Bien | `main.ts:72-83` | ValidationPipe global avec `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — ✅ conforme | — |
| V2 | Bien | `core/validation/domain-validation.decorators.ts` | Décorateurs de validation métier custom bien factorisés | — |
| V3 | Mineur | `pagination.dto.ts:103-113` | `createResponse` duplique le calcul de `page` et `pageSize` déjà disponibles via `this.page` / `this.pageSize`. Double `Number()` conversion sans raison | Simplifier en utilisant directement les propriétés |

### AXE 6 — Gestion des erreurs

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| E1 | Bien | `core/errors/` | Global exception filter + error catalog + DoriException — architecture exemplaire | — |
| E2 | Majeur | `error-catalog.ts:117-120`, `queue-engine.service.ts:302` | `QUEUE_EMPTY` a un status HTTP `200` mais est levée comme une exception. Le `ResponseInterceptor` sait déjà laisser passer une enveloppe métier. | Retourner une réponse métier normale avec `code: 'QUEUE_EMPTY'`, pas une exception. Ne pas utiliser `204` si une enveloppe JSON doit être retournée, car une réponse 204 ne doit pas avoir de corps |
| E3 | Mineur | `global-exception.filter.ts:47-64` | Table de correspondance code↔traduction dupliquée dans le filtre alors qu'elle existe déjà dans `ERROR_CATALOG`. | Lire `ERROR_CATALOG[code]` directement |

### AXE 7 — Configuration

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| CF1 | Majeur | `redis.module.ts:29` | `process.env.SWAGGER_EXPORT === 'true'` lu directement, hors `ConfigService`. Seul point de fuite détecté en dehors de `configuration.ts`. | Injecter `ConfigService` et lire `config.get('swaggerExport')` |
| CF2 | Bien | `core/config/configuration.ts` | Config centralisée, validée au démarrage, DATABASE_URL + variables individuelles supportées | — |
| CF3 | Mineur | `configuration.ts:262-263` | `appointmentExpiry.intervalMinutes: 5` est une constante codée en dur dans la config (jamais lisible depuis env). Cohérent mais non configurable. | Ajouter `APPOINTMENT_EXPIRY_INTERVAL_MINUTES` dans `.env.example` et `validateEnvironment` |

### AXE 8 — Sécurité

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| S1 | Majeur | `auth.repository.ts:37,48,120` | Trois `SELECT * FROM dorify.dori_user` peuvent retourner `password_hash`, `failed_attempts`, `locked_until`. Certaines données sont légitimement nécessaires à l'authentification, mais la sécurité publique repose alors en partie sur `SENSITIVE_FIELDS` et l'intercepteur de sérialisation. | Projeter explicitement les colonnes requises et distinguer le modèle interne d'authentification du DTO public ; conserver `password_hash` uniquement dans les méthodes qui en ont besoin |
| S2 | Bien | `serialization.interceptor.ts:19-25` | `SENSITIVE_FIELDS` filtre `password_hash`, `refresh_token_hash`, `password` avant sérialisation | — |
| S3 | Bien | `main.ts:27-47` | Helmet configuré avec CSP explicite | — |
| S4 | Bien | `auth.service.ts:25-27` | Tokens de rafraîchissement hashés SHA-256 avant stockage | — |
| S5 | Mineur | `main.ts:104` | `res.redirect` utilise `{ redirect: (url: string) => void }` comme type, bypassing le type complet de `Response`. Pas dangereux mais peut masquer d'autres méthodes. | Typer `res` correctement en `Response` de Express |
| S6 | Mineur | `.env.example:40` | `JWT_SECRET=CHANGE_ME_IN_PRODUCTION_MINIMUM_32_CHARS` — secret faible dans le template (attendu, mais à mentionner dans le README) | Ajouter une note explicite "Ne jamais déployer sans RS256 en production" |

### AXE 9 — Base de données

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| DB1 | Majeur | 36 occurrences textuelles `SELECT *` / `RETURNING *` dans `src/` | Récupération de toutes les colonnes — coût réseau, risque de colonnes sensibles dans les réponses, fragilité aux migrations. Le comptage inclut des usages internes de criticité variable. | Prioriser les 3 `SELECT *` sur `dori_user`, puis les résultats exposés par l'API et les requêtes fréquentes ; conserver un modèle interne distinct lorsque `password_hash` est nécessaire à l'authentification |
| DB2 | Bien | `database.module.ts:34-41` | Pool configurable via `DB_POOL_MAX` (défaut 10), avec `idleTimeoutMillis: 10000` et `connectionTimeoutMillis: 5000`. La précédente limite Aiven à une connexion a été retirée pour Neon. | Ajuster `DB_POOL_MAX` selon le nombre d'instances et utiliser l'endpoint poolé Neon |
| DB3 | Bien | `migration-runner.ts` + `database-seed.service.ts` | Migrations SQL versionnées, exécution idempotente | — |
| DB4 | Bien | `registrations.repository.ts:80-81` | Advisory lock `pg_advisory_xact_lock` pour la gestion des slots — approche correcte | — |
| DB5 | Mineur | `database-seed.service.ts:4-5` | Import de `fs` et `path` (Node.js built-ins) dans un service NestJS. La lecture de fichier SQL fonctionne en dev mais peut échouer sur Vercel (bundle serverless, pas de système de fichiers accessible au runtime). | Intégrer les migrations SQL comme chaînes de caractères (`import`) plutôt que `fs.readFileSync` au runtime, ou conditionner à `isVercel === false` |
| DB6 | Mineur | `audit.repository.ts:50-127` | Vue en ligne (CTE en dur dans un template SQL) de 80 lignes répétée dans `search` et `findById`. | Extraire dans une constante partagée (déjà fait : `AUDIT_EVENT_READ_MODEL`) — ✅ bon |

### AXE 10 — Serverless/Vercel

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| SL1 | **Critique** | `workers/` (4 workers Cron) | `@Cron(EVERY_MINUTE)` ne constitue pas un ordonnanceur fiable sur Vercel : les invocations serverless sont éphémères et sans processus persistant garanti. La `isRunning` flag en mémoire est locale à une instance et ne protège pas contre les exécutions concurrentes distribuées. | Désactiver `WorkersModule` sur Vercel ; migrer vers Vercel Cron (`vercel.json` `crons` section) avec quatre endpoints HTTP dédiés, authentifiés, idempotents et protégés au niveau base de données contre la concurrence |
| SL2 | **Critique** | `realtime.module.ts` | WebSocket non supporté sur Vercel. `ConfiguredIoAdapter` est conditionné sur `!isVercel` dans `main.ts`, mais `RealtimeModule` est toujours importé (coût de boot, risques d'erreur). | Conditionner l'import de `RealtimeModule` dans `app.module.ts` sur `!isVercel`, ou extraire en service séparé (Socket.IO standalone + Redis adapter) |
| SL3 | Majeur | `app.module.ts:3,45` | `ScheduleModule.forRoot()` enregistré inconditionnellement. Sur Vercel, il ne fait rien mais charge du code inutile. | Enregistrer `ScheduleModule.forRoot()` uniquement si `!isVercel` |
| SL4 | Majeur | `database-seed.service.ts:52-55` | `fs.readFileSync(seedPath)` : lit un fichier depuis le disque au runtime. Sur Vercel, les fichiers dans `dist/` sont présents après le build, mais **`__dirname` pointe vers un chemin différent** dans le bundle edge/serverless. | Vérifier le comportement sur Vercel ou conditionner `AUTO_RUN_MIGRATIONS` à `false` (ce qui est déjà le défaut) |
| SL5 | Bien | `main.ts:112-121` | Instance Nest cachée avec `appPromise ??= createApp()` — pattern correct pour le cold start | — |
| SL6 | Bien | `main.ts:108` | `app.init()` au lieu de `app.listen()` — correct pour Vercel | — |
| SL7 | Mineur | Pas de `vercel.json` trouvé dans le repo | Pas de fichier `vercel.json` visible pour configurer `maxDuration`, `regions`, `crons` | Créer `vercel.json` avec `maxDuration: 30`, `regions: ['fra1']`, et les cron endpoints |

### AXE 11 — Observabilité

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| O1 | Bien | Tous les services/workers | Utilisation de `new Logger(ClassName.name)` — logger NestJS natif cohérent | — |
| O2 | Bien | `main.spec.ts:5` | Test qui vérifie l'absence de `console.log` dans `main.ts` — excellent | — |
| O3 | Mineur | `logging/safe-error.ts` | Seule une utilité de sécurité de log. Pas de logger structuré (winston configuré dans `package.json` mais `nest-winston` non utilisé dans les modules — vérifier si configuré ailleurs). | Valider que winston est réellement branché via `nest-winston` dans `main.ts` ou `AppModule` |
| O4 | Mineur | `monitoring.service.ts:50` | `process.uptime()` et `process.memoryUsage()` dans `health()` — utile mais exposer `memoryUsage` dans une réponse HTTP publique peut révéler des informations d'infrastructure | Limiter `health()` aux routes authentifiées ou ne retourner que `status` + `timestamp` publiquement |

### AXE 12 — API

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| AP1 | Bien | Tous controllers | Préfixe `api/v1/` cohérent sur tous les controllers | — |
| AP2 | Bien | `pagination.dto.ts` | Pagination centralisée avec `PaginationDto.createResponse()` et `getSafeSortField()` | — |
| AP3 | Mineur | `openapi.config.ts` | Serveurs en dur dans le code (localhost:3000, dori-api-dev.vercel.app, dori-api.vercel.app) | Rendre les URLs des serveurs Swagger configurables via env |

### AXE 13 — Tests

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| TS1 | Majeur | `registrations.service.spec.ts:114,141,171,501,571...` | 7+ usages de `as any` pour contourner le typage des DTOs de test — masque des erreurs réelles | Créer des fixtures typées ou utiliser `Partial<CreateRegistrationDto>` |
| TS2 | Bien | Couverture | Services, repositories et workers ont des specs unitaires. | — |
| TS3 | Mineur | `test/app.e2e-spec.ts` | E2E très minimal (1 seul test health check). Pas de scénario de login/logout/CRUD. | Ajouter au moins les scénarios critiques (login, refresh, register, call next) |
| TS4 | Mineur | `jest-e2e.json` | Pas de `moduleNameMapper` — les alias de path TS ne fonctionneront pas dans les tests e2e si des alias sont ajoutés | Synchroniser avec tsconfig après ajout d'aliases |

### AXE 14 — Qualité outillage

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| Q1 | Majeur | `.eslintrc.js:23` | `no-explicit-any: 'off'` — désactivé globalement. La règle serait utile en `warn` au minimum pour les fichiers de production. | Activer `'warn'` avec `overrides` pour les specs |
| Q2 | Majeur | `tsconfig.json` | Pas d'alias de paths configurés (`@core/*`, `@modules/*`). Chemins relatifs profonds (`../../core/errors/...`) dans toute la codebase. | Ajouter dans `tsconfig.json` : `"paths": { "@core/*": ["src/core/*"], "@modules/*": ["src/modules/*"] }` |
| Q3 | Mineur | `package.json` | Pas de `husky` / `lint-staged` configuré. Les scripts `format:check`, `lint`, `typecheck` existent mais ne sont pas automatiquement exécutés avant les commits. | Ajouter husky + lint-staged |
| Q4 | Mineur | `package.json:28` | `db:schema` et `db:init` exécutent le même script (`db-init.ts`). Duplication de script npm. | Supprimer `db:schema` (alias redondant) |
| Q5 | Mineur | `package.json.backup` | Fichier de backup présent dans le repo (ne doit pas être versionné) | Ajouter `*.backup` dans `.gitignore` et supprimer |
| Q6 | Bien | `package.json:20` | Script `quality:check` qui enchaîne format, lint, typecheck, build, uuid:verify, tests | — |

### AXE 15 — Dépendances

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| DP1 | À vérifier | `package.json:68`, `package-lock.json` | `typeorm@1.1.1` existe bien et est réellement installé. `@nestjs/typeorm@11.0.3` accepte `^0.3.0 || ^1.0.0-dev`. En revanche, l'application semble utiliser directement `pg`, ce qui peut rendre les deux dépendances TypeORM inutiles. | Rechercher leurs usages réels. Si aucun usage n'existe, retirer `typeorm` et `@nestjs/typeorm`. Sinon conserver la version actuelle ou préparer une migration volontaire ; ne pas rétrograder automatiquement vers `0.3.x` |
| DP2 | Majeur | `package.json:36-37` | `@nestjs/bullmq` et `bullmq` sont en `dependencies` mais **aucun import de `@nestjs/bullmq`** n'a été trouvé dans le code source. Dépendances mortes qui alourdissent le bundle. | Vérifier et supprimer si inutilisées (réduction du cold start Vercel) |
| DP3 | Majeur | `package.json:43-44` | `@nestjs/platform-socket.io`, `@nestjs/websockets`, `@socket.io/redis-adapter`, `socket.io` sont des dépendances de production. Si les WebSockets sont désactivés sur Vercel, ces librairies alourdiront inutilement le bundle serverless. | Conditionner ou externaliser le bundle WebSocket |
| DP4 | Mineur | `package.json:50` | `@types/cookie-parser` dans `dependencies` au lieu de `devDependencies` | Déplacer dans `devDependencies` |
| DP5 | Mineur | `package.json:78` | `@types/js-yaml` dans `devDependencies` mais pas de `js-yaml` dans `dependencies` (il y est en dev) — vérifier la cohérence | Laisser en devDependencies si js-yaml n'est utilisé qu'en scripts |

### AXE 16 — Code mort

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| CD1 | Majeur | `package.json.backup` | Fichier de backup versionné | Supprimer et gitignore |
| CD2 | Mineur | `auth.service.ts:230-231` | `getCurrentUser` délègue uniquement à `me` — l'un des deux est superflu | Supprimer le wrapper |
| CD3 | Mineur | `modules/rbac/` | Dossier `entities/` présent mais vide hormis les entités elles-mêmes — pas de code mort mais structure à surveiller | — |

### AXE 17 — Lisibilité

| # | Gravité | Fichier(s) | Problème | Correctif proposé |
|---|---------|-----------|----------|-------------------|
| L1 | Majeur | `registrations.service.ts` (813 lignes) | Fonction `createRegistration` contient un bloc transactionnel de ~200 lignes avec 7 étapes numérotées. Complexité cyclomatique élevée. | Extraire chaque étape en méthode privée nommée (`_resolvePersonId`, `_validateSlot`, etc.) |
| L2 | Majeur | `queue-engine.service.ts` (552 lignes) | Même problème — mélange de logique métier haute et basse dans un seul service | Découper |
| L3 | Mineur | `auth.service.ts:187-227` | Constantes magiques de rang (`5`, `4`, `3`, `2`, `1`) sans nommage | `const ROOT_RANK = 5; const ADMIN_RANK = 4; ...` |
| L4 | Mineur | `daily-reset.worker.ts:24` | Chaîne `'Africa/Tunis'` en dur | Extraire constante `DEFAULT_TIMEZONE = 'Africa/Tunis'` dans le config |
| L5 | Mineur | `sites.repository.ts:74` | Longue liste de COALESCE en SQL (ligne de 200+ caractères) difficile à lire | Formater sur plusieurs lignes avec indentation |

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

| Couche | Responsabilités autorisées | Interdictions |
|--------|---------------------------|---------------|
| **Controller** | Routing HTTP, décorateurs Swagger, extraction de params/body/user, délégation au service | Logique métier, accès DB, appels multi-services |
| **Service** | Logique métier, orchestration, exceptions métier, transactions | Requêtes SQL directes, accès HTTP |
| **Repository** | Requêtes SQL/ORM, mappage DB→DTO interne | Logique métier, exceptions métier, import de services |
| **Core** | Infrastructure transversale | Logique métier spécifique à un module |

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
{ "code": "QUEUE_NOT_FOUND", "translationKey": "errors.queue_not_found", "translationParams": {}, "data": null }
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

1. **SL1/SL2/SL3** — Créer `vercel.json` avec les crons et désactiver `WorkersModule` + `RealtimeModule` + `ScheduleModule` lorsque la configuration validée indique Vercel. Éviter de disperser des lectures directes de `VERCEL`.
2. **SL1** — Créer quatre endpoints HTTP Cron (`daily-reset`, `appointment-expiry`, `notification-worker`, `queue-estimation`) protégés par `CRON_SECRET`, idempotents et munis d'un verrou distribué ou transactionnel, puis les déclarer dans `vercel.json`.
3. **CF1** — Corriger `redis.module.ts:29` : supprimer `process.env.SWAGGER_EXPORT` et utiliser `ConfigService`.
4. **DP1/DP2** — Auditer les usages de TypeORM et BullMQ. Retirer uniquement les dépendances réellement inutilisées ; ne pas remplacer automatiquement TypeORM 1.1.1 par 0.3.x.

**Risque :** Faible (ajout conditionnel, pas de changement de comportement en dev)
**Effort :** ~1 à 3 jours selon les contraintes d'idempotence, de verrouillage et de validation sur Vercel

---

### 🟠 Étape 2 — Fondations (risque : faible, effort : faible-moyen)

5. **E2** — Traiter `QUEUE_EMPTY` comme une réponse métier normale en 200, sans lever d'exception. Ne pas utiliser 204 si l'enveloppe JSON doit être conservée.
6. **T1** — Mesurer d'abord avec `npx tsc --noEmit --strict`, corriger les erreurs par lots, puis activer `"strict": true`. Évaluer séparément `noImplicitReturns` et `noUncheckedIndexedAccess`.
7. **T2/T4** — Corriger `transformKeysToCamel(data: any)` → `(data: unknown)` ; passer `no-explicit-any` en `warn`.
8. **Q2** — Ajouter les path aliases `@core/*`, `@modules/*` dans `tsconfig.json` + `tsconfig.build.json` + `jest` config.
9. **Q4/Q5** — Supprimer `package.json.backup`, `db:schema` redondant, déplacer `@types/cookie-parser` en devDependencies.
10. **DP2** — Vérifier et supprimer `@nestjs/bullmq`/`bullmq` si inutilisés.

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

- [ ] `npm run build` — ✅ zéro erreur
- [ ] `npm run lint` — ✅ zéro warning
- [ ] `npm run typecheck` — ✅ zéro erreur
- [ ] `npm test` — ✅ tous les tests verts
- [ ] Aucun `@Cron` actif dans le bundle serverless Vercel
- [ ] `WorkersModule` et `RealtimeModule` exclus quand `VERCEL=true`
- [ ] `vercel.json` présent avec `maxDuration`, `regions`, `crons`
- [ ] Zéro `SELECT *` sur `dori_user` (colonnes sensibles)
- [ ] Zéro `process.env` hors `configuration.ts` et `configuration.spec.ts`
- [ ] Usage de `typeorm` / `@nestjs/typeorm` justifié et testé, ou dépendances supprimées ; aucune rétrogradation automatique de 1.x vers 0.3.x
- [ ] `@nestjs/bullmq`/`bullmq` retirés ou justifiés
- [ ] `strict: true` activé dans `tsconfig.json`
- [ ] Zéro `any` injustifié dans les fichiers de production (hors tests)
- [ ] Path aliases configurés et utilisés
- [ ] `package.json.backup` supprimé
- [ ] `QUEUE_EMPTY` traité sans exception 200
- [ ] Swagger à jour (exporté via `npm run swagger:export`)
- [ ] README à jour avec variables d'env, endpoints cron, architecture
- [ ] Déploiement Vercel vérifié (preview branch)

---

*⚠️ PHASE 4 en attente de validation. Le présent document a été corrigé après vérification du dépôt ; aucune modification applicative n'a été appliquée.*
