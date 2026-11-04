# Annonces opérationnelles — 4 novembre 2026

## Fonctionnement livré

- Administration → Annonces : publication avec aperçu, plusieurs destinataires, importance, début et fin d’affichage, historique et retrait confirmé.
- Depuis le cloud, le ciblage « Installations intra » concerne une ou plusieurs installations complètes, tous leurs sites et écrans locaux compris. Aucun site interne distant n’est exposé comme destinataire dans le cloud.
- Le ciblage « Sites » concerne un ou plusieurs sites gérés dans l’environnement courant : sites cloud depuis le cloud, sites intra depuis cet intra.
- Les annonces des sites intra ne sont pas remontées vers le cloud et ne figurent pas sur le suivi public hébergé dans le cloud d’un ticket intra, conformément au choix demandé.
- Les messages sont publics sur les écrans concernés. Le formulaire l’indique explicitement. Texte simple, sans HTML exécutable.
- Bandeaux sous l’en-tête, niveaux information/attention/critique, mise en page mobile/tablette/desktop, quatre langues et thèmes existants. Le texte publié reste celui saisi par son auteur.
- Gestion accessible sans sélection préalable d’un site. Raccourci depuis l’administration des installations.

## Diffusion et cohérence

- Publication/retrait : transaction PostgreSQL et notification après commit. Lectures mutualisées par site et processus API.
- Les abonnements annonces, administration, files, état local et tracking partagent le transport SSE unique de l’onglet, sous HTTP/1.1.
- Pour une annonce locale à un site, mise à jour par notification PostgreSQL puis SSE. Aucun rafraîchissement REST périodique supplémentaire tant que le heartbeat est actif.
- Pour une installation distante, réutilisation du canal de contrôle sortant existant de l’agent : récupération au prochain contact, normalement sous 30 secondes, puis écriture locale atomique avec notification PostgreSQL et SSE. Ce trajet cloud → agent ne constitue pas une poussée instantanée depuis le cloud.
- Lors d’une reconnexion, les snapshots récupèrent l’état courant et les retraits manqués. La récupération de sécurité et le repli sans heartbeat utilisent les mécanismes existants.
- Début et expiration planifiés par échéance locale, sans polling. Une annonce déjà reçue expire même si l’agent est hors ligne. Le navigateur utilise l’heure observée du serveur et le temps monotone écoulé, pas son horloge civile seule.
- Limites : titre 120 caractères, message 2 000, durée 30 jours maximum, début au plus dans 90 jours, 50 annonces actives ou programmées par destinataire.

## Droits et données

- Installations : permission `edge_installation_manage`, cloud uniquement. Sites : `site_edit`, périmètre recalculé avant les opérations.
- Une sélection mélangeant destinataires autorisés et interdits est rejetée entièrement. Un responsable limité à un site ne peut pas retirer une annonce partagée avec d’autres sites ; les noms des autres sites sont masqués dans son historique.
- Le flux public refuse les abonnements privés avant l’envoi des en-têtes SSE. Pour le suivi direct, le site est dérivé de la file autorisée ; une valeur de site fournie ne peut pas détourner ce contexte.
- Publication et retrait tracés dans l’audit, actions traduites dans les quatre langues, cible présentée avec le titre de l’annonce.
- Migration additive `005_operational_announcements.sql`, sans modification des migrations historiques ni rejeu des seeds sur les bases existantes.

## Validation

- API : suite complète de 537 tests exécutée ; deux vérifications de contrat nécessitaient une adaptation (nouvelle migration et décorateur Swagger centralisé). Après correction, les deux suites concernées passent : 10 tests. Les tests métier ciblés, notamment séparation des sites, droits et flux public, passent : 46 tests.
- Front : suite complète exécutée, 356 tests réussis et un dépassement de délai sur un test de changement de langue pendant l’exécution concurrente. Reprise isolée des actions d’audit et de l’administration des installations : 8 tests réussis. Règles d’accès sans site : 13 tests réussis. Types, architecture et lint vérifiés.
- Agent : contrôle complet réussi, dont 27 tests, types, format, architecture et compilation.
- Intégration réelle dans deux environnements Docker temporaires : ciblage multiple et destinataire exclu, relais par le véritable agent, séparation cloud/intra et par site, publication/retrait SSE, début/expiration, refus des sujets privés et contrôle des droits d’un manager. Dix scénarios réussis.
- Arrêt de l’agent temporaire après réception : expiration locale confirmée.
- Edge réel aux largeurs 390, 1 024 et 1 440 px : publication depuis le formulaire, aperçu, absence de débordement horizontal et au plus une connexion SSE active.
- Edge réel : publication cloud à deux installations et retrait confirmé ; bandeaux dans les quatre langues, en clair et sombre sur mobile.
- Les annonces de test ont été publiées uniquement dans les bases temporaires, jamais sur les installations Docker habituelles.

## Migration locale

Sauvegardes privées effectuées avant migration. Comptages inchangés immédiatement après application :

| Environnement Docker | Inscriptions avant/après | Sites avant/après |
| --- | ---: | ---: |
| Cloud | 216 611 | 10 |
| Intra | 118 020 | 2 |

Neon n’a pas été modifié dans cette livraison.

## Déploiement vérifié

Les API, les deux fronts et l’agent intra ont été reconstruits et déployés dans les Docker locaux. Contrôles réels derrière les proxys web cloud et intra : santé HTTP 200, snapshot public et premier événement SSE `announcements` reçus. Accès à l’administration des annonces vérifié dans le front intra déployé sans site sélectionné. Les neuf conteneurs habituels sont sains. L’environnement Docker temporaire de validation est supprimé après les essais.

## Harmonisation avec l’annuaire

- Page reconstruite avec les composants communs `FilterPanel`, `DataTable`, cartes mobiles, menu d’actions mobile, pagination et fenêtres de consultation/édition.
- Tableau synthétique : titre, importance, état, destinataires résumés et fin d’affichage. Le texte complet et la liste des destinataires se consultent dans une fiche dédiée. Les libellés longs sont tronqués dans le tableau.
- Actions : consulter, modifier et supprimer avec confirmation. La modification conserve les instants de début et de fin si seuls le texte ou les destinataires changent. Le périmètre sites/installations d’une annonce reste immuable.
- Recherche et filtres côté serveur : `search`, `scope`, `status`, `severity`, `targetId`, `dateFrom`, `dateTo`, `sort`, `page`, `pageSize`. Recherche littérale insensible à la casse dans le titre et le message. La période filtre le chevauchement avec la période d’affichage, bornes incluses ; les instants ISO doivent préciser leur fuseau. Le front transforme les dates locales choisies en bornes ISO.
- Tri autorisé : `createdAt`, `title`, `startsAt`, `endsAt`, ascendant ou descendant. Ordre stable avec identifiant comme critère de départage. Le total et les résultats utilisent les mêmes prédicats, y compris le périmètre d’accès.
- Contrat Swagger et client front régénérés. La normalisation Swagger conserve les formats `date-time` explicitement déclarés et documente les tris du listing des annonces.
- Nouvelles opérations : `GET /api/v1/announcements/:id`, `PUT /api/v1/announcements/:id`, `DELETE /api/v1/announcements/:id`. Le DELETE effectue désormais une suppression logique, masquée des listings, des consultations directes et des écrans publics. Le retrait sans suppression de l’historique administratif reste disponible via `POST /api/v1/announcements/:id/withdraw`.
- Migration additive `006_announcement_management.sql`. La cible de l’audit est conservée. Les nouvelles actions d’audit sont traduites dans les quatre langues.
- Les mutations verrouillent l’annonce et revérifient tous ses destinataires avant écriture. Une consultation partagée n’accorde pas de droit de modification ou de suppression aux responsables d’un sous-ensemble des sites.
- Les listes filtrées sont invalidées par SSE aux échéances de début/fin, même si aucun résultat courant n’indique la prochaine échéance. Un minuteur est partagé par processus ; aucun polling fréquent n’est ajouté.

Validation de cette évolution : 56 tests API ciblés réussis ; 37 tests front de catalogues et d’audit réussis ; types, lint et architecture vérifiés. Huit scénarios sur de véritables API temporaires valident les filtres SQL, les caractères littéraux `%` et `_`, le tri, la pagination, les droits, l’édition et la suppression, leur diffusion SSE et le relais par l’agent. Edge aux largeurs 390, 1 024 et 1 440 px : filtres et parcours consulter → modifier → supprimer réussis, sans débordement horizontal. Les données de vérification restent exclusivement dans les environnements temporaires.

Avant la migration 006, nouvelles sauvegardes privées des bases Docker ; après migration, comptages inchangés : cloud 216 611 inscriptions et 10 sites, intra 118 020 inscriptions et 2 sites.

Contrôle complémentaire du front cloud : publication à deux installations, en-tête du tableau aligné, modification conservant exactement l’instant de début et suppression réussies. API et fronts cloud/intra déployés ; listing filtré vérifié sur l’intra déployé, snapshots et SSE vérifiés derrière les deux proxys. Les neuf conteneurs habituels sont sains et les conteneurs temporaires ont été supprimés. L’agent reste compatible sans modification supplémentaire.
