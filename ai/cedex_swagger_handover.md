# Handover d’audit Swagger / OpenAPI — Dori API

> Audit démarré le 2026-10-06 à partir de `openapi.json` généré par `npm run swagger:export`, puis confronté aux contrôleurs, DTO, services et règles de scope du code source. Ce document est enrichi progressivement ; un point n’y est ajouté qu’après confirmation dans le contrat généré et l’implémentation.

## Légende

- **P0** : faille de sécurité ou exposition de données critique.
- **P1** : incohérence fonctionnelle importante, contrat trompeur ou risque d’intégrité.
- **P2** : défaut d’ergonomie, de maintenabilité ou de précision du contrat.
- **P3** : amélioration documentaire.
- `[ ]` : à corriger ; `[x]` : corrigé et vérifié.

## Synthèse

| ID | Priorité | Zone | Constat |
| --- | --- | --- | --- |
| SW-PERSON-001 | P1 | Persons / scope | La recherche des personnes ne permet pas de sélectionner explicitement le site alors que l’identité est cloisonnée par site. |
| SW-SEC-001 | P1 | Webhook | Le webhook HMAC exige à tort Authorization/Bearer dans Swagger et sous-documente l’idempotence. |
| SW-AUTH-001 | P1 | Refresh | Swagger impose un body alors que le refresh par cookie HttpOnly est supporté. |
| SW-CACHE-001 | P2 | Traductions | La réponse conditionnelle `304 Not Modified` et le header `ETag` ne sont pas documentés. |
| SW-GEN-001 | P1 | Génération | Le script d’export et le Swagger servi utilisent deux configurations différentes. |
| SW-VAL-001 | P1 | Persons | Une personne entièrement vide est acceptée par le schéma et la validation. |
| SW-VAL-002 | P1 | Registrations / sessions | Les invariants conditionnels ne sont pas exprimés dans les DTO/OpenAPI. |
| SW-VAL-003 | P2 | Filtres | Plusieurs dates, statuts et identifiants sont documentés/validés comme chaînes ou entiers sans domaine précis. |
| SW-TIER-001 | P1 | Notifications | La valeur publique `trakingLink` contient une faute et devient un contrat persistant. |
| SW-ERR-001 | P1 | Erreurs | Le `500 INTERNAL_ERROR` réellement produit n’est documenté sur aucune route standard. |
| SW-ERR-002 | P2 | Erreurs | Les mêmes statuts génériques sont annoncés presque partout sans correspondre aux erreurs réellement possibles. |
| SW-NAME-001 | P1 | Registrations / notifications | La même ressource DB est appelée alternativement customer et registration, avec des IDs ambigus. |
| SW-SCHEMA-001 | P1 | Queue sessions | L’enum de réponse des sessions ne correspond pas aux modes réellement persistés. |
| SW-SCHEMA-002 | P1 | Notifications | Le statut `processing` existe dans le domaine mais manque dans le schéma de réponse. |
| SW-FORMAT-001 | P2 | Schémas | Beaucoup de dates/heures et identifiants n’exposent ni format ni bornes OpenAPI. |
| SW-PAG-001 | P2 | Pagination / tri | `sort` reste une chaîne libre alors que chaque service applique une allowlist différente. |
| SW-ENGINE-001 | P1 | QueueEngine | Plusieurs DTO de réponse sont obsolètes et incompatibles avec les objets réellement retournés. |
| SW-RBAC-001 | P2 | Autorisation | Les permissions requises par endpoint sont absentes du document OpenAPI. |
| SW-QUEUE-001 | P1 | Queues | Les réponses display/reset/affectation ne correspondent pas aux DTO Swagger annoncés. |
| SW-TIER-002 | P1 | Service tiers | Les schémas queue-tier et notification-rule décrivent un ancien modèle incompatible avec le service. |
| SW-RESP-001 | P2 | Affectations/suppressions | Des DTO génériques annoncent `success` ou `id` alors que les services renvoient des champs spécifiques différents. |
| SW-AUTH-002 | P1 | Auth | Les réponses refresh/me/logout/password ne correspondent pas aux schémas annoncés. |
| SW-REG-001 | P1 | Registrations | L’annulation est documentée comme `{deleted}` mais retourne `{cancelled}`. |
| SW-REG-002 | P1 | Registrations | Un DTO de détail unique masque plusieurs formes de réponse incompatibles. |
| SW-REG-003 | P1 | Suivi public | Le schéma de position exige des champs absents selon le statut réel. |
| SW-MAP-001 | P1 | Sérialisation | `SELECT *`/`RETURNING *` expose des formes plus larges que les DTO documentés. |
| SW-VAL-004 | P1 | DTO / base | Plusieurs limites SQL et formats métier ne sont pas validés à l’entrée. |
| SW-TIER-003 | P1 | Règles notification | La mise à jour partielle ne revalide pas les invariants documentés à la création. |
| SW-HTTP-001 | P2 | Sémantique HTTP | Plusieurs POST sont en réalité des upserts/idempotences non documentés. |
| SW-RT-001 | P2 | Temps réel | Le contrat WebSocket essentiel au produit est absent de toute spécification dédiée. |

## Constats détaillés

### [x] SW-PERSON-001 — Rendre le site explicite dans la recherche des personnes

- **Contrat observé :** `GET /api/v1/persons` expose la pagination, le tri et `search`, mais aucun `siteId`. À l’inverse, `POST /api/v1/persons` reçoit le site via un paramètre query obligatoire.
- **Implémentation observée :** `dori_person.site_id` est obligatoire et `PersonsService.findPersons` limite les utilisateurs non globaux à leurs sites, mais un utilisateur global recherche implicitement dans tous les sites.
- **Problème fonctionnel :** une même identité peut légitimement exister dans plusieurs sites. Une recherche globale peut donc retourner plusieurs fiches homonymes sans que le client puisse exprimer le contexte métier du site. Elle rend aussi plus facile une consultation transversale involontaire.
- **Correction recommandée :** ajouter `siteId` à `PersonFilterDto`. Le rendre obligatoire pour les profils globaux et soit obligatoire, soit validé contre le scope pour les profils locaux. Une route plus expressive comme `GET /sites/{siteId}/persons` serait encore plus homogène avec les files et les managers.
- **Impacts code :** `PersonsController`, `PersonFilterDto`, `PersonsService`/`PersonsRepository`, documentation Swagger et tests de scope multi-site.
- **Validation attendue :** même téléphone présent sur deux sites ; une recherche sur le site A ne retourne jamais la fiche du site B. Un `siteId` hors scope renvoie 403/404 selon la politique publique retenue.

### [x] SW-SEC-001 — Documenter correctement l’authentification HMAC du webhook

- **Contrat observé :** `POST /api/v1/webhooks/notifications/{provider}` hérite de `bearer` posé au niveau de `NotificationsController`. En plus, l’inférence Swagger transforme le paramètre `@Headers('authorization')` en header `authorization` obligatoire. `x-event-id` apparaît bien, mais sans description ni exemple.
- **Implémentation observée :** la route est `@Public()`, rejette explicitement un Bearer et exige `x-signature`, `x-timestamp`, `x-event-id` ainsi que le corps brut.
- **Impact :** le mécanisme documenté est contradictoire avec le mécanisme accepté : Swagger exige précisément le Bearer que le contrôleur rejette. L’idempotence reste insuffisamment spécifiée faute de contrat sur `x-event-id`.
- **Correction recommandée :** retirer la sécurité Bearer sur cette opération avec `@ApiSecurity`/`security: []`, empêcher `authorization` d’être déclaré obligatoire (ne pas l’exposer comme paramètre de contrat), puis documenter les trois headers HMAC requis avec formats/exemples. Préciser que la signature porte sur les octets bruts du body et définir l’unité/format du timestamp.
- **Validation attendue :** le JSON OpenAPI de cette opération ne contient plus `bearer`, contient les trois headers requis et permet de reproduire une signature valide.

### [x] SW-AUTH-001 — Représenter le refresh par cookie ou body

- **Contrat observé :** `POST /api/v1/auth/refresh` déclare `requestBody.required: true` via `@ApiBody`, sans cookie documenté.
- **Implémentation observée :** le contrôleur accepte `refreshDto.refreshToken || req.cookies?.refreshToken`; le body peut donc être absent lorsque le cookie HttpOnly est présent.
- **Impact :** les clients générés imposent inutilement le refresh token dans le body et ne découvrent pas le flux cookie sécurisé utilisé par le serveur.
- **Correction recommandée :** rendre le body optionnel, déclarer un schéma `apiKey` de type cookie nommé `refreshToken`, documenter les deux alternatives et les en-têtes `Set-Cookie` des réponses login/refresh ainsi que la suppression au logout.
- **Validation attendue :** OpenAPI autorise un appel sans body et décrit clairement le mode cookie et le mode body.

### [x] SW-CACHE-001 — Documenter le cache conditionnel du bundle de traductions

- **Contrat observé :** `GET /api/v1/translations/bundle` ne déclare que `200` et les erreurs standard.
- **Implémentation observée :** le contrôleur lit `If-None-Match`, émet `ETag` et retourne `304` lorsque la version correspond.
- **Impact :** les clients générés et passerelles ignorent une branche normale du contrat HTTP ; les headers de cache ne sont pas visibles.
- **Correction recommandée :** ajouter le header request `If-None-Match`, le header response `ETag` sur `200`, et une réponse `304` sans enveloppe JSON.
- **Validation attendue :** ces trois éléments apparaissent dans `openapi.json` et un test de contrat couvre `200` puis `304`.

### [x] SW-GEN-001 — Utiliser une configuration OpenAPI unique

- **Contrat observé :** `scripts/swagger-export.ts` et `src/main.ts` construisent séparément `DocumentBuilder`. L’export omet notamment contact, licence, serveurs et tags décrits dans le Swagger servi.
- **Impact :** le fichier livré aux intégrateurs n’est pas le document consulté dans Swagger UI ; toute évolution doit être synchronisée manuellement et dérivera à nouveau.
- **Correction recommandée :** extraire une fabrique `createOpenApiConfig()` dans le core et l’utiliser dans les deux chemins. Ajouter un test/snapshot comparant les métadonnées structurantes.
- **Validation attendue :** à code identique, export et `/api/docs-json` produisent le même document hors champs explicitement non déterministes.

### [ ] SW-VAL-001 — Exiger une identité minimale pour une personne

- **Contrat observé :** toutes les propriétés de `PersonIdentityDto` sont optionnelles. `CreatePersonDto` exige seulement `siteId`.
- **Implémentation observée :** le service insère effectivement une ligne dont nom, prénom, email, téléphone et date de naissance peuvent tous être nuls.
- **Impact :** fiches impossibles à identifier, déduplication inopérante et inscriptions rattachées à des personnes vides.
- **Correction recommandée :** définir l’invariant métier minimal (par exemple téléphone ou email, éventuellement identité nominative) et l’implémenter avec un validateur de classe réutilisé par la création directe et la création embarquée dans une inscription. Le représenter dans OpenAPI avec une description explicite et idéalement `oneOf`/`anyOf`.
- **Validation attendue :** une identité vide est rejetée en 400 ; chaque combinaison autorisée est couverte.

### [ ] SW-VAL-002 — Porter les invariants conditionnels dans la validation et OpenAPI

- **Contrats concernés :** `CreateRegistrationDto` autorise simultanément ou alternativement aucune valeur pour `personId`/`person`, rend `scheduledTime` optionnel quel que soit `entryType`; `LookupRegistrationDto` autorise une requête sans critère; `OpenSessionDto` autorise `mode=active` sans `threadNumber`.
- **Implémentation observée :** les services rejettent ces cas plus tard avec des contrôles manuels. Swagger ne permet donc pas aux clients de connaître les formes valides et le même invariant est réparti entre DTO et service.
- **Correction recommandée :** validateurs de classe communs (`ExactlyOneOf`, conditions rendez-vous/mode) et schémas OpenAPI `oneOf` documentant les variantes. Interdire aussi `scheduledTime` pour un walk-in afin que le contrat corresponde à la contrainte SQL.
- **Validation attendue :** validation DTO et document OpenAPI acceptent exactement les mêmes combinaisons que le domaine.

### [x] SW-VAL-003 — Fermer les domaines de filtres et identifiants

- **Preuve :** `RegistrationFilterDto.status`, `entryType` et `appointmentStatus` utilisent `IsString`; `businessDate` et `NotificationFilterDto.businessDate` ne valident pas réellement une date. Plusieurs IDs acceptent zéro ou des valeurs négatives, contrairement aux IDs PostgreSQL générés.
- **Impact :** Swagger génère des clients autorisant des valeurs impossibles, et les fautes deviennent des recherches vides plutôt que des erreurs explicites.
- **Correction recommandée :** enums partagés avec le domaine, `IsDateString` ou format `date` strict selon la sémantique, et pipe/DTO commun d’identifiant positif.
- **Validation attendue :** enums/formats/minimum apparaissent dans OpenAPI et les valeurs hors domaine renvoient 400.

### [ ] SW-TIER-001 — Corriger `trakingLink` en `trackingLink`

- **Preuve :** la faute apparaît dans les DTO create/update, les unions TypeScript, les contrôles du service et les contraintes SQL `notification_type`.
- **Impact :** la faute devient une valeur publique imposée aux clients, aux données et aux migrations futures.
- **Correction recommandée :** migration DB et code vers `trackingLink`, avec éventuelle période de compatibilité d’entrée si des clients existent déjà. Centraliser l’enum pour éviter une nouvelle divergence.
- **Validation attendue :** aucune occurrence de `trakingLink`; anciennes données migrées et Swagger régénéré.

### [x] SW-ERR-001 — Documenter les erreurs internes

- **Preuve :** `GlobalExceptionFilter` transforme toute exception inconnue en HTTP 500 avec `code=INTERNAL_ERROR`, mais `ApiDoriErrorResponses` ne déclare jamais 500.
- **Impact :** les SDK et consommateurs ne modélisent pas une réponse pourtant possible sur chaque opération.
- **Correction recommandée :** ajouter une réponse 500 centralisée avec `ErrorResponseDto`, sans exposer de détail interne.
- **Validation attendue :** les opérations standard exposent 500 et un test du filtre vérifie le même schéma.

### [ ] SW-ERR-002 — Déclarer les erreurs par cas d’usage

- **Preuve :** la majorité des endpoints annonce uniformément `400,401,403,404,409,422,423,429`, y compris lorsque certaines réponses ne peuvent pas être produites. Les routes publiques conservent parfois encore des statuts sans rapport.
- **Impact :** documentation bruyante, contrats clients inutilement larges et impossibilité d’identifier les erreurs métier importantes d’un endpoint.
- **Correction recommandée :** conserver un socle réellement transversal (`400/401/403/429/500`) et composer explicitement les erreurs métier (`404/409/422/423`) par décorateurs centralisés et codes applicatifs possibles.
- **Validation attendue :** chaque statut documenté dispose d’un chemin d’exécution ou d’une règle transverse identifiable.

### [ ] SW-NAME-001 — Unifier la ressource inscription/customer

- **Preuve :** l’API principale parle de `registrationId`, alors que les réponses du moteur et des notifications exposent `customerId`. `SendManualNotificationDto.customerId` est décrit comme « personne / client », mais le service l’utilise contre `dori_customer.customer_id`, donc l’identifiant de l’inscription. Le filtre équivalent s’appelle pourtant `registrationId`.
- **Impact :** un client peut envoyer un `personId` valide à la place d’un identifiant d’inscription et cibler la mauvaise ressource ou recevoir un 404 incompréhensible.
- **Correction recommandée :** choisir `registrationId` dans le contrat public, conserver `customer_id` comme détail interne si une migration DB n’est pas souhaitée, puis renommer DTO, réponses, descriptions et paramètres de service.
- **Validation attendue :** un seul nom public désigne cette ressource sur Registrations, QueueEngine et Notifications.

### [x] SW-SCHEMA-001 — Corriger l’enum des modes de session

- **Contrat observé :** `QueueSessionDetailDto.mode` annonce `active | paused | closed`.
- **Implémentation observée :** la table, `OpenSessionDto` et le service utilisent `active | consultation_only`; la fermeture est représentée par `disconnected_at`, pas par un mode `closed`.
- **Impact :** les SDK refusent une valeur réelle et proposent deux valeurs jamais produites.
- **Correction recommandée :** centraliser `QueueSessionMode` et documenter `active | consultation_only`; représenter l’état ouvert/fermé séparément si nécessaire.
- **Validation attendue :** enum identique dans DTO d’entrée, DTO de sortie, entité et contrainte SQL.

### [x] SW-SCHEMA-002 — Ajouter `processing` au statut des notifications

- **Contrat observé :** `NotificationDetailDto.notificationStatus` annonce `pending | sent | delivered | failed`.
- **Implémentation observée :** le worker réserve une notification avec le statut persistant `processing`, également accepté par `NotificationFilterDto` et la contrainte SQL.
- **Impact :** une réponse valide pendant le traitement ne respecte pas le SDK généré.
- **Correction recommandée :** enum partagé unique pour entité, worker, filtres et réponses.
- **Validation attendue :** `processing` apparaît dans le schéma de réponse et toutes les listes restent identiques.

### [x] SW-FORMAT-001 — Documenter formats et bornes scalaires

- **Preuve :** de nombreuses propriétés `createdAt`, `updatedAt`, `scheduledTime`, `businessDate`, `birthDate` et heures métier sont de simples `string` sans `format`; les IDs numériques n’ont généralement pas `minimum: 1`. Plusieurs propriétés entières sont décrites comme `number` sans format `int32`.
- **Impact :** génération de clients trop permissifs, absence de validation locale et ambiguïté entre date, instant UTC et heure locale.
- **Correction recommandée :** composants/décorateurs centraux pour ID positif, `date`, `date-time`, heure locale et timezone IANA. Aligner `class-validator` avec ces formats.
- **Validation attendue :** contrôle automatisé du document ne trouvant plus de propriétés temporelles non qualifiées ni d’IDs d’entrée sans borne.

### [x] SW-PAG-001 — Exposer les valeurs de tri autorisées par endpoint

- **Contrat observé :** `PaginationDto.sort` est une chaîne générique au format `field:asc|desc`.
- **Implémentation observée :** chaque service appelle `getSafeSortField` avec une allowlist propre et remplace silencieusement une valeur inconnue par le tri par défaut.
- **Impact :** Swagger propose des tris qui ne seront pas appliqués, sans signaler l’erreur au client.
- **Correction recommandée :** DTO de filtre par ressource avec enum Swagger partagé avec l’allowlist d’exécution, et rejet 400 d’un champ inconnu plutôt qu’un fallback silencieux.
- **Validation attendue :** les valeurs `sort` générées correspondent exactement aux colonnes autorisées de chaque listing.

### [x] SW-ENGINE-001 — Réaligner tous les schémas de sortie QueueEngine

- **Threads :** `GET /queues/{queueId}/threads` est documenté comme un tableau de `QueueThreadDetailDto` (`isOpen`, `operatorUserId`, `currentTicketNumber`), alors que le service retourne une réponse paginée contenant `threadNumber`, `status` et un objet `session` imbriqué.
- **Preview :** `GET /sites/{siteId}/next-preview` annonce un tableau de `QueuePreviewResponseDto` contenant lui-même `queueId` et `candidates`; le service retourne directement un tableau de candidats enrichis (`registrationId`, queue, site, personne, score, `calledEarly`).
- **Call next :** `CalledNextCustomerResponseDto` annonce seulement `customerId`, ticket, thread, statut et date. Le service retourne `registrationId`, `entryType`, `scheduledTime`, `calledEarly`, `tier`, `sessionId`, `priorityScore` et `person` en plus, et ne retourne pas `customerId`.
- **Served/no-show :** `CustomerActionResponseDto` annonce `customerId` et `completedAt`; le service retourne `registrationId`, `servedAt`, `closedAt`, `handledBySessionId` et `handledByUserId`.
- **Impact :** les clients générés désérialisent des propriétés absentes et ignorent des données essentielles. Le Swagger ne peut pas servir de contrat de référence.
- **Correction recommandée :** créer des DTO correspondant aux modèles de sortie actuels, typer explicitement les retours des services et ajouter des tests de contrat sur les objets après `SerializationInterceptor`.
- **Validation attendue :** snapshots JSON réels comparés aux schémas OpenAPI pour les quatre familles d’opérations.

### [x] SW-RBAC-001 — Exposer les permissions requises

- **Contrat observé :** OpenAPI indique uniquement `bearer`; les métadonnées `@RequirePermission` et `@RequireAnyPermission` ne sont pas visibles.
- **Impact :** un intégrateur authentifié ne peut pas déterminer pourquoi un endpoint retourne 403 ni quel rôle/jeu de permissions demander. C’est particulièrement problématique pour les endpoints Users dont les alternatives sont nombreuses.
- **Correction recommandée :** enrichir les décorateurs RBAC centralisés pour ajouter une extension OpenAPI (`x-required-permissions`, avec sémantique all/any) et, si utile, une description lisible générée.
- **Validation attendue :** chaque route protégée expose les permissions exactes sans duplication manuelle dans les contrôleurs.

### [x] SW-QUEUE-001 — Réaligner les réponses opérationnelles des files

- **Display :** `QueueDisplayResponseDto` annonce `queueName`, `currentCalling` et `recentCalled`; le service retourne `queueId`, `activeThreads[{threadNumber,currentTicket}]` et `nextTickets[string]`.
- **Reset :** `QueueResetResponseDto` annonce `resetAt` et `closedWaitingCount`; le service retourne `reset: true` et `timestamp` sans compteur.
- **Affectations :** `AssignOperatorResponseDto` annonce `success`; le service retourne `assigned` ou `removed` selon l’opération.
- **Impact :** rupture directe des clients générés et documentation fonctionnelle mensongère pour les écrans d’affichage et d’administration.
- **Correction recommandée :** décider la forme métier cible, typer les retours du service avec les DTO correspondants, séparer les DTO assign/remove si leurs formes diffèrent, et supprimer les anciens champs non produits.
- **Validation attendue :** tests HTTP passant les réponses sérialisées dans un validateur OpenAPI pour status, display, reset et opérateurs.

### [x] SW-TIER-002 — Réaligner les modèles de forfaits de file et règles

- **Queue tier :** `QueueTierDetailDto` documente essentiellement `price`, `isEnabled`, `isDefault` et `tier`; les créations/mises à jour retournent directement la ligne d’association avec notamment `currency`, `displayOrder`, timestamps et sans objet `tier`. La liste, elle, construit une forme enrichie encore différente.
- **Notification rule :** le DTO annonce `triggerEvent`, `thresholdType`, `thresholdValue` et `templateKey`. La table et le service produisent `notificationType`, `channel`, `thresholdPosition`, `thresholdMinutes` et `includeTrackingLink`.
- **Impact :** POST/PATCH et GET d’une même ressource n’ont pas une représentation stable, et le schéma de règle ne correspond à aucune réponse réelle.
- **Correction recommandée :** choisir une représentation canonique par ressource, mapper toutes les mutations vers celle-ci et supprimer les DTO hérités de l’ancien modèle.
- **Validation attendue :** create/update/list renvoient la même forme canonique et passent une validation OpenAPI.

### [x] SW-RESP-001 — Remplacer les DTO de résultat trop génériques

- **Preuve :** `AssignManagerResponseDto`/`AssignOperatorResponseDto` annoncent `success`, alors que les services renvoient `assigned` ou `removed`. `TierDeleteResponseDto` annonce `{id, deleted}` mais sert aussi à documenter des retours réels `{tierId, deleted}`, `{queueId, tierId, removed}` et `{ruleId, deleted}`.
- **Impact :** plusieurs opérations sont documentées avec des propriétés absentes ou de mauvais identifiants.
- **Correction recommandée :** DTO dédiés `AssignmentResponse`, `RemovalResponse`, `TierDeleteResponse`, `QueueTierRemovalResponse`, `RuleDeleteResponse`, ou une convention unique réellement appliquée par tous les services.
- **Validation attendue :** aucune opération ne réutilise un DTO dont les propriétés diffèrent de son retour réel.

### [x] SW-AUTH-002 — Réaligner les réponses d’authentification

- **Refresh :** `TokensResponseDto` annonce seulement les deux tokens, mais `AuthService.refresh` retourne aussi `user`.
- **Me :** `CurrentUserResponseDto` annonce `{user: AuthUserDto}`; le service retourne le profil à plat avec `userId`, identité, rôles, permissions et `scope`.
- **Logout/password :** `SimpleMessageResponseDto` exige `message`; les deux services renvoient `{success: true}`.
- **Détails associés :** `AuthUserDto` annonce `email` mais le login ne le retourne pas; le profil `/me` expose `scope` et `lastLogin` sans schéma correspondant.
- **Impact :** les fonctions les plus utilisées par un client authentifié violent leurs propres types générés.
- **Correction recommandée :** choisir les réponses cibles, créer des DTO distincts si nécessaire, et typer les retours des méthodes du service pour rendre ces divergences impossibles à compiler.
- **Validation attendue :** tests e2e login → refresh → me → password/logout validés contre OpenAPI après sérialisation.

### [x] SW-REG-001 — Documenter l’annulation comme une annulation

- **Contrat observé :** `DELETE /registrations/{registrationId}` utilise `RegistrationDeleteResponseDto` avec `{registrationId, deleted}`.
- **Implémentation observée :** la ressource passe au statut `cancelled` et retourne `{registrationId, cancelled: true}`.
- **Impact :** le nom HTTP DELETE et le DTO suggèrent une suppression, alors que le domaine conserve une inscription annulée pour l’historique.
- **Correction recommandée :** préférer une action explicite `POST /registrations/{id}/cancel` ou, au minimum, renommer le DTO et documenter précisément le soft-delete/statut. Harmoniser la propriété `cancelled`.
- **Validation attendue :** méthode, description, statut métier et payload emploient la même sémantique.

### [x] SW-REG-002 — Définir des représentations cohérentes de l’inscription

- **Contrat observé :** `RegistrationDetailResponseDto` exige `customerId`, `queueId`, `personId`, `tierId`, token de suivi, dates et timestamps. Il est utilisé pour create, lookup, get, update, reschedule et check-in.
- **Implémentation observée :** la création retourne notamment `registrationId`, un objet `tier`, `priorityReferenceTime`, `trackingUrl` et `registrationTrackingTokenValidUntil`, sans plusieurs champs exigés par le DTO. D’autres opérations retournent des lignes SQL ou des projections encore différentes.
- **Token :** le schéma décrit un `registrationTrackingToken` d’exemple `trk_...`, alors que la donnée persistée est un UUID; la création retourne plutôt une URL conditionnelle et sa date d’expiration.
- **Impact :** aucun type client unique ne peut correctement représenter toutes ces réponses.
- **Correction recommandée :** définir une représentation canonique complète, ou des DTO explicites par cas d’usage (`RegistrationCreated`, `RegistrationDetail`, `RegistrationTransition`). Mapper systématiquement les sorties au lieu de renvoyer des lignes SQL brutes.
- **Validation attendue :** chaque opération retourne exactement son DTO, y compris noms, nullabilité, formats UUID/date-time et objets imbriqués.

### [x] SW-REG-003 — Modéliser les variantes du suivi public

- **Contrat observé :** `PublicPositionResponseDto` exige ticket, position, attente, statut et `queueName`.
- **Implémentation observée :** une inscription clôturée depuis plus d’une heure retourne seulement `{status:'closed'}`; `in_progress` et `waiting` n’incluent pas `queueName`; les autres statuts retournent seulement ticket et statut.
- **Impact :** toutes les branches sauf une partie du statut waiting violent le schéma; un client généré ne peut pas traiter proprement la réponse dégradée.
- **Correction recommandée :** `oneOf` discriminé par `status` (waiting, in_progress, terminal, closed/degraded), ou réponse stable avec champs optionnels/nullables explicitement définis. Décider si le nom de file doit réellement être fourni puis l’implémenter.
- **Validation attendue :** test de contrat pour chaque branche de statut et token expiré.

### [x] SW-MAP-001 — Séparer conversion de casse et projection de contrat

- **Preuve :** de nombreux services/repositories renvoient directement `SELECT *`, `alias.*` ou `RETURNING *` (sites, queues, persons, registrations, notifications, tiers, translations). `SerializationInterceptor` convertit récursivement snake_case vers camelCase et retire quelques secrets, mais ne limite pas les propriétés au DTO Swagger.
- **Impact :** champs d’audit et colonnes ajoutées ultérieurement deviennent automatiquement publics sans mise à jour OpenAPI ni revue de sécurité. Les réponses contiennent aussi des propriétés non documentées, ce qui masque les divergences décrites dans cet audit.
- **Correction recommandée :** conserver l’intercepteur central pour la conversion mécanique, mais imposer une projection de sortie typée dans les repositories (`SELECT` explicite) ou un sérialiseur DTO centralisé. Interdire `SELECT *` sur les chemins HTTP par garde-fou statique.
- **Validation attendue :** `additionalProperties: false` sur les DTO publics pertinents et validation des réponses réelles; aucune colonne non déclarée n’est émise.

### [ ] SW-VAL-004 — Aligner les DTO sur les contraintes SQL et formats métier

- **Exemples confirmés :** devises documentées ISO 4217 mais validées par simple `IsString` malgré `CHAR(3)`; locales sans format/longueur; codes et noms de tiers sans les limites `VARCHAR(20/50)`; username/email et plusieurs textes sans toutes les bornes DB; URL de logo non validée comme URL; seuils de notification acceptant des valeurs négatives.
- **Impact :** le `ValidationPipe` accepte des payloads que PostgreSQL rejettera tardivement, souvent sous forme de 500, ou des valeurs syntaxiquement valides mais métier incohérentes.
- **Correction recommandée :** constantes/validateurs partagés pour ISO 4217, locale BCP 47, timezone IANA, URL, longueurs et valeurs positives. Faire dériver les métadonnées Swagger des mêmes contraintes.
- **Validation attendue :** tests de frontière DTO et aucune violation connue de longueur/check DB atteignable après validation HTTP.

### [x] SW-TIER-003 — Revalider une règle complète lors d’un PATCH

- **Preuve :** la création vérifie qu’une règle `threshold` possède position ou minutes et limite le tracking link à certains types. `updateNotificationRule` applique seulement les champs reçus sans recharger/revalider l’état final; la base peut alors rejeter la requête ou laisser le service produire une erreur technique.
- **Impact :** le même état est accepté ou rejeté différemment selon qu’il provient d’un POST ou de plusieurs PATCH; OpenAPI ne décrit pas ces dépendances.
- **Correction recommandée :** verrouiller/recharger la règle, fusionner le DTO, valider l’objet final avec le même validateur de domaine que la création, puis documenter les variantes conditionnelles.
- **Validation attendue :** matrice create/update couvrant chaque combinaison type, seuil et tracking link avec erreurs 400/422 stables.

### [ ] SW-HTTP-001 — Documenter ou revoir les upserts

- **Preuve :** `POST /translations` fait un upsert sur `(translation_key, locale)` tout en retournant toujours 201; l’association queue-tier réactive/met à jour une association existante; les affectations manager/opérateur/rôle utilisent `ON CONFLICT DO NOTHING` mais annoncent une affectation réussie même si elle existait.
- **Impact :** les clients ne savent pas si une ressource a été créée, mise à jour ou laissée inchangée; les réponses booléennes peuvent être mensongères.
- **Correction recommandée :** PUT sur une clé naturelle pour les upserts, ou réponses explicites avec `created/updated/unchanged`; réserver 201 aux créations effectives et documenter l’idempotence.
- **Validation attendue :** appels répétés couverts avec statuts et payloads fidèles à l’effet réel.

### [x] SW-RT-001 — Spécifier le protocole temps réel

- **Preuve :** OpenAPI décrit uniquement HTTP alors que `RealtimeGateway` expose `subscribe`, `ping_session` et plusieurs événements métier ops/display/suivi/traductions.
- **Impact :** les clients temps réel doivent lire le code source pour connaître handshake, authentification, rooms, payloads et erreurs.
- **Correction recommandée :** ajouter un document AsyncAPI (ou documentation contractuelle équivalente) généré depuis des DTO partagés avec les émissions HTTP/realtime.
- **Validation attendue :** événements entrants/sortants, sécurité, canaux et exemples couverts par tests de contrat.

## Journal des corrections

- **2026-10-06 — SW-GEN-001 :** `createOpenApiConfig()` est la source unique du bootstrap et de l'export.
- **2026-10-06 — SW-SEC-001 :** webhook sans Bearer dans le contrat; les trois headers HMAC, le timestamp, le corps brut signé et l'idempotence sont documentés.
- **2026-10-06 — SW-AUTH-001 :** body de refresh optionnel et cookie `refreshToken` déclaré.
- **2026-10-06 — SW-CACHE-001 :** `If-None-Match`, `ETag` et réponse vide 304 documentés.
- **2026-10-06 — SW-PERSON-001 :** `siteId` positif obligatoire, contrôle de scope préalable et recherche limitée à ce site.
- **2026-10-06 — SW-ERR-001 :** réponse 500 centralisée, sans détail technique.
- **2026-10-06 — SW-RBAC-001 :** extension `x-required-permissions` générée par les décorateurs centraux (`all`/`any`).
- **2026-10-06 — SW-AUTH-002 :** refresh, `/me`, logout et changement de mot de passe alignés sur leurs retours réels.
- **2026-10-06 — SW-SCHEMA-001 / SW-SCHEMA-002 :** enums de session et de notification alignés sur le domaine persistant.
- **2026-10-06 — SW-VAL-002 :** validateurs communs pour personne, créneau, lookup et mode de session.
- **2026-10-06 — SW-TIER-003 :** le PATCH valide l'état final fusionné avec les invariants de création.
- **2026-10-06 — SW-ENGINE-001 :** DTO dédiés aux candidats, threads paginés, sessions, appels et transitions served/no-show, avec enums et nullabilité réels.
- **2026-10-06 — SW-QUEUE-001 :** display, reset et affectations sont alignés sur les payloads effectivement retournés.
- **2026-10-06 — SW-TIER-002 :** représentation queue-tier canonique après create/update/list et modèle de règle aligné sur la table active.
- **2026-10-06 — SW-RESP-001 :** DTO distincts pour assign/remove et pour chaque type de suppression de forfait/règle.
- **2026-10-06 — SW-REG-001 / SW-REG-003 :** annulation documentée avec `cancelled`; variantes publiques rendues explicitement optionnelles selon le statut.
- **2026-10-06 — SW-RT-001 :** ajout de `asyncapi.yaml` pour le handshake, les rooms, `subscribe`, `ping_session` et les événements sortants.
- **2026-10-06 — SW-VAL-003 / SW-FORMAT-001 :** enums/date stricts sur les filtres concernés, pipe global pour tous les paramètres `*Id` positifs, et normalisation OpenAPI commune des minima et formats temporels.
- **2026-10-06 — SW-REG-002 :** DTO distincts pour la création, le détail et les transitions d'inscription; formats et nullabilité du tracking explicités.
- **2026-10-06 — SW-MAP-001 :** les décorateurs de réponse transmettent le DTO cible au `SerializationInterceptor`, qui convertit puis projette récursivement les propriétés autorisées. Une colonne SQL ajoutée ne devient donc plus publique par défaut.
- **2026-10-06 — SW-ERR-002 :** le décorateur commun est ramené aux erreurs réellement transversales; les 404/409/422 ne sont plus annoncées uniformément et le 423 générique a été supprimé.
- **2026-10-06 — SW-PAG-001 :** la normalisation OpenAPI publie les valeurs `champ:asc|desc` propres à chaque opération; les autres tris conservent un pattern strict.
- **2026-10-06 — SW-VAL-004 :** contraintes DTO rapprochées des bornes SQL avec validateurs standards pour URL, timezone IANA, ISO 4217, locale, longueurs et identifiants positifs.

## Décisions produit requises — non modifiées

- **SW-VAL-001 :** définir l'identité minimale autorisée pour une personne (email, téléphone ou identité nominative).
- **SW-TIER-001 :** choisir la stratégie de compatibilité/migration de la valeur publique persistée `trakingLink` vers `trackingLink`.
- **SW-NAME-001 :** confirmer le renommage public transversal `customerId` vers `registrationId` et sa période de compatibilité.
- **SW-HTTP-001 :** choisir les statuts et la stratégie de compatibilité pour les POST actuellement idempotents/upsert.

## Double contrôle du 2026-10-06

- **Résultat de vérification :** `npm run quality:check` réussi après corrections, avec **21 suites et 103 tests réussis**.
- **SW-VAL-002 rouvert :** les règles sont effectivement validées à l'exécution, mais les variantes conditionnelles ne sont pas encore toutes exprimées structurellement en `oneOf` dans OpenAPI.
- **SW-ERR-002 rouvert :** le bruit générique a été retiré, mais les erreurs métier 404/409/422 doivent encore être ajoutées précisément endpoint par endpoint.
- **SW-VAL-004 rouvert :** plusieurs contraintes majeures sont présentes (URL, timezone, devise, locale, longueurs et IDs), mais l'équivalence exhaustive avec chaque colonne SQL n'est pas encore prouvée.
- **Correction complémentaire :** la disponibilité d'inscription retourne maintenant `queueId` et `date`, conformément à `AvailabilityResponseDto`; les headers `Set-Cookie` login/refresh/logout et les paramètres de tri non supportés ont également été corrigés.
- **Vérification :** `npm run build` réussi; 19 suites et 93 tests réussis. L'export Swagger nécessite une base joignable et n'a pas pu être rejoué dans cette session.
- **Première vérification du 2026-10-06 :** `npm run quality:check` avait réussi intégralement avec 21 suites et 101 tests. Le double contrôle ci-dessous prévaut sur cette première conclusion et a rouvert les fermetures insuffisamment démontrées.

## Points solides observés

- Les 89 opérations possèdent un `operationId` et un résumé, et aucun schéma composant n’est vide.
- Les réponses de succès utilisent une enveloppe commune cohérente avec `ResponseInterceptor`.
- Bearer est déclaré sur les routes privées et le token de suivi possède un schéma de sécurité dédié.
- Pagination et limite ont des bornes communes `1..100` et la validation globale interdit les propriétés inconnues.
- Les routes publiques login, refresh, health et bundle n’annoncent pas de Bearer. Le suivi public utilise correctement `registration-token`.
- Les DTO masquent les mots de passe dans les schémas de réponse; l’intercepteur retire aussi plusieurs clés sensibles par défense en profondeur.

## Ordre de correction recommandé

1. **Contrats de sortie critiques :** SW-AUTH-002, SW-ENGINE-001, SW-QUEUE-001, SW-TIER-002, SW-REG-002 et SW-REG-003.
2. **Sécurité et cloisonnement :** SW-SEC-001, SW-PERSON-001, SW-MAP-001 et SW-RBAC-001.
3. **Validation métier :** SW-VAL-001/002/003/004, SW-TIER-001/003 et SW-NAME-001.
4. **Contrat HTTP transverse :** SW-GEN-001, SW-ERR-001/002, SW-AUTH-001, SW-CACHE-001, SW-HTTP-001 et SW-RESP-001.
5. **Qualité et protocoles :** SW-SCHEMA-001/002, SW-FORMAT-001, SW-PAG-001 et SW-RT-001.

## Périmètre et preuves

- `npm run swagger:export` exécuté avec succès le 2026-10-06 contre l’application actuelle.
- Document audité : OpenAPI 3.0.0, **60 chemins**, **89 opérations**, **115 schémas**, deux security schemes (`bearer`, `registration-token`).
- Toutes les opérations, paramètres, bodies, réponses, security requirements et schémas ont été inventoriés.
- Les constats ont été confrontés aux contrôleurs, DTO, services, intercepteurs, filtre d’erreurs, entités et contraintes SQL concernés.
- Cet audit ne corrige pas les points : il fournit un backlog ordonné et des validations attendues pour des corrections à faible coût et vérifiables.

<!-- CHECKPOINT id="ckpt_muvv5ihf_ml4d99" time="2026-10-05T23:10:56.979Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvvidgb_rrzwzb" time="2026-10-05T23:20:56.987Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muvwg7sy_mfjbrd" time="2026-10-05T23:47:15.970Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muw46x9v_gavi50" time="2026-10-06T03:23:59.347Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwbu299_6fz97j" time="2026-10-06T06:57:56.205Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwcanv6_bpqhm7" time="2026-10-06T07:10:50.706Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwcniu4_c5b64n" time="2026-10-06T07:20:50.716Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwd0dt4_d7dzou" time="2026-10-06T07:30:50.728Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwdd8rs_tnoy7r" time="2026-10-06T07:40:50.728Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwdq3vt_70tfge" time="2026-10-06T07:50:50.921Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwe2vvw_ki3y47" time="2026-10-06T08:00:47.084Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwefqut_a0ocps" time="2026-10-06T08:10:47.093Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muweslu0_zil8f7" time="2026-10-06T08:20:47.112Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwf5gsy_aof8r3" time="2026-10-06T08:30:47.122Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwfibs2_xw2ecr" time="2026-10-06T08:40:47.138Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwgxrns_fdkzhp" time="2026-10-06T09:20:47.176Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwhammr_c6r564" time="2026-10-06T09:30:47.187Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_muwhnhmy_qudmm0" time="2026-10-06T09:40:47.242Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
