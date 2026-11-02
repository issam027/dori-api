# Audit UI/UX, architecture et code mort — 1er novembre 2026

## Suivi du traitement

Clôture du traitement : tous les constats de cet audit sont corrigés et validés. Les preuves après modification sont détaillées dans les sections « Validation » et dans [le bilan de validation](bilan-traitement-audits-2026-11-01.md). Les mesures et captures initiales ont été conservées séparément.

Traitement demandé le 1er novembre 2026. Un point est coché uniquement après correction et validation ; les constats ci-dessous décrivent la situation initiale.

- [x] UX01 — corrigé et validé
- [x] UX02 — corrigé et validé
- [x] UX03 — corrigé et validé
- [x] UX04 — corrigé et validé
- [x] UX05 — corrigé et validé
- [x] AR01 — corrigé et validé
- [x] AR02 — corrigé et validé
- [x] AR03 — corrigé et validé
- [x] AR04 — corrigé et validé
- [x] QA01 — corrigé et validé
- [x] QA02 — corrigé et validé
- [x] DC01 — corrigé et validé
- [x] DC02 — corrigé et validé
- [x] DC03 — corrigé et validé
- [x] DC04 — corrigé et validé

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

<!-- CHECKPOINT id="ckpt_mvxjl2pr_qxkg63" time="2026-11-01T08:02:22.335Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxjxxrd_9k437t" time="2026-11-01T08:12:22.441Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxkassk_kvn8xs" time="2026-11-01T08:22:22.532Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxknnua_p4pgem" time="2026-11-01T08:32:22.642Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxl0itq_4khul3" time="2026-11-01T08:42:22.670Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxlddsg_gqteje" time="2026-11-01T08:52:22.672Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

### Validation AR01

site inclus dans la clé des rendez-vous ; ancien périmètre annulé et retiré au changement de site. Tests du cache et de changement de site passent.

### Validation AR02

imports entre features via façades publiques explicites ; phase11 passe sur 382 fichiers et contrôle de portée des imports étendu.

### Validation AR04

sélection métier déplacée dans shared/queue-services ; composants de configuration utilisent adaptateurs et hooks. Types, tests front et phase11 passent.

### Validation DC03

déclarations confirmées retirées dans les trois composants ; points d’entrée de framework et scripts conservés. Types et tests passent ; contrôle de fichiers inaccessibles avec racines explicites ajouté aux trois CI.

### Validation DC04

19 occurrences de sélecteurs obsolètes retirées après vérification des usages ; classes dynamiques des graphiques conservées. Build front et contrôles UI/tokens passent.

<!-- CHECKPOINT id="ckpt_mvxr3wkq_yf966r" time="2026-11-01T11:32:58.154Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxrgrj8_jc9ke7" time="2026-11-01T11:42:58.148Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxrtmj1_ppf967" time="2026-11-01T11:52:58.189Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxs6hhy_si3bha" time="2026-11-01T12:02:58.198Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxsjch2_jyj3mr" time="2026-11-01T12:12:58.214Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxsw7fz_rc0gv0" time="2026-11-01T12:22:58.223Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxt92ey_axi6r1" time="2026-11-01T12:32:58.234Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxtlxdt_tna6f4" time="2026-11-01T12:42:58.241Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxtyscf_zlvl8n" time="2026-11-01T12:52:58.239Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

### Validation UX01

Texte actif de navigation basse aligné sur le token de texte contrasté. Aucune violation axe sur les 34 parcours principaux à 390/1440 px, ni sur le complément ; parcours RTL et quatre thèmes passent. Voir mesures-uix-apres-2026-11-01.json et suite navigateur.

### Validation UX02

Titre du bandeau rendu réductible, éléments internes autorisés à rétrécir et calendrier contenu dans sa région de défilement. Assistant en une colonne sous 1100 px. Zéro débordement global sur les 85 parcours à cinq largeurs ; régressions tactiles à 1023/1024/1101 px passent. Voir mesures-uix-apres-2026-11-01.json et e2e/audit-regressions.spec.ts.

### Validation UX03

Aperçu doté d’un nom accessible et tabindex=0 ; sa section nommée possède le rôle implicite region. Focus clavier vérifié au navigateur, ainsi que le défilement clavier du calendrier. Contrôle axe du complément sans violation. Voir mesures-uix-complement-apres-2026-11-01.json.

### Validation UX04

Cibles et champs tactiles portés à 44 px ; police des champs au moins 16 px. Réduction d’échelle supprimée pour le pointeur tactile afin de conserver 44 px physiques. Mesure réelle d’un champ à trois largeurs tablette et parcours de rotation/dialogues passent. La densité de bureau à la souris reste couverte par la régression visuelle.

### Validation UX05

Vocabulaire Services harmonisé, compteurs condensés sur mobile, défaut facultatif indépendant des options et protection du service système expliquée. Activation/désactivation distinguée de l’édition ; champs en cours préservés au refetch du défaut. Scénarios quatre files/trois services aux cinq tailles passent ; exemples peuplés, RTL, thèmes et modales couverts par les 106 parcours.

### Validation AR03

Token Redis isolé, types et filtres d’audit indépendants du DTO HTTP ; autorisation SSE extraite dans un service réutilisé par les contrôleurs. Graphe sans cycle de valeurs dans les trois composants, démarrage Nest effectif et 439 tests API passent. SQL explicite, référence des migrations, contrat agent et exceptions de découverte documentés.

### Validation DC01

Évaluateur raccordé au worker notifications toutes les dix secondes et à sa route cron protégée. Sélection des files/services actifs avec seuils ; les clés d’idempotence déjà enregistrées sont éliminées avant recalcul. Tests du worker, câblage Nest et transaction PostgreSQL (candidat neuf retenu, candidat déjà traité écarté, aucun envoi externe) passent. Voir threshold-validation-2026-11-01.json.

### Validation DC02

Validateur de configuration légale appelé à l’initialisation en mode production ; garde de build existante conservée, sans inventer de mentions légales. Validation du snapshot public réellement appelée avant exposition ; contrôle récursif des clés sans rejeter un nom de file contenant « phone ». Tests de confidentialité et de configuration passent ; affichage/tracking sans violation axe dans le complément.

### Validation QA01

Lint et types complets passent sur le front et l’API ; format, build et portes de qualité passent. Derniers résultats : API 91 suites / 439 tests, front 89 suites / 298 tests, agent trois suites / 14 tests, navigateur 106 parcours. Voir les journaux api-quality-validation.log, web-lint-validation.log, web-unit-validation.log, agent-quality-validation.log et web-e2e-validation.log.

### Validation QA02

Détection des déclarations DTO par AST ; contrôle des frontières de features étendu ; doublons FR/EN/AR retirés et exceptions d’identifiants techniques explicites. CI Node/Docker alignés sur 22.22.0. Portes d’architecture et de fichiers inaccessibles ajoutées aux trois CI avec points d’entrée déclarés, plus les audits i18n/env/UI au front. Les contrôles phase11, i18n, env, UI, tokens, budgets et architecture passent ; le client généré est stable et correspond à la spécification (generated-client-validation-2026-11-01.json).

<!-- CHECKPOINT id="ckpt_mvxubnbb_yvpgz1" time="2026-11-01T13:02:58.247Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxuoi9z_2h1wsx" time="2026-11-01T13:12:58.247Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxv1d8v_wjojso" time="2026-11-01T13:22:58.255Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxve87v_lz5urw" time="2026-11-01T13:32:58.267Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxvr36w_2jafup" time="2026-11-01T13:42:58.280Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxy44bh_pa8tal" time="2026-11-01T14:49:05.501Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvxygz9v_osf1yu" time="2026-11-01T14:59:05.491Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvycjy2e_4czu8i" time="2026-11-01T21:33:18.518Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvycwt17_rjvdn6" time="2026-11-01T21:43:18.523Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvydi2qx_fr88ws" time="2026-11-01T21:59:50.889Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyduxpr_1swskf" time="2026-11-01T22:09:50.895Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyepzxk_ogmcll" time="2026-11-01T22:34:00.104Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyf2uwl_1iy5ar" time="2026-11-01T22:44:00.117Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyffpv6_y144lu" time="2026-11-01T22:54:00.114Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyfskuf_t69d98" time="2026-11-01T23:04:00.135Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyg5fti_z7f16u" time="2026-11-01T23:14:00.150Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvygiask_5igq6w" time="2026-11-01T23:24:00.164Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvygv5vc_0zoj6v" time="2026-11-01T23:34:00.312Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyh81cn_ewqp62" time="2026-11-01T23:44:00.983Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyiokcd_8lzh9t" time="2026-11-02T00:24:51.709Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyq02y6_az16e5" time="2026-11-02T03:49:46.350Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyvxpud_tzy74i" time="2026-11-02T06:35:53.749Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvywaktc_42iad9" time="2026-11-02T06:45:53.760Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyy1kwa_kfybqq" time="2026-11-02T07:34:53.194Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyyz4ta_idw17o" time="2026-11-02T08:00:58.654Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyzbzs9_q0cn7u" time="2026-11-02T08:10:58.665Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvyzsr40_eq61yz" time="2026-11-02T08:24:00.576Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvz05m2x_781sz5" time="2026-11-02T08:34:00.585Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvz0iplf_jqkd3i" time="2026-11-02T08:44:11.667Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvz257fn_otcc8y" time="2026-11-02T09:29:40.835Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvz2i2eo_h6r0np" time="2026-11-02T09:39:40.848Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
