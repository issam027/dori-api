# Un seul transport SSE par onglet — 4 novembre 2026

## Comportement

Le frontend possède désormais un seul gestionnaire réseau SSE par fenêtre JavaScript. Les files du cockpit, la salle d'attente, le kiosque, le statut local de l'agent, les installations et le suivi des tickets déclarent des abonnements logiques à ce gestionnaire. Ils n'appellent plus directement `fetchEventSource`.

Pour les écrans authentifiés, `POST /api/v1/realtime/events` regroupe les abonnements dans une seule réponse `text/event-stream`. La sélection est envoyée en JSON pour éviter une URL trop longue : au maximum 1 000 files distinctes, statut local, installations et éventuellement un ticket en aperçu. Les données continuent à être distinguées par leur type d'événement. Un seul heartbeat est émis toutes les 15 secondes lorsque la connexion LISTEN PostgreSQL fonctionne.

Le tracking anonyme conserve son endpoint public et son jeton propre ; il utilise le même gestionnaire et n'ouvre également qu'une connexion. Dans l'aperçu authentifié, les événements de tracking rejoignent la connexion commune avec le statut local. Les jetons restent dans les en-têtes, jamais dans l'URL ni dans le JSON de l'abonnement SSE.

Les ajouts ou retraits d'abonnements sont regroupés. Lorsque leur union change, le gestionnaire annule et attend la fermeture du transport précédent avant d'en ouvrir un autre. Les abonnements identiques ne provoquent pas de reconnexion. Les snapshots initiaux et les rafraîchissements à l'ouverture rétablissent les données après cette courte transition. Les composants gardent leur détection de perte de heartbeat et leur récupération dégradée existante.

Les anciens endpoints restent disponibles pour compatibilité API ; le frontend utilise le transport commun. Aucun changement de protocole, de certificat ou de configuration HTTP/2 n'est introduit. La limite HTTP/1.1 de connexions par origine reste partagée entre les onglets : cette intervention garantit un flux par onglet, pas un flux pour tout le navigateur.

## Sécurité et cycle de vie

- La sélection JSON et tous ses droits sont validés dans une garde avant l'envoi des en-têtes SSE : les refus conservent leur statut HTTP 400, 401, 403, 404 ou 410 selon le cas.
- Chaque file conserve sa vérification de périmètre. Les installations exigent leur permission de gestion. Un aperçu de ticket exige également un jeton de tracking valide.
- Les événements de statut local restent accessibles pour expliquer une installation révoquée, sans autoriser ses opérations métier.
- Expiration de session, révocation ou arrêt d'un abonnement protégé ferment le transport entier : aucun heartbeat ne doit annoncer comme sain un abonnement terminé.
- Le dernier désabonnement ferme le fetch ; la fermeture de la réponse HTTP désabonne les sources serveur, y compris pour une requête POST dont le corps est déjà lu.
- Les événements SSE sont des lectures : l'intercepteur d'audit ne crée pas une entrée métier pour chaque snapshot ou heartbeat.

## Validation

- [x] 34 tests API ciblés : union des événements, heartbeat unique, droits des files et installations, jetons, expiration, validation avant en-têtes, fermeture du socket et audit.
- [x] 27 tests frontend : union/dédoublonnage, absence de recouvrement des transports, routage des événements, reconnexion, jetons, tracking, statut local et récupération dégradée.
- [x] TypeScript, lint ciblé et vérifications d'architecture API/web.
- [x] API et interfaces intra/cloud reconstruites et installées ; aucun changement nécessaire dans l'agent ni migration de base.
- [x] Vérification réelle dans Edge sur l'intra : cockpit avec six files et statut local, navigation vers Santé, aperçu authentifié d'un ticket, tracking anonyme. Maximum d'un transport actif par onglet, réception des heartbeats et des états locaux, sans réponses simulées.

Les compteurs détaillés du parcours retenu sont dans [la preuve navigateur](./sse-unique-par-onglet-2026-11-04.json). Les essais intermédiaires du pilote restent dans le répertoire local ignoré `.tmp-consolidation/` ; ils ont permis d'ajuster la sélection du site et l'ouverture des sections du menu. Les tests ne créent, ne clôturent et ne suppriment aucun ticket. Le jeu de 100 000 inscriptions intra est conservé.

Contrôle final : 100 001 inscriptions présentes dans le site de charge, et aucune ligne d'audit `realtimeSession.stream` créée par les ouvertures ou événements du flux. Le protocole constaté dans Edge est `http/1.1` ; le maximum mesuré est un transport actif pour chacun des parcours cockpit, Santé et aperçu. Le tracking anonyme ouvre également un seul flux.
