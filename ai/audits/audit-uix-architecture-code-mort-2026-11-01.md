# Audit UI/UX, architecture et code mort — 1er novembre 2026

## Périmètre et preuves

Complément à audit-technique-2026-11-01.md. Les trois dépôts ont été inspectés : dori-web, dori-api, dori-agent.

Aucun code applicatif, paramètre de déploiement ou donnée métier modifié. Les nouveaux fichiers sont uniquement dans ai/audits du dépôt API.

Méthodes :
- Revue des conventions du dépôt, scripts qualité, configurations TypeScript, dépendances, points d'entrée, imports et tests.
- Graphe des imports statiques, analyse TypeScript des déclarations/références et confirmation textuelle des principaux candidats.
- Parcours Chromium du front intra déployé avec API simulée par les fixtures existantes. Le rendu déployé et le code source sont deux types de preuves distincts ; aucun rebuild effectué.
- 85 parcours principaux : 17 routes à 320, 390, 768, 1 024 et 1 440 px. Contrôle axe sur les 34 parcours à 390 et 1 440 px.
- 24 parcours complémentaires sur six routes à quatre largeurs. Le fichier complémentaire conserve aussi les limites rencontrées.
- Captures des rapports, services, annuaire, cockpit et rendez-vous à trois tailles, plus deux captures à 1 024 px.

Le périmètre navigateur principal comprend cockpit, suivi du jour, annuaire, rendez-vous, supervision, rapports, notifications, portefeuille, sites, files, services, utilisateurs, traductions, audit, profil, onboarding et kiosque. Le complément comprend affichage, mode appareil, santé, installations, mentions et tracking avec un ticket simulé.

Limites : données majoritairement simples ou vides, rôle root, français, thème clair, Chromium. Ce n'est pas une certification d'accessibilité, ni un test sur de vrais appareils iOS/Android, Safari ou lecteurs d'écran. Les grands jeux de données, RTL, thèmes, erreurs, modales et étapes de tous les assistants demandent une matrice de régression distincte. Le contrôle complémentaire de création de file n'a pas atteint la modale : la fixture a affiché l'écran d'erreur. Cela ne prouve pas un bug de production et la modale n'est pas déclarée validée.

## Résumé priorisé

| ID | Priorité | Domaine | Constat |
| --- | --- | --- | --- |
| UX01 | P1 | Mobile | Contraste du libellé actif de navigation basse inférieur au minimum AA |
| UX02 | P1 | Tablette | Débordements globaux à 1 024 px sur rendez-vous et onboarding |
| UX03 | P2 | Accessibilité | Aperçu d'affichage défilable sans accès clavier identifié par axe |
| UX04 | P2 | Tablette | Contrôles compacts conservés malgré un usage tactile possible |
| UX05 | P2 | Services | Métriques et vocabulaire prennent de la place ; harmonisation éditoriale utile |
| AR01 | P1 | Cache front | Clé des rendez-vous sans site alors que la requête dépend du site |
| AR02 | P2 | Front | 31 imports de valeurs entre détails internes de features |
| AR03 | P2 | API | Cycle Redis/throttler et couplage DTO/repository d'audit |
| AR04 | P2 | Front | Hook métier de services dans le design system et accès Orval dans des composants |
| QA01 | P1 | Qualité | Lint non passant : API 46 erreurs ; web 34 erreurs |
| QA02 | P2 | Qualité | Auditeur d'architecture produit des faux positifs ; CI incomplète |
| DC01 | P1 fonctionnel | API | Évaluation des notifications de seuil non raccordée |
| DC02 | P2 fonctionnel | Web | Validateur de configuration légale uniquement appelé par ses tests |
| DC03 | P2 | Trois composants | Déclarations et schémas sans consommateurs de production |
| DC04 | P3 | CSS | Restes probables d'anciens graphiques et formulaires |

## 1. Audit UI/UX

### UX01 — Contraste de navigation mobile

À 390 px, axe relève le même défaut transversal sur les écrans principaux : le texte actif de .mobile-bottom-nav a un contraste de 4,42:1, avec une police de 11 px en gras. Le minimum applicable au texte de cette taille est 4,5:1. Assombrir légèrement le texte ou ajuster son fond, puis vérifier les états actif, focus, hover et les thèmes.

La valeur est proche de la limite mais reste inférieure ; ne pas arrondir à une conformité. La petite taille des libellés renforce l'intérêt d'une meilleure lisibilité.

Référence : [W3C — contraste minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum).

### UX02 — Zone intermédiaire à 1 024 px

Mesures principales :
- /appointments : largeur du document 1 032 px pour une fenêtre de 1 024 px.
- /onboarding : 1 031 px pour une fenêtre de 1 024 px.
- Aucun débordement global détecté sur les 17 routes à 320, 390, 768 et 1 440 px dans le scénario principal.

À cette largeur, la combinaison sidebar, contrôles et contenu laisse trop peu d'espace. Pour les rendez-vous, certaines colonnes du calendrier sont naturellement plus larges que la zone disponible : leur défilement doit rester dans un conteneur explicite, accessible au clavier, sans faire déborder toute la page.

Pour l'onboarding, réexaminer le seuil des colonnes et les largeurs minimales. Le complément n'a pas reproduit le même état de contenu sur cet écran ; ne pas lui attribuer un élément précis sans nouvelle reproduction ciblée.

Ajouter une régression à 1 024 px et de part et d'autre des points de rupture, plutôt que tester uniquement 390 et 1 440 px.

### UX03 — Aperçu de l'affichage et clavier

À 390 px, axe signale scrollable-region-focusable sur .experience-preview dans /display : la région peut défiler mais ne comporte pas de contenu focalisable permettant son accès.

Prévoir une région nommée et focalisable lorsque le défilement est nécessaire, avec focus visible. Vérifier navigation clavier, zoom et retour au contenu parent. Le constat concerne l'aperçu dans l'application root, pas une validation complète du mode écran technique.

### UX04 — Tablette tactile et densité

Les mesures relèvent des contrôles de moins de 44 px, surtout à 768 et 1 024 px : la disposition de bureau reste assez compacte. C'est un signal ergonomique, pas automatiquement une non-conformité.

Le scan brut compte aussi des éléments masqués hors écran par translation, car sa visibilité géométrique ne garantit pas qu'ils soient effectivement accessibles dans la fenêtre. Les nombres de petites cibles du JSON ne doivent donc pas être assimilés à un nombre de défauts.

Viser 44 px pour les actions tactiles principales, tout en gardant une densité raisonnable. Vérifier les espaces entre cibles compactes et les menus d'icônes. Le minimum WCAG 2.2 AA est 24 × 24 px avec exceptions, notamment d'espacement ; 44 px est un objectif de confort plus exigeant, pas le seuil AA.

Référence : [W3C — taille minimum des cibles](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).

### UX05 — Configuration des services : cohérence et hiérarchie

Les captures confirment que le mobile utilise une présentation plus plate : les formulaires ne sont plus enfermés dans la même accumulation de cartes que sur desktop. La file et le service par défaut sont explicitement identifiés.

Améliorations éditoriales et de densité :
- Harmoniser « Services », « Niveaux » et « Niveaux de service » lorsque ces termes désignent la même ressource.
- Sur petit écran, regrouper ou condenser les compteurs en haut : ils repoussent le choix de file et le défaut sous la ligne de flottaison.
- Rendre immédiatement compréhensible la différence entre désactivation d'une association et protection d'un service système.
- Conserver un état désactivé avec explication pour les protections système ; ne pas masquer une action sans raison.
- Distinguer le résumé d'un service et son édition, et protéger une saisie en cours contre un refetch.

La capture de fixture associe un nom de service de test à un marqueur système ; elle ne permet pas de conclure à une incohérence réelle du catalogue de production.

### Éléments UI déjà bien conçus

Le système possède des composants partagés : Button, Modal Radix, FilterPanel, DataTable, cartes et navigation centralisée. La modale tient compte du visualViewport et du clavier mobile dans son implémentation. Les tableaux ont des alternatives mobiles dans plusieurs domaines.

Les contrôles existants UI consistency et design tokens passent. Zéro couleur hexadécimale hors tokens.css selon le contrôle existant. Ces succès ne prouvent pas à eux seuls la qualité de tous les états.

Sur les 85 parcours principaux, aucun événement pageerror n'a été collecté. Sur desktop, aucun défaut axe n'est ressorti dans les 17 états de page testés. Les écrans de formulaire, les graphiques alimentés et les erreurs doivent être contrôlés séparément.

## 2. Architecture et bonnes pratiques

### AR01 — Site absent de la clé des rendez-vous

Sources : dori-web/src/features/appointments/hooks/useAppointments.ts et src/api/client/query-keys.ts, appointments.byQueueRange.

La requête dépend de options.siteId, mais la clé ne contient que queueId, dateFrom et dateTo. Lorsque la file n'est pas sélectionnée, deux sites consultés pour la même période peuvent partager la même clé.

changeActiveSite change le site actif et recharge son identité ; il n'annule ni ne retire toutes les requêtes du précédent site. clearActiveSiteContext le fait, mais ce n'est pas le même parcours.

Risque : données précédentes réutilisées ou absence de rechargement immédiat au changement de site. Ce constat de code ne démontre pas une fuite d'autorisation API : le serveur garde ses vérifications. Il révèle une incohérence possible de l'affichage et du cache.

Inclure le site dans la fabrique de clés, adapter les invalidations et tester deux sites avec même période et queueId indéfini, y compris avec une requête précédente encore en cours. Étendre le contrôle à toutes les clés ayant un scope implicite.

### AR02 — Frontières entre features

La convention docs/frontend-architecture.md interdit la dépendance aux détails internes d'une autre feature. Le graphe des imports statiques de valeurs trouve 31 liens de ce type.

Exemples :
- AppointmentActionDialog importe le document d'impression interne du kiosque, TrackingQr et les hooks notes/personnes.
- SettingsWorkspace importe QueueEditor et des modales internes d'utilisateurs.
- ReportsPage importe appointment-rules et les hooks files/sites.
- PersonsPage et MyQueuesPage importent directement les composants internes de notes.

Ces imports ne prouvent pas que chaque réutilisation est mal placée. Ils montrent que la frontière promise n'est pas appliquée. Choisir explicitement une API publique de feature ou déplacer un composant réellement transversal dans shared. Ne pas créer des couches vides de simple renommage.

Le contrôle phase11 actuel vérifie surtout fondations vers features et quelques imports des pages ; il ne détecte pas tous ces liens entre features.

Aucun cycle de fichier n'a été trouvé dans les imports statiques de valeurs du front ou de l'agent. Le graphe ne prouve pas l'absence de cycles de modules Nest, d'appels métier, d'imports dynamiques ou de dépendances de types.

### AR03 — API : cycles et séparation des responsabilités

Cycle réel d'imports Redis :
- core/redis/redis.module.ts importe RedisThrottlerStorage.
- core/throttler/redis-throttler-storage.service.ts importe REDIS_CLIENT depuis ce module.

Extraire le token d'injection dans un fichier sans dépendance évite que le service réimporte le module qui l'enregistre. Le démarrage actuel n'a pas été déclaré cassé ; il s'agit d'un couplage à supprimer.

Le graphe relève aussi audit.repository.ts ↔ dto/audit-query.dto.ts. Le DTO importe AuditOutcome du repository, et le repository dépend du DTO HTTP. La branche AuditOutcome est un type, même si l'import n'est pas écrit import type : ne pas la présenter comme un second cycle runtime prouvé. Mettre les types communs et critères de recherche dans un modèle indépendant et garder l'adaptation HTTP dans le service.

La séparation contrôleur/service/repository est globalement présente. Aucun SQL brut n'a été trouvé dans les contrôleurs inspectés. Les contrôleurs temps réel connaissent toutefois des repositories d'authentification : isoler cette autorisation dans un service transversal clarifierait leur responsabilité.

TypeORM fournit la connexion et les métadonnées, tandis que les repositories utilisent largement du SQL explicite. C'est un choix valide ; le documenter et éviter que les entités deviennent une seconde définition divergente du schéma. synchronize est désactivé. Les migrations restent la référence de déploiement.

### AR04 — Design system et accès réseau dans des composants

Le hook design-system/use-queue-service-selection.ts dépend de QueueTierResponseDto et porte une règle métier de sélection. Il devrait vivre dans shared ou dans une API publique métier ; le design system devrait recevoir options, valeur et callbacks sans connaître les DTO de services.

SettingsWorkspace importe et appelle directement sitesControllerRemoveDirectUser. Cela contrevient à la convention qui réserve les accès Orval aux adaptateurs et hooks métier. Déplacer l'appel et les invalidations dans un hook ou adaptateur.

Plusieurs pages utilisent des types DTO générés. Ce n'est pas une duplication automatique : ne pas inventer une copie à chaque import de type. Une adaptation métier n'est utile que lorsqu'elle isole une responsabilité réelle.

### Agent : frontière globalement respectée, exceptions à documenter

Le README décrit un canal sortant, une autonomie locale et une liste de commandes limitée. Le code reste dans cette logique et ne fournit pas d'administration entrante.

En revanche, store.ts connaît directement le schéma et les projections d'inscriptions de l'API. Cette dépendance est réelle : les migrations API et le contrat des tables techniques doivent être versionnés avec l'agent. Éviter de recopier une deuxième règle de priorité qui divergerait du moteur.

Avant d'augmenter la concurrence, traiter la reprise des commandes RUNNING et l'arrêt du cycle, détaillés dans l'audit technique précédent.

### QA01 — État des vérifications

| Vérification exécutée | Résultat |
| --- | --- |
| API TypeScript sans émission | Passe |
| Front TypeScript tsconfig.app sans émission/incrémental | Passe |
| Agent TypeScript sans émission | Passe |
| API npm run lint | Échec, 46 erreurs de formatage Prettier |
| Front ESLint complet | Échec, 34 erreurs |
| Front audit:ui | Passe |
| Front audit:tokens | Passe |
| Front audit:phase11 | Échec, deux signalements à requalifier |
| Front audit:i18n | Échec, cinq signalements dont trois clés dupliquées |

API : les erreurs de formatage sont concentrées dans queue-engine.repository.ts et edge-control.service.spec.ts.

Front : erreurs de typage de tests HTTP, assertions non nulles, expressions retournant void, concaténations et un faux signalement de hook React sur un helper Playwright nommé useFixedClock. Les quatre fichiers de production signalés comprennent le hook de sélection des services, OnboardingWizard et QueueServiceSettings.

La présence de TypeScript strict et de tests est positive ; une branche n'est pas entièrement conforme à ses propres règles tant que ces commandes échouent. Aucune correction automatique exécutée.

### QA02 — Faux positifs, traductions et CI

Les deux échecs phase11 sont annoncés comme DTO recopiés, mais les lignes inspectées sont des imports de types générés dans CockpitPage et operation-actions. La regex confond « type NomDto » d'un import avec une déclaration. Corriger le contrôle avec l'AST, ou une détection plus précise, avant de considérer ces deux messages comme des copies de DTO.

audit:i18n trouve :
- Une clé apiErrors.DUPLICATE_ACTIVE_REGISTRATION dupliquée dans les domaines FR, EN et AR : anomalie réelle à corriger.
- DORIFY_INSTALLATION_ID et DORIFY_CLOUD_TOKEN affichés dans l'administration : noms techniques utiles dans ce contexte ; autoriser explicitement ces identifiants plutôt que les traduire.

Le workflow front CI utilise Node 22.18.0 alors que package.json demande au moins 22.19.0. Aligner version de CI, moteurs déclarés et image Docker.

Le script verify front comprend audit:i18n, audit:env et audit:ui, absents du workflow CI inspecté. Éviter deux définitions divergentes de la qualité attendue.

Aucun workflow CI local n'a été trouvé dans les dépôts API et agent. Cela ne prouve pas l'absence de CI externe. Les commandes quality:check et check existent et peuvent servir de portes de validation. Ajouter une vérification des imports et du code mort avec des points d'entrée explicites.

## 3. Code mort : inventaire qualifié

### Règle de lecture

Un export sans import direct n'est pas nécessairement mort. Les routes lazy, hooks Nest/React, injection de dépendances, entités TypeORM, migrations SQL, scripts, client Orval et déclarations de types externes demandent un contrôle particulier.

Les JSON automatiques sont des listes de candidats, pas des listes de suppression. Les références de méthodes liées à une interface ou héritées peuvent être sous-comptées. La confirmation lexicale et manuelle ci-dessous prime.

Aucune recherche statique ne garantit l'absence absolue de code mort avec des usages dynamiques. L'inventaire couvre les trois composants et inclut aussi les candidats CSS ; il ne prétend pas qu'un test jamais exécuté prouve qu'un chemin n'est jamais utile.

### DC01 — Fonctionnalité seuil non raccordée : ne pas supprimer

dori-api/src/modules/notifications/notifications.service.ts : evaluateQueueThresholds, ligne 227.

Seul le test l'appelle. Aucun contrôleur, worker, cron, agent ou événement ne la déclenche dans le code inspecté. Elle entraîne une chaîne de chargement des personnes en attente, règles, estimations et notifications.

Le cron notifications ne fait qu'envoyer les notifications déjà en attente. Il ne remplace pas l'évaluation des seuils.

Classement : code dormant portant une fonctionnalité attendue. Priorité à définir et raccorder le déclenchement après évolution de la file ou périodiquement, avec idempotence, plutôt que supprimer la méthode et ses repositories. Un test unitaire passant masque ici l'absence d'intégration.

### DC02 — Validations présentes mais non appliquées

Front :
- features/legal/legal-config.ts : validateProductionLegalConfig, ligne 12, appelée uniquement par ses tests.
- features/public-experiences/privacy.ts : isPublicDisplaySnapshot, ligne 32, appelée uniquement par ses tests.

Le premier validateur n'empêche donc pas à lui seul un déploiement mal renseigné. Le second n'est pas une barrière runtime contre les données personnelles et ne doit pas être présenté comme telle ; le serveur et la construction des DTO publics restent déterminants.

Décider d'une intégration pertinente, d'un contrôle de build ou d'un simple helper de test. Ne pas supprimer aveuglément ce code au motif qu'il concerne la sécurité ou la conformité ; ne pas lui attribuer une protection qu'il n'assure pas.

### API : candidats confirmés sans appel trouvé

| Fichier | Déclaration | Qualification |
| --- | --- | --- |
| src/core/clock/clock.service.ts:14 | nowUtc | Alias sans appel trouvé |
| src/core/clock/clock.service.ts:85 | tomorrowInTimezone | Helper sans appel trouvé |
| src/core/clock/clock.service.ts:121 | minutesSince | Helper sans appel trouvé |
| src/modules/monitoring/reports.repository.ts:61 | findQueueIdentity | Ancien accès unitaire sans consommateur trouvé |
| src/modules/monitoring/reports.repository.ts:393 | getDailyStats | Agrégation sans appel trouvé |
| src/modules/service-tiers/service-tiers.service.ts:455 | getNotificationRules | Ancien adaptateur, utilisé uniquement par son test |
| src/core/types/guid.ts:5–7 | SiteId, QueueId, RegistrationId | Alias de types non consommés |
| src/core/realtime/realtime.service.ts:33 | QueueDisplayChangeReason | Type non consommé |
| src/modules/monitoring/dto/report-response.dto.ts:153 | QueuePeriodVolumesResponseDto | DTO sans référence trouvée |
| src/modules/edge-control/dto/edge-control.dto.ts:207 | EdgeCommandPageResponseDto | DTO sans référence trouvée |

Soit douze déclarations candidates dans ce tableau. Avant retrait d'un DTO, régénérer et comparer l'OpenAPI : ses propriétés décorées ne prouvent pas son exposition si la classe n'est référencée nulle part.

Pour getNotificationRules, le contrôle de portée de l'ancien adaptateur n'est pas une preuve qu'il est actif : les contrôleurs utilisent les autres méthodes. Supprimer avec le test devenu sans objet ou raccorder explicitement au bon parcours, sans retirer les contrôles de droits effectifs.

### Front : candidats sans consommation de production

| Fichier | Déclaration | Qualification |
| --- | --- | --- |
| src/core/permissions/permissions.ts:21 | isWithinScope | Utilisée uniquement par ses tests |
| src/shared/queue-operations/operation-store.ts:60 | canCallNext | Utilisée uniquement par ses tests |
| src/features/appointments/appointment-actions.ts:19 | updateAppointment | Adaptateur utilisé uniquement par ses tests |
| src/core/realtime/realtime-status-store.ts:66 | getRealtimeConnection | Fonction de lecture utilisée uniquement par ses tests |
| src/features/onboarding/model/settings-schemas.ts | tierAssociationSchema, notificationRuleSchema, translationSchema | Trois schémas utilisés uniquement par leurs tests |
| src/features/queues/public.ts | Réexport useQueues/useQueueStatuses | Façade sans consommateur trouvé |

Ce tableau recense quatre helpers/adaptateurs, trois schémas et une façade. Les hooks useQueues et useQueueStatuses eux-mêmes sont utilisés ; seule leur façade public.ts est orpheline.

Les schémas Zod testés ne valident actuellement pas les formulaires de production. Choisir une seule validation réellement raccordée ; ne pas conserver deux contrats divergents en pensant que les tests de l'un protègent l'autre.

### Agent

Les neuf fichiers src sont accessibles depuis main.ts dans le graphe des imports. Aucun fichier de production orphelin trouvé.

src/types.ts:4 : l'alias CommandType n'a aucun consommateur trouvé. Le schéma commandTypeSchema est utilisé par cloudCommandSchema : conserver le schéma. Aucun traitement exécutable de l'agent n'a été confirmé mort dans cet audit.

### CSS : restes d'anciennes interfaces

Le scan lexical relève 95 occurrences classe/fichier sans présence littérale dans le TS/TSX de production. Ce chiffre contient des doublons et des classes dynamiques ; ce n'est pas « 95 classes mortes ».

Candidats à forte suspicion :
- application.css : report-hit-point, report-line-primary, report-line-success, report-point-primary, report-point-success, report-comparison-bars, report-comparison-row.
- layouts/mobile.css : quick-registration-panel et control-room-queue-filter.
- features/onboarding/admin.css : tier-default-option.

Les graphiques actuels utilisent report-line et report-point avec leur configuration de série. Aucun producteur des anciens suffixes ci-dessus n'a été trouvé. Nettoyer les blocs avec leurs variantes responsives après comparaison visuelle de rapports et supervision.

Contre-exemples à conserver : metric-card-${tone}, appointment-tier-${index}, public-${mode}, button-label-${mode}, tracking-status-${status}. L'absence de chaîne complète dans le source est normale pour ces classes. Ne pas appliquer de purge automatique sur la simple base du scan lexical.

### Faux positifs vérifiés et éléments conservés

- postgresClientConfig : utilisé par db-verify, les scripts de performance et les scripts de déploiement.
- daily-activity-seed.ts : utilisé par scripts/seed-daily-activity.ts, même s'il est hors du graphe de main.
- api/client/http-client.ts, request : configuré comme mutator Orval et utilisé par le client généré.
- Les pages exportées : chargées par imports dynamiques et lazyNamed ; elles ne sont pas mortes.
- Les fichiers de test, setup-tests, mock-server, glossaire et allow-identical : outils et infrastructure de tests, pas code applicatif à supprimer.
- Entités TypeORM : enregistrées par ALL_ENTITIES. Leur utilité peut être rediscutée par décision d'architecture, mais elles ne sont pas non référencées.
- Hooks onApplicationBootstrap, onApplicationShutdown, canActivate, validate, intercept, configure et cycles de vie React : invoqués par les frameworks.
- swagger-ui-express : usage indirect par l'adaptateur Swagger Nest, malgré l'absence d'import applicatif.
- @types/qrcode : fournit les déclarations de types de qrcode ; aucun import direct de ce nom de paquet n'est attendu.
- date-fns-tz : utilisé par ClockService. Ne pas le supprimer.
- Migrations SQL : découvertes sur disque et exécutées par le runner ; pas d'import TS individuel nécessaire.

Aucune dépendance runtime supprimable n'a été confirmée dans les trois manifestes. L'absence d'import direct n'est pas suffisante pour déclarer une dépendance morte.

### Ancien audit à ne pas réappliquer tel quel

ai/deadcode_handover.md date du 7 octobre. Certains points sont toujours vrais, notamment les helpers Clock et les seuils non raccordés. D'autres sont obsolètes :
- jwt.privateKey et jwt.publicKey sont consommés par AuthModule et JwtStrategy.
- security.maxFailedAttempts et security.lockoutMinutes sont consommés par AuthService.
- Les entités sont enregistrées et Redis est utilisé.

Marquer ce document comme historique ou le remplacer par cet inventaire qualifié pour éviter des suppressions régressives.

## 4. Plan de correction recommandé

1. Corriger le scope des clés de rendez-vous et couvrir le changement de site.
2. Remettre lint et contrôles qualité au vert, en corrigeant aussi les faux positifs des auditeurs.
3. Corriger contraste mobile, débordements à 1 024 px et accès clavier à l'aperçu.
4. Raccorder l'évaluation des seuils et décider où les validations dormantes doivent s'exécuter.
5. Retirer les helpers, DTO et façades réellement inutilisés par petits changements, avec comparaison OpenAPI et build des trois composants.
6. Nettoyer les anciens styles de graphiques puis vérifier rapports et supervision sur les trois formats.
7. Renforcer les frontières de features, extraire les tokens Redis et aligner CI, conventions et versions Node.

Pour un nettoyage, exécuter les commandes complètes après chaque lot. Un test qui appelle seulement une fonction par ailleurs inutilisée ne justifie pas de garder un chemin mort ; un hook de framework sans appel textuel ne justifie pas de le supprimer.

## Livrables et reproductibilité

- mesures-uix-2026-11-01.json : 85 parcours, métriques et résultats axe.
- mesures-uix-complement-2026-11-01.json : contrôles supplémentaires et limites de modale.
- uix-captures/ : captures collectées.
- code-mort-candidats-2026-11-01.json : candidats TypeScript bruts, avec limites.
- architecture-imports-2026-11-01.json : cycles statiques et dépendances internes entre features.
- dependances-references-2026-11-01.json : recherche des références des dépendances runtime.
- css-candidats-2026-11-01.json : candidats lexicaux CSS.
- Scripts analyse-*.cjs et audit-uix*.cjs : outils locaux de cet audit ; aucun n'est intégré au build applicatif.

Les scripts lisent les dépendances déjà installées ; ils ne téléchargent pas de paquets. Les parcours UI simulent les réponses API et ne valident donc pas les transactions, droits ou contrats réels du serveur.

