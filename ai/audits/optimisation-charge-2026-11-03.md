# Optimisations après la campagne de charge — 3 novembre 2026

La relecture des positions après un événement SSE passe de **9,61 s à 2,68 s
au p95** pour 1 000 tickets, avec zéro erreur HTTP. Le calcul reste effectué
par le moteur SQL commun aux écrans et aux déploiements intra/cloud.

## Calculs de position partagés

Les appels simultanés au repository d'estimation sont regroupés pendant au plus
25 ms avant envoi en base. Les identifiants sont dédupliqués, dans la limite
de 1 000 par lot. Les observations de secondes différentes restent séparées ;
chaque lot utilise l'instant d'observation de son premier appel.

La réponse de chaque demande ne contient que ses propres tickets. Les contrôles
de jeton et d'expiration restent effectués pour chaque requête. Aucun résultat
d'estimation n'est conservé après le calcul ; les appels suivants relisent la base.
Le délai de regroupement ajoute jusqu'à 25 ms d'attente à une demande isolée.

| Mesure                                              | Référence                         | Version retenue |
| --------------------------------------------------- | --------------------------------- | --------------- |
| 250 lectures après événement, p95                   | 1 697 ms                          | 945 ms          |
| 1 000 lectures après événement, p95                 | 9 613 ms                          | 2 676 ms        |
| 1 000 lectures après événement, maximum             | 9 952 ms                          | 2 784 ms        |
| Classements SQL pour les 1 000 tickets              | Un par demande dans l'ancien code | 95 mesurés      |
| Heartbeats au palier de 2 000 flux                  | 2 000                             | 2 000           |
| Erreurs HTTP des relectures au palier de 2 000 flux | 0                                 | 0               |
| Événement SSE intra au palier de 2 000 flux, p95    | 1 527 ms                          | 1 495 ms        |

Le gain principal observé est de **72 % sur la latence p95 des relectures**.
Les compteurs `queue_ticket_estimate_queries_total` et
`queue_ticket_estimate_tickets_total` rendent le regroupement observable.

## Reprise de l'agent

Une reprise du canal de contrôle cloud réveille immédiatement le cycle de
synchronisation en attente. Une erreur conserve aussi le signal de travail
consommé avant la tentative échouée : le prochain cycle réessaie sans attendre
l'intervalle de sécurité de cinq minutes.

Le backoff des échecs répétés du transfert reste actif. Un heartbeat réussi
ne remet pas à zéro le compteur d'échecs de transfert. Les réveils restent
événementiels ; les fréquences de heartbeat et de récupération de sécurité
ne sont pas augmentées.

Après 35,30 secondes d'arrêt de l'API cloud du banc, les 1 000 mutations sont
récupérées en **20,24 secondes** après redémarrage, contre **125,98 secondes**
dans la référence (environ 84 % de moins). Le tracking intra reste disponible
et le flux SSE cloud reçoit l'état rattrapé après reconnexion.

La coupure réseau de 130,32 secondes conserve la détection de l'intra hors ligne
et la disponibilité locale. Les 1 000 mutations sont rattrapées en **3,09 secondes**
après reconnexion, contre 20,64 secondes dans la référence. La phase du heartbeat
au moment du rétablissement influe sur ce délai : ce résultat n'est pas un SLA.

## Validation et limites

- [x] Tests du regroupement : isolation des tickets, absence de cache persistant,
      propagation des erreurs, nouvelle tentative et séparation des observations.
- [x] Tests du service d'estimation et du service d'inscription : 25 tests passent.
- [x] Tests de l'agent : maintien du backoff, conservation du signal de travail,
      réveil après rétablissement du canal de contrôle ; 26 tests passent.
- [x] Images construites et paliers SSE ciblés de 500 et 2 000 flux exécutés.
- [x] Panne cloud de 35 secondes rejouée avec 1 000 mutations et reprise SSE.
- [x] Coupure réseau de 130 secondes rejouée : détection hors ligne, reprise SSE
      et rattrapage des 1 000 mutations.
- [x] Contrôles TypeScript, ESLint ciblé, formatage et architecture validés.
- [x] Images API installées sur Docker intra et cloud ; image agent installée
      sur Docker intra. Les neuf conteneurs habituels sont sains ; les deux
      interfaces répondent HTTP 200 après redémarrage des proxies. Les routes de
      santé API/PostgreSQL répondent `ok` à travers les deux proxies.
- [x] Banc isolé et son volume supprimés après sauvegarde des résultats.

Le banc reprend les mêmes volumes synthétiques : 100 000 inscriptions historiques
par base et 2 000 tickets intra actifs. Les limites restent celles de la référence
(API 2 CPU / 768 Mio, générateur 1 CPU / 256 Mio, PostgreSQL local). Les plafonds
de trafic relevés concernent uniquement le banc de capacité.

Les relevés correspondent à des exécutions locales successives, avec variation
possible de la charge de l'hôte ; ils ne constituent pas une certification de
production. Les essais intermédiaires ne sont pas présentés comme résultats
de la version retenue. Le scénario mixte de trois minutes et le fanout de 2 000
mutations cloud de la référence ne sont pas inclus dans cette comparaison ciblée.

Au repos, le dernier palier ne relève aucune relecture SSE dans sa fenêtre de
16 secondes. Une lecture de topic apparaît au palier précédent : ces compteurs
incluent les invalidations et récupérations de sécurité, pas seulement les actions
du générateur. Aucun polling supplémentaire n'a été introduit.

L'essai de rapport avec une entrée matérialisée partagée donnait des agrégats
identiques sur huit combinaisons de période/filtres, mais augmentait sa latence
locale. Il a été retiré. Le code des rapports reste celui de la référence.

Référence : [campagne initiale](validation-charge-reprise-2026-11-03.md).

Relevés : [version optimisée](../../reports/performance/readiness-optimized-2026-11-03.json).
Code API : `980851e` ; agent : `c9edeb5`.
Images mesurées : API
`sha256:c38b3a180bc61363ee2934d8940e653d5fa09cc9f085d5bf4b75db50b473f795`,
agent `sha256:41b4940344e4fc2c77b93855392b99728ce15d6691d63fd93270d541da066baf`.
