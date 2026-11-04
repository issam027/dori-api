# Charge SaaS sur 100 000 inscriptions — 4 novembre 2026

## Données conservées

Le site **PERF SaaS - Tunis Centre 100K** reste dans le Docker intra : **100 000 inscriptions ajoutées**, **40 000 personnes**, six files, trois services, des noms français et arabes, 5 000 notes et 10 000 notifications synthétiques déjà délivrées. Historique réparti sur 90 jours, réservations sur 30 jours, états et durées variés. Les horaires très larges servent au banc de charge et ne représentent pas des horaires métier recommandés.

La base contient **118 019 inscriptions** au total : les 18 019 inscriptions initiales sont préservées. Contrôle final : aucune inscription avec appel antérieur au check-in ou service terminé avant l'appel. Les sessions des opérateurs de test ont été fermées ; les six sessions préexistantes de l'utilisateur restent présentes. Aucun volume intra ni aucune inscription de test n'a été supprimé. Une sauvegarde préalable est conservée localement dans `.tmp-consolidation/dori-before-saas-perf.dump`.

## Campagne et résultats

HTTP réel via nginx et API intra, PostgreSQL et Redis réels, Edge/Playwright sans réponses simulées. Cloud et agent arrêtés pour limiter la mémoire. Générateur HTTP en conteneur limité à deux CPU et 512 Mio ; ces limites ne sont pas celles du serveur API. Pool API existant conservé. Seuils anti-abus relevés temporairement pour mesurer la capacité puis rétablis avec le compose intra normal.

| Étape                                     | Lecteurs / opérateurs |  Requêtes | Erreurs | Appels / clôtures |
| ----------------------------------------- | --------------------: | --------: | ------: | ----------------: |
| Premier palier, 2 min                     |                 4 / 2 |       619 |       0 |           48 / 48 |
| Deuxième palier, 2 min                    |                 8 / 6 |     1 254 |       3 |         138 / 138 |
| Troisième palier, 3 min, avant correction |               16 / 18 |     3 918 |      23 |         595 / 595 |
| Troisième palier rejoué, après correction |               16 / 18 | **3 713** |   **0** |     **584 / 584** |

Aucune double attribution observée dans les ensembles de tickets appelés par les générateurs. Au total : 1 365 appels et clôtures par les scénarios de charge. Un appel supplémentaire a été effectué dans le navigateur ; sa clôture a ensuite été confirmée séparément via l'API réelle. Les scénarios incluent rappels et absences, avec 800 ms de réflexion entre lectures et environ cinq secondes par cycle opérateur. Le dernier palier représente **20,07 requêtes/s**, avec une boucle du générateur au p99 de 25,53 ms et 69 Mio de RSS. C'est une charge en boucle fermée, pas une preuve de capacité à un débit d'arrivée illimité.

Latences p95 du dernier palier :

| Opération            |      p95 |
| -------------------- | -------: |
| Appeler le suivant   |   910 ms |
| Clôturer un ticket   |   714 ms |
| Calendrier semaine   |   686 ms |
| Recherche annuaire   |   795 ms |
| Audit                |   203 ms |
| Rapport sur 90 jours | 2 734 ms |

Les rapports longs restent les opérations les plus coûteuses ; ce résultat ne constitue pas une certification de production.

Les temps de navigation complets mesurés au p95 sont de 4,52 s sur desktop, 4,18 s sur tablette et 7,84 s sur mobile. Ils incluent le chargement des données, le menu mobile et une vérification de stabilité de 400 ms. Les parcours fonctionnent sans débordement horizontal, mais ces temps montrent qu'il reste une marge d'amélioration de la navigation, particulièrement sur mobile ; les corrections de cette campagne visent d'abord les blocages et les erreurs concurrentes.

## Défauts détectés et corrigés

- [x] **Navigation bloquée par six flux SSE HTTP/1.** Les flux par file occupaient les connexions disponibles au même hôte, retardant les chunks des pages. Ajout d'un abonnement multiplexé authentifié, limité à 100 files, autorisation de l'ensemble avant ouverture, contrôle de l'expiration et réautorisation conservés. Le frontend partage désormais une connexion pour plusieurs files et conserve les heartbeats identifiés par file. Les parcours réels ont été rejoués après correction.
- [x] **Cockpit : erreurs 500 pendant les mises à jour concurrentes.** Les 26 erreurs du premier passage venaient uniquement du cockpit. PostgreSQL signalait une impossibilité de sérialiser une mise à jour concurrente : le rafraîchissement canonique des estimations écrivait depuis la transaction de lecture `REPEATABLE READ`. Rafraîchissement déplacé avant cette transaction ; lecture canonique sans écriture à l'intérieur du snapshot. Aucun calcul parallèle ajouté. Palier maximal rejoué : zéro erreur.
- [x] **Halo du loader tronqué.** Dégradé circulaire `closest-side`, dimension bornée au conteneur et transparence avant les bords. Captures réelles des variantes pleine page et compacte vérifiées.
- [x] **Actions rendez-vous sur mobile.** Libellés visibles, grille de deux colonnes, action principale sur toute la largeur lorsqu'elle existe, zones tactiles d'au moins 48 px et suppression du bouton de fermeture redondant dans le pied des écrans d'action. Consultation, reprogrammation et confirmation d'annulation vérifiées à 390 × 844, sans valider d'annulation ni de déplacement.

## Couverture et validation

- [x] 25 scénarios HTTP de lecture : cockpit, files, prochains tickets, annuaire/recherche/fiche/notes, calendriers semaine et mois, statuts, guichets, supervision, audit et filtre, notifications, configuration, utilisateurs/rôles, traductions, santé, rapports 7/30/90 jours et par file.
- [x] **108 navigations réussies**, réparties entre desktop 1440 px, tablette 1024 px et mobile 390 px, et **15 interactions** de recherche, calendrier et onglets des rapports. Les routes administratives sont testées avec un compte root de test. Aucun échec de page dans les passages retenus ; les réponses 401 de rafraîchissement anonyme au démarrage sont distinguées des erreurs applicatives.
- [x] 30 tests unitaires API ciblés du multiplexage, de l'autorisation et du snapshot cockpit ; 14 tests frontend des flux et hooks ; vérifications TypeScript, lint ciblé et architecture API.
- [x] 25 lectures API rejouées après restauration des seuils habituels : toutes en HTTP 200.
- [x] Configuration habituelle et conteneurs intra rétablis, données persistantes vérifiées. Cloud et agent laissés arrêtés.

Les premiers essais du navigateur mobile échouaient à cause du menu du scénario de test ; le parcours a été corrigé et les 36 navigations mobiles rejouées. Une première reprise le lendemain trouvait les attentes synthétiques sur la date métier de la veille : seules ces attentes de test ont été reportées avant le passage retenu. Les essais intermédiaires restent dans les traces privées, sans les présenter comme des succès.

## Limites et reproduction

Les durées de service accélérées influencent les médianes du jour ; utiliser l'historique synthétique pour explorer les rapports, pas pour mesurer une activité réelle. Les données sont déterministes et variées, sans prétendre reproduire une distribution statistique de clients réels. Les lignes d'audit importées lors du premier seed contiennent encore deux anciens libellés techniques ; l'audit étant immuable, elles n'ont pas été réécrites. Le générateur utilise désormais les noms d'action canoniques.

Cette campagne concerne l'IHM des utilisateurs SaaS. Elle ne couvre pas la charge cloud/agent, les écrans publics, les fournisseurs externes, ni toutes les mutations d'administration. Les mots de passe et captures nominatives synthétiques restent dans le répertoire local ignoré `.tmp-consolidation/saas-performance/`.

Résultats agrégés sans identifiants ni secrets : [JSON](../../reports/performance/saas-100k-2026-11-04.json). Instructions : [banc SaaS](../../scripts/performance/SAAS-PERFORMANCE.md).
