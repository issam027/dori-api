# Audit technique Dori — 1er novembre 2026

## Suivi du traitement

Clôture du traitement : tous les constats de cet audit sont corrigés et validés. Les preuves après modification sont détaillées dans les sections « Validation » et dans [le bilan de validation](bilan-traitement-audits-2026-11-01.md). Les mesures et captures initiales ont été conservées séparément.

Traitement demandé le 1er novembre 2026. Un point est coché uniquement après correction et validation ; les constats ci-dessous décrivent la situation initiale.

- [x] F01 — corrigé et validé
- [x] F02 — corrigé et validé
- [x] F03 — corrigé et validé
- [x] F04 — corrigé et validé
- [x] F05 — corrigé et validé
- [x] F06 — corrigé et validé
- [x] F07 — corrigé et validé
- [x] F08 — corrigé et validé
- [x] F09 — corrigé et validé
- [x] F10 — corrigé et validé
- [x] F11 — corrigé et validé
- [x] F12 — corrigé et validé
- [x] F13 — corrigé et validé
- [x] F14 — corrigé et validé
- [x] F15 — corrigé et validé
- [x] F16 — corrigé et validé

## Périmètre et méthode

Audit de dori-web, dori-api et dori-agent, incluant les services par file, PostgreSQL, rapports, temps réel, rendez-vous, notifications et synchronisation cloud.

Travail en lecture seule sur les applications et les données : revue de code, requêtes SELECT et EXPLAIN ANALYZE, inspection HTTP des fichiers statiques, comptage des requêtes du front avec des fixtures Playwright. Aucun changement de schéma, de configuration ou de code applicatif. Seuls ce rapport et son fichier de mesures ont été ajoutés.

Les mesures concernent l'environnement Docker local, avec des données de démonstration volumineuses. Elles ne constituent ni un test de charge ni des latences de production. Les durées SQL sont celles d'exécutions isolées ; les additionner ne donne pas la durée HTTP, notamment lorsque les requêtes sont parallèles. Les chiffres de requêtes navigateur décrivent des appels réels du front avec une API simulée, pas leur coût réseau réel.

Inventaire du code de production TypeScript : API 183 fichiers, web 279, agent 9.

## Conclusion

Les opportunités les plus importantes concernent la quantité de travail répétée : chargement anticipé de toutes les associations de services, interrogation SQL par connexion SSE, recalcul intégral des projections de tracking par l'agent et scans répétés des rapports.

L'introduction des services ne justifie pas une multiplication générale des index. Les tables de catalogue restent petites : 50 associations file/service dans l'environnement inspecté. Il faut d'abord réduire les requêtes inutiles et les parcours de grandes tables. Les contraintes existantes de service par défaut et d'inscription ouverte sont utiles.

Le service par défaut doit rester facultatif. Les optimisations proposées ne doivent ni en imposer un, ni conditionner son choix à l'existence d'options.

## Priorités

P1 : gain concret mesuré ou risque important de montée en charge. P2 : optimisation utile à traiter ensuite. P3 : entretien et durcissement. L'effort est relatif, sans engagement de délai.

| Référence | Composant | Priorité | Opportunité | Effort |
| --- | --- | --- | --- | --- |
| F01 | Web | P1 | Charger les services de la file sélectionnée et les règles à l'ouverture | Faible à moyen |
| F02 | API | P1 | Mutualiser la lecture des topics SSE entre connexions | Élevé |
| F03 | API / BDD | P1 | Indexer la sélection des notifications directes en attente | Faible à moyen |
| F04 | API / BDD | P1 | Réduire les scans et projections des rapports | Moyen à élevé |
| F05 | Agent / BDD | P1 | Éviter le recalcul intégral du tracking à chaque cycle | Élevé |
| F06 | Agent | P1 | Résorber plusieurs lots sans retarder le heartbeat | Moyen |
| F07 | Agent / BDD | P2 | Acquitter les projections par lot avec contrôle de séquence | Moyen |
| F08 | Web / Nginx | P1 | Compresser les ressources JS et CSS | Faible |
| F09 | Web | P2 | Adapter les ressources de configuration à l'onglet visible | Faible à moyen |
| F10 | Web / API | P2 | Borner les téléchargements parallèles des rendez-vous | Faible |
| F11 | API / BDD | P2 | Éviter certains recalculs statistiques sans perdre leur fraîcheur | Moyen |
| F12 | API / BDD | P2 | Supprimer les DISTINCT inutiles de l'annuaire | Faible |
| F13 | Tous / BDD | P2 | Définir la rétention des données techniques | Moyen |
| F14 | API / Agent | P2 | Mesurer les latences et le retard par traitement | Moyen |
| F15 | Web / API | P3 | Découper les gros composants et les traitements complexes | Progressif |
| F16 | Agent | P1 avant parallélisation | Rendre récupérables les commandes interrompues | Moyen |

## Constats détaillés

### F01 — Chargement des services et règles

Sources : dori-web/src/features/onboarding/components/QueueServiceSettings.tsx ; rechercher useQueries et ruleQueries.

Avec quatre files et trois services par file, l'ouverture de l'onglet Services déclenche 27 GET, contre 11 sur Sites ou Files. Les 16 appels supplémentaires sont quatre chargements d'associations et douze chargements de règles, alors qu'une seule file est affichée et que les détails des services sont fermés.

Charger uniquement les associations de la file sélectionnée, puis les règles lorsque le détail en a besoin. Dans ce scénario, le chargement initial pourrait passer de 27 à environ 12 GET en conservant les 11 appels communs. Cette cible suppose la même structure d'écran ; elle doit être vérifiée après modification.

Conserver les clés de cache partagées entre accueil rapide, rendez-vous et kiosque, l'invalidation après modification et le périmètre des droits. Le champ de service reste masqué lorsqu'un seul service est actif ; plusieurs services sans défaut exigent un choix explicite. Ne pas transformer un chargement absent en une liste vide définitive.

### F02 — Temps réel : coût SQL par connexion SSE

Sources : dori-api/src/core/realtime/realtime.service.ts et les contrôleurs de tracking / affichage.

Chaque connexion a son propre polling de topic toutes les deux secondes, avec autorisation réévaluée. Un heartbeat toutes les quinze secondes réévalue également l'accès. Pour le tracking, l'autorisation retrouve l'inscription par token puis la lecture du topic effectue une autre requête.

Ordre de grandeur théorique : 1 000 connexions de tracking représentent environ 1 000 requêtes SQL par seconde pour le polling, auxquelles s'ajoutent environ 67 vérifications par seconde liées aux heartbeats. Ce n'est pas un résultat de test de charge.

Mutualiser les lectures de topic par file et type d'événement dans chaque processus, puis envisager une notification via bus ou PostgreSQL pour déclencher les lectures. Garder une reprise par polling et l'outbox durable.

La mutualisation des topics ne supprime pas à elle seule les vérifications d'accès individuelles. Préserver la révocation, l'expiration des tokens, les permissions fraîches de l'affichage, la reconnexion et le snapshot REST. Un cache général d'autorisation introduisant un délai de révocation serait une régression.

### F03 — Notifications : scan intégral quand il n'y a rien à traiter

Source : dori-api/src/modules/notifications, sélection claimPending.

Le SELECT équivalent à la sélection des notifications directes pending ou processing expirées, limité à 50, retourne zéro ligne mais élimine 60 133 lignes. Durée observée : 27,376 ms et 60 715 blocs trouvés en cache. Le worker réessaie toutes les dix secondes.

L'index utilisé est parcouru à rebours sur created_at ; aucun index ciblant ce sous-ensemble direct en attente n'a été trouvé. Tester un index partiel sur les notifications directes pending/processing et l'ordre de sélection. Il peut être préférable de distinguer les notifications pending des leases processing expirées pour exploiter processing_started_at.

L'index proposé n'a pas été créé ni mesuré. Valider son plan et son coût en écriture avant adoption. Conserver FOR UPDATE SKIP LOCKED, la reprise après cinq minutes, les limites de tentative et l'unicité évitant les doublons d'envoi.

### F04 — Rapports : huit requêtes et fichiers temporaires

Source : dori-api/src/modules/monitoring/reports.repository.ts, getMonitoringSeries ; reports.service.ts.

Période inspectée : octobre 2026, quatre files, regroupement journalier, fuseau Africa/Tunis.

| Requête | Exécution isolée | Lignes retournées | Blocs temporaires lus / écrits |
| --- | ---: | ---: | ---: |
| Totaux | 78,542 ms | 1 | 0 / 0 |
| Séries globales | 233,614 ms | 32 | 4 788 / 1 344 |
| Par file | 80,990 ms | 4 | 0 / 0 |
| Séries par file | 229,961 ms | 112 | 4 902 / 1 459 |
| Par utilisateur | 34,241 ms | 4 | 0 / 0 |
| Par service | 26,877 ms | 3 | 0 / 0 |
| Par type d'entrée | 59,860 ms | 2 | 0 / 0 |
| Par statut | 21,428 ms | 5 | 0 / 0 |

Les requêtes répètent le périmètre d'inscriptions. La projection initiale reprend de nombreuses colonnes, dont certaines sans intérêt pour les agrégats. Les séries matérialisent et trient suffisamment de données pour utiliser des fichiers temporaires.

Première étape : limiter les colonnes aux besoins du calcul. Ensuite, évaluer le regroupement de plusieurs agrégations pour réduire les scans partagés. Les requêtes utilisent déjà des agrégations groupées : ne pas réintroduire des sous-requêtes par intervalle.

Les médianes et P90 doivent conserver leur définition exacte ; une moyenne de médianes ne les remplace pas. Préserver les dates d'événement, les limites de période et le fuseau. Ne pas augmenter globalement work_mem ou le pool pour masquer un plan coûteux.

Dans reports.service.ts, indexer les séries par file avec une Map évite les filter répétés pour chaque file. Gain secondaire comparé au SQL.

### F05 — Agent : recalcul complet du tracking

Source : dori-agent/src/store.ts, refreshTracking.

Le SELECT préparant les projections examine toutes les inscriptions actives dont le token n'a pas expiré, y compris les statuts terminaux encore consultables. Il recalcule notamment une fenêtre ROW_NUMBER avant l'upsert.

Mesure du SELECT seul : 118 800 lignes, 466,1 ms, tri externe et 1 808 / 1 810 blocs temporaires lus / écrits. Le coût de l'INSERT ON CONFLICT réel n'est pas inclus. La condition IS DISTINCT évite des mises à jour inchangées, mais pas le scan initial.

Passer progressivement à une liste de files ou inscriptions modifiées, avec reprise périodique complète pour réparer les événements manqués. Un événement concernant une file peut modifier la position de plusieurs personnes : recalculer uniquement l'inscription directement modifiée serait insuffisant.

Attention : l'ordre ROW_NUMBER de cette projection et les règles opérationnelles de priorité ne sont pas identiques dans leur expression. Définir et tester la position métier avant de mutualiser le calcul. Préserver les consultations de tickets terminés pendant la durée de validité du token.

### F06 — Agent : débit de synchronisation et heartbeat

Sources : dori-agent/src/agent.ts, config.ts.

Un cycle synchronise au plus un lot de 100 projections, puis la prochaine exécution est programmée après la fin du cycle et l'intervalle configuré, par défaut 30 secondes. Le plafond théorique est donc inférieur ou égal à 3,33 projections par seconde avant les autres coûts.

État local : 45 100 projections non synchronisées. Sans nouvelles arrivées et sans coût de traitement, cela représente déjà environ 3 h 45 de rattrapage. Ce calcul n'est pas une mesure de débit effectif.

Le cycle enchaîne statut, tracking, notifications, santé, heartbeat puis commandes. Jusqu'à 50 relais de notification sont exécutés séquentiellement ; leur attente peut retarder le heartbeat. Le statut en ligne utilise un seuil de deux minutes côté contrôle.

Traiter plusieurs lots dans une limite de temps et de concurrence, en respectant les limites du contrat cloud. Donner au heartbeat et au contrôle de révocation un budget indépendant. Répartir équitablement les reprises et les tickets vivants pour éviter la famine d'une catégorie. Ajouter du jitter au backoff aiderait lorsque plusieurs agents redémarrent simultanément.

### F07 — Agent : acquittements SQL par ligne

Source : dori-agent/src/store.ts, markTrackingSynced.

Un lot de 100 projections entraîne jusqu'à 100 UPDATE séquentiels d'acquittement. Remplacer ces écritures par une mise à jour groupée, avec tableau de couples hash/séquence ou recordset JSON.

Il faut conserver le contrôle compare-and-set : acquitter seulement la séquence effectivement envoyée. Une projection modifiée pendant l'appel réseau doit rester à synchroniser. Le cloud applique déjà un contrôle de séquence monotone.

### F08 — Compression des fichiers du front

Source : dori-web/nginx.conf ; vérification HTTP sur le front intra déployé.

Avec Accept-Encoding: gzip, les deux fichiers inspectés sont servis sans Content-Encoding. La compression gzip locale des mêmes octets donne :

| Ressource | Octets servis | Octets gzip calculés |
| --- | ---: | ---: |
| JavaScript principal | 384 878 | 120 790 |
| CSS principal | 238 393 | 40 717 |
| Total des deux fichiers | 623 271 | 161 507 |

Potentiel d'environ 74 % de réduction pour ces deux ressources seulement. Activer gzip, ou des fichiers précompressés ; Brotli est une option si le serveur le supporte. Vérifier Vary et le cache.

Préserver le fonctionnement du SSE : pas de buffering du proxy sur les événements et pas de compression qui retarde leur émission. Les ressources versionnées ont déjà un cache immutable d'un an.

Le budget existant tools/bundle-budget.mjs est utile, mais ajouter un suivi du graphe des ressources préchargées évite de se limiter au seul fichier d'entrée.

### F09 — Configuration : ressources chargées indépendamment de l'onglet

Source : dori-web/src/features/onboarding/hooks/useSettingsData.ts et components/SettingsWorkspace.tsx.

Sites, files, rôles, catalogue de services et utilisateurs directs sont demandés dès l'ouverture de chaque onglet. Le hook dispose déjà d'options enabled à exploiter. Conserver les ressources nécessaires aux compteurs communs et différer celles utilisées uniquement dans un formulaire ou un onglet.

Trois GET sur le chemin /sites ont été observés dans le scénario. Les paramètres n'ont pas été enregistrés : cela ne prouve pas que les trois requêtes sont identiques. Comparer clés de cache, paramètres et droits avant de les fusionner.

Le kiosque charge aussi des règles pour des services dont l'étape peut être sautée ; différer ces données lorsque leur présentation est réellement nécessaire.

### F10 — Rendez-vous : téléchargement parallèle sans borne

Source : dori-web, useAppointments.ts.

Après la première page de 100 rendez-vous, toutes les pages restantes sont lancées dans un Promise.all. Cela préserve l'exhaustivité, mais peut produire une rafale de requêtes pour un grand calendrier.

Limiter la concurrence, par exemple à trois ou quatre pages, puis mesurer. À plus long terme, un contrat de consultation par période visible pourrait éviter des données inutiles. Ne pas tronquer silencieusement les rendez-vous, les totaux du jour ou les conflits de capacité.

### F11 — Statistiques d'attente : optimiser sans figer les médianes

Les statistiques d'estimation ont déjà des index de recherche et un calcul périodique à la minute dans le déploiement inspecté. Toute réduction de recalcul doit garder cette fraîcheur maximale, les changements de journée et la mise à disposition des statistiques fiables.

Évaluer un recalcul des files concernées par de nouveaux services terminés, complété par un passage périodique de sécurité. Mesurer d'abord le coût global du job : ce point est une hypothèse d'optimisation, contrairement aux scans mesurés ci-dessus.

Le tracking possède une actualisation par événements avec reprise périodique. Le statut estimé du kiosque n'a pas de refetchInterval dans le hook inspecté : vérifier et améliorer sa fraîcheur avant de réduire ses appels. La réduction du trafic ne doit pas laisser une estimation initiale affichée durablement.

### F12 — Annuaire : DISTINCT redondants

Source : dori-api/src/modules/persons/persons.repository.ts, findPersons.

COUNT(DISTINCT p.person_id) et SELECT DISTINCT portent sur une seule table sans jointure multiplicatrice ; la clé primaire garantit déjà l'unicité. Les compteurs de notes sont des sous-requêtes corrélées.

Sur quatre paires d'exécutions à cache chaud, médiane du COUNT : 8,122 ms actuellement contre 1,769 ms sans DISTINCT. La liste passe d'environ 0,231 à 0,141 ms ; son gain absolu est faible. Une première mesure froide était défavorable à la variante, ce qui confirme la nécessité de comparer plusieurs passages équivalents.

Supprimer la déduplication inutile et, si nécessaire, paginer avant de calculer les notes. Vérifier filtres, tri et comptes. Pour ILIKE avec joker initial, envisager pg_trgm seulement si un plan et un volume représentatifs le justifient ; l'extension n'est pas installée actuellement.

### F13 — Rétention des tables techniques

Les tables locales comprennent 122 400 projections publiques, dont 3 600 expirées. Aucune purge dédiée de l'ensemble projection/outbox/inbox de commandes n'a été identifiée dans les chemins inspectés.

Définir une politique explicite avant suppression : délai de grâce après expiration, retard cloud, besoin de support et fenêtre d'idempotence des commandes. Purger par petits lots. L'état courant des topics référence un événement d'outbox : préserver les références existantes et la reprise SSE.

Ne pas supprimer indistinctement les notifications ou données métier. Ne pas déduire un besoin de VACUUM FULL ou de suppression d'index à partir d'une photographie de statistiques.

### F14 — Observabilité pour confirmer les gains

pg_stat_statements n'est pas installé dans la base inspectée. Les métriques applicatives globales ne donnent pas une distribution p95 par route ou requête, et un compteur enregistré à la fermeture d'un SSE ne mesure pas directement les connexions actuellement actives.

Ajouter des mesures bornées en cardinalité : durée/p95 par route, connexions SSE actives, lectures de topic, durée et file d'attente du pool, durée des jobs, ancienneté de la plus vieille projection non acquittée, âge du heartbeat et nombre de commandes bloquées.

Activer pg_stat_statements de manière contrôlée pour attribuer le coût cumulé aux requêtes. Comparer avant/après sur les mêmes données et la même concurrence, sans enregistrer de tokens ni de données personnelles dans les labels ou traces.

### F15 — Structure du code et état des formulaires

Gros fichiers inspectés : CockpitPage 1 314 lignes, OnboardingWizard 1 149, KioskWizard 797 ; côté API queue-engine.repository 1 041, registrations.service 914 et queue-engine.service 812. La taille seule ne prouve pas un problème de performance.

Extraire progressivement calculs métier, requêtes, formulaires et états de navigation ; profiler les rendus avant d'ajouter de la mémoïsation. Garder les transactions du moteur de file cohérentes.

Dans les cartes de services, une clé issue de JSON.stringify des associations/règles peut provoquer un remontage après rafraîchissement. Avant de rendre les données plus réactives, stabiliser les clés et gérer explicitement le changement de file et les brouillons modifiés, afin de ne pas perdre une saisie.

### F16 — Commandes de l'agent : reprise avant augmentation de concurrence

Sources : dori-agent/src/store.ts, réservation de commande ; agent.ts, traitement et arrêt.

La réservation persiste RUNNING avant l'acquittement cloud. Une commande existante avec un résultat nul peut être ignorée lors d'une reprise. Un crash ou un échec d'acquittement peut donc laisser une commande sans mécanisme de récupération identifié. Ce risque est déduit du code ; aucun incident n'a été provoqué.

Introduire une lease ou un état de reprise explicite, avec idempotence des effets et distinction entre traitement terminé et acquittement à reprendre. À l'arrêt, attendre ou interrompre proprement le cycle avant de fermer le pool. Traiter ce point avant de paralléliser les commandes.

## État PostgreSQL et éléments déjà bien conçus

Base locale : environ 325 Mo ; 243 600 inscriptions, 60 133 notifications, 50 000 personnes et 10 001 notes. La table d'inscriptions représente environ 77 Mo et ses 17 index environ 114 Mo. Ces valeurs ne prouvent pas de gonflement anormal.

Index existants utiles : file/jour/statut actif, file/date de création, fin et début de service, rendez-vous planifiés, dimensions de supervision, inscription ouverte unique par personne/file, ticket unique par jour/file, défaut de service unique actif par file, projections non synchronisées et expiration.

La contrainte de défaut assure au plus un défaut actif ; elle n'en impose pas un. La conserver.

Points à préserver :
- Requêtes paramétrées et tris contrôlés.
- Transactions, compteurs de tickets et protections contre les doubles inscriptions.
- Snapshot cohérent et chargements groupés de la supervision.
- Prise en charge concurrente des notifications avec SKIP LOCKED.
- Acquittement et synchronisation des projections contrôlés par séquence.
- Autonomie locale de l'agent pendant une coupure cloud.
- Routes front chargées à la demande, cache React Query et déduplication du renouvellement d'authentification.
- Pool API borné, valeur par défaut 10 ; pool agent limité à 3.

Ne pas augmenter globalement les pools ni multiplier les index du catalogue sans mesure. Aucun besoin de partitionnement ou de changement de framework n'est démontré à ce volume.

## Ordre de mise en œuvre conseillé

1. Garder les mesures de référence et ajouter les indicateurs essentiels.
2. Compresser les ressources, différer les services/règles et les ressources d'onglets.
3. Tester l'index de notifications et grouper les acquittements de l'agent.
4. Corriger la reprise des commandes ; découpler le heartbeat et borner les lots.
5. Réduire les projections/scans des rapports et le recalcul complet du tracking.
6. Mutualiser le polling SSE en conservant les garanties d'autorisation.
7. Ajuster la rétention, le recalcul statistique et les refactorings ciblés.

## Validation requise pour chaque correction

- Rejouer les mêmes mesures SQL à cache comparable et contrôler les écritures supplémentaires.
- Vérifier l'interface mobile et desktop, les droits, les changements de file et la conservation des brouillons.
- Couvrir services sans défaut, défaut sans options, un seul service actif, plusieurs actifs et désactivation.
- Vérifier tracking en attente/en cours/terminé, expiration, reconnexion et révocation.
- Vérifier les médianes/P90, journées et fuseaux avec des résultats de référence identiques.
- Tester l'agent pendant coupure/reprise cloud, modification concurrente d'une projection et arrêt en cours de cycle.
- Pour le SSE, faire ensuite un test de charge autorisé, borné et représentatif, avec mesures du pool et de PostgreSQL.

Les tests de la fonctionnalité services exécutés précédemment ne remplacent pas ces validations. Aucune optimisation applicative n'a été livrée dans cet audit.


### Validation F07

acquittement SQL groupé avec contrôle de séquence ; test PostgreSQL rejetant une réponse périmée puis acceptant la séquence courante (tracking-validation-2026-11-01.json).

### Validation F10

pagination plafonnée à quatre requêtes, ordre et totalité conservés ; annulation et séparation par site couvertes par les tests front (298 tests passent).

### Validation F11

révisions d’entrées, cron sélectif, recalcul à la lecture coalescé, changement de journée et publication des deux topics vérifiés sur PostgreSQL ; voir statistics-retention-validation-2026-11-01.json.

### Validation F13

purge bornée avec grâce et protections ; transactions PostgreSQL vérifient la conservation du dernier événement, des projections non acquittées et commandes RUNNING. Politique documentée dans remediation-architecture-et-exploitation-2026-11-01.md.

### Validation F16

lease récupérable, réutilisation du résultat, arrêt attendant le cycle et fermeture unique du pool ; tests PostgreSQL et tests agent passent.

### Validation F01

Chargement limité à la file sélectionnée ; règles chargées à l’ouverture des détails. La régression quatre files / trois services vérifie un seul GET d’associations et zéro GET de règles initial, à 320, 390, 768, 1024 et 1440 px. Les changements de défaut préservent le prix en cours de saisie. Les cas sans défaut et sans options restent couverts (services-settings et queue-service-selection ; 106 parcours passent).

### Validation F02

Lecture des topics partagée par file/type et processus, polling deux secondes et libération au dernier abonné. Autorisations individuelles et expiration conservées. Tests de révocation passent ; validation bornée de 100 observables SSE avec PostgreSQL réel : 100 lectures initiales puis trois lectures partagées, 300 vérifications individuelles, une révocation isolée et aucun polling après fermeture. Voir sse-load-validation-2026-11-01.json. Limite explicite : ce test ne mesure pas une charge HTTP réseau distribuée.

### Validation F03

Index partiel idx_notification_direct_pending déployé. Le plan de la vraie requête claimPending, avec SKIP LOCKED et reprise des leases, utilise l’index ; sélection vide vérifiée avec écritures annulées. Voir notification-claim-validation-2026-11-01.json. Les temps isolés restent sensibles au cache et à la charge ; le changement de plan est établi.

### Validation F04

Projection réduite aux onze colonnes utiles, un passage par jeu d’événements via VALUES, huit requêtes parallèles conservées et indexation des séries par file dans une Map. Résultats identiques aux références pour heure/jour/semaine/mois, fuseaux et percentiles. Sept mesures alternées donnent une médiane globale 946,7 → 808,5 ms dans cet environnement ; blocs temporaires lus des deux séries 4788/4902 → 492/492. Les mesures isolées fluctuent ; aucun gain uniforme par requête n’est prétendu. Voir reports-validation-2026-11-01.json et report-plan-validation-2026-11-01.json.

### Validation F05

Contrat SQL de classement partagé moteur/agent ; invalidations durables, rafraîchissement des files vivantes, tickets terminés conservés et réparation complète par file après quinze minutes. Égalité du classement sur cent inscriptions, acquittements et leases vérifiés sur PostgreSQL. Dernière comparaison : recalcul ancien complet environ 3,28 s, cycle incrémental 1,13 s ; premier recalcul environ 8,38 s, coût initial explicite. Concurrence mise à jour/refresh sans deadlock validée. Voir tracking-validation-2026-11-01.json et tracking-concurrency-validation-2026-11-01.json.

### Validation F06

Plusieurs lots de cent sous budgets de temps et de nombre ; priorité aux tickets vivants avec un lot FIFO sur quatre. Canal de contrôle indépendant, notifications bornées à trois tâches, délais absolus et backoff avec dispersion ; un heartbeat réussi ne remet plus à zéro un échec des transferts. Les transferts conservent la limite générale API et ne subissent plus la limite des tentatives d’authentification. Quatorze tests agent passent. Après déploiement : agent actif, heartbeat récent, zéro projection en retard et aucune erreur cloud (deployment-validation-2026-11-01.json).

### Validation F08

Compression Nginx limitée aux ressources statiques, Vary: Accept-Encoding et conservation octet pour octet après décompression vérifiés sur intra et cloud. Entrée JS environ 385 ko → 122 ko transférés ; CSS environ 238 ko → 42 ko. SSE réel via proxy répond text/event-stream sans compression. Voir deployment-validation-2026-11-01.json.

### Validation F09

Chargement des sites et utilisateurs directs réservé à l’onglet Sites ; rôles à l’ouverture d’une affectation. Les ressources partagées nécessaires aux compteurs et au périmètre restent disponibles. Les cinq tailles de configuration, l’affectation des rôles et la création de file passent dans la suite navigateur complète ; aucun chargement de règles anticipé sur Services.

### Validation F12

COUNT(*) et sélection des personnes sans DISTINCT redondant sur une clé primaire sans jointure multiplicatrice. Comparaison PostgreSQL en lecture seule sur cinq combinaisons (actifs/inactifs, recherche, pagination, vide) : résultats, totaux et ordre identiques. Voir persons-validation-2026-11-01.json.

### Validation F14

Métriques bornées de durée et P95 par modèle de route/job, abonnés et lectures SSE, pool PostgreSQL ; santé agent avec ancienneté du retard, âge du heartbeat, commandes en cours et compteurs distincts lots/projections. Tests des bornes et du percentile passent. pg_stat_statements est opérationnel sur intra, cloud et Neon ; aucune donnée personnelle ou token dans les labels. Voir les validations de déploiement, migrations et SSE.

### Validation F15

Extraction de la carte de file du cockpit, des étapes de l’assistant, du ticket kiosque et de la carte de service ; requêtes cockpit/rapports séparées de l’orchestration des repositories. Transactions métier conservées. Clés de cartes stables et brouillon distinct des données serveur ; régression qui modifie le défaut pendant la saisie passe. Types, architecture, tests et builds passent. Le détail de l’architecture est dans remediation-architecture-et-exploitation-2026-11-01.md.

Complément de validation F11 : chaque statistique journalière enregistre sa révision d’entrée (migration 021). Le recalcul d’une journée ne masque plus une autre journée encore périmée ; ce cas est vérifié sur PostgreSQL avec plusieurs journées et lectures simultanées.
