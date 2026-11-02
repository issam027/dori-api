# Revue agent, API et web — 2 novembre 2026

Revue ciblée des défauts simples et des incohérences confirmées, avec un commit par point. Aucun changement de contrat HTTP ni migration de base nécessaire.

## Corrections

| État | Composant | Correction | Commit |
| --- | --- | --- | --- |
| Validé | API | Normalisation de 13 chemins `UPDATE ... RETURNING` : notes/personnes, sites, files, services, registrations, installations, traductions, notifications, rappels et rotation de session. Les résultats `[lignes, compteur]` ne sont plus interprétés comme des objets métier ; les mises à jour sans ligne ne sont plus des faux succès. | `1bf8dae` |
| Validé | API | Typage PostgreSQL cohérent du statut des retours de livraison ; suppression de l'erreur `42P08` qui empêchait de traiter certains retours. | `dbeba95` |
| Validé | API | Réparation des accents mal encodés dans les libellés de secours de l'audit. | `d239e39` |
| Validé | Agent | Reconnexion de `LISTEN` après une fermeture propre de la connexion PostgreSQL. | `2101c9b` |
| Validé | Agent | URL du contrôle de santé normalisée pour accepter les barres obliques finales. | `018eee1` |
| Validé | Agent | Correction du type d'un scénario de commande qui faisait échouer le contrôle TypeScript des tests. | `3f0a978` |
| Validé | Web | Traduction des descriptions accessibles et infobulles du mode cloud/intra dans les quatre langues. | `44b43a3` |
| Validé | Web | Traduction des unités du sélecteur de rouleau thermique. | `6f8e9d0` |
| Validé | Web | Couleurs des badges cloud/intra centralisées dans les tokens, avec les mêmes valeurs visuelles. | `924e0d7` |
| Validé | Web | Nettoyage du mode impression, des écouteurs et des temporisations si le navigateur refuse l'impression. | `69ba68a` |
| Validé | Web | Libellé tunisien des champs obligatoires raccourci pour respecter sa contrainte d'affichage. | `47fc926` |
| Validé | Web | Unité SI « mm » explicitement reconnue comme identique en français et anglais dans le contrôle des traductions. | `d120fcc` |
| Validé | Web | Catalogue français séparé du moteur i18n au build ; plus gros bloc secondaire réduit de 47 354 à 34 499 octets gzip, sans relever le budget de 47 000 octets. | `f060129` |

## Vérifications

- API : suite globale de 472 tests réussie ; après les dernières corrections de livraison et de libellés, les 71 tests ciblés concernés ont été repassés avec succès. Lint, TypeScript, compilation et architecture vérifiés.
- Agent : contrôle complet réussi — format, architecture, TypeScript, 21 tests et compilation.
- Web : contrôles de traduction, tokens graphiques, cohérence UI, architecture, lint, TypeScript et budgets de bundle réussis.
- PostgreSQL réel : personnes et notes, double suppression, statut d'installation, service, renvoi de notification, retours livré/échoué, absence de notification correspondante et déduplication vérifiés. Les transactions ont été annulées et aucun message n'a été envoyé.
- Navigateur : 134 parcours réussis dans la suite globale et les 2 parcours propres au cloud réussis séparément, soit les 136 scénarios couverts. Contrôles desktop, tablette, mobile, quatre thèmes, accessibilité, impression thermique, langues, formulaires, services de file, rendez-vous, sessions et synchronisation entre onglets.
- Web : passe unitaire finale entièrement réussie, 324 tests dans 95 fichiers.

## Déploiement

- [x] API Docker intra et cloud reconstruites et saines.
- [x] Fronts Docker intra et cloud reconstruits et sains.
- [x] Agent Docker intra reconstruit et sain.

Les cinq conteneurs applicatifs sont `healthy`, ainsi que PostgreSQL et Redis dans les deux environnements. Les deux endpoints API de santé et les mêmes endpoints via les proxies web répondent `ok` ; `/readyz` de l'agent répond `ready`.

Journaux locaux : `ai/audits/review-three-*.log`. Le rapport d'audit préexistant modifié automatiquement par l'environnement n'est pas inclus dans les commits de cette revue.
