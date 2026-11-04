# Statut local intra par SSE — 4 novembre 2026

## Circuit retenu

L'agent reste responsable des contacts avec le cloud. Lorsqu'il enregistre un nouvel état `deployment_control`, une notification PostgreSQL `dorify_realtime`, clé `edge-local-status`, est émise dans la même instruction SQL. Une écriture identique ne notifie pas. La notification ne contient ni secret ni détail de l'installation.

L'API utilise sa connexion LISTEN existante : aucune connexion PostgreSQL par navigateur. Elle lit l'état une fois par changement et par processus API, partage le dernier snapshot entre ses abonnés et l'envoie directement via `GET /api/v1/edge/local-status/events`. Les heartbeats SSE, toutes les 15 secondes, ne déclenchent pas de requête SQL. Le mécanisme commun de récupération relit l'état toutes les cinq minutes lorsque LISTEN fonctionne, et après une reconnexion ; en cas de déconnexion de LISTEN, la récupération commune est accélérée à 30 secondes et les heartbeats sont suspendus.

Le frontend réalise une lecture REST initiale, puis reçoit les snapshots SSE. Le bandeau global et la page Santé partagent la même entrée de cache. Les deux anciens pollings REST du statut local sont supprimés. Si les heartbeats sont absents plus de 35 secondes, un contrôle local toutes les cinq secondes détecte la dégradation et autorise la récupération REST toutes les 30 secondes. Cette récupération s'arrête au retour des heartbeats. Une courte reconnexion n'active pas le polling.

Le flux est authentifié, vérifie la session avant ouverture et lors des changements, réagit aux notifications d'autorisation et se ferme à l'expiration du jeton. Son chemin reste accessible lorsque l'installation est révoquée afin de transmettre la révocation et son éventuelle levée ; cela ne contourne pas le blocage des opérations métier. Le mode cloud n'ouvre pas ce flux local.

## Validation

- [x] Huit tests API ciblés : snapshot initial partagé, propagation des changements, absence de lecture sur heartbeat, nettoyage des abonnements, expiration et révocation de session, garde métier et état persistant.
- [x] Cinq tests frontend : partage de la lecture, snapshots directs, absence de polling pendant les heartbeats, récupération après perte du flux et arrêt de cette récupération, rejet des données invalides et bandeaux de statut.
- [x] Deux tests du stockage/listener de l'agent, TypeScript des trois composants, lint ciblé API/web et contrôles d'architecture des trois projets.
- [x] Contrat OpenAPI exporté et spécification du frontend synchronisée ; images API, agent et interfaces intra/cloud reconstruites et déployées.
- [x] Edge réel, page Santé, environ 60 secondes : **1 requête REST initiale, 1 flux SSE, 6 snapshots, 5 changements d'état et 4 heartbeats**, aucun GET périodique supplémentaire. Agent connecté au cloud ; aucune réponse simulée ni modification de l'état de révocation pour ce contrôle.
- [x] Endpoint SSE sans authentification : HTTP 401. Interface cloud : HTTP 200. Neuf conteneurs sains après déploiement.

Aucune migration ni réinitialisation de base nécessaire. Les données existantes et les 100 000 inscriptions de charge sont conservées. Le contrôle HTTP général de santé de la page Santé est distinct du statut local et n'est pas modifié par cette intervention.
