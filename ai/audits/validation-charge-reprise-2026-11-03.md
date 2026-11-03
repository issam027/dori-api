# Validation de charge et de reprise — 3 novembre 2026

La campagne confirme plusieurs invariants fonctionnels, mais **ne valide pas
encore une mise en production intensive**. Les limites observées concernent le
rechargement REST simultané, la latence du traitement mixte et la reprise après
panne. Aucun code métier ni réglage des environnements existants n'a été modifié.

## Périmètre et méthode

- [x] Banc Docker dédié `dorify-perf`, données synthétiques, aucun accès à Neon.
- [x] 100 000 inscriptions historiques par base, réparties sur 90 jours ;
      3 000 personnes par base ; 2 000 tickets intra actifs projetés vers le cloud.
- [x] Accès HTTP à travers les images nginx de l'application.
- [x] Montée SSE 100 / 500 / 1 000 / 2 000 connexions distinctes, moitié intra,
      moitié cloud ; contrôle des heartbeats et des mises à jour.
- [x] Diffusion de vraies modifications de 2 000 projections vers 2 000 flux cloud.
- [x] Concurrence de réservation sur un créneau limité à cinq places.
- [x] Activité mixte pendant trois minutes avec 1 000 flux SSE.
- [x] Arrêt de l'API cloud, maintien du tracking intra et rattrapage des mutations.
- [x] Coupure réseau agent/cloud de 130 secondes, détection hors ligne et reprise.

Les résultats bruts sans identifiants ni jetons sont dans
[le relevé JSON](../../reports/performance/readiness-2026-11-03.json).
Le [mode opératoire](../../scripts/performance/README.md) permet de rejouer le banc.
Les scripts gardent leurs identifiants privés dans un répertoire ignoré par Git.

## Résultats

| Scénario                           | Observation                                                                                                       | Interprétation                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Limitation de trafic inchangée     | 120 lectures, concurrence 8 : 100 succès et 20 réponses 429                                                       | La configuration actuelle limite ce trafic avant la saturation technique.                               |
| Réservations concurrentes          | 50 demandes, concurrence 20 : 5 créations, 45 refus 409 ; exactement 5 tickets distincts en base                  | Aucun dépassement du quota observé.                                                                     |
| 2 000 SSE, moitié intra/cloud      | Heartbeat reçu par tous ; zéro erreur de snapshot ; événement intra p95 1,53 s                                    | Fonctionnement confirmé sur cette charge locale, latence à améliorer.                                   |
| Rechargement REST après événement  | 1 000 lectures simultanées : p95 9,61 s, maximum 9,95 s                                                           | Engorgement net lors d'une invalidation commune.                                                        |
| 2 000 SSE cloud et 2 000 mutations | 2 000 tickets actualisés ; délai mutation intra → client cloud p95 5,35 s, maximum 5,90 s                         | Ce délai inclut projection, agent et diffusion cloud.                                                   |
| Activité mixte, trois minutes      | 840 requêtes : 756 réponses 200 et 84 créations 201 ; p95 1,97 s, p99 2,81 s, maximum 7,09 s                      | Zéro erreur, mais la charge cible n'est pas maintenue : le générateur attend les lots ralentis.         |
| API cloud arrêtée 35,25 s          | Intra accessible ; 1 000 mutations finalement synchronisées ; SSE reconnecté ; reprise 125,98 s après redémarrage | Pas de perte observée sur ces mutations ; reprise trop lente pour une promesse de disponibilité rapide. |

La coupure réseau agent/cloud a duré 130,29 secondes. Le cloud a bien signalé
la source hors ligne, le tracking intra est resté disponible et les 1 000 mutations
ont été rattrapées en 20,64 secondes après reconnexion, reçues sur le flux SSE.

Le scénario mixte exécute par lot une consultation de rapport sur 90 jours, une
réservation et huit lectures de supervision/statut. Il vise dix requêtes par
seconde, mais atteint environ 4,65 requêtes/s : le test est à concurrence bornée,
pas à débit imposé. Sa réussite fonctionnelle ne prouve donc pas une capacité
à dix requêtes/s. Les réservations de ce scénario alimentent un autre créneau,
avec une capacité de 500, séparé du test de contention.

Aux quatre paliers SSE, les compteurs dédiés aux lectures SSE de topics intra
et de tracking répliqué cloud ne progressent pas pendant les fenêtres de repos
de 16 secondes. Cela confirme l'absence de lecture répétée toutes les deux secondes
dans ces fenêtres ; cela ne signifie pas absence de toute requête SQL ou absence
de relecture périodique de sécurité sur une période plus longue.

Les événements intra sont provoqués par invalidation transactionnelle d'un topic
de file. Chaque abonné relit ensuite sa position par REST, comme le navigateur.
Le scénario cloud modifie directement des inscriptions synthétiques puis laisse
les projections et l'agent livrer les modifications ; ce test n'est pas une
mesure de latence d'une action métier complète depuis le navigateur.

## Conditions et limites

Code API au commit `f96c834` lors de la campagne. Images utilisées :
API `sha256:cb288b4e26fda2c888deb51bbb604ca73cd741c9f082480196811fc9c849f8a5`,
agent `sha256:753394aedb673ac4969a97ca6ab61dab67ecb1ba1cfca717244af4db721854e9`,
web `sha256:0eb402d2a3739ae09a01343524b9730a6a7d145072c5518d6c36ebae888aaf85`.

- Docker dispose de 12 CPU et d'environ 7,60 Gio de mémoire ; une API par rôle,
  chacune limitée à 2 CPU et 768 Mio. Pool API : 10 ; pool agent : 3.
- Générateur dédié limité à 1 CPU et 256 Mio. Au palier 2 000 SSE : RSS Node
  109 Mio et délai de boucle événementielle p99 32 ms. Ces mesures ne désignent
  pas le générateur comme cause principale des 9,61 s de relecture REST.
- PostgreSQL 16 et Redis 7 sur le même hôte. Données intra sur volume Docker ;
  base cloud sur tmpfs de 768 Mio. Les résultats ne qualifient ni la durabilité
  de stockage, ni un serveur PostgreSQL distant.
- Les observations de ressources échantillonnées sont jointes au JSON. Les pics
  portent sur la session collectée, incluant préparation et transitions ; ils
  ne permettent pas d'attribuer seuls un ralentissement à une requête précise.
- La première tentative Postman s'est arrêtée sur sa protection mémoire hôte
  (97,19 %). Les quelque 100 requêtes réussies avant arrêt ne constituent pas
  un test de capacité terminé. Cette protection n'a pas été désactivée.
- Les phases de capacité utilisent un plafond de 100 000 sur les trois profils
  de limitation du **seul banc**. Les limites habituelles restent inchangées.
  Examiner avant production les plafonds, le profil appliqué et l'identification
  de l'adresse client derrière nginx ; ne pas copier ce plafond de test.
- HTTP local sans TLS, aucun rendu navigateur, aucun prestataire SMS/email,
  pas de multi-instance ni de panne PostgreSQL/Redis. Trois minutes ne remplacent
  pas une campagne de plusieurs heures, une hausse progressive à débit imposé
  ou un test d'endurance de 24 heures sur l'hébergement cible.
- `passed` dans les relevés signifie que les invariants fonctionnels du scénario
  sont respectés. Aucun SLA contractuel de latence n'a été défini ni validé.
- Le compteur `backlogAtRestart` porte seulement sur les projections dont la
  séquence dépasse la séquence synchronisée. Il exclut les inscriptions sales
  non encore projetées : sa valeur zéro ne prouve pas l'absence d'attente interne.

## Travaux à prioriser avant usage intensif

1. Réduire la rafale REST après invalidation de file : mutualiser la construction
   des snapshots ou transmettre un état exploitable via le flux, en conservant
   une source de vérité et les contrôles d'accès par ticket. Rejouer les mêmes
   paliers après modification.
2. Profiler les requêtes et les attentes de pool pendant le scénario mixte,
   notamment les rapports historiques. Le ralentissement mesuré ne permet pas
   d'attribuer sans profilage la cause au pool ou à une requête spécifique.
3. Réduire le délai de reprise agent/projection après rétablissement du cloud,
   en vérifiant le backoff et le réveil événementiel sans réintroduire du polling
   permanent. Le rattrapage fonctionnel est établi, sa rapidité reste insuffisante.
4. Valider les limites de trafic et les IP clientes derrière les proxies, puis
   définir les objectifs de latence et de disponibilité sur l'hébergement cible.
5. Compléter ensuite par débit imposé, multi-instance et endurance longue ;
   garder les protections du générateur et mesurer ses propres limites.

Ces travaux sont les suites mises en évidence par cette campagne de test ;
ils n'ont pas été appliqués au code métier dans cette intervention.

## Vérification du livrable

- [x] Syntaxe Node des scripts contrôlée.
- [x] Formatage des nouveaux fichiers contrôlé ; configuration Compose validée.
- [x] Aucune donnée d'identité, aucun mot de passe ni jeton exporté dans le rapport.
- [x] Environnements Docker habituels intra/cloud et agent vérifiés sains après
      les essais. Le banc de test est retiré une fois les observations sauvegardées.
