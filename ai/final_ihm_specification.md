# DORI — Spécification finale de l’IHM SaaS

> Version de référence : 1.0 — 7 octobre 2026  
> Référence visuelle validée : [`dori_saas_mockup.html`](./dori_saas_mockup.html)  
> Contrat API : [`docs-json.json`](./docs-json.json), Dori API 1.0  
> Spécification fonctionnelle source : [`spec_front.md`](./spec_front.md)

## 1. Objet et niveau d’autorité

Ce document est la spécification exécutable du futur front DORI. Il doit permettre à un développeur ou à une IA de reconstruire le produit présenté dans la maquette validée, sans réinterprétation fonctionnelle majeure.

Ordre d’autorité en cas d’écart :

1. `docs-json.json` pour les routes, paramètres, DTO, réponses et statuts HTTP ;
2. le présent document pour les parcours, permissions, états et architecture du front ;
3. `dori_saas_mockup.html` pour le rendu, la composition, la densité et les interactions ;
4. `spec_front.md` pour le contexte produit complémentaire.

Une fonctionnalité absente du Swagger ne doit pas être simulée comme persistante. Elle doit être marquée locale, dérivée, matérielle ou « évolution API requise ».

## 2. Principes produit non négociables

- Une session utilisateur opère dans le contexte d’un seul site à la fois.
- Le sélecteur de site n’est visible que si l’utilisateur possède plusieurs sites.
- Les personnes sont cloisonnées par site. Une même identité doit être recréée dans un autre site.
- Une personne exige au minimum `lastName`, `phoneNumber` et `siteId`.
- Un opérateur ne peut appeler aucun ticket sans session active occupant un guichet (`threadNumber`).
- Un opérateur affecté à plusieurs files voit une carte de guichet par file autorisée. Il ne peut avoir qu’une prise en charge en cours à la fois.
- Une carte de guichet occupée est mise en avant ; une carte libérée est grisée et repoussée après les cartes actives.
- Il n’existe pas de pause conservant le guichet et aucun transfert interfile dans cette version.
- Le catalogue commercial proposé dans l’IHM contient exclusivement `free`, `standard` et `premium`. L’administration d’un site associe ces forfaits à ses files ; elle n’en crée pas.
- Les notifications ont uniquement les types `welcome` et `threshold`. Les deux peuvent inclure un lien de tracking.
- L’affichage public de salle ne révèle aucune donnée personnelle. L’aperçu interne ouvert par un compte humain peut afficher les noms.
- L’onboarding d’un nouveau site et l’administration des traductions sont réservés à Root et Admin.
- Tout élément sélectionné possède un état visuel évident.
- Les champs obligatoires portent `*`. Les champs non marqués sont optionnels ; le mot « Optionnel » n’est pas affiché.
- Les libellés, messages, validations, statuts et textes d’aide sont traduisibles.
- Les mentions légales et la politique de confidentialité sont accessibles avant et après authentification, ainsi que depuis les interfaces publiques.

## 3. Profils et navigation

### 3.1 Profils de référence

| Profil IHM | Portée attendue | Espaces principaux |
|---|---|---|
| Root | Globale | Tous les sites, administration, traductions, santé |
| Admin | Multi-sites autorisés | Portefeuille, configuration, onboarding, santé |
| Manager | Un ou plusieurs sites autorisés | Opérations, supervision, rapports, configuration locale |
| Hôtesse / opérateur | Site courant et files affectées | Cockpit, mes files, rendez-vous, notifications autorisées |
| Kiosque | Un site, compte technique | Borne tactile et écran public |

Les écrans et actions sont réellement autorisés à partir de `GET /api/v1/auth/me`, de `permissions` et de `scope`. Les noms de rôle ne constituent qu’une présentation et un jeu de démonstration.

### 3.2 Menu accordéon

Le menu comporte trois catégories :

- Opérations : Cockpit guichet, Mes files, Rendez-vous, Supervision, Portefeuille de sites, Rapports, Notifications.
- Expériences : Borne kiosque, Écran salle, Tracking mobile.
- Administration : Nouveau site, Configuration, Santé de la plateforme.

Règles :

- une catégorie sans sous-écran autorisé est entièrement masquée ;
- toutes les catégories sont repliées sauf celle de l’écran actif ;
- une seule catégorie peut être dépliée ;
- ouvrir une catégorie replie la précédente ;
- naviguer vers une page déplie automatiquement sa catégorie.
- le lien `Mentions légales · Confidentialité` reste hors des catégories et est ancré en bas du bandeau latéral, quelle que soit la catégorie ouverte ou la hauteur de son contenu.

### 3.3 Bandeau supérieur

- nom du site courant fortement visible ;
- changement de contexte via un menu ponctuel, jamais par une liste déroulante permanente ;
- aucun sélecteur pour un utilisateur mono-site ;
- avatar cliquable ouvrant la page Profil ;
- déconnexion ;
- cycle de thème : clair → intermédiaire clair → intermédiaire sombre → sombre ;
- préférence de thème locale persistée, sans donnée métier.

## 4. Architecture frontend cible

### 4.1 Socle recommandé

- React 18+ et TypeScript strict (`strict`, `noUncheckedIndexedAccess`) ;
- Vite pour une SPA, ou Next.js en mode client si le socle d’entreprise l’impose ;
- React Router avec routes protégées et layouts par expérience ;
- TanStack Query pour tout état serveur ;
- Zustand limité à la session, au site courant, aux préférences et à l’état éphémère d’interface ;
- React Hook Form pour les formulaires ;
- schémas issus du contrat OpenAPI ou adaptateurs de validation explicitement testés ;
- primitives accessibles (Radix UI ou équivalent) ;
- CSS par design tokens, sans couleur métier dispersée dans les composants.

### 4.2 Organisation par fonctionnalités

```text
src/
  app/                 # bootstrap, router, providers, layouts
  api/
    generated/         # code généré, jamais modifié à la main
    client/            # auth, refresh, correlation, normalisation d’erreur
  core/
    auth/ permissions/ scope/ i18n/ realtime/ errors/ theme/
  design-system/
    components/ tokens/ patterns/
  features/
    auth/ cockpit/ queues/ appointments/ persons/ notes/
    kiosk/ display/ tracking/ supervision/ reports/ notifications/
    sites/ onboarding/ users/ tiers/ translations/ health/
  shared/
    date/ currency/ pagination/ forms/ testing/
```

Interdictions :

- aucun appel HTTP directement dans un composant de page ;
- aucune copie manuelle d’un DTO Swagger ;
- aucune logique de permission dupliquée écran par écran ;
- aucune modale métier réécrite pour la création et l’édition d’une même ressource ;
- aucune chaîne visible codée en dur dans le JSX final ;
- aucun `any`, token persistant non sécurisé ou état serveur dupliqué dans Zustand.

### 4.3 Client Swagger généré

Le client TypeScript, les types et les hooks TanStack Query doivent être régénérés depuis le Swagger livré par l’API. Orval est recommandé pour générer types, client et hooks, avec un client HTTP personnalisé.

Pipeline minimal :

1. récupérer `/api-json` ou utiliser `ai/docs-json.json` en mode reproductible ;
2. générer dans `src/api/generated/` ;
3. exécuter formatage, TypeScript et tests ;
4. échouer en CI si le Swagger modifié produit un diff non commité ;
5. interdire les modifications manuelles du dossier généré.

Les clés de cache sont centralisées par domaine : `sites`, `queues`, `queueStatus`, `registrations`, `persons`, `notes`, `tiers`, `notifications`, `reports`, `users`, `translations`.

### 4.4 Couche HTTP et authentification

- `POST /api/v1/auth/login` avec `LoginDto` (`username`, `password`).
- `GET /api/v1/auth/me` après authentification pour hydrater identité, permissions et scope.
- `POST /api/v1/auth/refresh` avec rotation atomique ; une seule tentative de refresh concurrente, les autres requêtes attendent la même promesse.
- `POST /api/v1/auth/logout` puis purge des caches et stores.
- access token en mémoire ; préférer refresh token en cookie HttpOnly lorsque le déploiement API le permet.
- corrélation propagée dans les erreurs et journaux sans PII.
- une erreur API est convertie vers un modèle unique `{ code, translationKey, translationParams, data }`.

### 4.5 Temps réel

Le Swagger décrit les snapshots REST, pas le protocole WebSocket. Le front doit donc :

- utiliser `GET /queues/{queueId}/status` et `GET /queues/{queueId}/display` comme sources de vérité ;
- encapsuler le transport temps réel derrière `RealtimeGateway` ;
- invalider/refetch les queries concernées sur événement ;
- refaire un snapshot après reconnexion avant d’accepter de nouveaux événements ;
- prévoir un polling contrôlé si le contrat WebSocket n’est pas disponible.

Les noms de rooms et événements ne doivent pas être inventés dans le code de production : ils nécessitent un contrat versionné distinct.

## 5. Design system et comportements transverses

### 5.1 Aspect validé

- interface SaaS sobre, professionnelle, fond clair ou sombre, accent turquoise ;
- navigation latérale sombre ;
- cartes à angles arrondis et ombres légères ;
- densité suffisante pour l’exploitation quotidienne ;
- quatre thèmes complets, y compris calendrier, badges, kiosque, affichage et mobile ;
- états sémantiques : vert succès/actif, ambre attention/SLA, rouge erreur/danger, turquoise sélection/contexte.

### 5.2 Composants obligatoirement factorisés

- `AppShell`, `SidebarAccordion`, `Topbar`, `SiteContextSwitcher` ;
- `PermissionGuard` / `<Can />` ;
- `PageHeader`, `Card`, `MetricCard`, `StatusBadge`, `EmptyState`, `ErrorState` ;
- `DataTable`, `Pagination`, `FilterDrawer` ;
- `Modal`, `WizardModal`, `ConfirmDialog` ;
- `FormField`, `RequiredMark`, champs date/heure/devise/téléphone E.164 ;
- `EntityPicker` avec sélection colorée ;
- `QueueEditor` partagé création/édition ;
- `UserAccountWizard` partagé création/édition ;
- `PersonPickerOrCreate` partagé accueil rapide/rendez-vous ;
- `PersonNotesViewer` ;
- `AppointmentEditor` et `AppointmentActionDialog` ;
- `ThemeSwitcher`, `LocaleSwitcher`.

### 5.3 Modales

- largeur de travail maximale : environ 820 px ;
- hauteur limitée au viewport avec scroll interne si absolument nécessaire ;
- barre d’actions sur une seule ligne sur desktop ;
- libellés de boutons sans retour à la ligne ;
- sur petit écran, défilement horizontal de la barre d’actions plutôt que désorganisation ;
- assistants longs divisés en étapes ;
- une modale d’ajout n’affiche que les contrôles utiles à l’ajout.

### 5.4 États obligatoires

Chaque appel réseau possède : chargement, succès, vide, erreur récupérable, erreur de permission et retry. Une commande désactive son bouton pendant l’exécution. Les erreurs 409 provoquent un rafraîchissement de la ressource concurrente.

## 6. Cartographie synthétique écrans/API

| Route front | Écran | Opérations API principales |
|---|---|---|
| `/login` | Connexion | `AuthController_login`, `AuthController_me`, `AuthController_refresh` |
| `/profile` | Profil connecté | `AuthController_me`, `UsersController_updateUser`, `AuthController_changePassword` |
| `/portfolio` | Portefeuille de sites | `SitesController_findSites`, rapports de synthèse |
| `/desk` | Cockpit guichet | preview, threads, sessions, next, served/no-show, persons, notes, registrations |
| `/my-queues` | Mes files | registrations, persons, notes, status |
| `/appointments` | Calendrier | registrations, availability, register, reschedule, remove, check-in |
| `/control-room` | Supervision | queue-load, status, threads, sessions, reset, notifications |
| `/reports` | Rapports | summary, queue-load, daily |
| `/notifications` | Journal | list, detail, manual, resend |
| `/kiosk` | Borne tactile | queues, tiers, register, lookup, check-in |
| `/display` | Écran salle/interne | queue display + rafraîchissement temps réel |
| `/track` | Tracking mobile | public registration position |
| `/onboarding` | Nouveau site | sites, queues, tiers, rules, users, rôles, affectations |
| `/settings/*` | Configuration | sites, queues, users, tiers, rules, translations |
| `/health` | Santé | health |
| `/legal` | Mentions légales et confidentialité | Aucun endpoint : contenu frontend versionné |

## 7. Écrans et parcours détaillés

### 7.1 Connexion

UI : email/nom utilisateur, mot de passe, mémorisation locale non sensible, oubli de mot de passe désactivé tant qu’aucun endpoint ne l’expose, sélection de profil uniquement en mode démonstration.

API :

- connexion : `POST /api/v1/auth/login`, `LoginDto` ;
- contexte : `GET /api/v1/auth/me` ;
- renouvellement : `POST /api/v1/auth/refresh`, `RefreshDto` ;
- déconnexion : `POST /api/v1/auth/logout`, `LogoutDto`.

Après connexion, rediriger vers le premier écran autorisé, calculé à partir des permissions. Si `mustChangePassword`, forcer la page de changement de mot de passe (`POST /api/v1/auth/password/change`, `ChangePasswordDto`).

### 7.2 Profil connecté

Page complète, jamais une modale. Afficher identité, rôle/rang, scope, dernière connexion, état.

- lecture : `GET /api/v1/auth/me` ;
- édition possible selon `UpdateUserDto` : `PATCH /api/v1/users/{userId}` avec `email`, `languagePreference` ;
- mot de passe : `POST /api/v1/auth/password/change`.

Les champs non modifiables par l’API restent en lecture seule.

### 7.3 Portefeuille de sites et contexte

Présenter les sites autorisés avec files, attente, occupation et indicateurs. Le clic « Activer ce site » change uniquement le contexte front, purge les queries dépendantes du site et recharge les scopes.

- sites : `GET /api/v1/sites` ;
- détail : `GET /api/v1/sites/{siteId}` ;
- files : `GET /api/v1/queues` avec filtres Swagger ;
- synthèse : `GET /api/v1/reports/dashboard/summary` ;
- charge : `GET /api/v1/reports/dashboard/queue-load`.

Un utilisateur mono-site ne voit pas de mécanisme de changement de site.

### 7.4 Cockpit guichet

Ordre des cartes : prochaines attentes, prise en charge, cartes guichet par file autorisée. Ne pas afficher une carte « contexte de travail » séparée.

Chargement :

- files et affectations : `GET /api/v1/queues`, `GET /api/v1/queues/{queueId}/operators` ;
- prochain éligible multi-files : `GET /api/v1/sites/{siteId}/next-preview` ;
- état : `GET /api/v1/queues/{queueId}/status` ;
- guichets : `GET /api/v1/queues/{queueId}/threads` ;
- sessions : `GET /api/v1/queues/{queueId}/sessions`.

Occupation/libération :

- occuper : `POST /api/v1/queues/{queueId}/sessions`, `OpenQueueSessionDto { threadNumber, mode: "active", takeOver }` ;
- consultation sans appel : même endpoint avec `mode: "consultation_only"` et sans poste ;
- libérer : `DELETE /api/v1/queues/{queueId}/sessions/{sessionId}`.

Appel et traitement :

- appeler : `POST /api/v1/queues/{queueId}/next` ;
- servi : `POST /api/v1/registrations/{registrationId}/served` ;
- absent : `POST /api/v1/registrations/{registrationId}/no-show`.

Contraintes UX :

- aucun appel sans session `active` et `threadNumber` ;
- si une personne est en cours, bloquer l’appel sur toutes les files de l’opérateur ;
- ancienneté du ticket, statut SLA et notes sont visibles ;
- bouton « Consulter les notes » si la personne en possède ;
- historique visible des quatre derniers appels ;
- les commandes attendent la réponse serveur, sans mise à jour optimiste irréversible.

Accueil rapide :

1. choix clairement exclusif entre personne connue et nouvelle personne ;
2. recherche : `GET /api/v1/persons` limitée au site ;
3. création éventuelle : `POST /api/v1/persons`, `CreatePersonDto` ;
4. choix file, forfait et type `walkin` ou `appointment` ;
5. pour un RDV, charger `GET /queues/{queueId}/availability` ;
6. créer : `POST /api/v1/registrations`, `CreateRegistrationDto` ;
7. afficher le `ticketNumber` seulement après confirmation.

### 7.5 Mes files

Vue consolidée des files affectées à l’opérateur et de leurs personnes en attente.

- liste : `GET /api/v1/registrations` avec filtres Swagger (`queueId`, statut, date, pagination) ;
- détails inscription : `GET /api/v1/registrations/{registrationId}` ;
- personne : `GET /api/v1/persons/{personId}` ;
- notes : `GET /api/v1/persons/{personId}/notes`.

La table affiche position, site/file, ticket, personne, type, ancienneté/SLA, forfait et présence de notes. Elle ne rend pas la note complète. « Voir / ajouter » ouvre le visualiseur.

Notes :

- liste paginée : `GET /api/v1/persons/{personId}/notes` ;
- ajout : `POST /api/v1/persons/{personId}/notes`, `CreatePersonNoteDto { content }`.

La modale affiche une note à la fois, la plus récente par défaut, avec précédent/suivant et position. Aucun bouton modifier/supprimer n’est présenté dans cette version, même si le Swagger expose les opérations. Le mode ajout masque la consultation et ne contient que la saisie nécessaire.

### 7.6 Rendez-vous

Deux vues : semaine et mois. La semaine couvre toutes les heures d’ouverture effectives de la file/site et matérialise l’interruption. La vue mensuelle montre les rendez-vous dans les jours.

Sources :

- inscriptions : `GET /api/v1/registrations` ;
- disponibilité : `GET /api/v1/queues/{queueId}/availability?date=YYYY-MM-DD` ;
- détail : `GET /api/v1/registrations/{registrationId}`.

Création :

- cliquer un espace vide préconfigure date et heure ;
- cliquer un jour vide en vue mois préconfigure la date ;
- étape 1 : personne existante (`GET /persons`) ou nouvelle identité ;
- étape 2 : file, forfait, date et créneau ;
- envoi : `POST /api/v1/registrations`, `CreateRegistrationDto` avec `entryType=appointment`, `scheduledTime`, `tierId`, et exactement `personId` ou `person`.

Actions sur un rendez-vous sélectionné :

- reprogrammer : `POST /api/v1/registrations/{registrationId}/reschedule`, `RescheduleRegistrationDto` ;
- annuler : `DELETE /api/v1/registrations/{registrationId}` ;
- modifier forfait/langue : `PATCH /api/v1/registrations/{registrationId}`, `UpdateRegistrationDto` ;
- check-in : `POST /api/v1/registrations/{registrationId}/check-in`.

Le check-in n’est visible que pour un rendez-vous sélectionné, prévu aujourd’hui et dans un état compatible. Un conflit de créneau recharge les disponibilités.

### 7.7 Supervision

Afficher charge par file, occupation des guichets, sessions détaillées, ancienneté, SLA et résumé des notifications.

- charge : `GET /api/v1/reports/dashboard/queue-load` ;
- statut : `GET /api/v1/queues/{queueId}/status` ;
- guichets : `GET /api/v1/queues/{queueId}/threads` ;
- sessions : `GET /api/v1/queues/{queueId}/sessions` ;
- reset : `POST /api/v1/queues/{queueId}/reset` après confirmation ;
- journal notifications : `GET /api/v1/notifications`.

Les alertes SLA de la maquette sont dérivées côté front des timestamps et seuils configurés ; elles ne constituent pas un endpoint autonome.

### 7.8 Rapports

Filtres : site, file, date métier, limite de files. Les graphiques ne doivent afficher que des valeurs renvoyées par l’API.

- résumé : `GET /api/v1/reports/dashboard/summary` ;
- files les plus chargées : `GET /api/v1/reports/dashboard/queue-load` ;
- quotidien : `GET /api/v1/reports/queues/{queueId}/daily`.

Afficher volumes inscrits/walk-in/RDV/servis/no-show/annulés/ouverts et KPI `noShowRate`, `averageWaitMinutes`, `averageServiceMinutes`. L’export de fichier n’est pas promis par le Swagger ; un export CSV local des données déjà reçues peut être proposé et doit être identifié comme local.

### 7.9 Notifications

Page dédiée. Les filtres sont repliés par défaut et résumés dans une pastille.

- liste : `GET /api/v1/notifications` avec filtres/pagination Swagger ;
- détail : `GET /api/v1/notifications/{notificationId}` ;
- manuelle : `POST /api/v1/notifications`, `SendManualNotificationDto` ;
- réémission d’un échec : `POST /api/v1/notifications/{notificationId}/resend`.

L’envoi manuel est un assistant en deux étapes afin d’éviter la saisie technique d’un identifiant :

1. rechercher une personne dans le site courant avec `GET /api/v1/persons`, la sélectionner, puis sélectionner l’une de ses inscriptions actives ou récentes obtenue avec `GET /api/v1/registrations` ;
2. afficher un récapitulatif immuable de la personne et de l’inscription, choisir le canal `sms` ou `email`, saisir le contenu requis et, si nécessaire, un destinataire de substitution, puis envoyer avec `POST /api/v1/notifications`.

La commande est toujours construite avec le `registrationId` exigé par `SendManualNotificationDto` : le frontend ne transmet jamais directement un `personId` à l’opération d’envoi. Le retour à l’étape précédente conserve le brouillon. Après validation, l’interface ferme l’assistant, confirme la mise en file et actualise le journal afin d’afficher le statut initial `pending`.

Colonnes : ID/registration, ticket/personne, type, canal, destinataire masqué, statut, tentatives, dates, action. Statuts : `pending`, `processing`, `sent`, `delivered`, `failed`. La réémission est réservée aux permissions adaptées et à un statut compatible.

### 7.10 Borne kiosque

Le compte technique est déjà connecté et limité à son site. L’interface masque toute navigation SaaS.

Walk-in :

1. sélectionner une file (`GET /queues`, `GET /queues/{id}/status`) ;
2. saisir nom et téléphone, prénom/langue facultatifs ;
3. charger les forfaits (`GET /queues/{queueId}/tiers`) ;
4. créer directement avec `POST /registrations`, `CreateRegistrationDto` et identité imbriquée ;
5. afficher ticket, position approximative et tracking renvoyé ;
6. impression locale facultative.

Rendez-vous :

1. scanner un identifiant ou saisir les critères ;
2. rechercher via `GET /api/v1/registrations/lookup` ;
3. confirmer l’arrivée via `POST /registrations/{registrationId}/check-in` ;
4. afficher le ticket confirmé.

L’annulation n’est jamais proposée au kiosque. Toutes les données saisies sont purgées à la fin ou après timeout.

### 7.11 Écran salle et aperçu interne

L’écran est un composant TV 16:9 sans scroll. Il contient :

- partie sombre (45 %) : site, file, ticket appelé, guichet ;
- partie claire (55 %) : dernier appel, attente, estimation et quatre derniers appels ;
- historique compact entièrement visible.

API : `GET /api/v1/queues/{queueId}/display` puis synchronisation temps réel via l’adaptateur prévu au §4.5.

Deux politiques de rendu :

- compte `kiosk` : affichage public, tickets et guichets uniquement, aucune PII ;
- compte humain autorisé : aperçu interne sur son propre écran, nom de la personne appelée, prochaine personne et noms de l’historique.

La simulation « appel suivant » appartient uniquement à la maquette/démonstration. En production, l’écran réagit aux changements serveur.

### 7.12 Tracking mobile

Accès public par token opaque, sans compte salarié.

- position : `GET /api/v1/public/registrations/position` avec paramètres Swagger ;
- afficher ticket, file, position, attente estimée, statut et guichet lorsqu’appelé ;
- ne jamais exposer personne, téléphone, notes ou identifiants internes ;
- l’animation d’appel, vibration et son sont des comportements locaux conditionnés au consentement navigateur.

### 7.13 Onboarding d’un nouveau site

Visible uniquement pour Root et Admin. Assistant en six étapes, sauvegardable et reprenable :

1. identité du site ;
2. valeurs par défaut ;
3. files et guichets ;
4. forfaits par file ;
5. équipe et appareils ;
6. recette déclarative et activation.

Étape 1–2 — site : `POST /api/v1/sites`, `CreateSiteDto`. Seul `siteName` est requis. Respecter tous les defaults, horaires, pause, devise, locale, RDV, priorité et reset.

Étape 3 — files : `POST /api/v1/sites/{siteId}/queues`, `CreateQueueDto`. La modale unique création/édition contient :

- écran 1 : code obligatoire, nom, attente moyenne, nombre de guichets ;
- écran 2 : héritage/surcharge pour devise, locale, RDV, durée/capacité, horaires/pause, tolérance, poids, escalade, report et reset.

Une valeur absente hérite du site. L’édition réutilise exactement le même composant et appelle `PATCH /api/v1/queues/{queueId}`.

Étape 4 — forfaits :

- catalogue : `GET /api/v1/tiers` ;
- association : `POST /api/v1/queues/{queueId}/tiers`, `AssociateQueueTierDto` ;
- édition : `PATCH /api/v1/queues/{queueId}/tiers/{tierId}` ;
- dissociation : `DELETE` correspondant.

Ne proposer que Gratuit, Standard, Premium. Configurer prix, devise héritée/surchargée, ordre et valeur par défaut.

Étape 5 — comptes et affectations :

- création : `POST /api/v1/users`, `CreateUserDto` ;
- rôles : `GET /api/v1/roles`, puis `POST /users/{userId}/roles` ;
- manager site : `POST /sites/{siteId}/managers`, `AssignManagerDto` ;
- opérateur de files : `POST /queues/{queueId}/operators`, `AssignOperatorDto`.

La modale est un assistant : informations du compte, puis rôle et files. Les appareils utilisent `userType=kiosk` et des permissions minimales.

Étape 6 : pas de bouton fictif de test d’appel. Afficher une checklist de configuration. Le bouton Activer/Désactiver appelle `PATCH /sites/{siteId}` avec `UpdateSiteDto { isActive }` et bascule son libellé après confirmation.

L’onboarding est une saga front : mémoriser les IDs confirmés et permettre de reprendre une étape sans recréer les ressources précédentes.

### 7.14 Configuration

Onglets : Sites, Files, Utilisateurs, Forfaits, Notifications, Traductions.

Sites :

- `GET/POST/PATCH/DELETE /api/v1/sites` ;
- managers : `GET/POST/DELETE /sites/{siteId}/managers` ;
- le bouton Nouveau site complet est Root/Admin seulement.

Files :

- `GET /queues`, `GET /queues/{id}` ;
- `POST /sites/{siteId}/queues`, `PATCH/DELETE /queues/{id}` ;
- opérateurs : `GET/POST/DELETE /queues/{queueId}/operators` ;
- même `QueueEditor` que l’onboarding.

Utilisateurs :

- `GET/POST/GET by id/PATCH/DELETE /users` ;
- activation : `PATCH /users/{userId}/status` ;
- mot de passe administré : `PATCH /users/{userId}/password` ;
- rôles : `GET /roles`, `POST/DELETE /users/{userId}/roles` ;
- permissions d’un rôle : `PATCH /roles/{roleId}/permissions`.

En édition, `UpdateUserDto` ne permet que `email` et `languagePreference`. Le changement de mot de passe et d’état utilisent leurs opérations dédiées. Appliquer l’anti-escalade de rang côté UI et laisser l’API la confirmer.

Forfaits : catalogue fixe lu par `GET /tiers`, puis associations par file. La création globale `POST /tiers` existe dans l’API mais n’est pas exposée dans l’administration de site de cette version.

Notifications par forfait/file :

- règles : `GET/POST/PATCH/DELETE /queues/{queueId}/tiers/{tierId}/notification-rules` ;
- Gratuit : aucune règle dans le produit ;
- Standard : Threshold ;
- Premium : Welcome et Threshold ;
- `includeTrackingLink` disponible pour les deux types ;
- Threshold exige `thresholdType` (`position` ou `estimatedTime`) et `thresholdValue >= 1`.

Traductions : Root/Admin uniquement. `GET /translations`, `POST /translations`, `PATCH/DELETE /translations/{translationId}`. Catégories `ihm`, `sms`, `error` et paramètres attendus visibles.

### 7.15 Santé de la plateforme

Visible uniquement pour Root et Admin.

- `GET /api/v1/health` ;
- afficher `status`, timestamp, uptime, base (`up/down`) et mémoire ;
- ne pas inventer d’état détaillé pour Redis, fournisseurs SMS ou WebSocket sans données API ;
- rafraîchissement manuel et périodique raisonnable.

### 7.16 Mentions légales et confidentialité

Page publique dédiée, jamais une modale. Elle est accessible :

- depuis le pied de la page de connexion ;
- depuis le bas du menu authentifié ;
- depuis la borne kiosque ;
- depuis le tracking mobile.

Elle n’appartient à aucune catégorie métier du menu. Lorsqu’elle est ouverte avant authentification, le shell privé, le menu, le profil et le contexte de site sont masqués. Le retour restitue exactement le contexte d’origine.

Contenu minimal :

- éditeur, directeur de publication, hébergeur et contact ;
- objet et conditions d’utilisation ;
- rôles responsable de traitement/sous-traitant selon le déploiement ;
- catégories de données, finalités, droits et contact ;
- confidentialité des écrans publics et du token de tracking ;
- cookies techniques et stockage local ;
- conservation, sécurité et gestion des incidents ;
- propriété intellectuelle, disponibilité et responsabilité ;
- version et date de mise à jour.

Aucun endpoint légal n’existe dans `docs-json.json`. Le contenu est donc versionné dans le frontend et configurable par environnement/build pour les coordonnées de l’éditeur et de l’hébergeur. Les valeurs fictives de la maquette doivent être bloquantes en recette de production. Tous les textes légaux sont traduisibles, mais une traduction ne doit être publiée qu’après validation juridique.

## 8. Contrats de formulaires essentiels

### 8.1 Personne

`CreatePersonDto` : requis `lastName`, `phoneNumber`, `siteId`; facultatifs `firstName`, `email`, `birthDate`, `languagePreference`. Téléphone normalisé E.164. Recherche et déduplication limitées au site courant.

### 8.2 Inscription

`CreateRegistrationDto` : requis `queueId`, `entryType`, `tierId`; fournir soit `personId`, soit `person`. `scheduledTime` est requis fonctionnellement pour `appointment`. Types d’entrée exacts : `walkin`, `appointment`.

Statuts : `booked`, `waiting`, `in_progress`, `served`, `no_show`, `cancelled`.

### 8.3 Site et file

Les noms camelCase du Swagger sont utilisés. Les heures sont envoyées au format `HH:mm`, sans conversion arbitraire en texte SQL. Les dates/heures ISO sont construites avec le fuseau du site.

Les origines `QueueConfigOriginsResponseDto` doivent afficher « Hérité du site » ou « Surchargé » sans recalculer l’origine côté front.

### 8.4 Forfait de file

`AssociateQueueTierDto` exige `tierId`, `price`; accepte `currency`, `displayOrder`, `isDefault`. Une devise absente/null hérite de la file puis du site. Un seul forfait actif par défaut est présenté.

### 8.5 Pagination et filtres

Toutes les listes paginées réutilisent un modèle unique `page`, `pageSize`, `total`, `totalPages`, `items`. Les filtres de l’URL sont sérialisés par une seule fonction commune et les valeurs vides ne sont pas envoyées.

## 9. Internationalisation

### 9.1 Règle absolue

Aucun texte visible ne doit être directement codé dans un composant : titres, boutons, placeholders, aides, validations, toasts, confirmations, états vides, erreurs et aria-labels utilisent des clés.

Exemples :

```text
nav.operations
desk.callNext
appointments.checkIn
notes.latest
validation.required
apiErrors.{translationKey}
```

### 9.2 Sources et fonctionnement

- bundle : `GET /api/v1/translations/bundle?locale={locale}&category=ihm` ;
- fallback embarqué minimal pour connexion et erreurs critiques ;
- cache indexé par locale, catégorie et `version` ;
- interpolation strictement limitée à `expectedParams` ;
- `dir="rtl"` pour les locales RTL ;
- dates via `Intl.DateTimeFormat` dans le fuseau du site ;
- devises via `Intl.NumberFormat` avec code ISO effectif ;
- pluriels via ICU MessageFormat ou équivalent.

Les traductions globales ne sont administrables que par Root/Admin, mais leur bundle est consommé par tous les espaces, y compris kiosque, écran et tracking.

## 10. Sécurité et confidentialité

- contrôle serveur obligatoire malgré le masquage UI ;
- route guard + action guard + contrôle de scope ;
- aucun token, téléphone, email, note ou nom dans logs/analytics ;
- destinataires de notification masqués dans les listes ;
- tokens de tracking exclus des URL de télémétrie et referers ;
- protection XSS : rendre les contenus de notes/traductions comme texte, sauf format explicitement assaini ;
- CSP, dépendances verrouillées, audit automatique et SRI si ressources externes ;
- confirmation pour reset, annulation, suppression, désactivation et prise de relais ;
- pas de file offline pour les mutations métier ;
- purge complète des données du kiosque entre deux usagers.

## 11. Performance et accessibilité

- WCAG 2.2 AA ;
- navigation clavier et focus visible ;
- cibles tactiles ≥ 44 px pour la borne ;
- support `prefers-reduced-motion` ;
- lazy loading par route ;
- virtualisation des listes volumineuses ;
- debounce des recherches ;
- images et logos dimensionnés ;
- TV lisible à distance en 1080p/4K, ratio 16:9 et aucun scroll ;
- modales utilisables au clavier et focus piégé/restitué.

## 12. Stratégie de tests

### 12.1 Tests unitaires

- adaptateurs DTO/formulaire ;
- sérialisation des filtres ;
- permission et scope ;
- héritage file/site ;
- formatage date/devise/locale ;
- reducer de session guichet ;
- sélection exclusive personne/forfait/file.

### 12.2 Tests composants

- menu accordéon selon permissions ;
- quatre thèmes et contrastes principaux ;
- `QueueEditor` création/édition ;
- assistant compte + affectations ;
- notes une par une, dernière par défaut ;
- calendrier semaine/mois et préremplissage ;
- check-in conditionnel ;
- écran public sans PII et écran interne avec noms ;
- page légale accessible avant/après authentification, depuis kiosque et mobile ;
- modales larges et actions sur une ligne.

### 12.3 Tests contractuels

- génération Swagger reproductible ;
- compilation des usages après régénération ;
- mocks MSW générés ou typés depuis le contrat ;
- aucun fixture avec champ inexistant dans le DTO.

### 12.4 Tests E2E prioritaires

1. login, refresh, logout et mot de passe imposé ;
2. changement de site et purge du contexte ;
3. occupation guichet, appel, servi/absent et libération ;
4. blocage d’un second appel pendant une prise en charge ;
5. accueil rapide personne connue/nouvelle, walk-in/RDV ;
6. calendrier : création, reprogrammation, annulation, check-in ;
7. kiosque walk-in et check-in RDV ;
8. écran public sans PII ;
9. notes consultation/ajout ;
10. onboarding complet et reprise après erreur ;
11. association Gratuit/Standard/Premium et règles ;
12. permissions Root/Admin/Manager/Hôtesse/Kiosque.

Tests visuels aux largeurs desktop, tablette, mobile, TV 16:9 et pour les quatre thèmes. Les captures de référence doivent être comparées à la maquette validée.

## 13. Observabilité

- journaliser route, opération OpenAPI, durée, statut et correlation ID ;
- exclure systématiquement PII et secrets ;
- mesurer erreurs de refresh, reconnexions, échecs mutations et temps de rendu ;
- associer chaque erreur visible à une clé traduisible et une action possible ;
- prévoir Error Boundaries par espace fonctionnel.

## 14. Définition de fini

Un écran est terminé lorsque :

- son rendu correspond à la maquette validée dans les quatre thèmes ;
- toutes ses actions sont reliées à une opération Swagger réelle ou marquées locales ;
- les DTO proviennent du client généré ;
- permissions et scopes sont testés ;
- tous les textes sont traduisibles ;
- chargement, vide, erreur, succès et concurrence sont gérés ;
- l’accessibilité clavier et les contrastes sont validés ;
- les tests unitaires, composants, E2E et visuels passent ;
- aucune PII n’est exposée sur les surfaces publiques ;
- aucun code métier n’est dupliqué entre écrans.

## 15. Registre des services et opérations Swagger

Les identifiants ci-dessous sont ceux de `docs-json.json`. Ils doivent être conservés dans les noms des fonctions générées ou être enveloppés par des hooks métier explicitement nommés.

### 15.1 Authentification et santé

| Service | OperationId | Méthode et route | Usage IHM |
|---|---|---|---|
| Authentification | `AuthController_login` | `POST /api/v1/auth/login` | Connexion |
| Authentification | `AuthController_refresh` | `POST /api/v1/auth/refresh` | Rotation silencieuse |
| Authentification | `AuthController_logout` | `POST /api/v1/auth/logout` | Déconnexion |
| Authentification | `AuthController_me` | `GET /api/v1/auth/me` | Profil, permissions, scope |
| Authentification | `AuthController_changePassword` | `POST /api/v1/auth/password/change` | Mot de passe personnel |
| Health | `HealthController_check` | `GET /api/v1/health` | Santé Root/Admin |

### 15.2 Sites et files

| Service | OperationId | Méthode et route | Usage IHM |
|---|---|---|---|
| Sites | `SitesController_findSites` | `GET /api/v1/sites` | Portefeuille et configuration |
| Sites | `SitesController_createSite` | `POST /api/v1/sites` | Onboarding |
| Sites | `SitesController_findSite` | `GET /api/v1/sites/{siteId}` | Détail/édition |
| Sites | `SitesController_updateSite` | `PATCH /api/v1/sites/{siteId}` | Édition et activation |
| Sites | `SitesController_deleteSite` | `DELETE /api/v1/sites/{siteId}` | Désactivation |
| Sites | `SitesController_getManagers` | `GET /api/v1/sites/{siteId}/managers` | Responsables |
| Sites | `SitesController_assignManager` | `POST /api/v1/sites/{siteId}/managers` | Affectation manager |
| Sites | `SitesController_removeManager` | `DELETE /api/v1/sites/{siteId}/managers/{userId}` | Retrait manager |
| Queues | `QueuesController_findAll` | `GET /api/v1/queues` | Listes et contexte |
| Queues | `QueuesController_createForSite` | `POST /api/v1/sites/{siteId}/queues` | Création file |
| Queues | `QueuesController_findOne` | `GET /api/v1/queues/{queueId}` | Détail file |
| Queues | `QueuesController_update` | `PATCH /api/v1/queues/{queueId}` | Édition file |
| Queues | `QueuesController_remove` | `DELETE /api/v1/queues/{queueId}` | Désactivation file |
| Queues | `QueuesController_getStatus` | `GET /api/v1/queues/{queueId}/status` | État temps réel |
| Queues | `QueuesController_getDisplay` | `GET /api/v1/queues/{queueId}/display` | Écran salle |
| Queues | `QueuesController_reset` | `POST /api/v1/queues/{queueId}/reset` | Reset confirmé |
| Queues | `QueuesController_getOperators` | `GET /api/v1/queues/{queueId}/operators` | Opérateurs affectés |
| Queues | `QueuesController_assignOperator` | `POST /api/v1/queues/{queueId}/operators` | Affectation opérateur |
| Queues | `QueuesController_removeOperator` | `DELETE /api/v1/queues/{queueId}/operators/{userId}` | Retrait opérateur |

### 15.3 Moteur de file et inscriptions

| Service | OperationId | Méthode et route | Usage IHM |
|---|---|---|---|
| QueueEngine | `QueueEngineController_nextPreview` | `GET /api/v1/sites/{siteId}/next-preview` | Prochains éligibles |
| QueueEngine | `QueueEngineController_getThreads` | `GET /api/v1/queues/{queueId}/threads` | Guichets libres/occupés |
| QueueEngine | `QueueEngineController_getActiveSessions` | `GET /api/v1/queues/{queueId}/sessions` | Sessions détaillées |
| QueueEngine | `QueueEngineController_openSession` | `POST /api/v1/queues/{queueId}/sessions` | Occuper/consulter |
| QueueEngine | `QueueEngineController_closeSession` | `DELETE /api/v1/queues/{queueId}/sessions/{sessionId}` | Libérer le guichet |
| QueueEngine | `QueueEngineController_callNext` | `POST /api/v1/queues/{queueId}/next` | Appeler suivant |
| QueueEngine | `QueueEngineController_markServed` | `POST /api/v1/registrations/{registrationId}/served` | Terminer servi |
| QueueEngine | `QueueEngineController_markNoShow` | `POST /api/v1/registrations/{registrationId}/no-show` | Marquer absent |
| Registrations | `RegistrationsController_getAvailability` | `GET /api/v1/queues/{queueId}/availability` | Créneaux disponibles |
| Registrations | `RegistrationsController_findRegistrations` | `GET /api/v1/registrations` | Files et agenda |
| Registrations | `RegistrationsController_register` | `POST /api/v1/registrations` | Walk-in ou RDV |
| Registrations | `RegistrationsController_lookup` | `GET /api/v1/registrations/lookup` | Recherche kiosque |
| Registrations | `RegistrationsController_findOne` | `GET /api/v1/registrations/{registrationId}` | Détail inscription |
| Registrations | `RegistrationsController_update` | `PATCH /api/v1/registrations/{registrationId}` | Forfait/langue |
| Registrations | `RegistrationsController_remove` | `DELETE /api/v1/registrations/{registrationId}` | Annulation |
| Registrations | `RegistrationsController_reschedule` | `POST /api/v1/registrations/{registrationId}/reschedule` | Reprogrammation |
| Registrations | `RegistrationsController_checkIn` | `POST /api/v1/registrations/{registrationId}/check-in` | Arrivée RDV |
| Registrations | `RegistrationsController_getPublicPosition` | `GET /api/v1/public/registrations/position` | Tracking public |

### 15.4 Personnes et notes

| Service | OperationId | Méthode et route | Usage IHM |
|---|---|---|---|
| Persons | `PersonsController_findPersons` | `GET /api/v1/persons` | Recherche site |
| Persons | `PersonsController_createPerson` | `POST /api/v1/persons` | Nouvelle personne |
| Persons | `PersonsController_findOne` | `GET /api/v1/persons/{personId}` | Fiche personne |
| Persons | `PersonsController_updatePerson` | `PATCH /api/v1/persons/{personId}` | Édition personne |
| Persons | `PersonsController_deletePerson` | `DELETE /api/v1/persons/{personId}` | Désactivation/suppression |
| Persons | `PersonsController_getNotes` | `GET /api/v1/persons/{personId}/notes` | Consultation notes |
| Persons | `PersonsController_createNote` | `POST /api/v1/persons/{personId}/notes` | Ajout note |

`PersonsController_updateNote` et `PersonsController_deleteNote` existent dans le Swagger mais ne sont volontairement pas exposés dans l’IHM validée.

### 15.5 Forfaits et notifications

| Service | OperationId | Méthode et route | Usage IHM |
|---|---|---|---|
| Tiers | `ServiceTiersController_findTiers` | `GET /api/v1/tiers` | Catalogue fixe |
| Tiers | `ServiceTiersController_getQueueTiers` | `GET /api/v1/queues/{queueId}/tiers` | Offres d’une file |
| Tiers | `ServiceTiersController_associateTier` | `POST /api/v1/queues/{queueId}/tiers` | Associer/tarifer |
| Tiers | `ServiceTiersController_updateQueueTier` | `PATCH /api/v1/queues/{queueId}/tiers/{tierId}` | Modifier association |
| Tiers | `ServiceTiersController_removeQueueTier` | `DELETE /api/v1/queues/{queueId}/tiers/{tierId}` | Dissocier |
| Tiers | `ServiceTiersController_getRules` | `GET /api/v1/queues/{queueId}/tiers/{tierId}/notification-rules` | Règles |
| Tiers | `ServiceTiersController_createRule` | `POST /api/v1/queues/{queueId}/tiers/{tierId}/notification-rules` | Nouvelle règle |
| Tiers | `ServiceTiersController_updateRule` | `PATCH /api/v1/queues/{queueId}/tiers/{tierId}/notification-rules/{ruleId}` | Modifier règle |
| Tiers | `ServiceTiersController_deleteRule` | `DELETE /api/v1/queues/{queueId}/tiers/{tierId}/notification-rules/{ruleId}` | Supprimer règle |
| Notifications | `NotificationsController_findNotifications` | `GET /api/v1/notifications` | Journal |
| Notifications | `NotificationsController_sendManual` | `POST /api/v1/notifications` | Envoi manuel |
| Notifications | `NotificationsController_findNotificationById` | `GET /api/v1/notifications/{notificationId}` | Détail |
| Notifications | `NotificationsController_resend` | `POST /api/v1/notifications/{notificationId}/resend` | Réémission |

Les opérations de création/modification du catalogue global existent dans l’API mais restent hors de l’administration d’un site, conformément au produit validé.

### 15.6 Utilisateurs, traductions et rapports

| Service | OperationId | Méthode et route | Usage IHM |
|---|---|---|---|
| Users | `UsersController_findUsers` | `GET /api/v1/users` | Annuaire |
| Users | `UsersController_createUser` | `POST /api/v1/users` | Compte humain/service |
| Users | `UsersController_findUserById` | `GET /api/v1/users/{userId}` | Fiche compte |
| Users | `UsersController_updateUser` | `PATCH /api/v1/users/{userId}` | Email/langue |
| Users | `UsersController_deleteUser` | `DELETE /api/v1/users/{userId}` | Suppression |
| Users | `UsersController_updateUserStatus` | `PATCH /api/v1/users/{userId}/status` | Activer/désactiver |
| Users | `UsersController_setUserPassword` | `PATCH /api/v1/users/{userId}/password` | Mot de passe administré |
| Users | `UsersController_assignUserRole` | `POST /api/v1/users/{userId}/roles` | Affecter rôle |
| Users | `UsersController_removeUserRole` | `DELETE /api/v1/users/{userId}/roles/{roleId}` | Retirer rôle |
| Users | `UsersController_getRoles` | `GET /api/v1/roles` | Rôles disponibles |
| Users | `UsersController_updateRolePermissions` | `PATCH /api/v1/roles/{roleId}/permissions` | Permissions rôle |
| Translations | `TranslationsController_getBundle` | `GET /api/v1/translations/bundle` | Bundle runtime |
| Translations | `TranslationsController_findTranslations` | `GET /api/v1/translations` | Studio Root/Admin |
| Translations | `TranslationsController_createTranslation` | `POST /api/v1/translations` | Créer/upsert |
| Translations | `TranslationsController_updateTranslation` | `PATCH /api/v1/translations/{translationId}` | Modifier |
| Translations | `TranslationsController_deleteTranslation` | `DELETE /api/v1/translations/{translationId}` | Supprimer |
| Reports | `ReportsController_getDashboardSummary` | `GET /api/v1/reports/dashboard/summary` | KPI globaux |
| Reports | `ReportsController_getDashboardQueueLoad` | `GET /api/v1/reports/dashboard/queue-load` | Charge files |
| Reports | `ReportsController_getDailyQueueReport` | `GET /api/v1/reports/queues/{queueId}/daily` | Rapport quotidien |

Le webhook fournisseur de notifications est serveur-à-serveur et ne doit jamais être appelé par l’IHM.

## 16. Hors périmètre ou dépendances futures

Ne pas présenter comme disponible sans évolution API :

- récupération de mot de passe par email ;
- export serveur de rapports ;
- contrat WebSocket versionné si non fourni séparément ;
- paiement en ligne des forfaits ;
- transfert interfile ;
- pause d’un opérateur sans libérer son poste ;
- création libre de forfaits depuis l’administration d’un site ;
- test automatisé d’appel depuis l’étape finale d’onboarding ;
- informations de santé autres que celles de `HealthResponseDto`.

---

Cette spécification constitue la référence finale de construction de l’IHM DORI. Toute évolution visuelle ou métier ultérieure doit mettre à jour simultanément le Swagger, ce document, les tests de contrat et les captures de référence.

<!-- CHECKPOINT id="ckpt_muyniih0_kv0uxr" time="2026-10-07T22:00:25.092Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muynvdfj_k79fs4" time="2026-10-07T22:10:25.087Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muyo88ea_46yk4b" time="2026-10-07T22:20:25.090Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muyol3d9_y5mh90" time="2026-10-07T22:30:25.101Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muyoxycf_9gjxm2" time="2026-10-07T22:40:25.119Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muyrgpqj_ijswep" time="2026-10-07T23:50:59.659Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muyrtkoz_ivpb2v" time="2026-10-08T00:00:59.651Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muys6fnp_891kpe" time="2026-10-08T00:10:59.653Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muysjanf_jucdhb" time="2026-10-08T00:20:59.691Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muyul5xt_qhcnsx" time="2026-10-08T01:18:26.129Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muyyzype_svh6go" time="2026-10-08T03:21:55.058Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
