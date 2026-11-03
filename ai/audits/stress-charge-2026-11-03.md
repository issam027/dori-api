# Charge renforcée — 3 novembre 2026

Les neuf conteneurs Dorify habituels sont arrêtés pour cette campagne. Leurs
volumes sont conservés. Seul le banc `dorify-perf` reçoit les données et la charge ;
aucun accès à Neon n'est effectué.

Le banc comporte 100 000 inscriptions historiques par base et **8 000 tickets
actifs distincts**, contre 2 000 dans la campagne précédente. Chaque API garde
2 CPU, 768 Mio et un pool de 10 connexions SQL. Le générateur dispose de 2 CPU,
512 Mio et d'un arrêt à 460 Mio de RSS. Le
[plan exploratoire](../../scripts/performance/stress-plan.json) fixe les seuils
avant la montée ; ils ne constituent pas un SLA de production.

## Rafales et connexions SSE

| Scénario                                 | Observation                                                                                                                                       | Verdict                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 2 000 SSE + 1 000 relectures simultanées | 1 000 réponses 200 ; p95 7,41 s ; 170 classements SQL ; tous les heartbeats reçus                                                                 | Zéro erreur ; sous le seuil exploratoire de 10 s.          |
| 4 000 SSE + 2 000 relectures simultanées | 877 réponses 200, 1 114 erreurs client sans réponse HTTP complète, 9 réponses 502 ; les 4 000 SSE restent connectés et reçoivent leurs heartbeats | Échec : 56,15 % de relectures en erreur.                   |
| 8 000 SSE, sans rafale REST              | 8 000 flux connectés et heartbeats récents ; invalidation reçue par les 4 000 abonnés intra, p95 4,77 s                                           | Transport fonctionnel confirmé pour ce scénario seulement. |

La montée des rafales est arrêtée au palier 4 000 conformément au plan ; les
paliers 6 000 et 8 000 avec relectures ne sont pas exécutés. Le test distinct à
8 000 connexions ne valide donc pas 8 000 clients relisant simultanément leur
position. Il ouvre progressivement les flux, environ 500 par seconde.

Les erreurs client sont comptées `status=0`, sans réponse HTTP complète ; leurs
codes détaillés ne sont pas présents dans ce premier relevé. Le client HTTP a un
délai d'inactivité de 15 secondes. Ces erreurs se distinguent des réponses 502.
Le p95 d'environ 15,48 s du palier en échec inclut ces erreurs client : ce n'est pas
une mesure des seules réponses API réussies.

Au palier en échec, le générateur utilise 143 Mio, avec une boucle événementielle
p99 de 77 ms. Au test de transport à 8 000 flux, il utilise 165 Mio, p99 55 ms.
Les API ne redémarrent pas et ne sont pas tuées par manque de mémoire.
La mémoire du générateur n'explique donc pas les expirations de 15 secondes.

Le test de transport relève 4 000 lectures répliquées dans sa fenêtre de repos,
au passage de la récupération de sécurité de cinq minutes. Il ne démontre pas
une absence absolue de lectures SQL au repos. Les paliers précédents n'en
relevaient aucune dans leurs fenêtres de 16 secondes. La récupération de sécurité
peut elle-même produire une rafale de lectures sur beaucoup de tickets distincts.

## Débit imposé avec 2 000 SSE maintenus

Le générateur impose les arrivées et compte les demandes abandonnées si son
plafond de 256 requêtes en vol est atteint. Un serveur lent ne réduit donc pas
silencieusement la charge demandée. Chaque palier dure une minute ; les API
recalculent les positions sur la file de 8 000 tickets.

| Cible | Débit reçu avant fin de fenêtre | Requêtes terminées | p95      | Erreurs / abandons |
| ----- | ------------------------------- | ------------------ | -------- | ------------------ |
| 20/s  | 19,96/s                         | 1 199              | 465 ms   | 0 / 0              |
| 50/s  | 49,91/s                         | 2 999              | 281 ms   | 0 / 0              |
| 100/s | 98,57/s                         | 5 999              | 1 150 ms | 0 / 0              |
| 200/s | 129,55/s                        | 8 029              | 3 459 ms | 0 / 3 970          |

Le palier 200/s échoue : le plafond de 256 requêtes en vol est atteint et 3 970
demandes ne sont pas émises. Les requêtes admises reçoivent toutes une réponse
200, mais cela ne valide pas la cible de 200/s. Le débit observé d'environ 130/s
ne constitue pas non plus une capacité maximale absolue de l'API : le plafond
du générateur et la durée du test influencent ce résultat.

Les requêtes encore en vol sont attendues après chaque fenêtre. Le débit de la
table compte seulement les réponses reçues avant sa fin ; le nombre de requêtes
terminées inclut le drainage suivant (environ 0,38 s à 100/s et 1,40 s à 200/s).

## Comparaison de code sur les mêmes données

Seule l'image de l'API intra est remplacée par la version antérieure aux
optimisations, puis le scénario 2 000 SSE / 1 000 relectures est rejoué sur
la même base de 8 000 tickets et avec les mêmes limites. Aucune autre phase de
charge ne s'exécute en parallèle.

| Image API                    | Réponses 200 | Réponses 500 | p95 des réponses réussies |
| ---------------------------- | ------------ | ------------ | ------------------------- |
| Référence avant optimisation | 572          | 428          | 9,02 s                    |
| Optimisée                    | 1 000        | 0            | 7,41 s                    |

Le gain confirmé ici concerne surtout la disparition des erreurs au palier
comparé. Le p95 global de la référence, 8,61 s, inclut ses erreurs 500 ; il ne
faut pas le comparer comme s'il décrivait 1 000 réussites. Les compteurs de
classement SQL ne sont pas exposés par cette ancienne image et restent `null`.
Le cache de base et la charge de l'hôte peuvent varier entre ces exécutions
successives ; la référence est exécutée après les phases optimisées.

L'image optimisée est remise sur le banc après comparaison. Les images sont
API optimisée `sha256:c38b3a180bc61363ee2934d8940e653d5fa09cc9f085d5bf4b75db50b473f795`
et référence `sha256:cb288b4e26fda2c888deb51bbb604ca73cd741c9f082480196811fc9c849f8a5`.

## Campagne REST Postman complémentaire

Une campagne locale de 16 utilisateurs virtuels pendant une minute était
prévue sur le statut de file, la supervision et le listing des files.
La protection Postman l'arrête à **97,8 % de CPU machine**. Le dernier relevé,
à 23 secondes, contient 900 requêtes, zéro erreur et une moyenne de 222 ms.
Cette phase est **incomplète**, sans verdict p95 valide. Le seuil de protection
n'est pas désactivé et aucune nouvelle tentative ne contourne cet arrêt.

## Suite prioritaire

Le transport SSE tient davantage de connexions que la rafale de relectures REST.
La prochaine optimisation devrait viser le calcul et la distribution des
positions lors d'une invalidation commune, ainsi que l'étalement des relectures
de sécurité. Augmenter les pools sans mesurer la base ne découle pas de ces
résultats. Aucun nouveau changement métier n'est appliqué dans cette campagne.

## Limites d'interprétation

Les résultats sont locaux, sans TLS, avec PostgreSQL et Redis sur le même hôte,
une seule API par rôle et des limites de trafic relevées uniquement sur le banc.
Les tickets restent en attente : les mesures n'incluent pas un flux continu
d'appels opérateurs, de changements de statut ou de réservations. Le transport
cloud n'est pas soumis ici à 8 000 mutations de projection simultanées.
La file suivie du seed n'a pas d'opérateur actif : le classement est calculé,
mais l'ETA est indisponible. Cette campagne ne qualifie donc pas une file en
service avec médianes alimentées en continu.
Ces phases courtes ne constituent pas un test d'endurance de production.

La file contient quatre fois plus de tickets actifs que la référence : comparer
directement ses 7,41 s aux 2,68 s précédents ne mesure pas une régression de code.
Le volume de classement est différent.

## Livrables et nettoyage

- [x] Plan, fixture agrandie et profil Docker du générateur versionnés.
- [x] Seuils et arrêts de montée appliqués ; échecs et phases incomplètes conservés.
- [x] Résultats exportés sans jetons ni identifiants privés dans
      [le relevé JSON](../../reports/performance/readiness-stress-2026-11-03.json).
- [x] Configuration Compose, syntaxe et formatage des scripts contrôlés.
- [x] Banc, volume synthétique et collecteur arrêtés/supprimés après sauvegarde.
- [x] Les neuf composants habituels restent arrêtés ; leurs volumes sont conservés.

Le [mode opératoire](../../scripts/performance/README.md) décrit les phases.
