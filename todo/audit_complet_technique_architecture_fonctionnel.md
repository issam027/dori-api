# Audit complet de DORI API

> Date : 22 octobre 2026  
> Périmètre : dépôt backend `dori-api` (code source, configuration, SQL, tests, contrats OpenAPI/AsyncAPI et documentation).  
> Objectif : dresser un état des lieux technique, architectural et fonctionnel, puis fournir un plan d'action vérifiable.

## 1. Résumé exécutif

DORI API est un backend NestJS cohérent et déjà substantiel. La séparation contrôleur/service/repository, la validation globale, l'authentification, le RBAC, le cloisonnement par site/file, les transactions SQL, les migrations contrôlées par checksum et la documentation OpenAPI constituent une base saine.

L'application n'est cependant **pas prête pour une mise en production exigeante en l'état**. Les principaux obstacles sont :

1. la chaîne qualité globale échoue sur le formatage de deux fichiers ;
2. les dépendances de production comportent 17 vulnérabilités connues, dont 5 hautes ;
3. les tests sont nombreux mais leur couverture globale reste à 43,6 % des lignes et aucun vrai parcours métier E2E n'est testé ;
4. l'exploitation n'est pas industrialisée dans le dépôt : aucune CI, aucun conteneur, aucun manifeste de déploiement ni procédure de sauvegarde/restauration ;
5. plusieurs composants critiques ne sont pratiquement pas testés : WebSocket, scope RBAC, filtres/intercepteurs globaux, démarrage et migrations ;
6. certaines classes métier et repositories sont devenus très volumineux ;
7. la documentation promet des modules qui n'existent pas comme tels et contient des chemins d'API erronés ;
8. les exigences de protection des données (rétention, export, anonymisation, audit métier) ne sont pas matérialisées.

### Évaluation synthétique

| Axe | Note | Conclusion |
| --- | ---: | --- |
| Architecture | 7/10 | Bonne modularité initiale, mais services/repositories centraux trop volumineux et couplage SQL important. |
| Qualité du code | 7/10 | Typage, lint et conventions présents ; format actuellement en échec et quelques `any` de production. |
| Sécurité | 6/10 | Socle applicatif sérieux, mais dépendances vulnérables et contrôles sensibles insuffisamment testés. |
| Fonctionnel | 7/10 | Cœur accueil/file/rendez-vous bien couvert ; quelques promesses documentaires et besoins SaaS restent incomplets. |
| Tests | 5/10 | 276 tests réussis, mais couverture 43,6 %, contrôleurs à 0 % pour la plupart et E2E symbolique. |
| Exploitabilité | 4/10 | Monitoring applicatif présent ; CI/CD, packaging, SLO, sauvegarde et tests d'intégration manquent. |
| Documentation | 6/10 | OpenAPI riche et SFD disponible ; README incohérent avec le code et runbooks absents. |

### Décision recommandée

- **Développement / démonstration :** acceptable après correction du formatage.
- **Pilote contrôlé :** possible après les actions P0 et une validation E2E sur PostgreSQL/Redis réels.
- **Production :** déconseillée avant traitement des vulnérabilités, tests E2E, CI/CD, sauvegarde/restauration et exigences RGPD.

## 2. Méthode et preuves

### Contrôles exécutés

| Contrôle | Résultat observé le 22/10/2026 |
| --- | --- |
| `npm run quality:check` | **Échec** dès `format:check`. |
| `npm run format:check` | 2 fichiers non conformes : `report-response.dto.ts`, `monitoring.module.ts`. |
| `npm run lint` | **Échec**, 3 erreurs Prettier dans ces deux fichiers. |
| `npm run typecheck` | Réussi. |
| `npm run build:check` | Réussi. |
| `npm test -- --runInBand --coverage=false` | 54 suites / 54 réussies ; 276 tests / 276 réussis. |
| `npm run test:cov -- --runInBand` | 43,60 % statements ; 39,74 % branches ; 41,39 % fonctions ; 43,56 % lignes. |
| `npm audit --omit=dev --json` | 17 vulnérabilités prod : 5 hautes, 11 modérées, 1 faible. |
| Inventaire OpenAPI statique | 61 chemins et 136 schémas. |

### Limites de l'audit

- Aucun environnement PostgreSQL/Redis isolé n'a été démarré : comportement réel, concurrence, migrations sur données volumineuses et performance restent à valider.
- Le seul test E2E du dépôt ne teste qu'un `GET /` attendu en 404.
- Aucun déploiement, proxy, certificat TLS, sauvegarde ou supervision externe n'est présent dans le dépôt ; ils ne peuvent donc pas être certifiés.
- Le frontend n'est pas dans ce dépôt. L'ergonomie, l'accessibilité et les parcours visuels ne sont pas audités ici.
- L'historique Git complet et les images de conteneurs ne sont pas scannés.

## 3. Cartographie actuelle

### Architecture d'exécution

```text
Clients HTTP / Swagger / Frontend
             |
             v
NestJS / Express
  -> Helmet + CORS + rawBody
  -> JWT guard -> permission guard -> throttling
  -> corrélation -> métriques -> enveloppe -> sérialisation
  -> contrôleurs -> services métier -> repositories SQL
             |                         |
             |                         v
             |                     PostgreSQL
             v
Socket.IO <-> Redis adapter / cache RBAC / métriques
             |
             v
Workers planifiés : expiration, reset, notification, estimation
```

### Modules réellement présents

| Domaine | Capacités principales |
| --- | --- |
| `auth` | Login, rotation refresh token, logout, profil, changement de mot de passe. |
| `users` + `rbac` | Utilisateurs, rôles, permissions, affectations et anti-escalade. |
| `sites` | CRUD sites et affectations directes. |
| `queues` | CRUD files, statut, affichage, reset et opérateurs. |
| `service-tiers` | Forfaits/priorités, association aux files et règles de notification. |
| `persons` | Dossiers usagers et notes. |
| `registrations` | Inscriptions, rendez-vous, check-in, report, annulation et suivi public. |
| `queue-engine` | Sessions opérateur, prochain ticket, servi et absent. |
| `notifications` | Consultation, création, renvoi, webhook et outbox. |
| `translations` | Bundle public et gestion des traductions. |
| `monitoring` | Santé, métriques, activité, supervision live et séries de rapport. |
| `queue-estimation` | Estimation dynamique utilisée par les files. |
| `workers` | Expiration, reset quotidien, envoi de notifications, agrégation d'estimation. |
| `realtime` | Authentification Socket.IO et salons registration/queue/translations. |

### Modèle de données

Le socle SQL couvre sites, utilisateurs, rôles/permissions, affectations, files, personnes, notes, forfaits, sessions opérateur, inscriptions, compteurs quotidiens, notifications, webhooks, traductions, sessions JWT et statistiques d'estimation. Les migrations `001` à `014` sont ordonnées, transactionnelles et protégées contre la modification a posteriori par checksum.

## 4. Audit fonctionnel

### Couverture fonctionnelle observée

| Besoin | État | Commentaire / action |
| --- | --- | --- |
| Authentification et sessions | Couvert | Rotation et révocation présentes ; ajouter des E2E anti-rejeu et cookie. |
| Gestion utilisateurs/rôles | Couvert | Gestion riche ; tester l'anti-escalade de bout en bout. |
| Multi-sites et multi-files | Couvert | Scope centralisé ; tester systématiquement les accès croisés. |
| Dossiers personnes | Couvert partiellement | CRUD/notes présents ; droits RGPD et historique métier absents. |
| Ticket sans rendez-vous | Couvert | Création, disponibilité, priorité et suivi présents. |
| Rendez-vous | Couvert partiellement | Création/report/check-in/expiration présents ; pas de véritable moteur de créneaux/calendrier exposé. |
| Sessions guichet | Couvert | Ouverture, heartbeat, fermeture et appel du prochain. |
| Écran salle | Couvert côté données | Endpoint display et salon temps réel ; aucune application écran dans ce dépôt. |
| Tracking public | Couvert côté API | Token, position et salon privé ; parcours frontend/QR non présents ici. |
| Notifications | Couvert techniquement | Outbox et webhook HMAC présents ; les adaptateurs semblent simulés/loggés, à valider avec de vrais fournisseurs. |
| Traductions | Couvert | Bundle public et CRUD protégé. |
| Supervision et rapports | Couvert partiellement | Live + série agrégée ; export CSV/PDF, planification et historique d'audit non trouvés. |
| Configuration métier | Couvert partiellement | Sites, files, forfaits et règles ; catalogue de services/motifs distinct non présent. |
| Borne kiosque | Couvert par primitives | Pas de module ni authentification de terminal dédiés ; le frontend doit orchestrer les endpoints existants. |
| Facturation SaaS/tenant | Non couvert | Pas d'organisation/tenant, abonnement, quota, facturation ou séparation contractuelle. À confirmer comme hors périmètre. |
| RGPD | Insuffisant | Pas d'export, anonymisation, rétention automatisée, consentement ou registre d'accès. |

### Incohérences documentaires fonctionnelles

Le README décrit des répertoires/modules `appointments`, `calendars`, `displays`, `reports`, `service-points`, `services`, `tickets` et `tracking` qui n'existent pas dans `src/modules`. Plusieurs capacités existent bien, mais sont regroupées dans `registrations`, `queues`, `queue-engine` et `monitoring`. Cette différence gêne l'onboarding et peut conduire le frontend à chercher des contrats inexistants.

Le README indique également des routes `/api/monitoring/...`, alors que le contrôleur expose `/api/v1/monitoring/...`.

La dépendance BullMQ est annoncée comme file de traitement, mais aucun `BullModule`, `Processor` ou job BullMQ n'est utilisé dans `src`. Les workers actuels reposent sur le scheduler Nest. Il faut soit retirer cette promesse/dépendance, soit réellement migrer les traitements vers une queue distribuée.

## 5. Audit d'architecture

### Points solides

- Découpage par domaines et couches explicites.
- Guards globaux JWT, permissions et throttling : faible risque d'oubli route par route.
- Validation globale avec whitelist et rejet des propriétés inconnues.
- Erreurs métier et réponses Swagger centralisées.
- `ClockService` facilitant les tests déterministes.
- Transactions SQL pour les changements atomiques et `FOR UPDATE SKIP LOCKED` dans les flux concurrents.
- Cache RBAC Redis distribué avec TTL et invalidation.
- WebSocket authentifié par JWT ou token de suivi et contrôle du scope avant accès aux salons.
- Migrations versionnées, transactionnelles et contrôlées par checksum.
- Dégradation Redis prévue dans plusieurs composants.

### Faiblesses structurelles

| ID | Sévérité | Constat | Preuve / impact |
| --- | --- | --- | --- |
| ARC-01 | P1 | `RegistrationsService` concentre trop de cas d'usage. | 812 lignes ; évolution et revue risquées. |
| ARC-02 | P1 | Plusieurs repositories sont monolithiques. | 584 lignes registrations, 551 users, 522 queues, 492 queue-engine. |
| ARC-03 | P1 | L'accès aux données mélange TypeORM et SQL brut très typé localement. | Maintenance du mapping et dérive schéma/types possibles. |
| ARC-04 | P1 | Les workers Cron tournent dans chaque instance API. | En déploiement horizontal, risque de concurrence/duplication ; certaines requêtes protègent ce risque, mais pas un modèle d'exploitation explicite. |
| ARC-05 | P2 | Les DTO de réponse sont volumineux et manuels. | Risque de divergence entre SQL, runtime et OpenAPI. |
| ARC-06 | P2 | `app.module.ts` référence tous les domaines directement. | Acceptable aujourd'hui, mais point de composition croissant sans tests d'architecture. |
| ARC-07 | P2 | Aucune règle automatisée de dépendances/cycles. | Les frontières de modules peuvent se dégrader silencieusement. |

### Cible recommandée

- Garder les modules Nest actuels : ils correspondent bien aux agrégats utiles.
- Découper `RegistrationsService` par cas d'usage : création, rendez-vous, check-in, consultation/suivi, mutation/annulation.
- Découper les gros repositories par agrégat ou profil de lecture, sans multiplier les abstractions génériques.
- Isoler l'exécution des workers dans un processus déployable séparément, ou garantir un verrou distribué/leader election pour chaque tâche.
- Choisir explicitement entre scheduler et BullMQ. Ne pas maintenir les deux modèles sans besoin.
- Ajouter des tests de frontières (cycles, imports interdits) et une décision d'architecture documentée pour SQL brut/TypeORM.

## 6. Audit sécurité et données

### Protections présentes

- Helmet, CORS sur liste d'origines et validation de la configuration au démarrage.
- Secret JWT minimum ou clés asymétriques validés.
- Access token Bearer, refresh token en cookie `HttpOnly`, `Secure` en production et `SameSite=Strict`.
- Refresh tokens stockés sous forme de hash et rotation anti-rejeu.
- Blocage après échecs d'authentification et coût bcrypt configurable.
- RBAC centralisé et réponses 404 hors scope pour limiter l'énumération.
- Webhook public signé HMAC, timestampé et idempotent ; raw body activé.
- Requêtes observées paramétrées et tris encadrés par listes autorisées.
- Token de tracking limité dans le temps et réponses publiques avec `no-store`/`no-referrer`.

### Risques à traiter

| ID | Sévérité | Constat | Action attendue |
| --- | --- | --- | --- |
| SEC-01 | P0 | 17 vulnérabilités de production, dont 5 hautes. | Monter la chaîne Nest/Express et verrouiller l'audit en CI. |
| SEC-02 | P0 | Les contrôles critiques HTTP/WS ne sont pas validés E2E. | Matrice auth, permissions, scope, cookies, webhook et salons. |
| SEC-03 | Résolu | Le guard JWT utilise désormais le logger structuré avec messages constants. | Couvert par SEC-03 et les tests de non-fuite. |
| SEC-04 | Résolu | Les erreurs WebSocket et workers sont normalisées depuis `unknown`. | Seul le type d'erreur est journalisé. |
| SEC-05 | Résolu | Un journal append-only applicatif trace rôles, affectations, suppressions, resets et accès sensibles. | Migration `015`, intercepteur global, 19 actions testées et runbook d'exploitation. |
| SEC-06 | P1 | Pas de politique RGPD implémentée. | Rétention, export, rectification, anonymisation et preuve de purge. |
| SEC-07 | P1 | Rate limiting dépend du processus applicatif. | Vérifier le stockage utilisé ; adopter une stratégie distribuée derrière plusieurs instances. |
| SEC-08 | P2 | Pas de scan de secrets/SAST/DAST dans le dépôt. | Ajouter contrôles CI et politique de traitement. |
| SEC-09 | P2 | `npm audit` impose probablement des montées majeures. | Planifier une migration contrôlée, ne pas appliquer `--force` aveuglément. |

## 7. Audit qualité, tests et maintenabilité

### Constat

- TypeScript, compilation et 276 tests passent.
- Le gate complet est rouge à cause de 3 erreurs de formatage.
- Couverture globale faible : 43,56 % des lignes et 39,74 % des branches.
- La plupart des contrôleurs sont à 0 % ; les modules de bootstrap et plusieurs intercepteurs/filtres sont à 0 %.
- `RealtimeGateway` est à 0 %, `ScopeService` à 12,5 % des lignes et `scope.repository.ts` à 23,07 %.
- Le test E2E ne valide aucune authentification ni opération métier et peut dépendre de services locaux via `AppModule`.
- Aucun seuil de couverture n'est configuré : une baisse ne casse pas la CI.
- Les tests de workers produisent volontairement des logs d'erreur bruyants, ce qui masque plus facilement une vraie erreur dans les journaux de test.

### Stratégie de test recommandée

1. Tests unitaires ciblés sur règles pures et branches d'erreur.
2. Tests d'intégration repositories/migrations contre PostgreSQL éphémère.
3. Tests Redis pour cache RBAC, métriques, invalidation et adapter temps réel.
4. E2E HTTP sur parcours réels avec rôles et scopes distincts.
5. E2E Socket.IO pour connexion, abonnements autorisés/refusés et déconnexion.
6. Tests de concurrence sur appel du prochain, refresh token, worker notifications et reset quotidien.
7. Tests contractuels comparant l'OpenAPI générée et la version suivie.
8. Seuil progressif de couverture, d'abord 50 %, puis 65-70 % sur le code métier ; éviter un objectif artificiel de 100 %.

## 8. Audit base de données et performance

### Points solides

- Contraintes de clés étrangères, checks et index métier nombreux.
- Index supplémentaires pour monitoring et estimation.
- Transactions sur les mutations critiques.
- Pagination et bornage des périodes de rapport.
- Migrations ascendantes automatiques optionnelles et checksum anti-altération.

### Risques

| ID | Sévérité | Constat | Action attendue |
| --- | --- | --- | --- |
| DB-01 | P0 | Aucun test d'intégration n'exécute les migrations `001` à `014` sur base vierge puis existante. | Ajouter un job PostgreSQL réel avec `db:init`, migrations et `db:verify`. |
| DB-02 | P1 | Aucune procédure de rollback/restauration. | Préférer sauvegarde + migration corrective, documenter et tester le retour arrière. |
| DB-03 | P1 | La migration initiale est très volumineuse et contient de la logique de reprise. | Tester plusieurs états historiques et documenter les préconditions. |
| DB-04 | P1 | Pas de mesures `EXPLAIN ANALYZE` ni de données de charge. | Profiler listes, monitoring, rapports, next-preview et sélection du prochain. |
| DB-05 | P1 | Pas de politique d'archivage des inscriptions/notifications/sessions. | Définir volumes, rétention, partitions ou archivage. |
| DB-06 | P2 | Pas de test de restauration ni RPO/RTO. | Automatiser sauvegarde, restauration et exercice périodique. |

## 9. Audit exploitation, observabilité et livraison

### Présent

- Endpoint de santé avec état PostgreSQL.
- Métriques HTTP et vues d'activité/live.
- Correlation ID et logger Nest/Winston.
- OpenAPI exportable et AsyncAPI fourni.

### Manquant ou insuffisant

- Aucun workflow CI visible.
- Aucun Dockerfile/docker-compose/manifeste Kubernetes dans le dépôt.
- Pas de readiness/liveness distinctes ni validation explicite de Redis dans la santé.
- Pas de métriques au format Prometheus, dashboards ni alertes versionnés.
- Pas de traces distribuées/OpenTelemetry.
- Pas de SLO/SLI, budget d'erreur, seuils d'alerte ou runbook d'incident.
- Pas de stratégie documentée pour arrêt gracieux, déploiement sans interruption et drainage des connexions WebSocket.
- Pas de politique de logs/PII, rétention ou centralisation.
- La documentation promet une architecture BullMQ non implémentée.

## 10. Backlog priorisé avec checkpoints

Les cases ci-dessous sont les checkpoints de réalisation. Une action n'est terminée que lorsque son critère d'acceptation est satisfait.

### P0 — Bloquants avant pilote/production

#### QUAL-01 — Rétablir le gate qualité ✅ Terminé le 22/10/2026

- [x] Formater `src/modules/monitoring/dto/report-response.dto.ts`.
- [x] Formater `src/modules/monitoring/monitoring.module.ts`.
- [x] Exécuter `npm run quality:check`.
- [x] **Checkpoint :** la commande retourne le code 0 (format, lint, typecheck, build et 276 tests réussis).

#### SEC-01 — Corriger les dépendances vulnérables

- [ ] Identifier pour chaque avis le chemin de dépendance et l'exploitabilité réelle.
- [ ] Construire un plan de migration cohérent de la famille Nest ; garder les paquets Nest sur des versions compatibles.
- [ ] Mettre à niveau `multer`, `js-yaml`, `lodash`, `file-type`, `qs`, `uuid` et `picomatch` via leurs parents.
- [ ] Rejouer typecheck, build, unitaires, intégration et E2E.
- [ ] Ajouter `npm audit --omit=dev` au pipeline avec politique d'exception datée.
- [ ] **Checkpoint :** aucune vulnérabilité haute/critique de production, ou dérogation documentée avec échéance et mitigation.

#### OPS-01 — Ajouter une CI obligatoire

- [ ] Créer un workflow avec installation reproductible via `npm ci`.
- [ ] Exécuter format, lint, typecheck, build, tests et audit.
- [ ] Ajouter PostgreSQL et Redis de service pour les intégrations.
- [ ] Vérifier que l'OpenAPI générée ne dérive pas des fichiers suivis.
- [ ] Protéger la branche principale avec ce workflow.
- [ ] **Checkpoint :** une PR volontairement cassée est refusée et une PR saine passe.

#### TST-01 — Construire le socle E2E

- [ ] Rendre l'environnement E2E hermétique et réinitialisable.
- [ ] Tester login, refresh, rejeu d'un refresh, logout et changement de mot de passe.
- [ ] Tester une opération autorisée et refusée pour chaque rôle.
- [ ] Tester l'isolation entre deux sites et deux files.
- [ ] Tester le parcours inscription -> session -> appel -> servi/no-show.
- [ ] Tester rendez-vous -> report -> check-in -> expiration.
- [ ] Tester tracking public sans fuite de PII.
- [ ] Tester webhook valide, signature invalide, timestamp expiré et événement dupliqué.
- [ ] **Checkpoint :** ces parcours tournent en CI sur PostgreSQL et Redis réels.

#### DB-01 — Certifier migrations et restauration

- [ ] Appliquer toutes les migrations sur une base vierge.
- [ ] Tester le baseline sur une base héritée représentative.
- [ ] Exécuter `db:verify` après migration.
- [ ] Écrire le runbook de sauvegarde, restauration et migration corrective.
- [ ] Réaliser un exercice de restauration chronométré.
- [ ] **Checkpoint :** preuve automatisée de migration et compte rendu de restauration avec RPO/RTO.

### P1 — À faire avant généralisation

#### TST-02 — Renforcer la couverture utile

- [ ] Tester `RealtimeGateway` et ses salons.
- [ ] Tester `ScopeService` avec Redis disponible, indisponible et invalidation.
- [ ] Tester `JwtAuthGuard`, filtre global et intercepteurs globaux.
- [ ] Tester les contrôleurs HTTP importants.
- [ ] Tester le runner de migrations et le seed.
- [ ] Définir un seuil initial à 50 % lignes/branches, puis le monter progressivement.
- [ ] **Checkpoint :** ≥ 65 % lignes et ≥ 60 % branches sur les services/core critiques, sans baisse sur les nouvelles PR.

#### ARC-01 — Découper le domaine registrations

- [ ] Cartographier les invariants et transactions avant refactoring.
- [ ] Extraire création, rendez-vous, check-in, suivi/lecture et annulation.
- [ ] Conserver les frontières transactionnelles explicites.
- [ ] Ajouter des tests de caractérisation avant déplacement.
- [ ] **Checkpoint :** aucun service métier principal > 400 lignes et comportement API inchangé.

#### ARC-02 — Réduire les repositories monolithiques

- [ ] Séparer commandes et lectures complexes lorsque cela améliore la cohésion.
- [ ] Créer des types de rows SQL précis au lieu de `Record<string, any>`.
- [ ] Centraliser uniquement les helpers SQL sûrs et stables.
- [ ] **Checkpoint :** repositories critiques cohésifs, mappings typés et tests d'intégration associés.

#### ARC-03 — Fiabiliser les workers en multi-instance

- [ ] Décider scheduler dédié ou BullMQ.
- [ ] Documenter l'idempotence et le verrouillage de chaque worker.
- [ ] Séparer le rôle API du rôle worker au déploiement si nécessaire.
- [ ] Tester deux instances concurrentes.
- [ ] **Checkpoint :** aucun envoi, reset ou traitement métier dupliqué sous concurrence.

#### SEC-03 — Journalisation et audit métier ✅ Terminé le 23/10/2026

- [x] Remplacer les `console.*` de production par le logger structuré.
- [x] Normaliser les erreurs `unknown` et masquer tokens, secrets et PII.
- [x] Définir les événements métier auditables.
- [x] Ajouter identité, action, cible, date, corrélation et résultat dans un journal protégé.
- [x] **Checkpoint :** tests prouvant la présence des événements et l'absence de secrets/PII interdits.

Précisions d'exploitation : la table est append-only du point de vue applicatif. Les privilèges PostgreSQL et l'alerte obligatoire sur le mode fail-open sont décrits dans `todo/audit_log_runbook.md`. La durée de rétention reste volontairement rattachée à PRI-01 afin de ne pas inventer une règle juridique.

#### PRI-01 — Conformité données personnelles

- [ ] Inventorier finalités, bases légales, champs personnels et durées de conservation.
- [ ] Implémenter export et rectification.
- [ ] Implémenter anonymisation/suppression compatible avec les obligations statistiques.
- [ ] Automatiser la purge des données expirées.
- [ ] Documenter et tester les droits d'accès aux notes sensibles.
- [ ] **Checkpoint :** procédure RGPD testée sur un dossier complet et traçable.

#### PERF-01 — Mesurer et corriger les performances

- [ ] Créer un dataset volumétrique représentatif.
- [ ] Mesurer p50/p95/p99 et débit des endpoints prioritaires.
- [ ] Exécuter `EXPLAIN (ANALYZE, BUFFERS)` sur les requêtes lentes.
- [ ] Tester contention de `callNext`, sessions, rapports et workers.
- [ ] Définir budgets de performance et régression en CI/nightly.
- [ ] **Checkpoint :** objectifs chiffrés tenus sur la volumétrie cible.

#### OPS-02 — Industrialiser le déploiement

- [ ] Fournir une image reproductible, non-root et minimale.
- [ ] Ajouter readiness/liveness et dépendances critiques.
- [ ] Documenter variables, secrets, migrations et arrêt gracieux.
- [ ] Ajouter dashboards, alertes et runbooks.
- [ ] Tester rolling deploy et connexions WebSocket.
- [ ] **Checkpoint :** déploiement et rollback validés en préproduction sans perte de traitement.

### P2 — Maintenabilité et complétude produit

#### DOC-01 — Aligner la documentation

- [ ] Corriger l'arborescence du README selon les modules réels.
- [ ] Corriger `/api/monitoring` en `/api/v1/monitoring`.
- [ ] Retirer ou préciser la mention BullMQ.
- [ ] Clarifier que rendez-vous, affichage, guichets, tickets et tracking sont des capacités intégrées à d'autres modules.
- [ ] Corriger le lien local `.env.example` et vérifier l'encodage UTF-8.
- [ ] Ajouter une matrice rôle/permission et un guide de démarrage reproductible.
- [ ] **Checkpoint :** un nouveau développeur lance et teste l'API uniquement avec le README.

#### FUN-01 — Valider les écarts produit

- [ ] Décider si un calendrier/créneaux explicite est requis.
- [ ] Décider si un catalogue services/motifs distinct des forfaits est requis.
- [ ] Décider si exports CSV/PDF et rapports planifiés sont requis.
- [ ] Confirmer que borne, écran salle, QR et tracking sont portés par le frontend.
- [ ] Confirmer si multi-tenant, abonnement, quota et facturation sont hors périmètre.
- [ ] Transformer chaque décision retenue en story avec critères d'acceptation.
- [ ] **Checkpoint :** périmètre signé par produit, UX, backend et frontend.

#### QUA-02 — Renforcer les règles statiques

- [ ] Remplacer progressivement les `any` de production par `unknown` ou des interfaces.
- [ ] Activer `no-explicit-any` par étapes.
- [ ] Ajouter détection de cycles et règles de frontières.
- [ ] Supprimer `package.json.backup` ou documenter sa génération.
- [ ] Nettoyer les dépendances inutilisées, dont BullMQ si non retenu.
- [ ] **Checkpoint :** zéro `any` non justifié dans le code de production et inventaire de dépendances propre.

#### OBS-01 — Compléter l'observabilité

- [ ] Exposer des métriques standard compatibles avec la plateforme de supervision.
- [ ] Ajouter métriques workers, file d'outbox, latence DB/Redis et connexions WS.
- [ ] Définir SLI/SLO et alertes.
- [ ] Ajouter tracing distribué si l'écosystème le justifie.
- [ ] **Checkpoint :** un incident simulé est détecté, corrélé et diagnostiqué depuis dashboards/logs.

## 11. Ordre de réalisation conseillé

### Sprint 0 — Remettre le dépôt au vert

- [x] QUAL-01.
- [ ] Créer la CI minimale d'OPS-01.
- [ ] Démarrer SEC-01 avec une branche de migration dédiée.
- [ ] Corriger immédiatement la documentation factuellement fausse de DOC-01.

### Sprint 1 — Sécuriser les parcours critiques

- [ ] Socle TST-01 : auth, RBAC, scope et inscription.
- [ ] DB-01 : base vierge, base héritée et restauration.
- [x] SEC-03 : logs sans fuite.

### Sprint 2 — Rendre l'exploitation fiable

- [ ] Finir TST-01 : WebSocket, webhook, workers et concurrence.
- [ ] ARC-03 : mode d'exécution distribué des workers.
- [ ] OPS-02 : packaging, health checks, métriques et runbooks.

### Sprints suivants — Réduire la dette et compléter le produit

- [ ] ARC-01 et ARC-02 par petites extractions couvertes de tests.
- [ ] PRI-01 et PERF-01.
- [ ] Décisions FUN-01, puis implémentation uniquement des besoins validés.
- [ ] TST-02, QUA-02 et OBS-01 en amélioration continue.

## 12. Définition de fini globale

Le backend peut être considéré prêt pour production lorsque toutes les conditions suivantes sont cochées :

- [ ] `npm run quality:check` passe sur un clone propre.
- [ ] Aucune vulnérabilité haute ou critique de production sans dérogation approuvée et datée.
- [ ] CI obligatoire et reproductible avec PostgreSQL et Redis.
- [ ] Parcours E2E critiques et matrice RBAC/scope au vert.
- [ ] Migrations, sauvegarde et restauration testées.
- [ ] Workers prouvés sûrs avec plusieurs instances.
- [ ] Couverture critique conforme aux seuils convenus.
- [ ] Logs, métriques, alertes, SLO et runbooks disponibles.
- [ ] Politique de données personnelles mise en œuvre.
- [ ] Documentation alignée avec le code et OpenAPI sans dérive.
- [ ] Tests de charge conformes à la volumétrie cible.
- [ ] Validation finale sécurité, produit et exploitation signée.

## 13. Fichiers de référence principaux

- Composition et pipeline : `src/app.module.ts`, `src/main.ts`.
- Configuration : `src/core/config/configuration.ts`, `.env.example`.
- Auth/RBAC : `src/modules/auth/`, `src/core/auth/`, `src/core/rbac/`.
- Temps réel : `src/core/realtime/` et `asyncapi.yaml`.
- Métier : `src/modules/`.
- Workers : `src/workers/`.
- Base : `src/core/database/` et migrations `001` à `014`.
- Contrat HTTP : `openapi.json`, `openapi.yaml`.
- Documentation métier : `ai/sfd.md`, `ai/final_ihm_specification.md`.
- Tests E2E actuels : `test/app.e2e-spec.ts`.

---

Ce rapport décrit l'état observé du dépôt à la date indiquée. Les constats de production, performance, fournisseurs externes et conformité doivent être confirmés dans un environnement représentatif.

<!-- CHECKPOINT id="ckpt_mvjwoqex_luyssl" time="2026-10-22T19:00:21.561Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvjx1ldv_oom61h" time="2026-10-22T19:10:21.571Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvkmubot_yijden" time="2026-10-23T07:12:32.436Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvkn76km_gxai00" time="2026-10-23T07:22:32.326Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvknk1j4_ck9go4" time="2026-10-23T07:32:32.320Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvknwwgg_7w1npf" time="2026-10-23T07:42:32.272Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
