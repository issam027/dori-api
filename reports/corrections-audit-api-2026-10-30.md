# Corrections de l’audit API — 30 octobre 2026

## Périmètre

Corrections des points 1, 2, 6, 9, 11, 13 et 14 et des cinq sujets de cohérence métier/duplication du rapport initial. Les points 7 (mutualisation du polling SSE) et 12 (reprise des webhooks) restent hors de cette intervention, conformément à la sélection.

## Comportements corrigés

| Point                   | Résultat                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Auto-attribution    | Le rôle demandé est contrôlé même lorsque l’appelant se cible lui-même. Un manager ne peut pas s’attribuer admin/root ; un admin ne peut pas s’attribuer root. La gestion globale par root est conservée.                                                                                                                                                                                |
| 2 — Périmètre           | Attribution/retrait de rôles et déconnexion forcée vérifient le périmètre actuel de l’appelant. Un compte hors site est masqué par `USER_NOT_FOUND`. Les affectations directes et via une file sont prises en compte ; admin/root conservent leur périmètre global.                                                                                                                      |
| 6 — SSE                 | Chaque cycle de polling revérifie la session et les affectations pour l’affichage, ou le token et l’inscription pour le suivi. Le cache de périmètre est contourné. L’expiration ferme également le flux via un timer. Une révocation ferme le flux au prochain contrôle, normalement sous deux secondes hors latence d’infrastructure. La déconnexion libère les timers et abonnements. |
| 9 — Échecs de connexion | L’incrément et le calcul du verrouillage sont effectués dans une seule instruction SQL. Une tentative n’écrase plus un compteur précédemment lu.                                                                                                                                                                                                                                         |
| 11 — Rôles inactifs     | Les permissions émises et les permissions/rangs de gestion excluent les rôles inactifs.                                                                                                                                                                                                                                                                                                  |
| 13 — Reprise du worker  | Un traitement dont le lease de cinq minutes a expiré est repris s’il reste des tentatives, ou finalisé en échec au plafond. Les mises à jour finales vérifient aussi le numéro de tentative et l’état du claim pour empêcher un ancien worker d’écraser un traitement repris.                                                                                                            |
| 14 — Métriques          | Un middleware observe la terminaison HTTP après les guards et les filtres. Il compte le statut final une seule fois, distingue les requêtes interrompues et sépare la durée des flux SSE de la moyenne REST.                                                                                                                                                                             |

## Cohérence et duplication

- **Attente et seuils :** les notifications utilisent le même service d’estimation que le suivi REST. Les positions sont récupérées en lot, puis les threads/statistiques sont réutilisés par file et journée, sans trois requêtes supplémentaires par client. Le classement distingue les clients appelables immédiatement des rendez-vous futurs et applique un départage déterministe.
- **Suivi et replanification :** la création et la replanification réutilisent le même calcul d’échéance. Pour un rendez-vous futur, le TTL est calculé à partir du rendez-vous ; pour un passage immédiat, à partir de l’émission. L’échéance reste plafonnée à la fin de la journée métier dans le fuseau du site. Le token opaque reste inchangé lors de la replanification ; sa validité est mise à jour dans la même transaction.
- **Notifications automatiques :** préparation du destinataire, rendu, repli de langue, erreurs et insertion en lot sont communs aux notifications de bienvenue et de seuil. L’inscription utilise son propre manager transactionnel pour conserver l’atomicité.
- **Injection :** `RankService` est injecté par NestJS dans les services utilisateurs et authentification.
- **Modification utilisateur :** profil, statut et déconnexion des sessions associées sont appliqués dans une seule transaction. Une erreur d’unicité sur le profil ne peut plus laisser une désactivation déjà validée séparément.
- **Retours TypeORM :** les chemins modifiés de profil, replanification et retrait de rôle normalisent les résultats `UPDATE/DELETE ... RETURNING` au format du driver installé (`[lignes, nombre]`). Des tests couvrent ce format, notamment le retrait d’un rôle non attribué sans révocation de session injustifiée.

## Compatibilité et exploitation

- Aucun changement de schéma SQL, nouvelle variable d’environnement ou migration nécessaire.
- Les routes, les schémas de requête et les enveloppes de réponse restent compatibles. Les opérations auparavant autorisées à tort retournent désormais les erreurs d’autorisation existantes.
- Les navigateurs doivent reconnecter le flux d’affichage avec un access token valide après expiration. Une inscription replanifiée peut nécessiter une reconnexion SSE si son ancienne échéance est atteinte sur une connexion déjà ouverte.
- La révocation SSE repose sur des contrôles périodiques, et non sur une notification instantanée. Les lectures restent propres à chaque connexion : l’optimisation du point 7 n’est pas incluse. Les contrôles supplémentaires de session/périmètre ont un coût PostgreSQL à mesurer en charge.
- La moyenne REST utilise de nouveaux compteurs dédiés ; le calcul conserve un repli pour les anciens compteurs si les nouveaux sont absents.
- Les notifications restent envoyées par le transport simulé existant : le remplacement par un fournisseur réel relève du point 3, non sélectionné.

## Vérification

`npm run quality:check` : réussi. Formatage, lint sans avertissement, typage strict, compilation et vérification statique des UUID passent. La suite complète compte **79 suites et 418 tests réussis** (51 tests supplémentaires par rapport à l’audit initial).

Tests de non-régression sur les auto-attributions, le périmètre, la fermeture SSE après révocation/expiration, les seuils calculés depuis les estimations, le suivi des rendez-vous futurs/replanifiés, les erreurs HTTP finales, les templates et l’atomicité de la commande de modification utilisateur.

Les tests HTTP exécutent une application NestJS locale isolée. Les repositories sont testés avec des dépendances factices et leurs instructions SQL sont vérifiées ; les courses concurrentes et reprises ne sont pas validées contre une instance PostgreSQL réelle dans cette intervention. Aucun appel aux services de production ni envoi SMS/email réel.
