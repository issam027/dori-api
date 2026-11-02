# Source de vérité opérationnelle — 2026-11-02

## Résultat

Les déploiements Docker intra et cloud installent le même moteur opérationnel PostgreSQL. `QueueEstimationModule` expose ses résultats à l'API ; les lectures groupées du cockpit et de la supervision utilisent directement le même contrat SQL. L'agent réplique les résultats de ce moteur, sans autre formule. Le cloud diffuse la projection intra par SSE sans la recalculer.

Les rapports conservent leurs mesures historiques : ils ne constituent pas une autre prévision d'attente. Les paramètres de priorité et `average_wait_time` restent des entrées du moteur, ce dernier étant le repli théorique lorsque aucune médiane exploitable n'existe.

## Étapes terminées et validées

- [x] Éligibilité et score uniques dans `queue_operational_candidates`.
- [x] Ordre unique dans `queue_operational_ranking` : tickets immédiatement appelables, score décroissant, date de référence, UUID stable ; rendez-vous anticipés ensuite, par heure prévue.
- [x] `queue_operational_positions` est une projection utilisée du classement commun, sans deuxième règle.
- [x] Formule et arrondis uniques dans `queue_estimate_minutes` ; distinction entre un ticket déjà positionné et un nouvel arrivant.
- [x] Contexte commun `queue_wait_context` : personnes en attente, guichets actifs, P50 du cycle entre appels, méthode, fiabilité et dates de calcul.
- [x] Résultats par ticket dans `queue_ticket_estimates`, y compris la position et l'attente nulles ou égales à zéro selon l'état métier. Les tickets en cours sont également lus via ce moteur.
- [x] Fraîcheur et agrégation communes dans `queue_estimation_needs_refresh` et `queue_refresh_estimation_stats` : révisions des entrées et plafond de 15 minutes ; le worker et les lectures utilisent les mêmes règles.
- [x] Statistiques antérieures utilisées en repli ; statistiques futures exclues. Une estimation indisponible n'est pas présentée comme zéro.
- [x] Cockpit, kiosque, supervision, tracking, notifications, affichage, aperçu et appels opérateur raccordés au moteur commun.
- [x] Transactions d'appel, verrou de remise à zéro et `FOR UPDATE OF c SKIP LOCKED` conservés. Préparation des statistiques avant les verrous de projection pour préserver l'ordre des verrous.
- [x] Les changements des priorités héritées d'un site invalident également les projections des files concernées.
- [x] Calcul par lot limité aux tickets et aux dates demandés. Migration 024 évitant de calculer puis jeter des comptages lors de la préparation des statistiques de projection.
- [x] Anciennes formules TypeScript, agrégation SQL embarquée dans le worker, tri FIFO de l'affichage, requêtes de priorité distinctes, comptage de secours du tracking, paramètres de priorité désormais inutilisés et dépendance `ClockModule` devenue inutile supprimés.
- [x] Présentation des valeurs indisponibles corrigée dans le tracking et le kiosque ; textes localisés et correctif de débordement du libellé SSE sur mobile RTL.
- [x] Migrations 023 et 024 appliquées par le runner habituel aux bases Docker intra et cloud. Les migrations appliquées restent immuables.

## Validation

- Suite API complète : **443 tests passent**, 92 suites.
- Après les derniers ajustements : 29 tests ciblés supervision/worker, 19 tests tracking et 4 tests de module/estimation passent.
- TypeScript, lint ciblé et audit d'architecture passent ; aucune boucle statique d'import de production.
- `test/operational-source-of-truth.sql` vérifie sur PostgreSQL réel les priorités, rendez-vous anticipés, départages, calculs file/ticket, lots limités, arrondis, P50 rafraîchi, ancien P50, exclusion des valeurs futures, faible échantillon et absence de guichet.
- `test/verify-operational-source.cjs` exécute les vrais dépôts compilés : même estimation cockpit/kiosque/supervision, même ordre affichage/aperçu/appel effectif, position zéro après appel et appel anticipé du premier rendez-vous futur. Toutes les données et tous les événements de ces fixtures sont annulés par rollback, également sur échec.
- Sur **100 tickets intra réels**, aucun écart entre les positions/estimations des projections et celles du moteur commun.
- Empreintes des **9 fonctions opérationnelles/projection identiques** entre les bases intra et cloud.
- Lors du contrôle final : **122 411 projections** identiques entre intra et cloud en identifiant, version, position et estimation ; aucun envoi en attente ni erreur de l'agent.
- Suite navigateur complète : **109 parcours passent**. Après ajout du traitement d'estimation indisponible : **9 parcours publics** et le cas mobile RTL dans les quatre thèmes passent. Le catalogue de traductions, TypeScript, lint ciblé et budgets de bundle passent.
- La recherche de personne ayant échoué sous charge a été rejouée trois fois avec succès ; la suite complète a ensuite passé avec un seul worker. Aucun délai de test ni assertion fonctionnelle n'a été assoupli.

## Rejouer l'intégration

Dans un environnement Docker intra de développement contenant les données de seed et les migrations 023/024 :

```powershell
docker cp test/operational-source-of-truth.sql intra-dorify-engine-1:/tmp/operational-source-of-truth.sql
docker cp test/verify-operational-source.cjs intra-dorify-engine-1:/tmp/verify-operational-source.cjs
docker exec -e OPERATIONAL_RULES_FIXTURE=/tmp/operational-source-of-truth.sql intra-dorify-engine-1 node /tmp/verify-operational-source.cjs
```

Les tests affichent seulement des résultats de validation et ne publient pas de données personnelles. La cohérence porte sur des règles et des entrées identiques à une date d'observation donnée ; la réplication intra/cloud reste asynchrone.
