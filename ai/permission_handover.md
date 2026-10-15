# Handover — Cohérence des permissions de l’API

## 1. Objet

Ce document décrit le prochain chantier de remise en cohérence des permissions
déclarées par les contrôleurs de l’API.

Il résulte d’un audit en lecture seule réalisé sur :

- les contrôleurs NestJS ;
- les extensions Swagger `x-required-permissions` ;
- le `PermissionsGuard` ;
- les permissions connues dans le seed SQL ;
- les contrôles complémentaires exécutés dans les services.

État constaté au moment de l’audit :

- 89 opérations exposées dans Swagger ;
- 80 opérations avec une permission explicite ;
- 3 opérations authentifiées sans permission explicite ;
- 6 opérations publiques ou sécurisées par un mécanisme spécifique ;
- 33 permissions connues ;
- aucune permission connue inutilisée.

Ce fichier décrit uniquement le travail futur. Aucune des corrections proposées
ci-dessous n’est encore implémentée.

## 2. Principes à préserver

- Une opération agissant uniquement sur la ressource de l’utilisateur connecté
  peut rester authentifiée sans permission métier supplémentaire.
- Une action administrative sur un autre utilisateur doit passer par le modèle
  RBAC et ne doit pas dépendre uniquement d’un nom de rôle codé en dur.
- Une permission doit décrire le domaine réellement manipulé par l’opération.
- Les contrôles de permission ne remplacent pas les contrôles de périmètre,
  d’appartenance, de hiérarchie ou d’anti-escalade dans les services.
- Les rôles restent des regroupements de permissions. Les services ne doivent
  pas utiliser directement les noms de rôles pour autoriser une action métier,
  sauf règle structurelle de hiérarchie clairement documentée.
- Chaque permission déclarée dans un contrôleur doit exister dans
  `dori_permission` et être documentée dans Swagger.
- Les endpoints publics, les webhooks signés et les accès par token opaque ne
  doivent pas recevoir artificiellement une permission RBAC utilisateur.

## 3. Priorité 1 — Séparer la déconnexion personnelle de la déconnexion forcée

### 3.1 Problème actuel

L’opération suivante remplit plusieurs responsabilités :

```http
POST /api/v1/auth/logout
```

Comportements actuels :

- sans `userId` : révoque la session courante ;
- avec le `userId` du caller : révoque toutes ses propres sessions ;
- avec le `userId` d’un autre utilisateur : force sa déconnexion.

La troisième variante ne déclare aucune permission. Elle autorise l’action en
vérifiant directement les rôles `manager`, `admin` et `root`, puis leur rang.
Cette logique contourne partiellement le modèle RBAC.

### 3.2 Évolution demandée

Conserver `POST /api/v1/auth/logout` pour les actions personnelles uniquement :

- déconnexion de la session courante ;
- déconnexion de toutes les sessions du caller.

Créer une opération administrative distincte, par exemple :

```http
POST /api/v1/users/{userId}/force-logout
```

Créer une permission dédiée :

```text
user_force_logout
```

L’opération administrative devra :

- déclarer `@RequirePermission('user_force_logout')` ;
- conserver le contrôle hiérarchique anti-escalade ;
- vérifier le périmètre du caller et de la cible ;
- interdire la déconnexion d’un utilisateur de rang égal ou supérieur ;
- révoquer toutes les sessions actives de la cible ;
- tracer l’auteur, la cible, la date et la raison de la révocation.

### 3.3 Attribution initiale proposée

- `kiosk` : non ;
- `operator` : non ;
- `manager` : oui, dans son périmètre et uniquement sur les rangs inférieurs ;
- `admin` : oui, selon la hiérarchie ;
- `root` : accès implicite.

La migration devra ajouter la permission sans écraser les personnalisations
existantes des rôles.

## 4. Priorité 2 — Corriger la consultation des utilisateurs

### 4.1 Opérations concernées

```http
GET /api/v1/users
GET /api/v1/users/{userId}
```

Ces opérations acceptent actuellement, entre autres :

```text
queue_view
session_operate
```

Ces permissions décrivent la consultation des files et l’exploitation des
guichets, pas la consultation des comptes utilisateur. Une borne possédant
`queue_view` peut ainsi franchir le premier contrôle du guard.

Le filtrage de périmètre dans le service limite les résultats, mais il ne rend
pas la déclaration du contrôleur sémantiquement correcte.

### 4.2 Décision à prendre

Option recommandée : créer une permission de lecture dédiée :

```text
user_view
```

Puis remplacer `queue_view` et `session_operate` sur les deux opérations par
`user_view`.

Les permissions `user_manage_*` et `system_manage` peuvent continuer à donner
accès à la consultation si ce comportement reste souhaité.

### 4.3 Contrôles à conserver

- filtrage par sites et files accessibles ;
- masquage des comptes hors périmètre ;
- protection particulière des comptes `admin` et `root` ;
- accès du caller à son propre profil via `/auth/me`, indépendamment de
  `user_view`.

## 5. Priorité 3 — Introduire une permission de monitoring

### 5.1 Opérations concernées

```http
GET /api/v1/monitoring/metrics
GET /api/v1/monitoring/activity
```

Elles utilisent actuellement :

```text
system_manage
```

Or `system_manage` est documentée pour la gestion des permissions de rôles et
le contournement des périmètres. Elle ne décrit pas explicitement la lecture du
monitoring.

### 5.2 Évolution recommandée

Créer :

```text
monitoring_view
```

Puis appliquer cette permission aux opérations `metrics` et `activity`.

L’opération suivante conserve `report_view` :

```http
GET /api/v1/monitoring/series
```

L’opération suivante reste publique :

```http
GET /api/v1/monitoring/health
```

### 5.3 Attribution initiale à décider

Recommandation :

- `kiosk` : non ;
- `operator` : non ;
- `manager` : à décider selon la sensibilité de `activity` ;
- `admin` : oui ;
- `root` : accès implicite.

Si `activity` doit être accessible aux managers mais pas `metrics`, créer deux
permissions au lieu d’une :

```text
monitoring_metrics_view
monitoring_activity_view
```

## 6. Priorité 4 — Découpler les personnes des permissions de registration

### 6.1 Problème actuel

Les opérations sur les personnes réutilisent les permissions des
registrations :

| Opération | Permission actuelle |
|---|---|
| `GET /api/v1/persons` | `registration_view` |
| `GET /api/v1/persons/{personId}` | `registration_view` |
| `POST /api/v1/persons` | `registration_register` |
| `PATCH /api/v1/persons/{personId}` | `registration_edit` |
| `DELETE /api/v1/persons/{personId}` | `registration_delete` |

Le comportement est techniquement opérationnel, mais les permissions ne
décrivent pas les ressources réellement consultées ou modifiées.

### 6.2 Évolution recommandée

Créer les permissions suivantes :

```text
person_view
person_create
person_edit
person_delete
```

Les permissions existantes restent utilisées pour les notes :

```text
person_note_view
person_note_manage
```

### 6.3 Compatibilité fonctionnelle à préserver

Les rôles qui peuvent actuellement inscrire une personne ne doivent pas perdre
la capacité minimale nécessaire au parcours d’inscription.

Il faudra donc décider entre :

1. attribuer `person_create` aux rôles possédant `registration_register` ;
2. permettre la création inline d’une personne pendant une registration sans
   donner accès à l’opération administrative `POST /persons` ;
3. exiger simultanément `registration_register` et `person_create` pour la
   création explicite via `/persons`.

L’option 2 offre la séparation la plus précise entre parcours métier et gestion
administrative des personnes.

## 7. Corriger la description de `registration_delete`

Description actuelle :

```text
Annuler (soft delete) une inscription
```

Cette description est obsolète : l’annulation est maintenant un statut métier
et ne modifie plus `is_active`.

Description recommandée :

```text
Annuler une inscription
```

La suppression ou désactivation administrative éventuelle d’une registration
devra être couverte séparément si elle existe un jour.

## 8. Permissions actuellement connues

Inventaire au moment de l’audit :

```text
appointment_checkin
appointment_lookup
appointment_manage
notification_send
notification_view
person_note_manage
person_note_view
queue_create
queue_delete
queue_edit
queue_tier_manage
queue_view
registration_call
registration_delete
registration_edit
registration_register
registration_view
report_view
session_operate
site_create
site_delete
site_edit
site_view
system_manage
tier_catalog_manage
tier_view
translation_manage
user_manage_admin
user_manage_kiosk
user_manage_manager
user_manage_operator
user_queue_assign
user_site_assign
```

Toutes ces permissions sont actuellement référencées par au moins une
opération. Il n’existe donc aucune permission connue inutilisée à supprimer.

## 9. Opérations sans permission explicite mais cohérentes

Les opérations suivantes ne nécessitent pas l’ajout d’une permission métier :

```http
GET  /api/v1/auth/me
POST /api/v1/auth/password/change
```

Elles agissent uniquement sur le caller authentifié.

Les opérations publiques ou protégées par un mécanisme spécifique restent
également sans permission RBAC :

- connexion ;
- renouvellement du token ;
- health check ;
- bundle public de traductions ;
- webhook signé du fournisseur de notifications ;
- suivi public par token opaque.

## 10. Travaux techniques attendus

Lors de l’implémentation :

1. créer une migration SQL versionnée pour les nouvelles permissions ;
2. mettre à jour le seed terminal sans modifier une migration déjà appliquée ;
3. attribuer les nouvelles permissions aux rôles retenus ;
4. mettre à jour les décorateurs des contrôleurs ;
5. déplacer la déconnexion forcée vers une opération dédiée ;
6. supprimer les contrôles de rôles codés en dur lorsqu’une permission les
   remplace, tout en conservant l’anti-escalade hiérarchique ;
7. mettre à jour les tests unitaires et d’intégration RBAC ;
8. régénérer `openapi.json`, `openapi.yaml` et `ai/docs-json.json` ;
9. vérifier les extensions Swagger `x-required-permissions` ;
10. vérifier qu’aucune permission référencée dans le code n’est absente de la
    base et qu’aucune permission active n’est inutilisée.

## 11. Tests d’acceptation minimums

- Un utilisateur peut fermer sa propre session sans permission spécifique.
- Un utilisateur peut révoquer toutes ses propres sessions.
- Un utilisateur sans `user_force_logout` ne peut pas déconnecter un tiers.
- `user_force_logout` ne permet jamais de contourner la hiérarchie.
- Un kiosk possédant `queue_view` ne peut plus lister les utilisateurs.
- `user_view` respecte toujours les périmètres site et queue.
- `monitoring_view` donne accès uniquement aux opérations retenues.
- `report_view` continue de donner accès à `/monitoring/series`.
- Les permissions `person_*` protègent correctement chaque opération CRUD.
- La création inline nécessaire au parcours d’inscription reste fonctionnelle.
- Swagger expose la permission exacte de chaque opération protégée.
- La comparaison automatisée entre permissions du code et de la base retourne
  zéro permission inconnue et zéro permission active inutilisée.

## 12. Condition de sortie du futur chantier

Le chantier sera terminé uniquement lorsque :

- chaque opération protégée déclare une permission cohérente avec son domaine ;
- aucune autorisation administrative ne dépend uniquement d’un rôle codé en
  dur ;
- les migrations, le seed, le code et Swagger contiennent le même référentiel
  de permissions ;
- les contrôles de périmètre et d’anti-escalade sont toujours actifs ;
- tous les tests de qualité et de sécurité passent ;
- l’audit final ne détecte aucune permission inconnue, manquante ou inutilisée.
