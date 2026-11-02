# Corrections du 2 novembre 2026

- [x] Check-in : normalisation du résultat PostgreSQL `UPDATE ... RETURNING` (`[rows, count]` avec TypeORM), avant publication des événements de file. Régression couverte pour les deux formats de résultat.
- [x] Commandes intra : statut persistant `timedOut` après le délai existant de 15 minutes, pour les commandes en attente ou accusées sans résultat. Migration additive 025 appliquée sur les bases Docker intra et cloud.
- [x] Une commande expirée est exclue de la distribution ; son accusé de réception est refusé (409) ; un résultat tardif ne remplace pas son statut terminal. L'agent vérifie aussi son échéance avant traitement et n'exécute pas une commande refusée par le cloud.
- [x] Actualisation : expiration évaluée lors des lectures et des transitions de commande ; le flux SSE de l'inventaire vérifie sa signature toutes les deux secondes et matérialise aussi les expirations. Aucun rafraîchissement REST périodique ajouté au navigateur.
- [x] Actions des installations : conteneurs flex avec espacement et retour à la ligne ; libellés des statuts traduits, dont « Délai dépassé ».
- [x] Arabe tunisien : disposition LTR conservée ; paragraphes arabes avec ponctuation adaptée à leur écriture ; dates isolées dans le formateur commun, indépendamment de la disposition de l'écran.
- [x] Tickets thermiques : suppression des styles d'impression concurrents et de la réapparition du kiosque dans le document imprimé. Choix persistant de rouleau 58/80 mm ; page dimensionnée à la hauteur du ticket ; QR code de 32 mm.

## Validation

- API : 449 tests réussis, 93 suites.
- Agent : 17 tests réussis.
- Front : 29 tests unitaires ciblés réussis ; lint et vérification TypeScript réussis.
- Navigateur : 15 parcours langue/notes/expériences publiques et 2 parcours spécifiques au cloud réussis, sur mobile et desktop.
- Impression Chromium : pour chaque largeur (58 et 80 mm), une seule page PDF, largeur physique contrôlée, QR code conservé à sa taille réelle et application masquée. Aucun essai matériel sur imprimante thermique réalisé.
- PostgreSQL réel : check-in et événements vérifiés dans une transaction annulée ; expiration, exclusion de distribution, refus de l'accusé et rejet du résultat tardif vérifiés dans une autre transaction annulée. Le ticket signalé n'a pas été modifié par ces validations.
- Le ticket signalé était déjà au statut `expired` au moment du diagnostic ; la correction technique ne contourne pas les règles de retard des rendez-vous.

Les journaux de validation et de déploiement locaux portent le préfixe `ai/audits/followup-`.
