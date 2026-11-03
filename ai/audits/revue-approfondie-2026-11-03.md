# Revue approfondie — 3 novembre 2026

Cette deuxième passe porte sur les requêtes réelles, les frontières de période,
les règles de disponibilité et les courses asynchrones des trois composants.

## Défauts corrigés

| Défaut confirmé                                                                                                                                                  | Correction                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Les attentes étaient regroupées avec la date de fin de service ; les moyennes pouvaient donc changer de jour ou d'heure. Les percentiles avaient le même défaut. | Agrégations distinctes par called_at pour l'attente et served_at pour le service, avec filtrage propre à chaque événement. Le même générateur SQL sert aux séries globales et par file.                                                    |
| Une inscription créée avant la fenêtre, appelée dedans et servie après pouvait disparaître des durées du rapport.                                                | called_at fait partie du périmètre temporel. La série par file conserve aussi les périodes qui n'ont qu'une durée, sans inscription ni fin de service.                                                                                     |
| Le pilote PostgreSQL interprétait les libellés de périodes selon le fuseau du processus Node.                                                                    | Typage explicite du transport des libellés calendaires, en conservant leur représentation attendue par le front. Vérification sous UTC et Europe/Berlin.                                                                                   |
| Une association de service active continuait à exposer un service désactivé globalement, y compris lors d'une nouvelle inscription.                              | Filtrage global dans la liste, son compteur et la vérification transactionnelle d'inscription. La représentation détaillée distingue également activité du service et activité de son association.                                         |
| Un créneau commençant avant une pause pouvait néanmoins la chevaucher. Le mode summaryOnly construisait tous les objets de créneaux avant de les jeter.          | Gabarit quotidien calculé une seule fois, exclusion de tout chevauchement, protection contre une durée nulle/invalide. Totaux calculés sans construire les objets de réponse détaillée en mode résumé ; index de réservations dédoublonné. |
| Deux ouvertures concurrentes du listener agent pouvaient créer deux connexions ; une connexion pouvait terminer son ouverture après la fermeture du store.       | Ouverture partagée, attente de la connexion en cours pendant la fermeture et interdiction d'une réouverture après fermeture. Délais bornés de connexion et d'exécution de LISTEN.                                                          |
| Après retrait d'une file du cockpit, un événement tardif ou un timer déjà programmé pouvait encore demander son rafraîchissement.                                | Le cycle de vie suit le site et la liste normalisée des files ; les événements hors périmètre sont ignorés et les timers de l'ancien périmètre annulés.                                                                                    |

## Vérifications de comportement

- [x] PostgreSQL : appel avant minuit et fin de service après minuit. Attente,
      moyenne, médiane et P90 restent dans la période de l'appel ; les durées de
      service restent dans celle de la fin de service.
- [x] PostgreSQL : fenêtre contenant seulement l'appel. La durée reste présente
      dans les totaux et dans la série par file.
- [x] Les deux scénarios passent avec TZ=UTC et TZ=Europe/Berlin.
- [x] PostgreSQL : désactivation d'un service dans des tables temporaires ; il
      disparaît de la liste et du compteur et n'est plus accepté à l'inscription.
- [x] Gabarit de rendez-vous : pause non alignée, bornes de pause, fermeture avec
      créneau incomplet et durées invalides.
- [x] Agent : ouverture concurrente et fermeture pendant la connexion ; aucun
      abonnement tardif ni connexion laissée ouverte.
- [x] Web : retrait d'une file, événement tardif ignoré et rafraîchissement
      toujours possible pour la nouvelle file.

Les vérifications PostgreSQL n'écrivent que dans des tables temporaires avec
rollback. Les données applicatives et le schéma consolidé sont conservés.

Commandes reproductibles, avec DATABASE_URL fourni dans l'environnement :

```powershell
npm run db:verify:report-periods
npm run db:verify:inactive-service
```

## Performance et organisation

Les rapports conservent huit requêtes bornées, sans requête par période ni par
file. Les agrégations des durées sont partagées et n'utilisent pas la duplication
de chaque ligne en deux événements. Les plans EXPLAIN ANALYZE ont été comparés
sur le jeu intra ; la variance de charge ne permet pas d'affirmer un gain de
latence global. La correction d'attribution reste l'objectif principal.

Le gabarit des rendez-vous est une fonction dédiée, indépendante du fuseau ;
ClockService conserve la conversion de chaque date métier en instant. L'agent
conserve la responsabilité des connexions dans son store. Le cockpit conserve
ses abonnements et leurs protections dans son hook dédié.

## Validation finale

- [x] API : format, lint, types, build, architecture, UUID ; 90 suites et 473 tests.
- [x] Agent : architecture, format, types, 22 tests et build.
- [x] Web : lint, types, architecture/frontières, budgets du bundle, build ;
      97 fichiers, 332 tests unitaires et 24 parcours navigateur ciblés.
- [x] Docker intra/cloud/agent actualisés ; neuf conteneurs sains. Connexions,
      rapports et suivi intra/cloud vérifiés après redémarrage. Les réponses réelles
      de disponibilité détaillées et résumées ont les mêmes totaux ; le résumé
      n'inclut pas les objets de créneau.

Aucune migration, réinitialisation de base ou dépendance supplémentaire.

## Commits

- API `6bd95d9` : périodes et événements des rapports.
- API `be97815` : services globalement désactivés.
- API `30c9068` : gabarits de créneaux et chevauchements des pauses.
- Agent `acddfc6` : concurrence du listener PostgreSQL.
- Web `fc290a4` : périmètre des événements du cockpit.
