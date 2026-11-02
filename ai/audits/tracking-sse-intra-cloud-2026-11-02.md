# Suivi SSE des tickets intra depuis le cloud — 2026-11-02

## Défaut confirmé

Les projections cloud ne contiennent pas de file locale. La page ne pouvait donc pas ouvrir le SSE de file, restait en connexion et ne relisait la position qu'une fois par minute. L'agent transmettait ses changements à son prochain cycle périodique.

## Traitement validé

- [x] Flux public dédié `GET /api/v1/realtime/tracking`, autorisé par `X-Registration-Token` uniquement en en-tête. Le cloud vérifie le hash, l'expiration et le statut de l'installation.
- [x] Instantané initial et événements `tracking_changed` contenant uniquement les champs publics du ticket. Le navigateur applique directement l'instantané, sans GET périodiques de position.
- [x] Heartbeat SSE, reconnexion, surveillance du flux et fermeture des abonnements à la fin du ticket ou au démontage de la page.
- [x] Vérification du jeton dans un guard avant les en-têtes SSE : refus HTTP réel à expiration. Vérification continue pendant l'abonnement ; fermeture après expiration/révocation.
- [x] Lectures serveur indexées et partagées entre les onglets d'un même ticket, avec libération après déconnexion. Même stratégie que les topics SSE existants : une vérification serveur toutes les 2 secondes, sans polling REST du navigateur.
- [x] Migration 022 : notification PostgreSQL après commit sur les marqueurs de file à recalculer, sans jeton ni données personnelles.
- [x] Agent réveillé par LISTEN/NOTIFY, rafales fusionnées, reconnexion LISTEN lors d'un cycle après déconnexion, backoff conservé si le cloud est indisponible. Cycle périodique de 30 secondes conservé uniquement comme filet de sécurité/reprise.
- [x] Migration 022 appliquée avec le runner habituel sur les bases Docker intra et cloud. Agent, API et interfaces intra/cloud déployés et sains.
- [x] Contrats OpenAPI de l'API et du front mis à jour.

## Preuves

- API : 22 tests ciblés du temps réel passent ; les 5 tests du nouveau service sont également rejoués après ajout du guard. TypeScript, lint ciblé et architecture passent.
- Front : 43 tests ciblés passent, ainsi que TypeScript et le lint ciblé. Les 8 parcours publics passent, dont le parcours SSE cloud sans relecture REST périodique.
- Agent : 15 tests passent, ainsi que la chaîne architecture, formatage, TypeScript et build.
- Réveil réel de l'agent après demande technique de recalcul observé en environ 5,1 secondes avec intervalle de sécurité configuré à 30 secondes. Aucun ticket existant modifié.
- Test réel sur projection synthétique temporaire : SSE direct et via nginx, affichage dans le navigateur cloud déployé, changement de statut reçu en 2 012 ms après mise à jour de la projection cloud. Une seule lecture REST initiale ; aucun GET de position supplémentaire pour le changement SSE.
- Expiration : fermeture des deux flux et reconnexion refusée avec HTTP 410 ; écran d'expiration affiché dans le navigateur.
- Projection de test supprimée dans le nettoyage, y compris en cas d'échec. Aucun jeton de ticket existant n'a été utilisé pour ces tests de mutation.

Les délais mesurés concernent les étapes indiquées sur les conteneurs locaux, pas un engagement de délai de bout en bout sur une connexion distante.
