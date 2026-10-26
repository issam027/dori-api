# Dori API 🧭

> API backend modulaire, résiliente et temps réel pour la gestion d'accueil multi-sites, de files d'attente intelligentes, de rendez-vous et d'affichage dynamique.

[![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![SSE](https://img.shields.io/badge/Realtime-SSE-0A7EA4)](https://html.spec.whatwg.org/multipage/server-sent-events.html)

---

## 📋 Sommaire

- [Fonctionnalités clés](#-fonctionnalités-clés)
- [Stack Technique](#-stack-technique)
- [Prérequis](#-prérequis)
- [Démarrage Rapide](#-démarrage-rapide)
- [Variables d'Environnement](#-variables-denvironnement)
- [Base de Données & Seeding](#-base-de-données--seeding)
- [Documentation de l'API (Swagger)](#-documentation-de-lapi-swagger)
- [Architecture & Structure du Projet](#-architecture--structure-du-projet)
- [Workers d'Arrière-Plan](#-workers-darrière-plan)
- [Commandes & Scripts NPM](#-commandes--scripts-npm)
- [Sécurité & Authentification](#-sécurité--authentification)
- [Monitoring & Observabilité](#-monitoring--observabilité)

---

## ✨ Fonctionnalités clés

- **Gestion multi-sites & multi-files** : Organisation hiérarchique par sites, files d'attente, guichets et services.
- **Prise de rendez-vous & tickets sans contact** : Gestion des créneaux, tickets virtuels avec suivi en temps réel pour l'usager (via lien web public et QR code).
- **Temps réel & Écrans d'affichage** : flux SSE alimentés par un journal transactionnel PostgreSQL pour notifier les IHM, qui actualisent ensuite leurs données via REST.
- **Sécurité & Contrôle d'accès granulaire (RBAC)** : Permissions hiérarchiques (`root`, `admin`, `manager`, `operator`) avec cache de scope distribué via Redis.
- **Workers automatiques** : Recalcul prédictif des temps d'attente, purge des RDV expirés, notifications et réinitialisation nocturne.

---

## 🛠 Stack Technique

- **Framework** : [NestJS 10](https://nestjs.com/) (Node.js runtime / Express)
- **Langage** : [TypeScript 5](https://www.typescriptlang.org/) (mode strict, typage complet)
- **Base de données** : PostgreSQL 14+ avec [TypeORM](https://typeorm.io/)
- **Cache distribué** : [Redis](https://redis.io/) (via `ioredis`) pour le cache de scope RBAC et les compteurs de métriques
- **Tâches planifiées** : workers NestJS hors Vercel et déclencheurs HTTP Vercel Cron en production serverless
- **Documentation API** : OpenAPI 3.0 via `@nestjs/swagger` + Swagger UI
- **Tests** : Jest, ts-jest, Supertest

---

## 📦 Prérequis

- **Node.js** : `>= 20.x`
- **npm** : `>= 10.x`
- **PostgreSQL** : `>= 14.x` (avec extension `pgcrypto` ou `uuid-ossp`)
- **Redis** : `>= 7.x`

---

## 🚀 Démarrage Rapide

### 1. Installation des dépendances

```bash
npm install
```

### 2. Configuration de l'environnement

Copiez le modèle de configuration et ajustez les paramètres locaux (base de données, Redis, secrets JWT) :

```bash
cp .env.example .env
```

### 3. Initialisation de la base de données & jeux d'essai

Initialisez les tables et injectez les données de démonstration (sites, files, utilisateurs de test) :

```bash
npm run db:init:seed
```

Pour vérifier l'intégrité de la base de données :

```bash
npm run db:verify
```

### 4. Lancement de l'API

```bash
# Mode développement avec rechargement automatique (hot-reload)
npm run start:dev

# Mode production (après npm run build)
npm run start:prod
```

L'API démarre par défaut sur `http://localhost:3000`.

---

## ⚙️ Variables d'Environnement

Principales variables configurables dans `.env` :

| Variable                              | Description                                                 | Défaut / Exemple                                      |
| ------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| `PORT`                                | Port d'écoute du serveur HTTP                               | `3000`                                                |
| `NODE_ENV`                            | Environnement (`development`, `production`, `test`)         | `development`                                         |
| `DATABASE_URL`                        | URL PostgreSQL unique (ajouter `sslmode=require` pour Neon) | `postgresql://dori:dori_password@localhost:5432/dori` |
| `REDIS_URL`                           | URL de connexion Redis unique                               | `redis://localhost:6379`                              |
| `JWT_SECRET`                          | Clé secrète de signature HMAC (min. 32 caractères)          | _clé aléatoire_                                       |
| `JWT_ACCESS_EXPIRES_IN`               | Durée de validité de l'Access Token                         | `60m`                                                 |
| `REFRESH_TOKEN_EXPIRES_DAYS`          | Durée de validité du Refresh Token                          | `30`                                                  |
| `CORS_ORIGINS`                        | Origines autorisées (séparées par virgule)                  | `http://localhost:3001,http://localhost:5173`         |
| `PUBLIC_WEB_URL`                      | URL de l'application usager pour les liens de suivi         | `http://localhost:5173`                               |
| `CRON_SECRET`                         | Secret Bearer des endpoints Vercel Cron                     | secret aléatoire long                                 |
| `DEFAULT_TIMEZONE`                    | Fuseau horaire IANA utilisé en repli                        | `Africa/Tunis`                                        |
| `APPOINTMENT_EXPIRY_INTERVAL_MINUTES` | Délai avant traitement des rendez-vous expirés              | `5`                                                   |
| `SWAGGER_SERVERS`                     | URLs OpenAPI séparées par des virgules                      | local et production                                   |

Consultez [.env.example](file:///.env.example) pour la liste exhaustive et commentée.

Ne déployez jamais la valeur d'exemple de `JWT_SECRET`. En production, utilisez soit un secret HMAC aléatoire d'au moins 32 caractères, soit de préférence une paire `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` dédiée.

---

## 📖 Documentation de l'API (Swagger)

Une interface interactive Swagger UI est directement intégrée :

- **Swagger UI** : [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (la racine `/` redirige automatiquement ici)
- **Spécification OpenAPI JSON** : `GET /api/docs-json`
- **Spécification OpenAPI YAML** : `GET /api/docs-yaml`
- **Export statique** : `npm run swagger:export` (génère `openapi.json` et `openapi.yaml` à la racine)

---

## 🏗 Architecture & Structure du Projet

```text
src/
├── app.module.ts              # Module racine NestJS
├── main.ts                    # Point d'entrée de l'application
├── core/                      # Services et briques transversales
│   ├── auth/                  # Stratégies Passport, guards JWT et hashing
│   ├── clock/                 # Abstraction d'horloge pour tests déterministes
│   ├── config/                # Validation et chargement des configurations
│   ├── database/              # Connexion PostgreSQL et repositories TypeORM
│   ├── errors/                # DoriException et gestionnaire global d'exceptions
│   ├── monitoring/            # Health check, métriques Redis et supervision
│   ├── rbac/                  # Guards de permissions et scope distribué
│   ├── realtime/              # Outbox PostgreSQL et endpoints SSE par file
│   └── redis/                 # Module Redis global partagé (@Inject(REDIS_CLIENT))
├── modules/                   # Domaines métier de la plateforme
│   ├── appointments/          # Prise et gestion des rendez-vous
│   ├── auth/                  # Endpoints d'authentification et refresh token
│   ├── calendars/             # Plages horaires, ouvertures et disponibilités
│   ├── displays/              # Gestion des écrans d'affichage en salle
│   ├── notifications/         # Journal et envoi de notifications (SMS, email)
│   ├── queues/                # Files d'attente et gestion des priorités
│   ├── registrations/         # Arrivée et enregistrement des usagers
│   ├── reports/               # Statistiques, temps de passage et agrégations
│   ├── service-points/        # Guichets, pupitres opérateurs et sessions
│   ├── services/              # Catalogue des démarches et motifs de visite
│   ├── sites/                 # Établissements et fuseaux horaires
│   ├── tickets/               # Numérotation, appels et clôture de tickets
│   ├── tracking/              # Suivi public temps réel pour les usagers
│   └── users/                 # Gestion des comptes, rôles et assignations
└── workers/                   # Tâches périodiques en arrière-plan (CRON)
    ├── appointment-expiry/    # Purge et annulation des RDV non honorés
    ├── daily-reset/           # Remise à zéro quotidienne des compteurs de tickets
    ├── notification-worker/   # Dépilement et envoi des notifications en attente
    └── queue-estimation/      # Estimation dynamique des temps d'attente
```

---

## ⏰ Workers d'Arrière-Plan

Quatre workers CRON s'exécutent en tâche de fond pour garantir la fluidité opérationnelle :

Sur Vercel, les workers persistants sont désactivés. `vercel.json` déclenche à la place quatre routes `GET /api/v1/internal/cron/*`, protégées par `Authorization: Bearer <CRON_SECRET>`. En développement ou sur un serveur Node.js persistant, les workers NestJS restent actifs.

| Worker                      | Fréquence        | Rôle                                                                  |
| --------------------------- | ---------------- | --------------------------------------------------------------------- |
| **NotificationWorker**      | Toutes les 10s   | Récupère et expédie les SMS et emails en attente                      |
| **QueueEstimationWorker**   | Toutes les 30s   | Recalcule l'attente estimée par file selon le débit réel des guichets |
| **AppointmentExpiryWorker** | Toutes les 60s   | Marque comme expirés les rendez-vous dépassés sans enregistrement     |
| **DailyResetWorker**        | Toutes les nuits | Réinitialise les numéros de tickets du jour par site/file             |

---

## 📜 Commandes & Scripts NPM

```bash
# Compilation & Build
npm run build              # Compile l'application avec le CLI NestJS
npm run typecheck          # Vérification stricte des types TypeScript sans émettre de JS

# Qualité & Linting
npm run lint               # Analyse du code avec ESLint
npm run lint:fix           # Correction automatique des erreurs ESLint
npm run format             # Formatage du code avec Prettier
npm run quality:check      # Suite complète (format + lint + typecheck + build + tests)

# Tests
npm test                   # Exécute tous les tests unitaires Jest
npm run test:watch         # Exécute les tests en mode écoute
npm run test:cov           # Rapport de couverture de code (coverage)
npm run test:e2e           # Exécute les tests End-to-End

# Base de données & OpenAPI
npm run db:init            # Crée les tables et schémas PostgreSQL
npm run db:init:seed       # Crée les tables et peuple avec le jeu d'essai
npm run db:verify          # Contrôle la cohérence des tables et données
npm run swagger:export     # Exporte la spécification OpenAPI en JSON et YAML
```

---

## 🔒 Sécurité & Authentification

- **Authentification double-token** :
  - _Access Token JWT court_ (porté via en-tête `Authorization: Bearer <token>`).
  - _Refresh Token long_ (stocké dans un cookie HTTP-only sécurisé).
- **Hardening des mots de passe** : Chiffrement bcrypt (12 rounds) avec blocage de compte temporaire après 5 échecs consécutifs.
- **Cache RBAC Distribué** : Les habilitations et scopes par site/file sont résolus puis mis en cache dans Redis avec invalidation immédiate lors des modifications.
- **Protection réseau & Rate Limiting** :
  - Protection contre les injections et attaques courantes via **Helmet**.
  - Limitation de débit adaptative via **Throttler** (limites strictes sur les routes sensibles d'authentification).

---

## 📊 Monitoring & Observabilité

L'API fournit plusieurs points de supervision :

- `GET /api/monitoring/health` : État de santé du processus (statut DB, mémoire, uptime).
- `GET /api/monitoring/metrics` : Compteurs d'activité HTTP (`http_requests_total`, durée moyenne des requêtes, etc.), persistés et agrégés dans Redis.
- `GET /api/monitoring/activity` : Activité globale d'exploitation (sessions ouvertes, tickets en cours, notifications en échec).
- `GET /api/monitoring/live?siteId=:id` : Supervision en temps réel d'un site (files chargées, guichets actifs, alertes d'attente critique).

---

## 📄 Licence

Propriétaire — Tous droits réservés.

<!-- CHECKPOINT id="ckpt_mvnmqon0_58hwtl" time="2026-10-25T09:33:01.116Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvnn3jlu_fiybrq" time="2026-10-25T09:43:01.122Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvnngekz_sfnkh6" time="2026-10-25T09:53:01.139Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvnnt9jn_g97n3o" time="2026-10-25T10:03:01.139Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvno64ij_0pa639" time="2026-10-25T10:13:01.147Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvnoizh9_nilrzm" time="2026-10-25T10:23:01.149Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
