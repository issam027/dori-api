# Rapport Final — Points d'Audit Non Traités

> Généré le 2026-10-25 | Vérification directe du code source dori-api  
> Périmètre : tous les fichiers `/todo/*.md` croisés avec l'état réel du dépôt

---

## Méthode de vérification

Chaque point des audits (`audit_rapport_dori_api.md`, `audit_complet_technique_architecture_fonctionnel.md`, `claude_audit_handover.md`, `handover_estimatedtime.md`, `handover_to_guid.md`) a été croisé avec :

- l'existence réelle des fichiers de tests (`.spec.ts`)
- la présence des patterns de code attendus (grep sur sources)
- la structure des répertoires et fichiers de configuration
- les sorties de `npm audit` et `npm test:cov`

---

## Résultats globaux vérifiés

| Métrique | Valeur observée | Seuil attendu | Statut |
|---|---|---|---|
| Couverture statements | 70 % | ≥ 50 % (seuil P1) | ⚠️ Seuil non configuré |
| Couverture branches | 39,95 % | ≥ 50 % (seuil P1) | ❌ Insuffisant |
| Couverture fonctions | 44,54 % | ≥ 50 % (seuil P1) | ❌ Insuffisant |
| Vulnérabilités prod | 17 (6 hautes) | 0 haute | ❌ Non corrigé |
| CI/CD | Absent | Obligatoire | ❌ Manquant |
| Tests E2E métier | 3 tests (racine + health + search_path) | Parcours complets | ❌ Insuffisant |
| `RealtimeGateway` spec | Absent | Requis | ❌ Manquant |
| `ScopeService` spec Redis | Absent | Requis | ❌ Manquant |
| `GlobalExceptionFilter` spec | Absent | Requis | ❌ Manquant |
| `MigrationRunner` spec | Absent | Requis | ❌ Manquant |

---

## POINT 1 — SEC-01 : Vulnérabilités de dépendances de production

**Source :** `audit_complet_technique_architecture_fonctionnel.md` §6, `claude_audit_handover.md` §2  
**Priorité :** P0 — Bloquant avant pilote/production  
**État réel dans le code :** ❌ **Non traité**

### Constat

`npm audit --omit=dev` retourne **17 vulnérabilités (11 modérées, 6 hautes)** dont :
- `lodash` — Prototype Pollution dans `_.unset` et `_.omit` (`GHSA-xxjr-mmjv-4gpg`)
- `picomatch` — ReDoS via extglob quantifiers (`GHSA-c2c7-rcm5-vvqj`)
- Chaînes transitives Nest/Express (`multer`, `js-yaml`, `qs`, etc.)

### Instructions de réalisation

1. **Inventorier les chemins d'exploitation :**
   ```bash
   npm audit --omit=dev --json > audit-report.json
   ```
   Pour chaque vulnérabilité haute : identifier le chemin de dépendance, évaluer l'exploitabilité réelle dans le contexte de l'API (ex. : `multer` — l'API a-t-elle des endpoints d'upload ?).

2. **Plan de mise à niveau :**
   - Mettre à niveau `@nestjs/*` en famille cohérente (vérifier le changelog Nest 10.x → latest)
   - Mettre à niveau `lodash` → `4.17.21+` ou supprimer si remplaçable par des helpers natifs
   - Mettre à niveau `picomatch` via son parent (`fast-glob`, `chokidar`, etc.)
   - Mettre à niveau `multer`, `js-yaml`, `qs` via leurs parents transitifs

3. **Rejouer les gates après chaque lot :**
   ```bash
   npm run format:check && npm run lint && npm run typecheck && npm run build:check && npm test -- --runInBand --coverage=false
   ```

4. **Ajouter l'audit CI :**  
   Dans le futur workflow CI (voir POINT 2), ajouter :
   ```yaml
   - name: Audit dependencies
     run: npm audit --omit=dev --audit-level=high
   ```
   Avec une politique d'exception datée et motivée pour les vulnérabilités non corrigeables.

5. **Checkpoint :** `npm audit --omit=dev` retourne code 0 ou une liste d'exceptions documentées avec échéance et mitigation.

---

## POINT 2 — OPS-01 : Absence de CI obligatoire

**Source :** `audit_complet_technique_architecture_fonctionnel.md` §9 + §10, `claude_audit_handover.md` §2  
**Priorité :** P0 — Bloquant avant pilote/production  
**État réel dans le code :** ❌ **Non traité** — aucun dossier `.github/` n'existe dans le dépôt

### Constat

- Pas de workflow GitHub Actions (ni `.github/workflows/`)
- Pas de hook pre-commit actif (`.husky/pre-commit` peut exister mais n'est pas actif sans `npm install` dans un environnement Git)
- Aucun seuil de couverture configuré dans `package.json` (`coverageThreshold` absent)

### Instructions de réalisation

1. **Créer le dossier et le workflow CI minimal :**
   ```
   mkdir .github/workflows
   ```
   Créer `.github/workflows/ci.yml` :
   ```yaml
   name: CI
   on:
     push:
       branches: [main, develop]
     pull_request:
       branches: [main, develop]

   jobs:
     quality:
       runs-on: ubuntu-latest
       services:
         postgres:
           image: postgres:16
           env:
             POSTGRES_USER: dori
             POSTGRES_PASSWORD: dori
             POSTGRES_DB: dori_test
           options: >-
             --health-cmd pg_isready
             --health-interval 10s
             --health-timeout 5s
             --health-retries 5
         redis:
           image: redis:7
           options: >-
             --health-cmd "redis-cli ping"
             --health-interval 10s
             --health-timeout 5s
             --health-retries 5

       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: '20'
             cache: 'npm'
         - run: npm ci
         - run: npm run format:check
         - run: npm run lint
         - run: npm run typecheck
         - run: npm run build:check
         - run: npm run uuid:verify
         - run: npm test -- --runInBand --coverage=false
         - run: npm audit --omit=dev --audit-level=high
         - name: E2E tests
           run: npm run test:e2e
           env:
             DATABASE_URL: postgres://dori:dori@localhost:5432/dori_test
             REDIS_URL: redis://localhost:6379
   ```

2. **Protéger la branche `main` :**  
   Dans GitHub → Settings → Branches → Branch protection rules : activer "Require status checks to pass before merging" et sélectionner le job `quality`.

3. **Vérifier que Husky est actif :**
   ```bash
   npm install
   git add -A && git commit -m "test: vérifie pre-commit"
   ```
   S'assurer que lint-staged s'exécute sur les fichiers indexés.

4. **Ajouter les seuils de couverture dans `package.json` :**
   ```json
   "jest": {
     "coverageThreshold": {
       "global": {
         "statements": 50,
         "branches": 40,
         "functions": 45,
         "lines": 50
       }
     }
   }
   ```
   Ces seuils correspondent à l'étape P1 (seuil progressif). Les augmenter à 65/60 après TST-02.

5. **Checkpoint :** une PR introduisant un `console.log` dans un service est refusée par le lint ; une PR réduisant la couverture sous le seuil est refusée par Jest.

---

## POINT 3 — TST-01 : Absence de tests E2E sur parcours métier réels

**Source :** `audit_complet_technique_architecture_fonctionnel.md` §10 P0, `claude_audit_handover.md` §2  
**Priorité :** P0 — Bloquant avant pilote/production  
**État réel dans le code :** ❌ **Non traité** — `test/app.e2e-spec.ts` ne contient que 3 tests (route racine 404, health public, et validation du `search_path` PostgreSQL). **Aucun parcours authentification, RBAC, scope, inscription, session ni webhook n'est testé de bout en bout.**

### Constat

```
# Fichier actuel : test/app.e2e-spec.ts
it('does not expose a root route')
it('exposes the public health endpoint without infrastructure details')
it('resolves qualified application SQL to dorify even with a hostile search_path')
```

Parcours manquants selon les audits :
- Auth : login / refresh / rejeu d'un refresh révoqué / logout / changement de mot de passe
- RBAC : opération autorisée et refusée pour chaque rôle
- Scope : isolation entre deux sites et deux files distinctes
- Inscription : création → session opérateur → appel → servi/no-show
- Rendez-vous : création → report → check-in → expiration
- Tracking public : sans fuite de PII
- Webhook : signature valide / invalide / timestamp expiré / doublon

### Instructions de réalisation

1. **Rendre l'environnement E2E hermétique :**
   - Créer `test/helpers/db.helper.ts` : fonction `resetTestDb()` qui tronque les tables applicatives (dans l'ordre FK inverse) et réinjecte le seed minimal
   - S'appuyer sur `npm run db:reset` ou une variante en mémoire

2. **Créer les suites E2E par domaine :**
   ```
   test/
   ├── auth.e2e-spec.ts
   ├── rbac.e2e-spec.ts
   ├── scope-isolation.e2e-spec.ts
   ├── registration-flow.e2e-spec.ts
   ├── appointment-flow.e2e-spec.ts
   ├── public-tracking.e2e-spec.ts
   └── webhook.e2e-spec.ts
   ```

3. **Modèle de suite E2E (auth) :**
   ```typescript
   // test/auth.e2e-spec.ts
   describe('Auth E2E', () => {
     it('POST /api/v1/auth/login retourne access + refresh tokens valides')
     it('POST /api/v1/auth/refresh renouvelle les tokens avec cookie valide')
     it('POST /api/v1/auth/refresh avec token révoqué retourne 401')
     it('POST /api/v1/auth/logout révoque la session et invalide le refresh')
     it('POST /api/v1/auth/change-password change le mot de passe et révoque toutes les sessions')
   })
   ```

4. **Suite isolation de scope :**
   ```typescript
   // test/scope-isolation.e2e-spec.ts
   describe('Scope isolation', () => {
     it('un opérateur du site A ne peut pas lire la file du site B (→ 404)')
     it('un opérateur du site A ne peut pas créer une inscription dans la file du site B (→ 404)')
   })
   ```

5. **Variables d'environnement E2E :**
   Créer `.env.test` ou utiliser les variables injectées par la CI :
   ```
   DATABASE_URL=postgres://dori:dori@localhost:5432/dori_test
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=test-secret-32-chars-minimum-here
   CRON_SECRET=test-cron-secret
   ```

6. **Checkpoint :** les suites tournent en CI sur PostgreSQL et Redis réels, sans dépendances de l'environnement de développement.

---

## POINT 4 — TST-02 : Couverture insuffisante sur les composants critiques

**Source :** `audit_complet_technique_architecture_fonctionnel.md` §7 + §10 P1  
**Priorité :** P1 — À faire avant généralisation  
**État réel dans le code :** ❌ **Non traité**

### Constat

Fichiers critiques **sans spec** identifiés :
- `src/core/realtime/realtime.gateway.ts` — 0 % de couverture, aucun spec
- `src/core/rbac/services/scope.service.ts` — spec présent MAIS **sans tests Redis** (Redis désactivé/mock dans les tests existants)
- `src/core/errors/global-exception.filter.ts` — aucun spec
- `src/core/database/migration-runner.ts` — aucun spec
- `src/core/http/correlation-id.interceptor.ts` — aucun spec
- `src/core/response/response.interceptor.ts` — aucun spec
- Aucun spec de contrôleur pour : `auth`, `sites`, `persons`, `registrations`, `notifications`, `service-tiers`, `translations`, `users`
- Couverture branches globale : **39,95 %** (objectif P1 : ≥ 60 %)
- Aucun `coverageThreshold` configuré → une baisse ne casse pas la CI

### Instructions de réalisation

#### 4.1 `RealtimeGateway` spec

Créer `src/core/realtime/realtime.gateway.spec.ts` :
```typescript
describe('RealtimeGateway', () => {
  it('refuser une connexion WebSocket sans token JWT valide')
  it('accepter une connexion WebSocket avec un JWT valide et créer la room registration:<uuid>')
  it('accepter une connexion avec un tracking token et créer la room registration:<uuid>')
  it('rejeter l'abonnement à une queue room si l'utilisateur n'a pas le scope requis')
  it('émettre un événement registration:update dans la room appropriée')
  it('retirer l'utilisateur des rooms à la déconnexion')
})
```
Utiliser `@nestjs/platform-socket.io` avec un serveur de test en mémoire, ou mocker `Server` de Socket.IO.

#### 4.2 `ScopeService` spec Redis

Enrichir le spec existant (`scope.service.spec.ts`) avec :
```typescript
describe('ScopeService avec Redis disponible', () => {
  it('met en cache le scope dans Redis au premier appel')
  it('lit le scope depuis Redis au second appel (sans requête DB)')
  it('invalide le cache Redis lors de l'appel à invalidateScope(userId)')
})
describe('ScopeService avec Redis indisponible', () => {
  it('retombe sur la DB si Redis est down (mode dégradé)')
  it('ne lance pas d'exception si Redis échoue')
})
```
Injecter un mock Redis avec `ioredis-mock` ou un spy Jest sur `redis.get`/`redis.set`.

#### 4.3 `GlobalExceptionFilter` spec

Créer `src/core/errors/global-exception.filter.spec.ts` :
```typescript
describe('GlobalExceptionFilter', () => {
  it('transforme une DoriException en réponse { code, translationKey, data: null }')
  it('transforme une erreur HTTP NestJS standard en code catalog')
  it('transforme une Error inconnue en INTERNAL_SERVER_ERROR sans fuiter le message')
  it('log l'erreur avec le correlation ID')
  it('ne pas inclure le stack trace dans la réponse HTTP')
})
```

#### 4.4 `MigrationRunner` spec

Créer `src/core/database/migration-runner.spec.ts` :
```typescript
describe('MigrationRunner', () => {
  it('ne ré-exécute pas une migration déjà enregistrée (idempotence)')
  it('échoue et rollback si le SQL de migration est invalide')
  it('vérifie le checksum et refuse une migration modifiée a posteriori')
  it('enregistre la migration avec son checksum après exécution réussie')
})
```

#### 4.5 Configurer les seuils dans `package.json`

```json
"coverageThreshold": {
  "global": {
    "statements": 50,
    "branches": 40,
    "functions": 45,
    "lines": 50
  },
  "./src/core/": {
    "statements": 65,
    "branches": 60,
    "functions": 65,
    "lines": 65
  }
}
```

5. **Checkpoint :** ≥ 65 % lignes et ≥ 60 % branches sur `src/core/`, `npm run test:cov` passe sans avertissement de seuil.

---

## POINT 5 — DB-01 / DB-02 : Absence de procédure de migration et rollback testés

**Source :** `audit_complet_technique_architecture_fonctionnel.md` §8 + §10, `claude_audit_handover.md` §2  
**Priorité :** P0 / P1  
**État réel dans le code :** ❌ **Non traité** — aucun test de migration sur base vierge, aucun runbook de restauration

### Constat

- La migration baseline UUID (`001_uuid_baseline.sql`) existe dans le dépôt
- `npm run db:reset` et `npm run db:verify` existent
- **Mais :** aucun test automatisé ne vérifie que la baseline s'applique sur une base vierge (hors de la machine locale du développeur)
- Aucun runbook de sauvegarde/restauration n'est versionnés dans le dépôt
- Aucun exercice de restauration chronométré n'a été réalisé et documenté

### Instructions de réalisation

1. **Ajouter un job de migration dans la CI (voir POINT 2) :**
   ```yaml
   - name: Run migrations on empty DB
     run: |
       npm run db:init
       npm run db:verify
     env:
       DATABASE_URL: postgres://dori:dori@localhost:5432/dori_test
   ```

2. **Tester le baseline sur une base héritée (DB non vierge) :**
   - Créer `test/migrations/migration-baseline.e2e-spec.ts`
   - Scénario 1 : base totalement vierge → baseline → seed → `db:verify`
   - Scénario 2 : baseline déjà appliquée → deuxième exécution → aucun changement (idempotence)
   - Scénario 3 : `public` schema intact avant et après

3. **Créer le runbook de sauvegarde/restauration :**
   Créer `docs/runbook-backup-restore.md` contenant :
   ```markdown
   ## Sauvegarde
   pg_dump --schema=dorify --no-owner --no-acl -Fc $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).dump
   
   ## Restauration
   pg_restore --schema=dorify --no-owner -d $DATABASE_URL backup.dump
   
   ## Migration corrective (rollback applicatif)
   # Créer un fichier 002_corrective.sql annulant les effets de la migration défectueuse
   # Exécuter via le runner habituel
   # NE PAS modifier une migration déjà déployée
   
   ## Vérification post-restauration
   npm run db:verify
   ```

4. **RPO/RTO cible :** documenter les objectifs (ex. RPO 1h, RTO 30min) et réaliser un exercice chronométré.

5. **Checkpoint :** preuve automatisée de migration baseline sur base vierge en CI + compte rendu de restauration avec RPO/RTO documentés.

---

## POINT 6 — PRI-01 : Absence de politique RGPD implémentée

**Source :** `audit_complet_technique_architecture_fonctionnel.md` §6 + §10, `claude_audit_handover.md` §2  
**Priorité :** P1  
**État réel dans le code :** ❌ **Non traité**

### Constat

L'API traite des données personnelles (nom, prénom, téléphone, email, notes sensibles dans `dori_person` et `dori_person_note`) sans aucun mécanisme RGPD :
- Pas d'endpoint d'export des données d'une personne
- Pas d'endpoint de rectification structurée (seul un PATCH générique)
- Pas d'endpoint d'anonymisation / de suppression définitive avec traçabilité
- Pas de purge automatisée des données expirées
- Pas de durée de rétention définie
- La suppression actuelle (`deletePerson` → soft delete) ne constitue pas une anonymisation conforme

### Instructions de réalisation

1. **Inventorier les données personnelles :**
   Créer `docs/donnees-personnelles.md` listant :
   - Chaque table contenant des données personnelles (`dori_person`, `dori_person_note`, `dori_registration`, `dori_notification`, `dori_audit_event`)
   - La finalité, la base légale et la durée de conservation pour chaque catégorie
   - Les destinataires et les flux de données sortants (webhooks, notifications externes)

2. **Implémenter l'export RGPD :**
   - Ajouter `GET /api/v1/persons/:personId/export` (permission : `persons:read` + scope validé)
   - Retourner un JSON structuré contenant toutes les données non-anonymisées de la personne : identité, notes, inscriptions, notifications
   - Ajouter l'action d'audit `PERSON_DATA_EXPORT` dans `AuditEventAction`
   - Exemple de structure :
   ```json
   {
     "person": { "personId": "...", "firstName": "...", ... },
     "notes": [...],
     "registrations": [...],
     "notifications": [...]
   }
   ```

3. **Implémenter l'anonymisation :**
   - Ajouter `DELETE /api/v1/persons/:personId/anonymize` (permission protégée, restriction par scope)
   - La méthode doit :
     - Effacer les champs personnels identifiants : `first_name`, `last_name`, `email`, `phone`, `external_id` → remplacer par des valeurs neutres (`[anonymisé]`, `null`)
     - Supprimer les notes (`dori_person_note`) associées
     - Conserver les inscriptions à des fins statistiques mais en détachant la référence personnelle (ou supprimer `person_id` FK si non requis pour les stats)
     - Enregistrer l'action dans `dori_audit_event` avec `action = PERSON_ANONYMIZED`, `target_id = personId`, sans stocker les données effacées
   - Différencier du soft-delete existant (`deleted_at`) qui ne supprime pas les données

4. **Implémenter la purge automatisée :**
   - Définir des durées de rétention par type dans la configuration :
     ```
     RETENTION_PERSON_DAYS=730         # 2 ans après le dernier mouvement
     RETENTION_NOTIFICATION_DAYS=90    # 3 mois
     RETENTION_AUDIT_DAYS=1825         # 5 ans (obligation légale)
     ```
   - Créer un worker de purge : `src/workers/data-retention/data-retention.worker.ts`
   - Planifier à 3h du matin (hors pic d'activité)
   - Logger les volumes purgés sans logguer de données personnelles

5. **Tester la procédure :**
   - Test unitaire : anonymisation ne laisse aucune donnée identifiante
   - Test d'intégration : export retourne exactement les données attendues, pas plus
   - Test de conformité : un dossier complet exporté → anonymisé → export retourne uniquement données neutres

6. **Checkpoint :** procédure RGPD testée et documentée sur un dossier complet, traçable dans `dori_audit_event`.

---

## POINT 7 — ARC-01 : Découpage du domaine `registrations`

**Source :** `audit_complet_technique_architecture_fonctionnel.md` §5 + §10 P1, `claude_audit_handover.md` §2  
**Priorité :** P1  
**État réel dans le code :** ❌ **Non traité** — `registrations.service.ts` compte **784 lignes** (objectif : < 400 lignes par service)

### Constat

- `src/modules/registrations/registrations.service.ts` : **784 lignes**
- `src/modules/registrations/registrations.repository.ts` : **589 lignes**
- Cas d'usage mélangés : création walk-in, prise de rendez-vous, check-in, suivi/lecture, report, annulation, appel suivant, position publique

### Instructions de réalisation

1. **Cartographier les invariants transactionnels AVANT le refactoring :**
   - Lister les méthodes actuelles et identifier celles qui partagent des transactions
   - Documenter les dépendances entre méthodes (ex. : `checkIn` modifie `registration.status` → dépend de `findById`)
   - Ajouter des tests de caractérisation sur chaque méthode extraite AVANT de déplacer le code

2. **Découpage cible du service :**
   ```
   src/modules/registrations/
   ├── registration-creation.service.ts    # createWalkin, createAppointment
   ├── registration-appointment.service.ts # checkIn, reschedule, expire
   ├── registration-tracking.service.ts    # getPublicPosition, findByTrackingToken
   ├── registration-lifecycle.service.ts   # cancel, markServed, markNoShow
   ├── registrations.service.ts            # facade (délègue aux sous-services)
   └── registrations.repository.ts         # SQL pur, pas de logique métier
   ```

3. **Règle impérative :** conserver TOUTES les frontières transactionnelles dans le repository (pas dans les services). Les services orchestrent, le repository garantit l'atomicité.

4. **Découpage du repository :**
   Séparer par profil de lecture/écriture si nécessaire :
   - `registration-write.repository.ts` : INSERT, UPDATE, verrous advisory
   - `registration-read.repository.ts` : SELECT (recherche, position, tracking)
   - Ou conserver un seul fichier si la cohésion est meilleure

5. **Processus de migration :**
   - Branche dédiée `refactor/registrations-split`
   - Copier → tester → supprimer l'original (jamais renommer directement)
   - Garder le même contrat public (aucun endpoint ne change)
   - Valider : `npm run quality:check` vert, couverture non dégradée

6. **Checkpoint :** aucun service métier principal > 400 lignes, comportement API inchangé vérifié par les tests existants et les E2E de POINT 3.

---

## POINT 8 — ARC-02 : Réduction des repositories monolithiques

**Source :** `audit_complet_technique_architecture_fonctionnel.md` §5 + §10 P1, `claude_audit_handover.md` §2  
**Priorité :** P1  
**État réel dans le code :** ❌ **Non traité**

### Constat

Tailles actuelles mesurées :
- `registrations.repository.ts` : **589 lignes**
- `users.repository.ts` : **534 lignes**
- `queue-engine.service.ts` : **519 lignes** (service — voir aussi POINT 7)

### Instructions de réalisation

1. **Créer des types de lignes SQL précis :**  
   Remplacer `Record<string, unknown>` par des interfaces explicites par domaine :
   ```typescript
   // users/types/user-row.type.ts
   interface UserRow {
     user_id: string;
     username: string;
     role_id: string | null;
     // ...
   }
   ```

2. **Centraliser les helpers SQL stables :**
   Dans `src/core/database/sql-helpers.ts` :
   ```typescript
   export function buildPaginationClause(page: number, pageSize: number): string
   export function buildSortClause(field: string, allowedFields: string[]): string
   ```

3. **Séparer les lectures complexes des commandes :**  
   Pour `users.repository.ts` (534 lignes), séparer :
   - `users-command.repository.ts` : CREATE, UPDATE, DELETE, assignation de rôles
   - `users-query.repository.ts` : findById, search avec filtres, relations

4. **Checkpoint :** repositories critiques cohésifs (< 300 lignes chacun), mappings typés et tests d'intégration associés verts.

---

## POINT 9 — ARC-03 : Fiabilisation des workers en environnement multi-instance

**Source :** `audit_complet_technique_architecture_fonctionnel.md` §5 + §10 P1  
**Priorité :** P1  
**État réel dans le code :** ⚠️ **Partiellement traité** — `BaseWorker` centralise le verrou local, mais aucun test d'instances concurrentes n'existe et la stratégie de déploiement n'est pas documentée

### Constat

- Le verrou est local au processus (`BaseWorker.isRunning`) — ne protège pas contre deux instances Vercel distinctes
- Certains workers utilisent un advisory lock PostgreSQL (`pg_advisory_xact_lock`) mais ce n'est pas documenté pour tous
- Aucun test prouvant l'absence de duplication sous concurrence réelle
- Le README ne documente pas clairement le modèle d'exécution

### Instructions de réalisation

1. **Documenter l'idempotence et le verrouillage de chaque worker :**
   Créer `docs/workers-deployment.md` :
   ```markdown
   ## Modèle de déploiement des workers
   
   | Worker | Verrouillage | Idempotence | Notes |
   |---|---|---|---|
   | daily-reset | pg_advisory_lock | OUI (dori_queue_daily_reset_execution) | Sûr multi-instance |
   | appointment-expiry | pg_advisory_lock | OUI (UPDATE WHERE status='booked' AND scheduled_time < now) | ... |
   | notification-worker | pg_advisory_lock | OUI (UPDATE outbox WHERE status='pending' LIMIT 1 FOR UPDATE SKIP LOCKED) | ... |
   | queue-estimation | advisory lock par queue_id | OUI (UPSERT sur clé unique) | ... |
   ```

2. **Vérifier et compléter les verrous :**
   Pour chaque worker, vérifier que le SQL utilise bien :
   - `SELECT pg_advisory_xact_lock(<id>)` au début de la transaction, ou
   - `FOR UPDATE SKIP LOCKED` sur les lignes à traiter
   
   Si absent, l'ajouter avant toute modification métier.

3. **Ajouter un test de concurrence :**
   Dans `base.worker.spec.ts` ou un test dédié :
   ```typescript
   it('deux instances concurrentes ne produisent qu'un seul traitement', async () => {
     // Simuler deux workers qui démarrent simultanément
     // Vérifier qu'un seul d'eux effectue le traitement
   })
   ```

4. **Décider et documenter la stratégie de déploiement :**
   - **Option A (recommandée) :** les workers NestJS tournent sur un serveur persistant séparé (non Vercel), les Cron Vercel restent en backup uniquement
   - **Option B :** les workers n'existent que via les Cron Vercel, supprimer `WorkersModule` du code local
   - La décision doit être documentée dans `README.md` et dans `vercel.json`

5. **Checkpoint :** aucun envoi, reset ou traitement métier dupliqué sous concurrence simulée dans les tests.

---

## POINT 10 — DOC-01 : Documentation incohérente avec le code réel

**Source :** `audit_complet_technique_architecture_fonctionnel.md` §4 (incohérences documentaires) + §10 P2  
**Priorité :** P2  
**État réel dans le code :** ❌ **Non traité** — vérification directe confirme les incohérences

### Constat

Incohérences confirmées dans `README.md` :
- Structure de dossiers listée : `appointments/`, `calendars/`, `displays/`, `reports/`, `service-points/`, `services/`, `tickets/`, `tracking/` — **aucun de ces modules n'existe dans `src/modules/`**
- Route documentée `GET /api/monitoring/health` — **la vraie route est `/api/v1/monitoring/health`**
- Mention de BullMQ comme file de traitement — **BullMQ a été retiré, les workers utilisent le scheduler Nest**

### Instructions de réalisation

1. **Corriger l'arborescence dans `README.md` :**
   Remplacer la section "Structure" par les modules réels :
   ```
   src/modules/
   ├── auth/              # Login, refresh, logout, changement de mot de passe
   ├── monitoring/        # Santé, métriques, rapports (inclut displays/reports)
   ├── notifications/     # Notifications et webhooks (inclut outbox)
   ├── persons/           # Dossiers usagers et notes
   ├── queue-engine/      # Sessions opérateur, appel suivant (inclut service-points)
   ├── queue-estimation/  # Estimation du temps d'attente
   ├── queues/            # CRUD files (inclut tickets/numbering)
   ├── rbac/              # Rôles et permissions
   ├── registrations/     # Inscriptions, rendez-vous, tracking public (inclut appointments/tracking)
   ├── service-tiers/     # Forfaits et règles de notification
   ├── sites/             # CRUD sites et affectations
   ├── translations/      # Traductions UI
   └── users/             # Gestion des utilisateurs
   ```

2. **Corriger les routes dans `README.md` :**
   - `GET /api/monitoring/health` → `GET /api/v1/monitoring/health`
   - `GET /api/monitoring/metrics` → `GET /api/v1/monitoring/metrics`
   - Vérifier toutes les autres routes listées

3. **Supprimer ou clarifier la mention BullMQ :**
   Remplacer :
   > "File de traitement BullMQ pour les tâches asynchrones"
   
   Par :
   > "Workers planifiés via le scheduler NestJS (@nestjs/schedule). Les crons Vercel (`POST /api/v1/cron/*`) servent de point d'entrée en environnement serverless."

4. **Ajouter un guide de démarrage reproductible :**
   ```markdown
   ## Démarrage local
   
   1. Copier `.env.example` → `.env` et renseigner les variables
   2. `npm install`
   3. Démarrer PostgreSQL et Redis (ou Docker)
   4. `npm run db:reset` (première fois) OU `npm run db:init` (migrations seulement)
   5. `npm run db:verify` pour valider l'état de la base
   6. `npm run start:dev`
   7. Swagger disponible sur http://localhost:3000/api/docs
   ```

5. **Ajouter la matrice rôle/permission :**
   Récupérer les permissions depuis `src/core/errors/error-catalog.ts` ou le seed et les documenter dans le README.

6. **Checkpoint :** un nouveau développeur lance et teste l'API uniquement avec le README, sans intervention externe.

---

## POINT 11 — OBS-01 : Observabilité incomplète

**Source :** `audit_complet_technique_architecture_fonctionnel.md` §9 + §10 P2  
**Priorité :** P2  
**État réel dans le code :** ❌ **Partiellement traité** — métriques HTTP présentes, mais SLO/SLI, alertes, Prometheus, tracing et métriques workers absents

### Constat

Présent :
- Endpoint `/api/v1/monitoring/health` avec état PostgreSQL
- Endpoint `/api/v1/monitoring/metrics` avec compteurs HTTP dans Redis
- Correlation ID sur chaque requête

Manquant :
- Aucune métrique au format Prometheus (pas de `/metrics` compatible scrapers)
- Aucun SLO/SLI défini ni budget d'erreur documenté
- Pas de métriques sur l'âge des statistiques d'estimation par queue
- Pas de métriques workers (durée, erreurs, files outbox)
- Pas de tracing distribué (OpenTelemetry)
- Pas d'alertes versionnées ni de runbooks d'incident

### Instructions de réalisation

1. **Exposer des métriques Prometheus :**
   Installer `@willsoto/nestjs-prometheus` ou `prom-client` directement :
   ```bash
   npm install prom-client
   ```
   Exposer `GET /api/v1/monitoring/prometheus` (protégé, non public) avec :
   - `http_requests_total{method, route, status_code}`
   - `http_request_duration_seconds{method, route}`
   - `db_pool_connections_active`
   - `worker_last_run_timestamp{worker_name}`
   - `worker_errors_total{worker_name}`
   - `queue_estimation_stats_age_seconds{queue_id}`
   - `outbox_pending_notifications_total`

2. **Définir les SLI/SLO :**
   Créer `docs/slo.md` :
   ```markdown
   | SLI | Objectif (SLO) | Fenêtre |
   |---|---|---|
   | Disponibilité (health 200) | 99.5 % | 30 jours |
   | Latence P95 endpoint `/api/v1/queue-engine/call-next` | < 500 ms | 7 jours |
   | Taux d'erreur 5xx | < 0.5 % | 7 jours |
   ```

3. **Ajouter les alertes dans le runbook :**
   Créer `docs/runbook-alerts.md` :
   ```markdown
   ## Alerte : Échec d'écriture d'audit
   Pattern : `Audit persistence failed`
   Action : Investiguer avec correlation_id, vérifier les privilèges PostgreSQL du rôle runtime
   
   ## Alerte : Aucune statistique d'estimation fiable
   Pattern : `queue_estimation_stats_age_seconds > 600`
   Action : Vérifier le worker d'estimation, vérifier les connexions DB
   ```

4. **Checkpoint :** un incident simulé (ex. DB down) est détecté via les métriques, corrélé via les logs et diagnostiqué depuis dashboards/logs.

---

## POINT 12 — PERF-01 : Cache de scope non distribué (risque multi-instance)

**Source :** `claude_audit_handover.md` §2 PERF-01, `audit_complet_technique_architecture_fonctionnel.md` §6  
**Priorité :** P2  
**État réel dans le code :** ⚠️ **Partiellement traité** — Redis est utilisé pour le cache de scope (TTL 30 secondes), mais le test de cohérence inter-instance n'existe pas et la stratégie de déploiement multi-instance n'est pas documentée

### Constat

- `src/core/rbac/services/scope.service.ts` : utilise Redis avec TTL 30s
- L'invalidation du cache (`invalidateScope(userId)`) purge la clé Redis
- **Manquant :** un test prouvant que l'invalidation Redis est bien propagée dans un scénario multi-instance
- **Manquant :** documentation de la fenêtre de cohérence acceptable

### Instructions de réalisation

1. **Documenter la fenêtre de cohérence :**
   Dans `docs/workers-deployment.md` ou README :
   ```markdown
   ## Cache RBAC et cohérence multi-instance
   
   Le scope RBAC est mis en cache Redis avec un TTL de 30 secondes par utilisateur.
   L'invalidation est distribuée via Redis : lorsqu'une affectation de rôle ou de site change,
   la clé Redis est purgée et toutes les instances rechargeront le scope depuis PostgreSQL.
   
   Fenêtre de cohérence maximale : 30 secondes (si Redis est indisponible lors de l'invalidation).
   En cas de panne Redis, le service retombe sur PostgreSQL sans cache.
   ```

2. **Ajouter un test d'invalidation distribuée :**
   Dans `scope.service.spec.ts` :
   ```typescript
   it('l'invalidation Redis supprime la clé et force un rechargement DB', async () => {
     // 1. Charger le scope → mis en cache Redis
     // 2. Appeler invalidateScope(userId)
     // 3. Vérifier que la clé Redis est absente
     // 4. Charger le scope à nouveau → lecture DB, pas le cache
   })
   ```

3. **Ajouter une métrique sur l'âge du cache :**
   Logger un warning si un appel au scope Redis retourne une valeur vieille de plus de 25 secondes (proche de l'expiration).

4. **Checkpoint :** stratégie de cache documentée, test d'invalidation présent, aucune régression sous charge simulée.

---

## POINT 13 — SEC-06 / SEC-07 : Contrôles de sécurité HTTP non validés E2E

**Source :** `audit_complet_technique_architecture_fonctionnel.md` §6 SEC-02  
**Priorité :** P0  
**État réel dans le code :** ❌ **Non traité** — les contrôles d'authentification, permissions, scope, cookies, webhook et salons WebSocket ne sont pas validés de bout en bout

### Constat

Les protections existent dans le code (JwtAuthGuard, PermissionsGuard, ScopeService) mais aucun test E2E ne prouve qu'elles sont effectivement actives sur les routes. Une mauvaise configuration de `AppModule` pourrait les désactiver silencieusement.

### Instructions de réalisation

1. **Matrice de tests d'autorisation E2E :**
   Créer `test/rbac-matrix.e2e-spec.ts` :
   ```typescript
   // Pour chaque endpoint sensible, tester :
   it('retourne 401 sans token JWT')
   it('retourne 403 avec un rôle insuffisant')
   it('retourne 404 (pas 403) pour une ressource hors scope')
   it('retourne 200 avec le bon rôle et le bon scope')
   ```
   Endpoints prioritaires : `POST /api/v1/registrations`, `POST /api/v1/queue-engine/sessions`, `GET /api/v1/users`, `DELETE /api/v1/users/:userId`

2. **Tests de cookie :**
   ```typescript
   it('le refresh token n'est pas accessible en JavaScript (HttpOnly)')
   it('le refresh token n'est pas envoyé sur des requêtes cross-site (SameSite=Strict)')
   it('un cookie de refresh expiré retourne 401')
   ```

3. **Tests de webhook :**
   ```typescript
   it('un webhook avec signature HMAC valide est accepté (200)')
   it('un webhook avec signature invalide est rejeté (401)')
   it('un webhook avec timestamp expiré (> 5 min) est rejeté')
   it('un webhook dupliqué (même event_id) est ignoré (idempotence)')
   ```

4. **Checkpoint :** matrice RBAC/scope au vert en CI sur PostgreSQL et Redis réels.

---

## POINT 14 — FUN-01 : Validation des écarts produit non formalisée

**Source :** `audit_complet_technique_architecture_fonctionnel.md` §10 P2  
**Priorité :** P2  
**État réel dans le code :** ❌ **Non traité** — les décisions produit ne sont pas formalisées

### Constat

Les questions suivantes n'ont pas de réponse documentée dans le dépôt :
- Calendrier / créneaux explicites : requis ou non ?
- Catalogue services/motifs distinct des forfaits : requis ou non ?
- Exports CSV/PDF et rapports planifiés : requis ou non ?
- Borne kiosque, écran salle, QR code : portés par le frontend uniquement ?
- Multi-tenant, abonnement, quota, facturation : hors périmètre ?

### Instructions de réalisation

1. **Organiser un atelier produit** avec les parties prenantes (produit, UX, backend, frontend) pour décider chaque point.

2. **Documenter les décisions dans `docs/product-decisions.md` :**
   ```markdown
   | Fonctionnalité | Décision | Date | Responsable | User story |
   |---|---|---|---|---|
   | Calendrier/créneaux | HORS PÉRIMÈTRE V1 | 2026-10-XX | [nom] | — |
   | Exports CSV/PDF | À IMPLÉMENTER | 2026-10-XX | [nom] | US-XXX |
   | Multi-tenant | HORS PÉRIMÈTRE | 2026-10-XX | [nom] | — |
   ```

3. **Transformer chaque décision retenue en story avec critères d'acceptation** dans l'outil de gestion du backlog.

4. **Checkpoint :** périmètre signé par produit, UX, backend et frontend. Aucune ambiguïté fonctionnelle dans le backlog actif.

---

## Récapitulatif des points non traités

| # | ID | Priorité | Domaine | Effort estimé | Impact |
|---|---|---|---|---|---|
| 1 | SEC-01 | 🔴 P0 | Vulnérabilités dépendances | M (2-3j) | Production bloquée |
| 2 | OPS-01 | 🔴 P0 | CI/CD obligatoire | M (2-3j) | Production bloquée |
| 3 | TST-01 | 🔴 P0 | Tests E2E métier | L (5-7j) | Production bloquée |
| 4 | TST-02 | 🟠 P1 | Couverture composants critiques | M (3-4j) | Qualité / sécurité |
| 5 | DB-01/DB-02 | 🔴 P0 / 🟠 P1 | Migrations et rollback testés | M (2-3j) | Résilience |
| 6 | PRI-01 | 🟠 P1 | RGPD (export, anonymisation, purge) | L (5-7j) | Conformité légale |
| 7 | ARC-01 | 🟠 P1 | Découpage `registrations` | L (4-5j) | Maintenabilité |
| 8 | ARC-02 | 🟠 P1 | Repositories monolithiques | M (3-4j) | Maintenabilité |
| 9 | ARC-03 | 🟠 P1 | Workers multi-instance | S (1-2j) | Fiabilité prod |
| 10 | DOC-01 | 🟡 P2 | README incohérent | S (1j) | Onboarding |
| 11 | OBS-01 | 🟡 P2 | Observabilité Prometheus/SLO | M (3-4j) | Exploitation |
| 12 | PERF-01 | 🟡 P2 | Cache scope documentation/test | S (1j) | Multi-instance |
| 13 | SEC-02 | 🔴 P0 | Matrice auth/RBAC E2E | M (inclus dans TST-01) | Sécurité |
| 14 | FUN-01 | 🟡 P2 | Décisions produit | S (atelier) | Alignement |

### Ordre de réalisation recommandé

```
Sprint 0 (maintenant) :
  → POINT 2 (CI minimale) — débloque tout le reste
  → POINT 1 (vulnérabilités) — sécurité immédiate
  → POINT 10 (README) — coût minimal, impact onboarding

Sprint 1 :
  → POINT 3 + POINT 13 (E2E auth/RBAC/scope/inscription)
  → POINT 5 (migrations et rollback en CI)

Sprint 2 :
  → POINT 4 (couverture composants critiques)
  → POINT 6 (RGPD)
  → POINT 9 (workers multi-instance)

Sprints suivants :
  → POINT 7 + POINT 8 (découpage architecture)
  → POINT 11 (observabilité)
  → POINT 12 + POINT 14 (amélioration continue)
```

---

*Ce rapport ne liste que les points confirmés comme non traités après vérification directe du code source. Les points marqués "Traité" dans les fichiers d'audit et confirmés dans le code ont été exclus.*
