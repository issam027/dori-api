# Handover — Évolution temporelle, calendriers et reporting de l’API Dori

## 1. Objectif du document

Ce document décrit les améliorations recommandées après audit global de l’API, avec un accent particulier sur les opérations utilisant `businessDate`, les disponibilités de rendez-vous et les rapports.

L’objectif principal est d’éliminer les appels répétitifs « un jour par requête » et de fournir des contrats adaptés aux calendriers mensuels, aux graphiques temporels et aux rapports couvrant une période.

Ce document est une feuille de route. Il ne correspond pas à une implémentation déjà réalisée.

## 2. État actuel observé

### 2.1 Endpoints temporels existants

| Domaine | Endpoint actuel | Limitation principale |
|---|---|---|
| Disponibilités | `GET /api/v1/queues/{queueId}/availability?date=YYYY-MM-DD` | Une seule journée par appel |
| Rapport de file | `GET /api/v1/reports/queues/{queueId}/daily?date=YYYY-MM-DD` | Une seule journée et une seule file par appel |
| Inscriptions | `GET /api/v1/registrations?businessDate=YYYY-MM-DD` | Filtre par date exacte uniquement |
| Notifications | `GET /api/v1/notifications?businessDate=YYYY-MM-DD` | Filtre par date exacte uniquement |

Conséquences :

- un calendrier mensuel nécessite jusqu’à 31 appels ;
- un rapport couvrant 90 jours nécessite 90 appels par file ;
- un rapport multi-files peut produire `nombre de jours × nombre de files` appels ;
- le frontend doit fusionner les réponses, combler les journées absentes et recalculer certaines synthèses ;
- les temps réseau et les risques d’incohérence augmentent.

### 2.2 Fichiers principalement concernés

Disponibilités et inscriptions :

- `src/modules/registrations/registrations.controller.ts`
- `src/modules/registrations/registrations.service.ts`
- `src/modules/registrations/registrations.repository.ts`
- `src/modules/registrations/dto/registration.dto.ts`
- `src/modules/registrations/dto/registration-response.dto.ts`

Rapports :

- `src/modules/reports/reports.controller.ts`
- `src/modules/reports/reports.service.ts`
- `src/modules/reports/reports.repository.ts`
- `src/modules/reports/dto/report-query.dto.ts`
- `src/modules/reports/dto/report-response.dto.ts`
- `src/modules/reports/reports.controller.spec.ts`

Notifications :

- `src/modules/notifications/notifications.controller.ts`
- `src/modules/notifications/notifications.service.ts`
- `src/modules/notifications/notifications.repository.ts`
- `src/modules/notifications/dto/notification.dto.ts`
- `src/modules/notifications/dto/notification-response.dto.ts`

Dates et fuseaux horaires :

- `src/core/clock/clock.service.ts`
- `src/core/validation/domain-validation.decorators.ts`
- `src/core/database/sql/schema.sql`

Documentation :

- décorateurs Swagger des contrôleurs et DTO concernés ;
- `scripts/swagger-export.ts` ;
- `openapi.json` ;
- `openapi.yaml`.

## 3. Principes transversaux à adopter

### 3.1 Contrat de période commun

Créer un DTO partagé, par exemple `DateRangeQueryDto`, placé dans un module transversal tel que :

```text
src/core/dates/date-range.dto.ts
```

Propriétés recommandées :

```text
dateFrom: YYYY-MM-DD, obligatoire
dateTo: YYYY-MM-DD, obligatoire
```

Extensions possibles selon l’endpoint :

```text
granularity: day | week | month
includeEmpty: boolean
timezone: interdit côté client si le fuseau vient obligatoirement du site
```

Règles de validation :

- format strict `YYYY-MM-DD`, et non n’importe quelle chaîne ISO 8601 ;
- `dateFrom <= dateTo` ;
- période maximale explicite ;
- erreurs applicatives documentées ;
- aucune conversion silencieuse dans le fuseau horaire du serveur.
- tout endpoint acceptant actuellement une date unique `date` ou `businessDate`
  doit remplacer ce paramètre par `dateFrom` et `dateTo` ;
- les anciens paramètres de date unique sont supprimés et refusés, sans période
  de compatibilité ;
- pour une seule journée, le client fournit la même valeur dans `dateFrom` et
  `dateTo`.

Limites retenues :

- disponibilités détaillées : 62 jours ;
- disponibilités en résumé : 366 jours ;
- reporting synchrone journalier : 366 jours ;
- filtres d'inscriptions et de notifications : 366 jours ;
- toute plage supérieure à la limite de l'opération est refusée avec une erreur
  HTTP 400.

Implémentation de fondation :

- `src/core/dates/date-range.dto.ts` contient `DateRangeQueryDto`, les limites
  nommées et la validation croisée ;
- `ClockService.dateRangeToUtcBounds` convertit une période calendaire en borne
  de début inclusive et borne de fin exclusive dans le fuseau du site ;
- le calcul ajoute un jour calendaire avant la conversion UTC et non 24 heures
  à un instant, afin de gérer correctement les journées de 23 h ou 25 h ;
- aucun champ `timezone` n'est accepté dans le DTO client : le fuseau provient
  de la configuration du site.

### 3.2 Requêtes SQL ensemblistes

Une période doit être traitée par une seule requête SQL ou par un nombre constant de requêtes. Il ne faut pas appeler en boucle le service journalier côté backend.

Exemple de filtre :

```sql
WHERE queue_id = $1
  AND business_date BETWEEN $2::date AND $3::date
```

Pour les séries journalières incluant les jours vides :

```sql
SELECT day::date AS business_date
FROM generate_series($1::date, $2::date, interval '1 day') AS day
```

Puis effectuer un `LEFT JOIN` avec les agrégats métier.

### 3.3 Calculs agrégés corrects

Une moyenne globale ne doit pas être une moyenne des moyennes journalières.

Exemple incorrect :

```text
(moyenneJour1 + moyenneJour2) / 2
```

Exemple correct :

```text
somme de toutes les durées / nombre total d’éléments concernés
```

Les requêtes de reporting doivent retourner les sommes et dénominateurs nécessaires ou calculer directement les agrégats sur les événements bruts.

## 4. Évolution 1 — Calendrier de disponibilités sur une période

### 4.1 Contrat cible

Remplacer le paramètre unique `date` de l'endpoint existant :

```http
GET /api/v1/queues/{queueId}/availability
    ?dateFrom=2026-11-01
    &dateTo=2026-11-30
    &summaryOnly=false
```

Le paramètre `date` est supprimé. Pour une seule journée, `dateFrom` et
`dateTo` reçoivent la même valeur.

### 4.2 Réponse proposée

```json
{
  "queueId": 10,
  "timezone": "Europe/Paris",
  "dateFrom": "2026-11-01",
  "dateTo": "2026-11-30",
  "days": [
    {
      "businessDate": "2026-11-01",
      "isOpen": true,
      "capacity": 32,
      "booked": 12,
      "available": 20,
      "slots": [
        {
          "time": "2026-11-01T08:00:00+01:00",
          "capacity": 2,
          "booked": 1,
          "available": 1,
          "isAvailable": true
        }
      ]
    },
    {
      "businessDate": "2026-11-02",
      "isOpen": false,
      "reason": "unavailable",
      "capacity": 0,
      "booked": 0,
      "available": 0,
      "slots": []
    }
  ]
}
```

`summaryOnly=true` peut omettre `slots` et retourner seulement les totaux journaliers afin d’afficher rapidement un mois.

### 4.3 Changements techniques ciblés

DTO :

- remplacer `RegistrationAvailabilityQueryDto` par un DTO utilisant `dateFrom` et `dateTo` ;
- ajouter les DTO de réponse `AvailabilityCalendarResponseDto` et `AvailabilityDayDto` ;

Contrôleur :

- mettre à jour le contrat de la route existante et Swagger ;
- conserver les permissions actuelles de l'endpoint ;
- documenter la limite de période.

Service :

- charger une seule fois la configuration de la file et du site ;
- résoudre le fuseau horaire depuis le site ;
- générer les dates de la période ;
- appliquer la configuration existante de la file et du site ;
- associer les réservations agrégées à chaque créneau ;
- ne pas effectuer une requête SQL par jour.

Repository :

- ajouter une méthode `findBookedSlotsBetween(queueId, dateFrom, dateTo)` ;
- grouper par `business_date, scheduled_time` ;
- filtrer uniquement les statuts consommant réellement une capacité : `booked`, `waiting`, `in_progress` et `is_active = TRUE`.

### 4.4 Checkpoints

- [ ] Créer le DTO commun de période avec validation stricte.
- [ ] Supprimer le paramètre `date` du DTO et de Swagger.
- [ ] Fixer la période maximale autorisée.
- [ ] Ajouter la requête SQL agrégée sur la période.
- [ ] Implémenter la réponse détaillée par jour.
- [ ] Implémenter `summaryOnly=true`.
- [ ] Retourner explicitement le fuseau horaire.
- [ ] Inclure les jours sans créneau dans la réponse.
- [ ] Ajouter les tests de changement d’heure été/hiver.
- [ ] Ajouter les tests de mois de 28, 29, 30 et 31 jours.
- [ ] Ajouter les tests de période inversée et trop longue.
- [ ] Mettre à jour Swagger et régénérer OpenAPI.

### 4.5 Critères d’acceptation

- Un mois complet est chargé avec un seul appel HTTP.
- Le backend n’exécute pas une requête de réservation par journée.
- Chaque date demandée apparaît exactement une fois dans la réponse.
- Les capacités et réservations correspondent aux statuts actifs pertinents.
- Les heures sont correctes dans le fuseau du site.
- Une requête d'une journée utilise `dateFrom=dateTo` et retourne un seul jour.
- Le paramètre obsolète `date` est rejeté.

## 5. Évolution 2 — Reporting unifié sur une période

### 5.1 Contrat cible

L'ancien endpoint `/daily` et son paramètre unique `date` sont remplacés par
une seule opération. Exemple pour une file :

```http
GET /api/v1/reports/series
    ?queueIds=10
    &dateFrom=2026-09-01
    &dateTo=2026-09-30
    &granularity=day
    &includeEmpty=true
```

La même opération accepte un site complet :

```http
GET /api/v1/reports/series
    ?siteId=1
    &dateFrom=2026-09-01
    &dateTo=2026-09-30
    &granularity=day
    &includeEmpty=true
    &groupBy=queue
```

Ou une sélection explicite de files :

```http
GET /api/v1/reports/series
    ?queueIds=1,2,3
    &dateFrom=2026-09-01
    &dateTo=2026-09-30
    &granularity=day
    &includeEmpty=true
```

Exactement un filtre de périmètre doit être fourni parmi `queueIds` et
`siteId`. `queueIds` est une chaîne d'identifiants positifs séparés par des
virgules ; une file unique s'écrit `queueIds=10`. Le paramètre `groupBy` est optionnel et peut prendre les valeurs
`site`, `queue`, `tier`, `entryType`, `hour` ou `weekday`.

Valeurs de granularité :

```text
day
week
month
```

### 5.2 Réponse proposée

```json
{
  "scope": {
    "type": "queues",
    "queueIds": [10]
  },
  "timezone": "Europe/Paris",
  "period": {
    "dateFrom": "2026-09-01",
    "dateTo": "2026-09-30",
    "granularity": "day"
  },
  "summary": {
    "volume": {
      "registered": 1400,
      "walkin": 950,
      "appointments": 450,
      "served": 1250,
      "noShow": 80,
      "expired": 20,
      "cancelled": 50
    },
    "timing": {
      "averageWaitMinutes": 17.4,
      "medianWaitMinutes": 13.2,
      "p90WaitMinutes": 35.8,
      "averageServiceMinutes": 8.1,
      "medianServiceMinutes": 7.3,
      "p90ServiceMinutes": 14.6
    },
    "rates": {
      "noShowRate": 0.0602,
      "cancellationRate": 0.0357,
      "expirationRate": 0.0143
    }
  },
  "buckets": [
    {
      "periodStart": "2026-09-01",
      "periodEnd": "2026-09-01",
      "volume": {
        "registered": 52,
        "walkin": 31,
        "appointments": 21,
        "served": 44,
        "noShow": 3,
        "expired": 1,
        "cancelled": 4
      },
      "timing": {
        "averageWaitMinutes": 14.6,
        "medianWaitMinutes": 11.2,
        "p90WaitMinutes": 28.4,
        "averageServiceMinutes": 8.7,
        "medianServiceMinutes": 7.9,
        "p90ServiceMinutes": 16.3
      },
      "rates": {
        "noShowRate": 0.0638,
        "cancellationRate": 0.0769,
        "expirationRate": 0.0192
      }
    }
  ]
}
```

`summary` et chaque bucket utilisent les mêmes objets typés `volume`, `timing`
et `rates`. Le contrat n'utilise pas d'objet `kpis` libre ou extensible sans
définition Swagger.

### 5.3 Requête et calculs

Le repository doit agréger toute la période. Pour `day`, grouper par `business_date`. Pour `week` et `month`, utiliser une logique PostgreSQL explicite et documenter le début de semaine.

La synthèse doit être calculée à partir de toutes les lignes de la période, et non en additionnant ou moyennant naïvement les buckets.

Les jours vides doivent être ajoutés si `includeEmpty=true`.

Les KPI sont limités aux données reproductibles avec le schéma actuel :

- `registered` : nombre de lignes de `dori_registration` dans la période ;
- `walkin` et `appointments` : répartition de `registered` par `entry_type` ;
- `served`, `noShow`, `expired` et `cancelled` : répartition par état final `status` ;
- attente : `called_at - priority_reference_time`, uniquement lorsque `called_at` est renseigné ;
- service : `served_at - called_at`, uniquement lorsque les deux timestamps sont renseignés ;
- médiane et P90 : `PERCENTILE_CONT(0.5)` et `PERCENTILE_CONT(0.9)` sur les mêmes durées que la moyenne ;
- `noShowRate` : `no_show / (served + no_show)` ;
- `cancellationRate` : `cancelled / registered` ;
- `expirationRate` : `expired / registered`.

Un taux dont le dénominateur vaut zéro et une durée sans observation valent
`null`, jamais `0`. Pour un bucket vide, les volumes valent `0`, tandis que les
durées et les taux valent `null`.

Les indicateurs d'attente et de service globaux sont recalculés sur toutes les
inscriptions éligibles de la période. Ils ne sont pas obtenus en moyennant les
valeurs des buckets. Aucun indicateur historique d'état ouvert, de capacité ou
d'occupation n'est exposé, car le schéma actuel ne permet pas de reconstruire
fiablement ces valeurs dans le passé.

Les volumes par statut décrivent l'état final connu au moment de la requête.
Ils sont reproductibles pour un même état de la base, mais un rapport passé
peut évoluer si une inscription change ensuite de statut, de date métier ou de
date planifiée. Le contrat ne doit donc pas présenter ces résultats comme un
instantané historique immuable.

Lorsque `groupBy` est absent, `summary` et `buckets` agrègent tout le périmètre
demandé. Lorsqu'il est fourni, la réponse ajoute une collection `groups` dont
chaque élément contient la valeur de dimension, son propre `summary` et ses
propres `buckets`. Les agrégats globaux restent calculés directement sur les
données brutes et non à partir des groupes.

Pour plusieurs sites, les regroupements calendaires utilisent la
`business_date` déjà calculée dans le fuseau de chaque site. Tout groupe de site
ou de file expose son propre fuseau horaire ; la réponse ne doit pas annoncer
un fuseau global unique si plusieurs fuseaux sont présents.

### 5.4 Sécurité du périmètre

Le périmètre est résolu via `ScopeService` :

- `checkSiteAccess` pour `siteId` ;
- vérification de chaque identifiant fourni dans `queueIds` ;
- intersection systématique avec les sites et files autorisés du compte ;
- aucune confiance accordée aux identifiants fournis par le client.

### 5.5 Fichiers concernés

- `src/modules/reports/reports.controller.ts`
- `src/modules/reports/reports.service.ts`
- `src/modules/reports/reports.repository.ts`
- `src/modules/reports/dto/report-query.dto.ts`
- `src/modules/reports/dto/report-response.dto.ts`
- nouveaux tests de repository et de service ;
- `src/core/database/sql/schema.sql` si un index supplémentaire est nécessaire.

### 5.6 Checkpoints

- [ ] Créer un DTO unique `ReportSeriesQueryDto`.
- [ ] Créer les DTO de synthèse, période et buckets.
- [ ] Ajouter l’endpoint `/series`.
- [x] Ajouter `queueIds` et `siteId` avec validation d'exclusivité.
- [ ] Ajouter les dimensions réellement nécessaires au frontend.
- [ ] Réutiliser `ScopeService` pour limiter toutes les données agrégées.
- [ ] Supprimer l'endpoint `/daily` et son paramètre `date`.
- [ ] Implémenter l’agrégation journalière en une requête.
- [ ] Implémenter `includeEmpty` avec `generate_series`.
- [ ] Ajouter la granularité hebdomadaire.
- [ ] Ajouter la granularité mensuelle.
- [ ] Calculer moyennes, médianes et P90 sur les durées brutes éligibles.
- [ ] Implémenter les trois taux avec leurs dénominateurs documentés.
- [ ] Retourner `null` lorsque la durée ou le taux n'est pas calculable.
- [ ] Ajouter une limite de période.
- [ ] Tester une période sans activité.
- [ ] Tester une période partiellement vide.
- [ ] Tester les statuts servis, no-show, expirés et annulés.
- [ ] Tester moyenne, médiane et P90 sur un jeu de durées connu.
- [ ] Vérifier que les KPI globaux ne sont pas des moyennes de buckets.
- [ ] Tester un utilisateur global, un manager de site et un opérateur limité à certaines files.
- [ ] Vérifier qu'aucune donnée hors périmètre ne fuite.
- [ ] Mettre à jour Swagger et OpenAPI.

### 5.7 Critères d’acceptation

- Un rapport mensuel est obtenu avec un seul appel.
- La requête SQL ne dépend pas du nombre de jours.
- Les journées vides sont présentes si demandé.
- La somme des buckets correspond aux volumes de synthèse.
- Les moyennes globales restent pondérées correctement.
- Une journée reste interrogeable avec `dateFrom=dateTo`.
- Une file, une sélection de files ou un site utilisent la même opération.
- Un rapport de site ne nécessite pas un appel par file.
- L'ancien endpoint `/daily` n'est pas conservé.

## 6. Évolution 3 — Filtre des inscriptions par date planifiée

### 6.1 État actuel

`RegistrationFilterDto` accepte actuellement :

```text
businessDate
```

### 6.2 Contrat cible

Remplacer `businessDate` par les deux paramètres suivants :

```text
dateFrom: YYYY-MM-DD
dateTo: YYYY-MM-DD
```

Exemple complet pour alimenter les « post-it » d'un calendrier de rendez-vous :

```http
GET /api/v1/registrations
    ?page=1
    &pageSize=25
    &queueId=1
    &siteId=1
    &dateFrom=2026-10-01
    &dateTo=2026-10-31
    &entryType=appointment
```

Les filtres existants restent disponibles. `queueId` et `siteId` peuvent être
utilisés séparément ou ensemble ; lorsqu'ils sont combinés, la file doit
appartenir au site demandé. `status`, `appointmentStatus`, `personId` et
`tierId` restent combinables avec la période selon une logique `AND`.

Ces paramètres filtrent exclusivement la date planifiée de l'inscription,
c'est-à-dire la colonne `scheduled_time`. Ils ne filtrent pas
`business_date` ni `created_at`.

Règles :

- `dateFrom` et `dateTo` doivent toujours être fournis ensemble ;
- `dateFrom <= dateTo` ;
- une période requiert au moins `queueId` ou `siteId` afin de déterminer le fuseau horaire ;
- les dates sont interprétées dans le fuseau horaire du site de la file ;
- les deux journées sont incluses dans la période ;
- pour filtrer une seule journée, fournir la même valeur dans `dateFrom` et `dateTo` ;
- lorsqu'une période est fournie, les inscriptions sans `scheduled_time` sont exclues ;
- l'ancien paramètre `businessDate` est supprimé, sans interface de compatibilité ;
- aucun paramètre `businessDateFrom`, `businessDateTo`, `scheduledFrom` ou `scheduledTo` n'est introduit.

### 6.3 Données nécessaires au calendrier

La réponse paginée existante doit permettre au frontend de construire chaque
post-it sans appel supplémentaire. Chaque inscription retournée doit donc
documenter au minimum :

```text
registrationId
personId
firstName
lastName
queueId
queueName
tierId
tierName
scheduledTime
status
appointmentStatus
```

`scheduledTime` reste un instant ISO 8601. Le frontend le présente dans le
fuseau horaire du site. `firstName` et `lastName` proviennent de la jointure
existante avec `dori_person` et doivent être ajoutés explicitement au DTO de
réponse Swagger s'ils ne sont pas encore déclarés.

La pagination reste active. Le calendrier doit suivre `total`, `page` et
`pageSize` et charger les pages restantes afin de ne pas masquer des
rendez-vous lorsque la période contient plus de résultats que `pageSize`.

### 6.4 Repository

Étendre `RegistrationsRepository.findPage` avec des bornes temporelles calculées
par le service dans le fuseau horaire du site :

```sql
r.scheduled_time >= $dateFromStart::timestamptz
r.scheduled_time < $dayAfterDateToStart::timestamptz
```

La borne supérieure exclusive correspond au début du jour suivant `dateTo`.
Cette forme rend toute la journée `dateTo` inclusive sans dépendre de la
précision stockée dans `scheduled_time`.

### 6.5 Checkpoints

- [ ] Remplacer `businessDate` par `dateFrom` et `dateTo` dans le DTO.
- [ ] Ajouter la validation du format, de la paire obligatoire et de l'ordre des dates.
- [ ] Exiger `queueId` ou `siteId` lorsqu'une période est fournie.
- [ ] Convertir les bornes locales en instants selon le fuseau horaire du site.
- [ ] Ajouter les filtres SQL paramétrés sur `scheduled_time`.
- [ ] Conserver la combinaison des filtres existants avec une logique `AND`.
- [ ] Documenter `firstName`, `lastName`, `queueName` et `tierName` dans le DTO de réponse.
- [ ] Vérifier la pagination sur une période longue.
- [ ] Tester l'inclusion complète de `dateFrom` et `dateTo`.
- [ ] Tester une période réduite à une seule journée.
- [ ] Tester l'exclusion des inscriptions sans `scheduled_time`.
- [ ] Tester `queueId` seul, `siteId` seul et les deux filtres combinés.
- [ ] Tester plusieurs pages de rendez-vous sur une même période.
- [ ] Vérifier que `businessDate` est refusé par la validation des query params.
- [ ] Mettre à jour Swagger.

## 7. Évolution 4 — Recherche des notifications

### 7.1 État actuel

`NotificationFilterDto` accepte actuellement `businessDate` en plus des filtres
de statut, canal et inscription. Il ne permet pas de cibler directement une
file ou un site.

### 7.2 Contrat cible

Remplacer `businessDate` et ajouter les filtres suivants :

```text
dateFrom: YYYY-MM-DD
dateTo: YYYY-MM-DD
queueId: entier positif, optionnel
siteId: entier positif, optionnel
```

`dateFrom` et `dateTo` filtrent la date métier de l'inscription associée à la
notification. Ils doivent être fournis ensemble, respecter `dateFrom <= dateTo`
et leurs bornes sont inclusives. Pour une seule journée, les deux valeurs sont
identiques. L'ancien paramètre `businessDate` n'est pas conservé.

`queueId` et `siteId` peuvent être utilisés séparément ou ensemble. Lorsqu'ils
sont tous les deux présents, les deux conditions s'appliquent : la file doit
appartenir au site demandé. Ces filtres s'ajoutent aux filtres existants
`registrationId`, `channel` et `status`.

Le périmètre RBAC reste prioritaire : un filtre demandé par le client ne doit
jamais permettre d'accéder à une file ou à un site hors de son périmètre.

### 7.3 Fichiers concernés

- `src/modules/notifications/dto/notification.dto.ts`
- `src/modules/notifications/notifications.repository.ts`
- `src/modules/notifications/notifications.service.ts`
- tests du module notifications.

### 7.4 Checkpoints

- [ ] Remplacer `businessDate` par `dateFrom` et `dateTo`.
- [ ] Valider le format, la paire obligatoire et l'ordre des dates.
- [ ] Ajouter `queueId` et `siteId` au DTO et à Swagger.
- [ ] Appliquer les filtres `queueId` et `siteId` dans le repository avec une logique `AND`.
- [ ] Appliquer systématiquement le périmètre des files autorisées.
- [ ] Ajouter les index nécessaires après mesure avec `EXPLAIN ANALYZE`.
- [ ] Tester `queueId` seul, `siteId` seul et les deux filtres combinés.
- [ ] Tester le rejet d'une file n'appartenant pas au site demandé.
- [ ] Tester une journée avec `dateFrom=dateTo` et une période de plusieurs jours.
- [ ] Vérifier que `businessDate` est refusé.
- [ ] Mettre à jour Swagger.

## 8. Évolution 5 — Accès et réactivation des ressources désactivées

### 8.1 Contrat commun

Les opérations de liste ou de recherche concernées doivent accepter le query
parameter suivant :

```text
isActive: boolean, optionnel, true par défaut
```

Sémantique :

- `isActive=true` cible uniquement les ressources actives ;
- `isActive=false` cible uniquement les ressources désactivées ;
- l'absence du paramètre conserve le comportement actuel et cible uniquement
  les ressources actives ;
- sur une collection ou une recherche, le paramètre filtre les éléments retournés ;
- aucune opération ciblée par identifiant ne prend `isActive` en query parameter ;
- un `GET` ou un `PATCH` par identifiant retrouve la ressource qu'elle soit
  active ou désactivée ;
- le body d'un `PATCH` peut contenir `isActive: true` pour réactiver la ressource ;
- `isActive` doit être transformé et validé comme un booléen strict ; les
  chaînes autres que `true` et `false` sont refusées.

Les repositories de liste appliquent la valeur de `isActive`. Les méthodes de
lecture et de modification par identifiant doivent cesser d'imposer
`is_active = TRUE` et retrouver aussi les lignes désactivées par soft delete,
même si `deleted_at` est renseigné. Cela ne concerne pas une ressource
physiquement supprimée.

### 8.2 Opérations concernées

Sites :

```http
GET   /api/v1/sites?isActive=false
GET   /api/v1/sites/{siteId}
PATCH /api/v1/sites/{siteId}
```

Files :

```http
GET   /api/v1/queues?isActive=false
GET   /api/v1/queues/{queueId}
PATCH /api/v1/queues/{queueId}
```

Inscriptions :

```http
GET   /api/v1/registrations?isActive=false
GET   /api/v1/registrations/{registrationId}
PATCH /api/v1/registrations/{registrationId}
```

Personnes et notes :

```http
GET   /api/v1/persons?isActive=false
GET   /api/v1/persons/{personId}
PATCH /api/v1/persons/{personId}
GET   /api/v1/persons/{personId}/notes?isActive=false
PATCH /api/v1/persons/{personId}/notes/{noteId}
```

Utilisateurs :

```http
GET   /api/v1/users?isActive=false
GET   /api/v1/users/{userId}
PATCH /api/v1/users/{userId}
```

Traductions :

```http
GET   /api/v1/translations/bundle?isActive=false
GET   /api/v1/translations?isActive=false
PATCH /api/v1/translations/{translationId}
```

Sur les listes et recherches, les filtres existants, la pagination, le tri et
le périmètre RBAC restent applicables et se combinent avec `isActive` selon une
logique `AND`. Sur les opérations par identifiant, seul l'identifiant cible la
ressource ; son état actif ne conditionne pas sa visibilité.

### 8.3 Mise à jour et réactivation

Les DTO de mise à jour des sites, files, inscriptions, personnes, notes,
utilisateurs et traductions doivent accepter `isActive` dans le body lorsque ce
champ n'existe pas encore.

Lors d'une réactivation (`isActive: true`) :

- remettre `deleted_at` à `NULL` pour la ressource ciblée ;
- mettre à jour les colonnes d'audit et l'auteur de la modification ;
- vérifier les contraintes métier et l'accès RBAC avant la modification ;
- ne pas réactiver automatiquement les ressources enfants ou parentes ;
- retourner la ressource avec son nouvel état actif.

Lors d'une désactivation (`isActive: false`), conserver les règles métier de
désactivation existantes et renseigner `deleted_at` lorsque le module utilise
le soft delete. La désactivation d'un site, par `DELETE` ou par `PATCH`,
désactive toutes ses files actives dans la même transaction. La réactivation
du site ne réactive jamais automatiquement ces files : elles doivent être
réactivées explicitement afin de préserver les désactivations antérieures.

### 8.4 Sécurité et cas particuliers

- La lecture d'une ressource désactivée ne contourne jamais `ScopeService`.
- Une file désactivée reste soumise au contrôle d'accès de son site.
- Une personne, une note ou une inscription désactivée reste limitée à son
  site ou à sa file d'origine.
- Un utilisateur ne peut pas réactiver un compte au-delà de son niveau de
  permissions.
- Le bundle de traductions respecte toujours `locale` et `category` ;
  `isActive=false` retourne uniquement les traductions désactivées demandées.
- Une ressource désactivée doit exposer `isActive` et, lorsque le DTO le permet,
  `deletedAt` afin que le client comprenne son état.

### 8.5 Swagger et tests

Pour chaque opération listée :

- déclarer `isActive` uniquement sur les listes et recherches avec
  `ApiPropertyOptional` ou le décorateur de query Swagger approprié, type
  booléen, défaut `true` et exemples `true`/`false` ;
- ne pas exposer `isActive` comme query parameter sur les routes par identifiant ;
- documenter le comportement sur les ressources désactivées ;
- ajouter `isActive` aux DTO de réponse si le champ n'est pas encore exposé ;
- régénérer `openapi.json` et `openapi.yaml` ;
- vérifier que chaque paramètre apparaît une seule fois dans OpenAPI.

Tests attendus :

- valeur absente : seules les ressources actives sont visibles ;
- `isActive=true` : seules les ressources actives sont visibles ;
- `isActive=false` : seules les ressources désactivées sont visibles ;
- lecture par identifiant d'une ressource active et d'une ressource désactivée,
  sans query parameter supplémentaire ;
- modification puis réactivation d'une ressource désactivée directement par son identifiant ;
- remise à `NULL` de `deleted_at` lors de la réactivation ;
- refus des valeurs booléennes invalides ;
- respect du RBAC pour les ressources actives et désactivées ;
- pagination et comptage cohérents sur les collections filtrées ;
- bundle de traductions actives et désactivées.

## 9. Évolution 6 — Retour du tracking token à la création d'une inscription

`POST /api/v1/registrations` ne doit plus construire ni retourner
`trackingUrl`. La réponse retourne directement le token stocké sur
`dori_registration` :

```json
{
  "registrationId": 101,
  "ticketNumber": "A-012",
  "registrationTrackingToken": "550e8400-e29b-41d4-a716-446655440000",
  "registrationTrackingTokenValidUntil": "2026-10-01T21:59:59.999Z"
}
```

Règles :

- supprimer `trackingUrl` du DTO de réponse, du service et de Swagger ;
- exposer `registrationTrackingToken` au format UUID ;
- conserver `registrationTrackingTokenValidUntil` ;
- retourner systématiquement `registrationTrackingToken` et sa date
  d'expiration, indépendamment du forfait et de ses règles de notification ;
- ne jamais reconstruire une URL dans l'API ; le client décide de la route à
  utiliser avec le token ;
- ne pas journaliser le token en clair.

Checkpoints :

- [x] Remplacer `trackingUrl` dans `CreateRegistrationResponseDto`.
- [x] Retourner le token créé par la transaction sans transformation.
- [x] Mettre à jour les tests du service et du contrôleur.
- [x] Régénérer et vérifier `openapi.json` et `openapi.yaml`.
- [x] Vérifier que `trackingUrl` n'apparaît plus dans le contrat OpenAPI.

## 10. Indexation et performance

### 10.1 Index existants utiles

Le schéma contient notamment :

- unicité `(queue_id, business_date, ticket_number)` ;
- index partiel `(queue_id, business_date, status) WHERE is_active` ;
- index sur `scheduled_time` pour les rendez-vous ;
- index sur `appointment_status, scheduled_time` ;
- index sur `person_id`.

### 10.2 Points à mesurer

Les rapports historiques incluent des inscriptions inactives ou clôturées. L’index partiel limité à `is_active` ne couvre donc pas tous les rapports historiques.

Avant d’ajouter un index, utiliser `EXPLAIN (ANALYZE, BUFFERS)` sur des volumes représentatifs.

Index candidats selon les requêtes finales :

```sql
(queue_id, business_date)
(business_date, queue_id)
(queue_id, business_date, entry_type, status)
(queue_id, scheduled_time) WHERE entry_type = 'appointment'
```

Le choix entre `(queue_id, business_date)` et `(business_date, queue_id)` dépend des rapports dominants : par file ou globaux par période.

### Checkpoints

- [ ] Préparer un jeu de données volumineux représentatif.
- [ ] Mesurer les requêtes avant modification.
- [ ] Ajouter seulement les index justifiés.
- [ ] Mesurer les impacts sur les écritures.
- [ ] Vérifier les plans pour une journée, un mois et une année.
- [ ] Documenter les résultats de mesure.

## 11. KPI retenus dans ce handover

Le reporting de la section 5 expose uniquement les indicateurs suivants :

- volumes `registered`, `walkin`, `appointments`, `served`, `noShow`,
  `expired` et `cancelled` ;
- temps moyen, médian et P90 d'attente ;
- temps moyen, médian et P90 de service ;
- taux de no-show, d'annulation et d'expiration.

Leurs sources, filtres, dénominateurs et règles de valeur `null` sont définis en
section 5. Aucun autre KPI ne fait partie du périmètre de ce handover.

## 12. Tests attendus

### 12.1 Tests DTO

- format strict des dates ;
- plage inversée ;
- plage trop longue ;
- granularité invalide ;
- filtres incompatibles ;
- listes trop longues ;
- valeurs par défaut.

### 12.2 Tests services

- contrôle RBAC et périmètre ;
- période vide ;
- période partiellement vide ;
- agrégats et synthèse ;
- gestion du fuseau horaire ;
- rejet des anciens paramètres `date` et `businessDate`.

### 12.3 Tests repositories

- bornes inclusives de `business_date` ;
- groupement journalier, hebdomadaire et mensuel ;
- jours vides ;
- statuts actifs et historiques ;
- calcul pondéré des moyennes ;
- requêtes paramétrées.

### 12.4 Tests E2E

- calendrier d’un mois en un appel ;
- rapport d’un mois en un appel ;
- rapport multi-files limité par scope ;
- Swagger conforme ;
- temps de réponse sur volumétrie cible.

## 13. Swagger et qualité documentaire

Pour chaque évolution :

- documenter précisément les bornes inclusives/exclusives ;
- préciser le fuseau horaire utilisé ;
- donner un exemple de période ;
- documenter la limite maximale ;
- décrire les jours sans données ;
- exposer les enums de granularité et groupement ;
- ajouter les réponses d’erreur ;
- régénérer `openapi.json` et `openapi.yaml` ;
- vérifier que les anciens paramètres de date unique ne sont plus exposés.

Commandes de validation attendues :

```text
npm run typecheck
npm run lint
npm run build:check
npm test -- --runInBand --coverage=false
npm run swagger:export
git diff --check
```

## 14. Ordre d’implémentation recommandé

### Phase 1 — Fondation temporelle

- [x] Créer le DTO commun de période.
- [x] Ajouter les validations croisées.
- [x] Fixer les limites de plage.
- [x] Normaliser les règles de fuseau horaire.

### Phase 2 — Réduction immédiate des appels

- [x] Ajouter le calendrier de disponibilités sur une période.
- [x] Ajouter le reporting unifié par file, sélection de files ou site.
- [x] Ajouter les plages aux inscriptions.
- [x] Ajouter les plages aux notifications.

### Phase 3 — Ressources désactivées et tracking

- [x] Ajouter le filtre `isActive` aux opérations listées.
- [x] Permettre la lecture, la modification et la réactivation des ressources désactivées.
- [x] Remplacer `trackingUrl` par `registrationTrackingToken` à la création d'une inscription.
- [x] Mettre à jour et régénérer Swagger.

### Phase 4 — Validation et performance

- [ ] Mesurer et optimiser les index.

## 15. Définition globale de terminé

L’évolution peut être considérée terminée lorsque :

- un calendrier mensuel nécessite un seul appel ;
- un rapport couvrant une période nécessite un seul appel ;
- un rapport de site ne nécessite pas un appel par file ;
- toutes les dates métier utilisent le fuseau du site ;
- les jours vides sont gérés explicitement ;
- les agrégats globaux sont mathématiquement corrects ;
- les permissions limitent toutes les agrégations au périmètre autorisé ;
- les requêtes ont été mesurées sur une volumétrie représentative ;
- Swagger décrit les nouveaux contrats sans ambiguïté ;
- les anciens contrats à date unique ont été retirés de l'API et de Swagger ;
- toutes les opérations listées peuvent cibler explicitement les ressources actives ou désactivées ;
- les ressources désactivées restent protégées par le même périmètre RBAC ;
- `POST /registrations` retourne le tracking token et n'expose plus `trackingUrl` ;
- typecheck, lint, build et tests sont verts.

## 16. Résumé des priorités

Priorité immédiate :

1. plage de dates pour les disponibilités ;
2. reporting temporel unifié avec buckets et synthèse ;
3. plages de dates pour inscriptions et notifications.

Priorité fonctionnelle suivante :

4. accès et réactivation des ressources désactivées ;
5. retour du tracking token à la création d'une inscription.

Priorité de validation :

6. mise à jour complète de Swagger, tests et optimisation mesurée des index.

<!-- CHECKPOINT id="ckpt_mv7u0bsu_skgz1x" time="2026-10-14T08:12:09.534Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7ud6re_lpufil" time="2026-10-14T08:22:09.530Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7uq1o9_oe2r05" time="2026-10-14T08:32:09.465Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7v2wl8_otnpwn" time="2026-10-14T08:42:09.404Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7vfri6_hy5o06" time="2026-10-14T08:52:09.342Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7vsmfw_bdcoyi" time="2026-10-14T09:02:09.308Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7w5hdn_vi46uv" time="2026-10-14T09:12:09.275Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7wicbr_ebrhqn" time="2026-10-14T09:22:09.255Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7wv79v_s72i5g" time="2026-10-14T09:32:09.235Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7xkx6j_0w7r25" time="2026-10-14T09:52:09.211Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7xxs58_sjcrg2" time="2026-10-14T10:02:09.212Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7yan3u_7pb260" time="2026-10-14T10:12:09.210Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7yni28_mxgzsx" time="2026-10-14T10:22:09.200Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7z0d0x_b6d0f6" time="2026-10-14T10:32:09.201Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7zd801_rxhhn1" time="2026-10-14T10:42:09.217Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv7zzo9r_jwabgr" time="2026-10-14T10:59:36.735Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv831bj2_k382h8" time="2026-10-14T12:24:52.382Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv83gkl6_n2vz7t" time="2026-10-14T12:36:43.962Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv83tfk9_z8cwm5" time="2026-10-14T12:46:43.977Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv846ajg_nyfm4c" time="2026-10-14T12:56:43.996Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv84j5i9_x137lq" time="2026-10-14T13:06:44.001Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv84w0h5_hnxz6e" time="2026-10-14T13:16:44.009Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv858vfx_0p3fvz" time="2026-10-14T13:26:44.013Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv85lqep_si4coe" time="2026-10-14T13:36:44.017Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv85yldk_8gqwsx" time="2026-10-14T13:46:44.024Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv86bgcm_uw93pi" time="2026-10-14T13:56:44.038Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv86obbf_e3jyal" time="2026-10-14T14:06:44.043Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8716a4_pib447" time="2026-10-14T14:16:44.044Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv87e18o_jrqigk" time="2026-10-14T14:26:44.040Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv87qw82_ibbhr0" time="2026-10-14T14:36:44.066Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv883r6y_okmbor" time="2026-10-14T14:46:44.074Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv88gm62_6huxsq" time="2026-10-14T14:56:44.090Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv88th4n_2j9qhd" time="2026-10-14T15:06:44.087Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv896c3i_e029mq" time="2026-10-14T15:16:44.094Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv89n7zf_c0wrwa" time="2026-10-14T15:29:51.915Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8a02yh_2iwsq5" time="2026-10-14T15:39:51.929Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8acxxa_sg8i8v" time="2026-10-14T15:49:51.934Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8apsw7_8e67bk" time="2026-10-14T15:59:51.943Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8b2nuw_c45x9c" time="2026-10-14T16:09:51.944Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8bfitx_ds66aq" time="2026-10-14T16:19:51.957Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8djigu_eriu47" time="2026-10-14T17:18:57.342Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8dwdfy_qcgdog" time="2026-10-14T17:28:57.358Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8e98er_xhymnj" time="2026-10-14T17:38:57.363Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8em3es_p0hpd5" time="2026-10-14T17:48:57.412Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8msbhj_f2iurn" time="2026-10-14T21:37:44.743Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8n56g4_aii2na" time="2026-10-14T21:47:44.740Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8ni1ey_s6x8gm" time="2026-10-14T21:57:44.746Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8nuwdv_9wwjl9" time="2026-10-14T22:07:44.755Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8o7rcm_kzqw69" time="2026-10-14T22:17:44.758Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8okmb9_71tjwz" time="2026-10-14T22:27:44.757Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8oxhab_d77u1b" time="2026-10-14T22:37:44.771Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8pilqr_5ib9g4" time="2026-10-14T22:54:10.323Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8s4zlf_blk9ah" time="2026-10-15T00:07:33.939Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv8z03k3_gtnrw8" time="2026-10-15T03:19:43.107Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv96oqc7_oj24pg" time="2026-10-15T06:54:49.687Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv971l89_ptrdqq" time="2026-10-15T07:04:49.593Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv97eg75_qtc55c" time="2026-10-15T07:14:49.601Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mv97rb65_hunbcq" time="2026-10-15T07:24:49.613Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
