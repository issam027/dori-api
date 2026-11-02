# Revue de factorisation, optimisation et organisation — 2 novembre 2026

Périmètre : code de production des trois dépôts, frontières d'architecture,
services/repositories API, orchestration agent, cockpit et graphiques web.
Les contrats HTTP et le schéma de données restent inchangés.

## Corrections réalisées

| Point constaté                                                                                       | Correction                                                                                                                                                                                                                          | Validation                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Rapports : relecture du périmètre pour chaque file et pour le site                                   | Une seule lecture du périmètre, puis assertions centralisées dans ScopeService sur toute la sélection. Set pour les sélections multiples ; contrôle simple sans allocation pour une file.                                           | Test du nombre de lectures et refus d'une file inaccessible avant toute requête de rapport.                        |
| Chargement séquentiel de deux affectations indépendantes pour opérateur/borne                        | Lectures des affectations de sites et de files en parallèle dans ScopeService.                                                                                                                                                      | Tests des périmètres et parcours navigateur des rôles.                                                             |
| Deux convertisseurs des services de file pouvaient diverger                                          | presentQueueTier partagé par listes et mutations ; même traitement des montants, devise, description, activité et service par défaut.                                                                                               | Tests des services et repositories, lint/types/build.                                                              |
| Code hérité sans consommateur de production                                                          | Suppression de ReportsRepository.getSeries, de sa projection et du type SeriesRow ; suppression de findActiveNotificationRules ; suppression de l'alias getQueueTiers et adaptation de son test à la méthode réelle findQueueTiers. | Recherche des références, contrôle d'architecture et tests API complets.                                           |
| Horloge directement instanciée dans les rapports                                                     | Utilisation de ClockService pour parsing et date de génération, conformément à l'architecture existante.                                                                                                                            | Tests et instanciation réelle du module Monitoring après redémarrage.                                              |
| Cockpit : cycle de vie SSE inclus dans la page, réponses tardives après changement de site/démontage | Hook useCockpitRealtime : debounce par file, annulation des timers, génération par périmètre et révision par file. Une réponse ancienne ne remplace plus une réponse récente.                                                       | Quatre tests : debounce, changement de site/démontage, réponse de l'ancien site, réponses reçues dans le désordre. |
| Graphiques : recherches répétées dans les listes et labels associés par position                     | Préparation pure dans reports/utils/report-chart-data.ts ; index des files par identifiant et sélection par Set. Une identité absente conserve le nom de son groupe plutôt que celui d'une autre file.                              | Tests des identités absentes, périodes manquantes, sélection vide et ordre des couleurs.                           |
| Graphiques : copie de toutes les valeurs et appel Math.max avec arguments dépliés                    | Maximum calculé en un parcours, sans tableau intermédiaire ; mémorisé lors des interactions du graphique.                                                                                                                           | Test de 300 000 valeurs, échelle vide et valeurs non finies.                                                       |
| Agent : traitement durable des commandes imbriqué dans l'orchestration générale                      | CommandProcessor dédié ; DorifyAgent conserve scheduling, contrôle, heartbeat, tracking et relais. Expiration, reprise idempotente, ordre du curseur et budget restent identiques.                                                  | 21 tests agent, vérification du contrat, build et agent Docker opérationnel.                                       |

## Organisation retenue

- **API** : les contrôleurs valident les entrées et délèguent ; les services
  orchestrent les règles ; les repositories portent le SQL. Les représentations
  réutilisées restent dans leur module métier, sans dépendance réseau. RBAC et
  horloge demeurent centralisés dans core.
- **Web** : les pages composent les interactions visuelles ; les hooks possèdent
  cache, abonnements et cycle de vie ; les fonctions pures de préparation restent
  dans utils de la feature. Le client généré n'est pas modifié manuellement.
- **Agent** : l'orchestrateur possède le cycle global ; commands contient le
  traitement durable ; store et clients conservent la persistance et le transport.
- Les extractions isolent une responsabilité effectivement utilisée : aucune
  couche de renommage, aucun dossier vide ni nouveau calcul d'estimation.

## Résultats et portée des optimisations

La validation des filtres d'un rapport passe de N+1 lectures du périmètre
(N+2 avec un site explicite) à une seule pour N files. Les réponses HTTP et les
contrôles d'accès restent les mêmes. Les gains réseau découlent du nombre
d'appels, sans prétendre à un gain de latence global non mesuré.

Les rapprochements des séries et files utilisent des index plutôt que des
recherches imbriquées. Le calcul du maximum reste linéaire, mais supprime une
copie des valeurs et la limite du nombre d'arguments JavaScript. La gestion SSE
supprime les mises à jour périmées ; elle ne remplace pas le flux par du polling.

## Vérifications

- [x] API : format, lint, types, build, architecture, UUID ; 89 suites, 470 tests.
- [x] Agent : architecture, format, types, contrat, 21 tests et build.
- [x] Web : architecture sans cycle, frontières des features, lint et types.
- [x] Web : 97 fichiers de tests, 331 tests réussis après génération du client.
- [x] Navigateur : 134 tests généraux, 20 parcours ciblés sur le build final et
      deux tests cloud avec le mode cloud activé.
- [x] Budgets du bundle respectés ; aucun contrat ni client généré modifié.
- [x] API Docker : connexions managers, périmètres, rapports historiques et lecture
      d'un ticket intra depuis le cloud, avec position et estimation concordantes.
- [x] API et web intra/cloud ainsi que l'agent reconstruits et actualisés ;
      neuf conteneurs sains, interfaces et readyz agent en HTTP 200.

Les données tunisiennes existantes sont conservées ; aucune migration ni
réinitialisation de base n'est nécessaire pour cette revue.

## Commits des corrections

- API `3972d17` : périmètre des rapports, horloge commune et ancien moteur SQL retiré.
- API `cc47097` : représentation des services centralisée et méthodes mortes retirées.
- Web `319ba77` : hook SSE du cockpit et protection contre les réponses périmées.
- Web `b9f2b76` : préparation indexée des graphiques et calculs purs dans utils.
- Agent `5099249` : traitement durable des commandes isolé.
