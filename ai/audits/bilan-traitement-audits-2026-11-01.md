# Bilan du traitement des deux audits

Les 31 constats initiaux sont corrigés et validés : F01–F16 et UX01–UX05, AR01–AR04, QA01–QA02, DC01–DC04. Les cases des deux rapports sont cochées et chaque constat possède une section de validation. Les conclusions et mesures initiales restent conservées comme référence historique.

## Vérifications finales

| Porte | Résultat |
| --- | --- |
| API : format, lint, types, build, architecture, UUID, tests | Passe ; 91 suites, 439 tests |
| Front : lint, types et tests unitaires | Passe ; 89 suites, 298 tests |
| Agent : format, types, build, architecture et tests | Passe ; trois suites, 14 tests |
| Chromium : suite complète | 106 parcours passent |
| Responsive : 17 routes × cinq largeurs | 85 parcours, aucun débordement global, aucune page d’erreur |
| Axe : principaux, complément et modales | Aucune violation relevée dans cette matrice |
| Complément responsive | 24 parcours et trois modales ; focus, Escape et axe passent |
| Tablette tactile/clavier | Régressions à 1023, 1024 et 1101 px passent ; champs de 44 px, calendrier défilable au clavier, aperçu focalisable |
| Front : phase11, i18n, env, UI, tokens et budgets | Passent ; client Orval conforme et génération stable |
| Imports de valeurs | Aucun cycle statique dans les trois composants ; aucun import interne entre features |
| PostgreSQL : résultats métier | Rapports identiques aux références sur quatre granularités ; annuaire identique sur cinq combinaisons ; classement opérationnel identique sur cent inscriptions |
| PostgreSQL : concurrence et reprise | CAS de séquence, reprise de lease, transactions concurrentes sans deadlock et invalidations de plusieurs journées passent |
| Statistiques et rétention | Recalcul coalescé pour dix lecteurs ; journées distinctes et rollover vérifiés ; projections non acquittées, dernier événement de topic et commandes en cours préservés |
| Notifications de seuil | Worker raccordé ; candidat neuf retenu, clé d’idempotence déjà traitée écartée ; aucune notification externe émise par les validations |
| Déploiement | Deux API, deux interfaces et agent sains ; agent actif, sans erreur cloud ni retard de projections lors du contrôle final |
| Compression HTTP | JS/CSS gzip et Vary sur les deux interfaces ; SSE réel via proxy sans compression |

Les journaux `api-quality-validation.log`, `web-lint-validation.log`, `web-unit-validation.log`, `agent-quality-validation.log` et `web-e2e-validation.log` donnent le détail des portes exécutées. Les mesures après modification sont séparées des mesures et captures initiales.

## Livraison et preuves reproductibles

Migrations 016 à 021 appliquées et enregistrées avec contrôle de checksum sur intra, cloud Docker et Neon `dorify-dev`. Aucune réinitialisation ni réinjection de données de démonstration. `pg_stat_statements` est disponible sur les trois bases. Les index et contrats SQL précèdent le déploiement des consommateurs.

Les conteneurs Docker intra/cloud et agent ont été reconstruits et relancés. Les fichiers CI sont prêts dans les trois dépôts ; leur exécution sur un service CI distant n’est pas prétendue. Les changements sont enregistrés dans des commits locaux distincts : API `017301d`, agent `bc972b8`, audit front `5e92119` et retrait du bouton d’affectation en double `28d6688`. Ce bilan et les preuves sont regroupés dans un commit documentaire séparé.

| Preuve | Fichier |
| --- | --- |
| Déploiement, gzip, santé et SSE | [deployment-validation-2026-11-01.json](deployment-validation-2026-11-01.json) |
| Migrations des trois bases | `migrations-intra-validation-2026-11-01.json`, `migrations-cloud-validation-2026-11-01.json`, `migrations-neon-validation-2026-11-01.json` |
| Régression responsive | [mesures-uix-apres-2026-11-01.json](mesures-uix-apres-2026-11-01.json), [complément](mesures-uix-complement-apres-2026-11-01.json), captures dans `uix-captures-apres/` |
| Rapports | [résultats comparés](reports-validation-2026-11-01.json), [sept mesures alternées et plans](report-plan-validation-2026-11-01.json) |
| Tracking et commandes | [tracking-validation-2026-11-01.json](tracking-validation-2026-11-01.json), [concurrence](tracking-concurrency-validation-2026-11-01.json) |
| Statistiques et rétention | [statistics-retention-validation-2026-11-01.json](statistics-retention-validation-2026-11-01.json) |
| Sélection de notifications | [notification-claim-validation-2026-11-01.json](notification-claim-validation-2026-11-01.json), [seuils](threshold-validation-2026-11-01.json) |
| Annuaire | [persons-validation-2026-11-01.json](persons-validation-2026-11-01.json) |
| SSE avec PostgreSQL réel | [sse-load-validation-2026-11-01.json](sse-load-validation-2026-11-01.json) |
| Architecture et exploitation | [décisions et contrat](remediation-architecture-et-exploitation-2026-11-01.md), [graphe](architecture-imports-apres-2026-11-01.json) |

Les scripts `validate-*.cjs` et `benchmark-report-plans.cjs` permettent de reproduire les contrôles. Ils lisent une connexion de configuration (`DORI_AUDIT_DATABASE_URL` ou `DATABASE_URL`) sans identifiants dans le code. `DORI_AUDIT_DATABASE_PORT=15432` sélectionne le port intra lorsque la configuration locale utilise un autre port. Les tests de mutations PostgreSQL annulent leurs transactions ; la preuve de concurrence conserve uniquement une demande technique de rafraîchissement, pas de modification métier. Les références Git des comparaisons sont figées pour rester reproductibles après un prochain commit.

## Limites des preuves et observation distincte

Les mesures de performance restent locales et sensibles au cache et à la charge. Le premier recalcul de projections est plus coûteux ; le gain porte sur les cycles incrémentaux. Le test SSE de cent clients utilise les observables applicatifs avec PostgreSQL réel ; il ne mesure pas cent connexions HTTP distribuées. Le proxy SSE réel a été vérifié séparément. Chromium, axe et les dimensions simulées ne certifient pas les lecteurs d’écran ni tous les appareils physiques.

La construction a également révélé des alertes de dépendances préexistantes, distinctes des 31 constats initiaux : l’inventaire npm d’exécution API conserve 17 alertes, dont six élevées et aucune critique. L’essai de correction compatible n’a pas supprimé ces alertes ; plusieurs chemins de correction proposés nécessitent une migration majeure de Nest/Swagger ou de leurs dépendances. Aucune mise à niveau majeure forcée n’a été introduite dans ce traitement. Le détail est conservé dans [api-runtime-dependencies.json](api-runtime-dependencies.json). La clôture des deux audits ne constitue donc pas une déclaration d’absence de vulnérabilités de dépendances.
