# Consolidation SQL et réinitialisation des bases — 2 novembre 2026

Périmètre autorisé : Docker intra, Docker cloud et Neon. Les anciennes données
applicatives ont été remplacées par un jeu tunisien synthétique.

## Réalisé et validé

- [x] Sauvegardes PostgreSQL des trois bases avant toute suppression ; archives
      relues par pg_restore et empreintes SHA-256 enregistrées. Elles restent dans
      `.tmp-consolidation/`, exclu de Git, avec les paramètres privés d'intervention.
- [x] Exécution des 25 anciennes migrations dans une base temporaire de référence.
- [x] Création d'un seul fichier final :
      `src/core/database/sql/migrations/001_schema_final.sql`. Colonnes et contraintes
      sont directement intégrées aux tables ; aucune instruction ALTER TABLE.
- [x] Comparaison du catalogue final avec la référence historique : 688 éléments
      identiques, comprenant 36 tables et 18 fonctions, leurs contraintes, index et
      triggers. Anciennes migrations retirées du répertoire actif, historique Git
      conservé ; tests des anciens états intermédiaires remplacés par les invariants
      du schéma final.
- [x] Scripts d'initialisation et vérifications UUID/agent adaptés. Le reset
      réinitialise aussi l'état durable de l'agent, pour éviter les anciens curseurs.
- [x] Réinstallation des références : rôles, permissions, services Basic/Standard/
      Premium, traductions et root. Correction des chaînes françaises mal encodées.
- [x] Générateur de démonstration séparé, reproductible et inséré par lots ; jamais
      lancé automatiquement par l'application.
- [x] Réinitialisation des trois bases, avec préservation de neon_auth et des
      identités/empreintes de jetons nécessaires à la liaison agent intra/cloud.
- [x] Vidage des caches Redis, reconstruction de l'image API et redémarrage des
      API intra/cloud et de l'agent.

## Données installées

| Base         | Sites | Files | Clients | Tickets |
| ------------ | ----: | ----: | ------: | ------: |
| Docker intra |     1 |     5 |   2 500 |  18 019 |
| Docker cloud |    10 |    50 |  25 000 | 216 611 |
| Neon         |    10 |    50 |  25 000 | 212 372 |

Cloud : Tunis, Sfax, Sousse, Nabeul, Bizerte, Kairouan, Gabès, Monastir, Gafsa,
Médenine. Intra : Ariana. Fuseau Africa/Tunis, monnaie TND. Chaque site comprend
un manager, une borne et des opérateurs affectés à ses guichets.

Le jeu couvre 90 jours d'historique et 21 jours de rendez-vous futurs, avec
variation des charges selon le jour, des guichets, des services et tarifs, des
délais, des statuts et des types d'entrée. Il comprend notes, audit et
notifications historiques simulées. Les rendez-vous respectent les jours,
horaires et pauses ; les clients des tickets ouverts sont distincts par file.
Les calculs d'estimation et projections passent par les fonctions canoniques.

## Preuves de validation

- [x] Contrôles qualité : format, lint, types, build, architecture, UUID ;
      89 suites et 469 tests API réussis.
- [x] Cinq tests supplémentaires des outils : découpage SQL, contraintes/FK,
      refus d'instructions inconnues, aléatoire reproductible et garde de périmètre.
- [x] Même catalogue de 688 éléments sur les trois bases, PostgreSQL 16 Docker
      et PostgreSQL 18 Neon compris ; une seule migration appliquée par base.
- [x] Aucun ticket dans le mauvais site, aucune session opérateur incohérente,
      aucun ticket ouvert sur un service inactif, aucune affectation de file sans
      affectation au site, aucun compteur insuffisant ni rendez-vous hors calendrier.
- [x] Vérifications générales BDD réussies : UUID/FK, audit append-only,
      références opérateur, modèles de notification et permissions admin/root.
- [x] Connexion des managers cloud et intra, portefeuille limité au site affecté,
      rapports sur 90 jours avec données non nulles et cinq files par site.
- [x] Lecture du même ticket intra par API intra et cloud : position et estimation
      concordantes après reprise de l'agent. Jeton conservé privé.
- [x] API, interfaces web et endpoint readyz de l'agent répondent HTTP 200 ;
      conteneurs Docker sains.

Accès et commandes documentés dans `scripts/database/README.md`. Les anciennes
sessions utilisateur ont été invalidées par la réinitialisation : se reconnecter.
