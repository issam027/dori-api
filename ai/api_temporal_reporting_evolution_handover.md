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
| Dashboard | `GET /api/v1/reports/dashboard/summary` | Vue instantanée, sans période configurable |
| Charge des files | `GET /api/v1/reports/dashboard/queue-load` | Vue instantanée, sans historique |

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

Créer un DTO partagé, par exemple `BusinessDateRangeQueryDto`, placé dans un module transversal tel que :

```text
src/core/dates/business-date-range.dto.ts
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

Limites suggérées :

- disponibilités détaillées : 31 ou 62 jours ;
- disponibilités en résumé : 366 jours ;
- reporting synchrone journalier : 366 jours ;
- au-delà : export asynchrone.

### 3.2 Compatibilité ascendante

Deux stratégies possibles :

1. Conserver `date` et ajouter `dateFrom` / `dateTo` au même endpoint.
2. Conserver l’endpoint journalier et créer un endpoint distinct de période.

Recommandation : conserver les endpoints existants et ajouter des endpoints explicites de période. Cela évite les contrats ambigus et réduit le risque de régression.

### 3.3 Requêtes SQL ensemblistes

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

### 3.4 Calculs agrégés corrects

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

### 4.1 Contrat proposé

Nouvel endpoint recommandé :

```http
GET /api/v1/queues/{queueId}/availability/calendar
    ?dateFrom=2026-11-01
    &dateTo=2026-11-30
    &summaryOnly=false
```

Alternative acceptable : faire évoluer `/availability` pour accepter soit `date`, soit `dateFrom` et `dateTo`, avec validation d’exclusivité.

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
      "reason": "weekly_closure",
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

- ajouter `RegistrationAvailabilityRangeQueryDto` ;
- ajouter les DTO de réponse `AvailabilityCalendarResponseDto` et `AvailabilityDayDto` ;
- conserver `RegistrationAvailabilityQueryDto` pour l’endpoint journalier.

Contrôleur :

- ajouter la route et le contrat Swagger ;
- utiliser les mêmes permissions que l’endpoint journalier ;
- documenter la limite de période.

Service :

- charger une seule fois la configuration de la file et du site ;
- résoudre le fuseau horaire depuis le site ;
- générer les dates de la période ;
- appliquer les règles d’ouverture et les exceptions ;
- associer les réservations agrégées à chaque créneau ;
- ne pas effectuer une requête SQL par jour.

Repository :

- ajouter une méthode `findBookedSlotsBetween(queueId, dateFrom, dateTo)` ;
- grouper par `business_date, scheduled_time` ;
- filtrer uniquement les statuts consommant réellement une capacité : `booked`, `waiting`, `in_progress` et `is_active = TRUE`.

### 4.4 Checkpoints

- [ ] Décider si l’évolution utilise une nouvelle route ou étend `/availability`.
- [ ] Créer le DTO commun de période avec validation stricte.
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
- Le comportement de l’endpoint journalier existant reste inchangé.

## 5. Évolution 2 — Horaires hebdomadaires et exceptions de calendrier

### 5.1 Limitation actuelle

La configuration contient principalement un horaire journalier général : début, fin, pause, durée et capacité des créneaux. Elle ne permet pas correctement de représenter :

- des horaires différents selon le jour de la semaine ;
- les week-ends fermés ;
- les jours fériés ;
- une fermeture exceptionnelle ;
- une ouverture exceptionnelle ;
- une capacité exceptionnelle pour une date ou un créneau.

### 5.2 Modèle recommandé

Table hebdomadaire :

```text
dori_queue_schedule
  schedule_id
  queue_id
  weekday                    1..7
  is_open
  opening_time
  closing_time
  break_start
  break_end
  slot_duration
  slot_capacity
  is_active
  audit columns
```

Table d’exception :

```text
dori_queue_schedule_exception
  exception_id
  queue_id
  business_date
  is_open
  opening_time nullable
  closing_time nullable
  break_start nullable
  break_end nullable
  slot_duration nullable
  slot_capacity nullable
  reason nullable
  audit columns
```

Ordre de résolution recommandé :

```text
exception de date
→ horaire hebdomadaire
→ configuration de la file
→ configuration par défaut du site
```

### 5.3 Services et fichiers concernés

- `src/modules/queues/queues.controller.ts`
- `src/modules/queues/queues.service.ts`
- `src/modules/queues/queues.repository.ts`
- nouveaux DTO dans `src/modules/queues/dto/`
- nouvelles entités dans `src/modules/queues/entities/`
- `src/core/database/sql/schema.sql`
- service de disponibilité des inscriptions.

### 5.4 Checkpoints

- [ ] Valider le modèle hebdomadaire avec le métier.
- [ ] Définir la convention ISO du jour de semaine.
- [ ] Ajouter les tables et index.
- [ ] Ajouter les endpoints CRUD des horaires hebdomadaires.
- [ ] Ajouter les endpoints CRUD des exceptions.
- [ ] Centraliser la résolution d’un horaire effectif.
- [ ] Brancher la disponibilité journalière sur ce résolveur.
- [ ] Brancher le calendrier mensuel sur ce résolveur.
- [ ] Empêcher une réservation sur une date fermée.
- [ ] Empêcher une réservation hors des heures effectives.
- [ ] Tester jours fériés, week-ends et changements de capacité.
- [ ] Documenter les règles de priorité dans Swagger.

## 6. Évolution 3 — Reporting sur une période

### 6.1 Contrat proposé

Nouvel endpoint :

```http
GET /api/v1/reports/queues/{queueId}/series
    ?dateFrom=2026-09-01
    &dateTo=2026-09-30
    &granularity=day
    &includeEmpty=true
```

Valeurs de granularité :

```text
day
week
month
```

### 6.2 Réponse proposée

```json
{
  "queueId": 10,
  "queueCode": "H000B",
  "queueName": "Accueil B",
  "siteName": "Site principal",
  "timezone": "Europe/Paris",
  "period": {
    "dateFrom": "2026-09-01",
    "dateTo": "2026-09-30",
    "granularity": "day"
  },
  "summary": {
    "totalRegistered": 1400,
    "totalWalkin": 950,
    "totalAppointment": 450,
    "totalServed": 1250,
    "totalNoShow": 80,
    "totalExpired": 20,
    "totalCancelled": 50,
    "totalOpen": 0,
    "noShowRate": 0.06,
    "averageWaitMinutes": 17.4,
    "averageServiceMinutes": 8.1
  },
  "buckets": [
    {
      "periodStart": "2026-09-01",
      "periodEnd": "2026-09-01",
      "volume": {},
      "kpis": {}
    }
  ]
}
```

### 6.3 Requête et calculs

Le repository doit agréger toute la période. Pour `day`, grouper par `business_date`. Pour `week` et `month`, utiliser une logique PostgreSQL explicite et documenter le début de semaine.

La synthèse doit être calculée à partir de toutes les lignes de la période, et non en additionnant ou moyennant naïvement les buckets.

Les jours vides doivent être ajoutés si `includeEmpty=true`.

### 6.4 Fichiers concernés

- `src/modules/reports/reports.controller.ts`
- `src/modules/reports/reports.service.ts`
- `src/modules/reports/reports.repository.ts`
- `src/modules/reports/dto/report-query.dto.ts`
- `src/modules/reports/dto/report-response.dto.ts`
- nouveaux tests de repository et de service ;
- `src/core/database/sql/schema.sql` si un index supplémentaire est nécessaire.

### 6.5 Checkpoints

- [ ] Créer `QueueReportSeriesQueryDto`.
- [ ] Créer les DTO de synthèse, période et buckets.
- [ ] Ajouter l’endpoint `/series`.
- [ ] Implémenter l’agrégation journalière en une requête.
- [ ] Implémenter `includeEmpty` avec `generate_series`.
- [ ] Ajouter la granularité hebdomadaire.
- [ ] Ajouter la granularité mensuelle.
- [ ] Calculer les moyennes globales sur les événements bruts.
- [ ] Définir précisément `totalOpen`.
- [ ] Ajouter une limite de période.
- [ ] Tester une période sans activité.
- [ ] Tester une période partiellement vide.
- [ ] Tester les statuts servis, no-show, expirés et annulés.
- [ ] Mettre à jour Swagger et OpenAPI.

### 6.6 Critères d’acceptation

- Un rapport mensuel est obtenu avec un seul appel.
- La requête SQL ne dépend pas du nombre de jours.
- Les journées vides sont présentes si demandé.
- La somme des buckets correspond aux volumes de synthèse.
- Les moyennes globales restent pondérées correctement.
- L’ancien endpoint `/daily` reste compatible.

## 7. Évolution 4 — Reporting multi-files et multi-sites

### 7.1 Besoin

Un rapport de site ne doit pas nécessiter un appel par file et par jour.

Contrat possible :

```http
GET /api/v1/reports/series
    ?siteId=1
    &dateFrom=2026-09-01
    &dateTo=2026-09-30
    &groupBy=queue
```

Ou :

```http
GET /api/v1/reports/series
    ?queueIds=1,2,3
    &dateFrom=2026-09-01
    &dateTo=2026-09-30
```

Dimensions utiles :

```text
site
queue
tier
entryType
hour
weekday
```

### 7.2 Sécurité

Le périmètre doit être résolu via `ScopeService` :

- `checkSiteAccess` pour un site explicite ;
- vérification de chaque file explicite ;
- restriction automatique aux `siteIds` ou `queueIds` du compte ;
- aucune confiance accordée à une liste d’identifiants fournie par le client.

### 7.3 Checkpoints

- [ ] Définir les dimensions réellement nécessaires au frontend.
- [ ] Ajouter `siteId` et/ou `queueIds` au contrat.
- [ ] Ajouter la validation d’exclusivité des filtres de périmètre.
- [ ] Réutiliser `ScopeService` pour limiter les données.
- [ ] Grouper côté SQL, jamais côté frontend.
- [ ] Tester un utilisateur global.
- [ ] Tester un manager limité à un site.
- [ ] Tester un opérateur limité à certaines files.
- [ ] Vérifier qu’aucune donnée hors périmètre ne fuite.

## 8. Évolution 5 — Comparaison de périodes

Contrat possible :

```http
GET /api/v1/reports/queues/10/series
    ?dateFrom=2026-09-01
    &dateTo=2026-09-30
    &compare=previousPeriod
```

Réponse possible :

```json
{
  "summary": {},
  "comparison": {
    "dateFrom": "2026-08-02",
    "dateTo": "2026-08-31",
    "totalRegisteredPercent": 12.4,
    "averageWaitMinutesPercent": -8.2,
    "noShowRatePercent": 3.1
  }
}
```

Règles à préciser :

- `previousPeriod` doit utiliser exactement le même nombre de jours ;
- division par zéro : retourner `null`, pas une valeur trompeuse ;
- possibilité future de fournir `compareDateFrom` et `compareDateTo` explicitement.

### Checkpoints

- [ ] Définir la sémantique de `previousPeriod`.
- [ ] Définir le comportement lorsque la période précédente vaut zéro.
- [ ] Ajouter les DTO Swagger.
- [ ] Mutualiser les agrégations des deux périodes.
- [ ] Ajouter les tests de pourcentage positif, négatif et indéterminé.

## 9. Évolution 6 — Filtres par plage sur les inscriptions

### 9.1 État actuel

`RegistrationFilterDto` accepte seulement :

```text
businessDate
```

### 9.2 Proposition

Ajouter :

```text
businessDateFrom
businessDateTo
scheduledFrom
scheduledTo
createdFrom
createdTo
queueIds
statuses
```

Conserver temporairement `businessDate` pour compatibilité et appliquer la règle :

- `businessDate` ne peut pas être combiné avec `businessDateFrom` / `businessDateTo` ;
- une plage incomplète peut être refusée ou interprétée comme ouverte, mais la décision doit être explicite ;
- les listes multi-valeurs doivent être limitées en taille.

### 9.3 Repository

Étendre `RegistrationsRepository.findPage` avec des comparaisons :

```sql
r.business_date >= $n::date
r.business_date <= $n::date
r.scheduled_time >= $n::timestamptz
r.scheduled_time < $n::timestamptz
```

### 9.4 Checkpoints

- [ ] Ajouter les champs de plage au DTO.
- [ ] Ajouter la validation croisée.
- [ ] Conserver `businessDate` pendant la période de compatibilité.
- [ ] Ajouter les filtres SQL paramétrés.
- [ ] Vérifier la pagination sur une période longue.
- [ ] Tester les bornes inclusives de `businessDate`.
- [ ] Tester les bornes temporelles de `scheduledTime`.
- [ ] Mettre à jour Swagger.

## 10. Évolution 7 — Filtres par plage sur les notifications

### 10.1 État actuel

`NotificationFilterDto` accepte seulement `businessDate` en plus des filtres de statut, canal et inscription.

### 10.2 Proposition

Ajouter :

```text
businessDateFrom
businessDateTo
createdFrom
createdTo
sentFrom
sentTo
deliveredFrom
deliveredTo
queueIds
statuses
channels
```

### 10.3 Fichiers concernés

- `src/modules/notifications/dto/notification.dto.ts`
- `src/modules/notifications/notifications.repository.ts`
- `src/modules/notifications/notifications.service.ts`
- tests du module notifications.

### 10.4 Checkpoints

- [ ] Ajouter les champs de période.
- [ ] Ajouter les filtres multi-valeurs utiles.
- [ ] Appliquer systématiquement le périmètre des files autorisées.
- [ ] Ajouter les index nécessaires après mesure avec `EXPLAIN ANALYZE`.
- [ ] Tester les notifications sans date de remise.
- [ ] Mettre à jour Swagger.

## 11. Correction importante — Fuseau horaire du dashboard

### 11.1 Risque observé

`ReportsRepository.getDashboardSummary` utilise actuellement :

```sql
c.business_date = CURRENT_DATE
```

`CURRENT_DATE` dépend du fuseau horaire de la session PostgreSQL. Or la date métier des inscriptions est calculée dans le fuseau du site.

Autour de minuit ou dans un contexte multisite, `appointmentsToday` peut donc compter une mauvaise journée.

### 11.2 Correction recommandée

Pour un site explicite :

- charger ou connaître son fuseau ;
- calculer la date métier via `ClockService` ;
- passer cette date comme paramètre SQL.

Pour plusieurs sites ayant potentiellement différents fuseaux :

- comparer `business_date` à la date locale calculée par site ;
- ou transmettre une table de correspondance site/date ;
- éviter une date globale unique si les fuseaux diffèrent.

### 11.3 Fichiers concernés

- `src/modules/reports/reports.service.ts`
- `src/modules/reports/reports.repository.ts`
- `src/core/clock/clock.service.ts`
- tests du dashboard.

### 11.4 Checkpoints

- [ ] Confirmer si plusieurs fuseaux sont autorisés fonctionnellement.
- [ ] Supprimer la dépendance métier à `CURRENT_DATE`.
- [ ] Passer les dates métier explicitement aux requêtes.
- [ ] Tester avant et après minuit dans le fuseau du site.
- [ ] Tester un utilisateur global accédant à plusieurs fuseaux.
- [ ] Documenter la définition de « aujourd’hui ».

## 12. Évolution 8 — Historique des transitions d’inscription

### 12.1 Limitation

Le modèle conserve principalement l’état courant et plusieurs timestamps. Cela ne suffit pas pour reconstruire tous les changements ou expliquer précisément un parcours complexe.

### 12.2 Modèle recommandé

```text
dori_registration_status_event
  event_id
  registration_id
  previous_status
  new_status
  previous_appointment_status
  new_appointment_status
  occurred_at
  performed_by_user_id nullable
  session_id nullable
  reason nullable
  metadata jsonb nullable
```

Événements à capturer :

- création ;
- confirmation ;
- check-in ;
- appel ;
- éventuel rappel ;
- retour en attente ;
- service terminé ;
- no-show ;
- annulation ;
- expiration ;
- replanification ;
- désactivation/réactivation.

### 12.3 Bénéfices

- audit métier ;
- analyse des abandons ;
- calcul précis des temps par étape ;
- explication d’un rapport ;
- nouveaux KPI sans dénaturer la table principale.

### 12.4 Modules concernés

- `registrations` ;
- `queue-engine` ;
- worker d’expiration ;
- worker de remise à zéro ;
- rapports ;
- schéma SQL.

### 12.5 Checkpoints

- [ ] Définir la liste canonique des transitions.
- [ ] Créer la table et les index.
- [ ] Choisir entre écriture applicative et trigger SQL.
- [ ] Garantir l’écriture dans la même transaction que le changement d’état.
- [ ] Brancher toutes les opérations et workers.
- [ ] Ajouter un endpoint d’historique protégé.
- [ ] Ajouter la rétention et les règles RGPD éventuelles.
- [ ] Tester l’atomicité état/événement.

## 13. Évolution 9 — Export asynchrone de rapports

Pour les périodes longues, les rapports multi-sites ou les formats CSV/XLSX :

```http
POST /api/v1/reports/exports
```

Corps possible :

```json
{
  "format": "csv",
  "dateFrom": "2026-01-01",
  "dateTo": "2026-12-31",
  "siteId": 1,
  "groupBy": "queue"
}
```

Suivi :

```http
GET /api/v1/reports/exports/{exportId}
```

États :

```text
pending
processing
ready
failed
expired
```

### Checkpoints

- [ ] Définir les formats supportés.
- [ ] Créer le modèle de job d’export.
- [ ] Réutiliser BullMQ et l’infrastructure workers existante.
- [ ] Appliquer le périmètre RBAC au moment de la demande.
- [ ] Ne pas permettre à un changement ultérieur de droits d’exposer un export interdit.
- [ ] Ajouter expiration et suppression des fichiers.
- [ ] Protéger le téléchargement.
- [ ] Journaliser l’auteur et les filtres.
- [ ] Tester les exports volumineux.

## 14. Évolution 10 — Idempotence des créations sensibles

### 14.1 Opérations prioritaires

- `POST /api/v1/registrations`
- envoi manuel de notification ;
- replanification si le client peut réessayer après timeout ;
- création d’un export.

### 14.2 Proposition

Accepter un en-tête :

```http
Idempotency-Key: <UUID client>
```

Conserver la clé, l’identité du caller, un hash de la requête et la réponse finale.

Règles :

- même clé et même payload : retourner la réponse initiale ;
- même clé et payload différent : retourner un conflit ;
- expiration documentée ;
- contrainte unique en base ;
- transaction commune avec la création métier.

### Checkpoints

- [ ] Définir les endpoints idempotents.
- [ ] Définir la durée de conservation.
- [ ] Ajouter la table et la contrainte unique.
- [ ] Ajouter un interceptor ou service transversal.
- [ ] Tester deux requêtes simultanées.
- [ ] Tester une reprise après timeout.
- [ ] Documenter l’en-tête Swagger.

## 15. Indexation et performance

### 15.1 Index existants utiles

Le schéma contient notamment :

- unicité `(queue_id, business_date, ticket_number)` ;
- index partiel `(queue_id, business_date, status) WHERE is_active` ;
- index sur `scheduled_time` pour les rendez-vous ;
- index sur `appointment_status, scheduled_time` ;
- index sur `person_id`.

### 15.2 Points à mesurer

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

## 16. KPI supplémentaires intéressants

KPI recommandés :

- taux d’occupation des créneaux ;
- capacité disponible et utilisée ;
- taux de no-show ;
- taux d’annulation ;
- taux d’expiration ;
- temps moyen, médian, P90 et P95 d’attente ;
- temps moyen, médian et P95 de service ;
- ponctualité des rendez-vous ;
- retard moyen au check-in ;
- fréquentation par heure et jour de semaine ;
- répartition walk-in/rendez-vous ;
- répartition par forfait ;
- charge et performance par file ;
- nombre de clients reportés lors du reset quotidien ;
- taux d’échec et de remise des notifications.

Les percentiles sont préférables à une moyenne seule, car ils révèlent les attentes extrêmes.

## 17. Tests attendus

### 17.1 Tests DTO

- format strict des dates ;
- plage inversée ;
- plage trop longue ;
- granularité invalide ;
- filtres incompatibles ;
- listes trop longues ;
- valeurs par défaut.

### 17.2 Tests services

- contrôle RBAC et périmètre ;
- période vide ;
- période partiellement vide ;
- agrégats et synthèse ;
- gestion du fuseau horaire ;
- compatibilité avec les endpoints existants.

### 17.3 Tests repositories

- bornes inclusives de `business_date` ;
- groupement journalier, hebdomadaire et mensuel ;
- jours vides ;
- statuts actifs et historiques ;
- calcul pondéré des moyennes ;
- requêtes paramétrées.

### 17.4 Tests E2E

- calendrier d’un mois en un appel ;
- rapport d’un mois en un appel ;
- rapport multi-files limité par scope ;
- Swagger conforme ;
- temps de réponse sur volumétrie cible.

## 18. Swagger et qualité documentaire

Pour chaque évolution :

- documenter précisément les bornes inclusives/exclusives ;
- préciser le fuseau horaire utilisé ;
- donner un exemple de période ;
- documenter la limite maximale ;
- décrire les jours sans données ;
- exposer les enums de granularité et groupement ;
- ajouter les réponses d’erreur ;
- régénérer `openapi.json` et `openapi.yaml` ;
- vérifier que l’ancien contrat reste présent lorsqu’il doit rester compatible.

Commandes de validation attendues :

```text
npm run typecheck
npm run lint
npm run build:check
npm test -- --runInBand --coverage=false
npm run swagger:export
git diff --check
```

## 19. Ordre d’implémentation recommandé

### Phase 1 — Fondation temporelle

- [ ] Créer le DTO commun de période.
- [ ] Ajouter les validations croisées.
- [ ] Fixer les limites de plage.
- [ ] Normaliser les règles de fuseau horaire.
- [ ] Corriger `CURRENT_DATE` dans le dashboard.

### Phase 2 — Réduction immédiate des appels

- [ ] Ajouter le calendrier de disponibilités sur une période.
- [ ] Ajouter le rapport de file en série.
- [ ] Ajouter les plages aux inscriptions.
- [ ] Ajouter les plages aux notifications.

### Phase 3 — Calendrier métier réel

- [ ] Ajouter les horaires hebdomadaires.
- [ ] Ajouter les exceptions de calendrier.
- [ ] Bloquer les réservations hors calendrier.

### Phase 4 — Reporting avancé

- [ ] Ajouter les rapports multi-files et multi-sites.
- [ ] Ajouter les dimensions et granularités.
- [ ] Ajouter les comparaisons de périodes.
- [ ] Ajouter les percentiles et KPI complémentaires.

### Phase 5 — Industrialisation

- [ ] Ajouter l’historique des transitions.
- [ ] Ajouter les exports asynchrones.
- [ ] Ajouter l’idempotence.
- [ ] Mesurer et optimiser les index.

## 20. Définition globale de terminé

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
- les endpoints historiques restent compatibles ou leur migration est documentée ;
- typecheck, lint, build et tests sont verts.

## 21. Résumé des priorités

Priorité immédiate :

1. plage de dates pour les disponibilités ;
2. rapport temporel avec buckets et synthèse ;
3. correction du fuseau horaire du dashboard ;
4. plages de dates pour inscriptions et notifications.

Priorité fonctionnelle suivante :

5. horaires hebdomadaires et exceptions ;
6. rapports multi-files/multi-sites ;
7. comparaison de périodes et KPI avancés.

Priorité d’industrialisation :

8. historique des transitions ;
9. export asynchrone ;
10. idempotence et optimisation mesurée des index.
