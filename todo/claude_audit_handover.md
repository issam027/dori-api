# Audit Dorify : Handover

- Date de l'audit : 2026-10-19
- Périmètre analysé : 239 fichiers sur 239 fichiers du dépôt hors dépendances et artefacts (`node_modules/`, `dist/`, `.quality-dist/`, `coverage/`). Les 201 fichiers TypeScript de `src/`, `test/` et `scripts/` ont été inventoriés; recherches transverses sur tout `src/`; lecture ciblée des fichiers de sécurité, configuration, architecture et des fichiers les plus volumineux. Les artefacts OpenAPI ont été comptés mais non relus ligne à ligne car générés.

\- Stack détectée : Node.js, TypeScript, NestJS 10, TypeORM/PostgreSQL, BullMQ/Redis, Socket.IO, Passport/JWT, class-validator/class-transformer, Jest/Supertest, ESLint 8 et Prettier 3. Aucun framework UI ni gestionnaire d'état client dans ce dépôt. - Commandes exécutées et résultats bruts (lint, typecheck, build, tests) : \`npm run format:check\` : succès, tous les fichiers correspondent à Prettier; \`npm run lint\` : succès, 0 erreur/0 avertissement; \`npm run typecheck\` : succès, 0 erreur; \`npm run build:check\` : succès; \`npm test -- --runInBand --coverage=false\` : 51 suites/51 réussies, 264 tests/264 réussis, mais Jest signale un worker forcé à quitter; \`npm audit --omit=dev --audit-level=none\` : 17 vulnérabilités de production (1 faible, 11 modérées, 5 hautes); audit complet : 65 vulnérabilités (4 faibles, 20 modérées, 40 hautes, 1 critique).

## 1. Synthèse exécutive

L'API est structurée par domaines, possède des contrôles globaux solides et réutilise réellement plusieurs briques transverses. Elle compile, se formate et passe 264 tests. Les risques prioritaires sont les dépendances vulnérables de production, l'absence de CI visible, la couverture e2e quasi nulle et plusieurs classes monolithiques. Notes : Réutilisation **7,8/10**, Architecture **7/10**, Qualité **7/10**, Sécurité **6/10**, Accessibilité **NON VÉRIFIÉE**, Performance **6,5/10**, Tests **7/10**.

**Score de réutilisation estimé : 78 %.** Méthode reproductible : 7 préoccupations récurrentes effectivement centralisées et utilisées par plusieurs modules (pagination, horloge, scope, erreurs, réponses Swagger, booléens stricts, utilisateur courant) sur 9 préoccupations serveur inspectées; les deux échecs sont le typage des lignes SQL et la journalisation d'authentification. Comptages par fichiers : `PaginationDto` 23, `ClockService` 35, `ScopeService` 24, `DoriException` 28, `ApiDoriErrorResponses` 11, `strictBoolean` 7, `CurrentUser` 12.

Top 10 des actions prioritaires :

 1. Mettre à niveau les dépendances de production vulnérables avec tests de non-régression.
 2. Ajouter une CI imposant `quality:check`, audit de dépendances et e2e.
 3. Diagnostiquer le handle Jest non fermé.
 4. Ajouter des e2e d'authentification, RBAC, isolation de scope et parcours d'inscription.
 5. Découper `RegistrationsService`, `QueueEngineService` et les gros repositories.
 6. Remplacer les `any` de production par des types `unknown`/interfaces.
 7. Remplacer les `console.error` du guard JWT par le logger structuré sans détails exploitables.
 8. Ajouter une politique RGPD testée : export, anonymisation/suppression et rétention.
 9. Rendre les migrations réversibles ou documenter/tester une procédure de rollback.
10. Supprimer `package.json.backup` ou justifier et automatiser sa synchronisation.

## 2. Tableau de suivi des constats

| ID | Domaine | Sévérité | Constat | Fichiers:lignes | Action recommandée | Effort (S/M/L) | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SEC-01 | Sécurité | 🔴 Critique | L'arbre de production contient 17 vulnérabilités, dont 5 hautes (`js-yaml`, `lodash`, `multer`, `picomatch` et chaînes Nest). | `package.json:27-52`, `package-lock.json:1` | Planifier les montées de versions Nest et transitives, valider par tests puis bloquer les nouvelles alertes en CI. | L | \[ \] À faire |
| TST-01 | Tests | 🟠 Majeur | Le seul e2e ne vérifie que l'absence d'une route racine; aucun parcours métier/autorisation complet. | `test/app.e2e-spec.ts:6-24` | Ajouter une matrice e2e auth/RBAC/scope/inscription/file/notifications sur PostgreSQL isolé. | L | \[ \] À faire |
| OPS-01 | Outillage | 🟠 Majeur | Aucun workflow CI ni hook pre-commit n'est présent à la racine. | `package.json:7-23` | Ajouter CI et hook exécutant au minimum format, lint, typecheck, build et tests. | M | \[ \] À faire |
| ARC-01 | Architecture | 🟠 Majeur | Plusieurs classes cumulent orchestration métier et branches nombreuses : 716, 551 et 461 lignes. | `src/modules/registrations/registrations.service.ts:32-716`, `src/modules/queue-engine/queue-engine.service.ts:19-551`, `src/modules/service-tiers/service-tiers.service.ts:25-461` | Extraire des cas d'usage cohésifs et conserver les transactions dans les repositories. | L | \[ \] À faire |
| ARC-02 | Architecture | 🟡 Mineur | Plusieurs repositories SQL sont monolithiques : 564, 527, 493 et 485 lignes. | `src/modules/registrations/registrations.repository.ts:26-564`, `src/modules/users/users.repository.ts:41-527`, `src/modules/queue-engine/queue-engine.repository.ts:64-493`, `src/modules/queues/queues.repository.ts:21-485` | Scinder par agrégat/cas d'usage et mutualiser les fragments sûrs de pagination/tri. | L | \[ \] À faire |
| QUA-01 | Qualité | 🟡 Mineur | Des `any` subsistent dans le code de production et la règle ESLint correspondante est désactivée. | `.eslintrc.js:17`, `src/core/auth/guards/jwt-auth.guard.ts:24`, `src/core/serialization/serialization.interceptor.ts:27-38`, `src/modules/users/users.repository.ts:91-137` | Activer progressivement `no-explicit-any`, typer les lignes SQL et utiliser `unknown` dans les catch. | M | \[ \] À faire |
| SEC-02 | Sécurité | 🟡 Mineur | Le guard JWT écrit directement des détails d'erreur et de stratégie sur stderr. | `src/core/auth/guards/jwt-auth.guard.ts:24-41` | Employer `Logger`, corréler la requête, réduire les détails et tester l'absence de secrets/PII. | S | \[ \] À faire |
| TST-02 | Tests | 🟡 Mineur | Les tests passent mais Jest force la sortie d'un worker, signe d'un timer/handle non libéré. | `src/workers/appointment-expiry/appointment-expiry.worker.ts:7-36`, `src/workers/notification-worker/notification.worker.ts:9-69` | Exécuter avec `--detectOpenHandles`, corriger le teardown des workers/schedulers. | M | \[ \] À faire |
| DB-01 | Maintenabilité | 🟠 Majeur | Les migrations SQL sont uniquement ascendantes; aucune migration inverse/procédure de rollback n'est fournie. | `src/core/database/migration-runner.ts:19-55`, `src/core/database/sql/migrations/010_force_logout_revocation_reason.sql:1-6` | Introduire des migrations up/down ou un runbook de restauration testé avant production. | M | \[ \] À faire |
| PRI-01 | Données personnelles | 🟠 Majeur | Aucun mécanisme explicite d'export, anonymisation, consentement ou rétention des personnes n'a été trouvé. | `src/modules/persons/persons.controller.ts:48-220`, `src/modules/persons/persons.repository.ts:39-288` | Définir et implémenter les droits RGPD, la rétention et un journal d'audit. | L | \[ \] À faire |
| CFG-01 | Configuration | 🔵 Amélioration | Un manifeste de dépendances de sauvegarde est suivi, avec risque de dérive. | `package.json.backup:1`, `package.json:1` | Supprimer ce doublon ou documenter sa génération et vérifier sa synchronisation. | S | \[ \] À faire |
| DOC-01 | Documentation | 🟡 Mineur | Le README ne contient qu'un titre et n'explique ni installation, environnement, migrations ni validation. | `README.md:1` | Documenter bootstrap, variables, DB/Redis, migrations, scripts qualité et déploiement. | M | \[ \] À faire |
| PERF-01 | Performance | 🔵 Amélioration | Le cache de scope est local au processus et limité à 30 s; en multi-instance, invalidation non distribuée. | `src/core/rbac/services/scope.service.ts:14-18`, `src/core/rbac/services/scope.service.ts:91-97` | Utiliser Redis/versionnement d'autorisation ou documenter la fenêtre de cohérence acceptée. | M | \[ \] À faire |

Sévérités : 🔴 Critique / 🟠 Majeur / 🟡 Mineur / 🔵 Amélioration\
Statut initial pour tous : `[ ] À faire`

## 3. Détail par domaine

### 3.0 Cartographie

- `src/core/` : authentification, RBAC, configuration, BDD, erreurs, HTTP, monitoring, temps réel, sérialisation et validation.
- `src/modules/` : 12 domaines fonctionnels (`auth`, `notifications`, `persons`, `queue-engine`, `queues`, `rbac`, `registrations`, `reports`, `service-tiers`, `sites`, `translations`, `users`).
- `src/workers/` : tâches asynchrones; `scripts/` : DB et Swagger; `test/` : e2e; tests unitaires colocalisés dans `src/`.
- 201 fichiers TypeScript, 197 sous `src/`, 52 fichiers de tests, 11 contrôleurs, 17 services, 18 repositories et 21 entités.
- TypeScript active `strictNullChecks`, `noImplicitAny`, `strictBindCallApply` et `noFallthroughCasesInSwitch` (`tsconfig.json:12-16`). ESLint étend TypeScript recommandé et Prettier (`.eslintrc.js:8-11`). Prettier fixe quotes simples, virgules finales et LF (`.prettierrc:1-5`).

### 3.1 Réutilisation des composants

1. **Inventaire partagé.** Les principales briques et leurs usages par fichiers sont : `PaginationDto` (23; définition `src/core/pagination/pagination.dto.ts:28-114`), `ClockService` (35; `src/core/clock/clock.service.ts:9-33`), `ScopeService` (24; `src/core/rbac/services/scope.service.ts:13-97`), `DoriException` (28; `src/core/errors/dori.exception.ts:4-51`), `ApiDoriErrorResponses` (11; `src/core/swagger/api-dori-response.decorator.ts:83-169`), `strictBoolean` (7; `src/core/validation/strict-boolean.transformer.ts:1-9`), `CurrentUser` (12; `src/core/auth/decorators/current-user.decorator.ts:4-11`) et `RequirePermission` (11; `src/core/rbac/decorators/require-permission.decorator.ts:7-16`). Ce sont des usages réels, pas des composants orphelins.
2. **Duplication exacte/quasi-duplication.** Les lignes de réponses paginées (`page`, `pageSize`, `total`, `items`) sont répétées dans plusieurs DTO, mais héritent déjà majoritairement de `PaginatedResponseDto` (`src/core/pagination/pagination.dto.ts:124-139`, `src/modules/persons/dto/person-response.dto.ts:55-66`, `src/modules/users/dto/user-response.dto.ts:52-63`). Le reliquat à réduire concerne surtout les types de lignes SQL `Record<string, unknown>` répétés dans les repositories (`src/modules/persons/persons.repository.ts:9-17`, `src/modules/reports/reports.repository.ts:13-34`). Proposition : helpers génériques de lignes/scalars SQL plutôt qu'un composant UI inexistant.
3. **Partagés contournés.** `JwtAuthGuard` utilise `console.error` (`src/core/auth/guards/jwt-auth.guard.ts:28-34`) alors que les autres couches utilisent `Logger` (`src/core/errors/global-exception.filter.ts:15-16,73`). C'est le contournement partagé concret trouvé.
4. **Partagés utilisés une fois/trop spécifiques.** `PositiveIdParamPipe` n'a qu'un consommateur applicatif direct global dans `src/main.ts:73`, ce qui est approprié à sa portée globale; aucun partagé manifestement artificiel n'a été démontré. Les décorateurs métier de validation restent ciblés mais regroupés (`src/core/validation/domain-validation.decorators.ts:26-70`).
5. **Styles/design tokens.** NON APPLICABLE/NON VÉRIFIÉ : aucune UI, CSS, Tailwind, JSX ou HTML applicatif dans ce dépôt. Le Swagger charge des CDN et CSS/JS dans `src/main.ts:82-98`, mais ce n'est pas le design system produit.
6. **Duplication de logique.** La pagination, l'heure, le scope, les booléens et les erreurs sont centralisés. Les conversions camelCase sont centralisées dans `src/core/serialization/serialization.interceptor.ts:27-126`. Écart : le typage faible des retours SQL conduit à des casts/maps locaux (`src/modules/users/users.repository.ts:91,451,471`).
7. **Duplication de types/schémas.** Les DTO de pagination réutilisent une base; les types de rows SQL sont redéclarés par repository, ce qui respecte parfois le domaine mais duplique `Record<string, unknown>`. Aucun schéma de validation identique complet dupliqué n'a été prouvé.
8. **Textes/constantes.** Les erreurs sont centralisées dans `src/core/errors/error-catalog.ts:5-259`; les limites de date le sont dans `src/core/dates/date-range.dto.ts:9-13`. Restent des valeurs d'infrastructure en dur, notamment TTL du cache de scope (`src/core/rbac/services/scope.service.ts:18`) et URLs locales par défaut (`src/core/config/configuration.ts:133-134,187`). Elles sont documentables/configurables plutôt que des tokens UI.
9. **Granularité.** Les trois services signalés ARC-01 dépassent 300 lignes et les repositories ARC-02 dépassent 480 lignes. Les contrôleurs restent séparés des repositories, mais ces tailles augmentent le coût de changement.

### 3.2 Normes de code et architecture

- Séparation cohérente contrôleur/service/repository/DTO/entity. Les transactions sont concentrées dans les repositories, par exemple auth (`src/modules/auth/auth.repository.ts:94,267`) et registrations (`src/modules/registrations/registrations.repository.ts:291-295`).
- Les imports profonds existent dans les DTO (`src/modules/users/dto/user.dto.ts:18`), mais ils suivent la profondeur de l'arborescence; aucun cycle n'a été établi. Dépendances circulaires : NON VÉRIFIÉES par outil spécialisé.
- Les tris SQL interpolés sont alimentés par des champs validés/allowlistés dans les services, exemple `src/modules/queues/queues.service.ts:320-328` avant `src/modules/queues/queues.repository.ts:140`; aucune injection démontrée.
- Lisibilité : format, lint, typecheck et build réussissent. Les classes longues ARC-01/02 demeurent la principale dette.
- Typage : options strictes partielles actives, mais `strict: true` global n'est pas déclaré et `no-explicit-any` est désactivé (`tsconfig.json:12-16`, `.eslintrc.js:17`).
- Configuration : validation du secret JWT (32 caractères ou paire RSA) et des bornes numériques dans `src/core/config/configuration.ts:13-67`; `.env` n'est pas suivi, `.env.example` l'est.
- Outillage : scripts complets dans `package.json:7-23`, mais aucun `.github/workflows` ni `.husky` racine.

### 3.3 Sécurité SaaS

- Auth/RBAC globaux : `JwtAuthGuard`, `PermissionsGuard` et `ThrottlerGuard` sont enregistrés globalement (`src/app.module.ts:73-87`). Les contrôleurs déclarent des permissions, par exemple sites (`src/modules/sites/sites.controller.ts:53-173`) et personnes (`src/modules/persons/persons.controller.ts:53-211`).
- Isolation : `ScopeService` calcule les sites/files par utilisateur et rejette hors scope avec 404 (`src/core/rbac/services/scope.service.ts:20-88`). Les mutations d'affectation invalident le cache (`src/modules/sites/sites.service.ts:138-149`, `src/modules/queues/queues.service.ts:375-391`).
- Entrées : pipe global avec whitelist, rejet des propriétés inconnues et transformation explicite (`src/main.ts:71-81`). Les requêtes SQL observées paramètrent les valeurs; les fragments de tri sont allowlistés côté service.
- Sessions : refresh token hashé SHA-256 (`src/modules/auth/auth.service.ts:25-27`), cookie `HttpOnly`, `Secure` en production et `SameSite=Strict` (`src/modules/auth/auth.controller.ts:44-51`).
- Défense HTTP : Helmet et CORS sur allowlist avec credentials (`src/main.ts:32-69`), throttling global (`src/app.module.ts:26-48,83-87`).
- Risques : SEC-01, SEC-02, PRI-01. Upload/SSRF : aucun endpoint d'upload ni client HTTP sortant n'a été trouvé; la présence transitive de Multer reste à corriger à cause des avis DoS.
- Secrets exposés : aucun secret suivi trouvé; `.env` n'est pas dans `git ls-files`. L'historique Git complet n'a pas été scanné : NON VÉRIFIÉ.

### 3.4 Accessibilité, UX technique et performance

- Accessibilité, responsive, loaders, états vides, contraste, labels, ARIA, images, lazy loading UI et bundle client : NON VÉRIFIÉS/NON APPLICABLES à ce dépôt API.
- Pagination réutilisée sur les listes via `PaginationDto` (`src/core/pagination/pagination.dto.ts:28-114`).
- Cache de scope de 30 secondes (`src/core/rbac/services/scope.service.ts:14-18`) : performant en mono-instance, mais cohérence inter-instance à traiter (PERF-01).
- Index de monitoring dédiés présents dans `src/core/database/sql/migrations/009_monitoring_indexes.sql:1-14`.
- N+1 : aucune mesure/profil SQL n'a été exécuté; NON VÉRIFIÉ en conditions réelles. Les repositories utilisent beaucoup de SQL agrégé, mais cela ne suffit pas à conclure.

### 3.5 Tests et maintenabilité

- 51 suites et 264 tests unitaires réussis couvrent repositories, services, guards, validation, workers, sérialisation et Swagger.
- Une seule suite e2e, limitée à la racine (`test/app.e2e-spec.ts:6-24`) : TST-01.
- Couverture chiffrée : NON VÉRIFIÉE, car la mission demandait les commandes qualité et le test a été exécuté avec `--coverage=false`; `test:cov` existe (`package.json:17`).
- Paiement/facturation : NON APPLICABLE, aucun module correspondant. Auth et droits ont des tests unitaires (`src/modules/auth/auth.service.spec.ts:1`, `src/core/rbac/guards/permissions.guard.spec.ts:1`), mais pas de bout-en-bout.
- Documentation insuffisante : DOC-01. Swagger est centralisé et exportable (`src/core/swagger/openapi.config.ts:7-65`, `package.json:23`).
- Migrations ordonnées 001 à 010 et runner transactionnel (`src/core/database/migration-runner.ts:19-55`), mais sans rollback : DB-01.

## 4. Points conformes (avec preuve)

- Validation globale stricte des DTO : `src/main.ts:71-81`.
- Authentification, permissions et limitation de débit globales : `src/app.module.ts:73-87`.
- Isolation de périmètre centralisée et refus hors scope : `src/core/rbac/services/scope.service.ts:20-88`.
- Cookies de refresh durcis et rotation documentée : `src/modules/auth/auth.controller.ts:44-51,101-137`.
- Secrets JWT et configuration numérique validés au démarrage : `src/core/config/configuration.ts:13-67`.
- Erreurs métier et réponses OpenAPI centralisées : `src/core/errors/error-catalog.ts:5-259`, `src/core/swagger/api-dori-response.decorator.ts:83-320`.
- Réutilisation réelle de la pagination, horloge et scope : définitions `src/core/pagination/pagination.dto.ts:28`, `src/core/clock/clock.service.ts:9`, `src/core/rbac/services/scope.service.ts:13`; respectivement 23, 35 et 24 fichiers utilisateurs.
- Qualité statique entièrement verte lors de l'audit; 264/264 tests réussis.
- SQL majoritairement paramétré et transactions présentes sur les écritures multi-étapes, exemple `src/modules/auth/auth.repository.ts:94-181`.

## 5. Points NON VÉRIFIÉS et raisons

- UI, composants visuels, accessibilité, responsive et état client : dépôt serveur uniquement.
- Couverture en pourcentage : commande de couverture non exécutée; les 264 tests ont été exécutés sans couverture.
- Dépendances circulaires : aucun analyseur de graphe dédié configuré.
- Performance/N+1 sous charge : absence de base et de scénario de charge contrôlés dans la mission.
- Contrastes et design tokens : aucune source CSS/JSX produit.
- Secrets dans tout l'historique Git : seul l'état courant suivi a été inspecté.
- Déploiement réel, configuration cloud, sauvegardes et restauration : aucune configuration d'infrastructure suivie.
- Conformité RGPD juridique complète : nécessite politiques organisationnelles et avis juridique; seul le code a été recherché.

## 6. Plan de remédiation

- **Lot 1 — bloquant/sécurité** : SEC-01, SEC-02, PRI-01. Ordre : inventaire des chemins exploitables, upgrade progressif Nest/transitifs, tests, logging sûr, spécification RGPD. Dépendance : environnement de recette. Risques : breaking changes Nest et contrats OpenAPI.
- **Lot 2 — réutilisation à fort impact** : ARC-01, ARC-02, QUA-01. Commencer par extraire des interfaces de rows et cas d'usage sans modifier les contrats publics. Dépendance : renforcer tests caractérisation. Risque : frontières transactionnelles.
- **Lot 3 — dette technique** : TST-01, TST-02, DB-01, OPS-01. Corriger le handle, créer DB de test, e2e, rollback, puis CI. Risque : tests plus longs/flaky; isoler temps et services externes.
- **Lot 4 — confort** : DOC-01, CFG-01, PERF-01. Documenter, nettoyer le manifeste dupliqué, distribuer l'invalidation de scope. Risque faible sauf changement de cache multi-instance.

## 7. Instructions de handover pour l'IA suivante

- Reprendre dans l'ordre Lot 1 → Lot 4. Avant chaque lot : branche dédiée, tests de caractérisation, état Git propre. Un commit par ID ou groupe atomique.
- Validation minimale : `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build:check`, `npm test -- --runInBand --coverage=false`; pour les e2e : `npm run test:e2e`; après dépendances : `npm audit --omit=dev`.
- Ne pas casser les enveloppes de réponse, le Swagger exporté, les permissions, la sémantique 404 hors scope ni les formats snake_case/camelCase existants.
- Définition de terminé Lot 1 : aucune vulnérabilité haute/critique de production acceptée sans justification datée; logs sans secrets/PII; exigences RGPD documentées et testées. Lot 2 : classes ciblées sous responsabilité unique, aucun nouvel `any`, mêmes contrats/tests verts. Lot 3 : e2e critiques verts en CI, aucun handle Jest ouvert, rollback testé. Lot 4 : README exploitable, aucun manifeste ambigu, stratégie de cache documentée/testée.
- Mettre ce fichier à jour en cochant `[x] Terminé`, dater chaque décision, ajouter le commit et conserver les preuves `fichier:ligne`; ne supprimer un constat qu'avec justification dans le journal.

## 8. Journal des mises à jour

| Date | Auteur | Modification |
| --- | --- | --- |
| 2026-10-19 | Codex | Audit initial complet, résultats qualité, constats, preuves et plan de remédiation. |

<!-- GATE
  id="gate-mvfspy83-yo7xcx"
  type="merge"
  status="blocked"
  blockedBy=""
  canProceedIf=""
  doneDefinition="All review annotations resolved"
-->

<!-- CHECKPOINT id="ckpt_mvfspy7e_kokv7h" time="2026-10-19T21:58:15.146Z" note="auto" fixes=0 questions=1 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvfsv3kg_terev7" time="2026-10-19T22:02:15.376Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvft7yj7_zy3f8x" time="2026-10-19T22:12:15.379Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvftkthy_6829bz" time="2026-10-19T22:22:15.382Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
