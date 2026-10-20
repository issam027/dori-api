# Handover — Estimation du temps d'attente

## 1. Objectif

Remplacer l'estimation actuelle :

```text
position × temps théorique / nombre de guichets actifs
```

par une estimation fondée sur le fonctionnement réellement observé de chaque file. La valeur retournée au client doit estimer le délai avant son appel au guichet, en incluant :

- le temps de traitement des personnes qui passeront avant lui ;
- les temps morts entre la clôture d'un dossier et l'appel suivant ;
- les no-show et autres transitions opérateur ;
- le parallélisme des guichets actifs ;
- les rendez-vous, walk-ins et règles de priorité du moteur de file.

La valeur affichée doit rester une estimation, arrondie de préférence par tranche de 5 minutes.

## 2. Décisions fonctionnelles

### 2.1 Sémantique de `checked_in_at`

Le nom `checked_in_at` est conservé.

Il représente la date d'arrivée effective du client sur le site et son entrée réelle dans la file :

- `walkin` : `checked_in_at` est renseigné dès la création de l'inscription ;
- `appointment` réservé mais non arrivé : `checked_in_at = NULL` ;
- `appointment` pointé : `checked_in_at` reçoit la date du check-in ;
- un rendez-vous reporté avant sa prise en charge remet `checked_in_at` à `NULL` ;
- un rendez-vous annulé ou expiré sans arrivée peut conserver `checked_in_at = NULL`.

Chronologie cible :

```text
created_at              création technique de l'inscription
scheduled_time          date prévue, uniquement pour un rendez-vous
checked_in_at           arrivée réelle et entrée dans la file
priority_reference_time référence du moteur de priorité
called_at               appel au guichet
served_at               fin du traitement réussi
closed_at               clôture du cycle, quel que soit le résultat final
```

`priority_reference_time` reste distinct de `checked_in_at` : le premier pilote le classement, le second mesure un événement réel.

### 2.2 Mesures de référence

```text
attente réelle       = called_at - checked_in_at
durée de service     = served_at - called_at
temps total sur site = closed_at - checked_in_at
cycle effectif       = called_at suivant - called_at précédent
```

Le cycle effectif doit être calculé pour une même `served_by_session_id`. Il inclut la durée du service précédent et le délai réellement pris avant l'appel suivant.

### 2.3 Percentile utilisé

- P50 du cycle effectif : valeur initialement recommandée pour l'ETA client afin de privilégier une estimation basse ;
- P65 : valeur de comparaison et de suivi ;
- P90 : borne haute et indicateur de qualité, pas multiplicateur principal ;
- temps théorique de la queue/site : dernier fallback.

Le produit privilégie volontairement une estimation basse plutôt qu'une estimation haute susceptible d'inciter le client à s'éloigner et à manquer son tour. Le choix P50 devra être recalibré après mesure de l'erreur réelle. Le percentile retenu doit limiter en priorité les surestimations, tout en conservant une information honnête présentée comme approximative.

## 3. État actuel à faire évoluer

Le service public `GET /api/v1/public/registrations/position` retourne déjà `estimatedWaitMinutes` via `RegistrationPositionResponseDto`.

Le calcul actuel dans `RegistrationsService.getPublicPosition` est :

```text
position × queue.average_wait_time / activeThreads
```

Limites connues :

- `countWaitingBefore` compare seulement `priority_reference_time` et ne reproduit pas le classement réel de `callNext` ;
- `average_wait_time` est un paramètre théorique ;
- le calcul ignore le travail déjà en cours aux guichets ;
- il ne tient pas compte du rythme effectif des appels ;
- il force au moins un guichet actif, même lorsqu'aucun guichet n'est ouvert.

Le moteur `callNext` possède déjà la logique de classement avec les poids walk-in/rendez-vous et l'escalade. Cette logique doit devenir la source unique pour déterminer les candidats susceptibles de passer avant une inscription.

## 4. Migration de `dori_registration`

### 4.1 Alimentation de `checked_in_at`

`checked_in_at` existe déjà : aucune nouvelle colonne n'est requise pour cette notion.

À la création d'un walk-in :

```text
checked_in_at = now
priority_reference_time = now
status = waiting
```

À la création d'un rendez-vous :

```text
checked_in_at = NULL
status = booked
priority_reference_time = scheduled_time
```

Au check-in d'un rendez-vous :

```text
checked_in_at = now
status = waiting
appointment_status = checked_in
```

### 4.2 Reprise des données historiques

Créer une migration idempotente qui renseigne les walk-ins historiques :

```sql
UPDATE dori_registration
SET checked_in_at = COALESCE(priority_reference_time, created_at)
WHERE entry_type = 'walkin'
  AND checked_in_at IS NULL;
```

Ne pas remplir artificiellement les rendez-vous qui n'ont jamais été pointés.

Avant d'ajouter les contraintes, produire des requêtes de contrôle pour identifier :

- les walk-ins sans `checked_in_at` ;
- les inscriptions appelées sans `checked_in_at` ;
- les `called_at < checked_in_at` ;
- les `served_at < called_at` ;
- les rendez-vous `checked_in` sans `checked_in_at`.

### 4.3 Contraintes recommandées

Ajouter après nettoyage :

```sql
CHECK (entry_type <> 'walkin' OR checked_in_at IS NOT NULL)

CHECK (
  entry_type <> 'appointment'
  OR appointment_status <> 'checked_in'
  OR checked_in_at IS NOT NULL
)

CHECK (called_at IS NULL OR checked_in_at IS NOT NULL)
CHECK (called_at IS NULL OR called_at >= checked_in_at)
CHECK (served_at IS NULL OR served_at >= called_at)
```

Vérifier les données existantes avant validation des contraintes afin de ne pas bloquer le déploiement.

## 5. Nouvelle table de statistiques

La création d'une table dédiée reste valide et est préférable à l'ajout de colonnes dans `dori_queue_daily_ticket_counter`.

`dori_queue_daily_ticket_counter` doit rester limité à l'attribution transactionnelle des numéros de ticket. Le mélanger avec les statistiques créerait une responsabilité ambiguë et davantage de contention sur la ligne du compteur.

Table proposée :

```sql
CREATE TABLE dori_queue_estimation_stats (
  estimation_stats_id BIGSERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES dori_site(site_id),
  queue_id INT NOT NULL REFERENCES dori_queue(queue_id),
  activity_date DATE NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_ended_at TIMESTAMPTZ NOT NULL,
  cycle_p50_minutes INT NULL,
  cycle_p65_minutes INT NULL,
  cycle_p90_minutes INT NULL,
  wait_p50_minutes INT NULL,
  wait_p65_minutes INT NULL,
  wait_p90_minutes INT NULL,
  sample_size INT NOT NULL,
  is_reliable BOOLEAN NOT NULL DEFAULT FALSE,
  calculated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Contraintes/index à prévoir :

- percentiles et `sample_size` positifs ou nuls ;
- unicité logique `(site_id, queue_id, activity_date)` ;
- index `(site_id, queue_id, activity_date, calculated_at DESC)` ;
- index sur les statistiques fiables ;
- suppression ou désactivation cohérente lors de la désactivation d'une queue.

Prévoir une ligne statistique par site, file et journée d'activité. Les calculs utilisent exclusivement l'activité du jour concerné ; aucune fenêtre historique glissante ni segmentation par jour de semaine n'entre dans le calcul V1.

Une table brute `dori_queue_cycle_sample` n'est pas obligatoire pour la première version : les cycles peuvent être reconstruits depuis `dori_registration`. Elle pourra être ajoutée si les agrégations deviennent coûteuses ou si l'on doit mémoriser précisément le backlog au moment de chaque appel.

Le worker reconstruit les cycles directement depuis les données métier existantes dans `dori_registration`, sans traitement particulier dans `callNext` :

```sql
LEAD(called_at) OVER (
  PARTITION BY served_by_session_id
  ORDER BY called_at
) - called_at
```

Un cycle est valide seulement si :

- les deux appels concernent la même queue, session et journée métier ;
- les horodatages sont cohérents ;
- la session n'a pas été fermée entre les appels ;
- la durée n'est pas un outlier manifeste ;
- idéalement, la file n'était pas vide durant l'intervalle.

## 6. Worker d'agrégation

Créer un worker dédié, par exemple :

```text
src/workers/queue-estimation/
  queue-estimation.worker.ts
  queue-estimation.repository.ts
  queue-estimation.repository.spec.ts
  queue-estimation.worker.spec.ts
```

L'enregistrer dans `WorkersModule`.

### 6.1 Déclenchement

- exécution planifiée toutes les 5 minutes ;
- protection contre deux exécutions concurrentes, notamment en environnement multi-instance ;
- verrou PostgreSQL advisory ou mécanisme distribué Redis ;
- calcul queue par queue pour limiter la durée des transactions.

### 6.2 Fenêtre et segmentation initiales

- utiliser exclusivement les inscriptions et cycles de la journée d'activité courante ;
- produire une statistique par `site_id`, `queue_id` et `activity_date` ;
- minimum 30 cycles valides pour `is_reliable = true` ;
- si le worker n'a pas encore produit de nouvelle valeur exploitable, conserver et retourner la dernière estimation calculée disponible pour le site et la file ;
- ne pas compléter l'échantillon du jour avec des observations de jours précédents.

### 6.3 Agrégats

Calculer avec PostgreSQL :

```text
PERCENTILE_CONT(0.50)
PERCENTILE_CONT(0.65)
PERCENTILE_CONT(0.90)
```

sur :

- les cycles inter-appels ;
- les attentes réelles `called_at - checked_in_at` à des fins de comparaison ;
- éventuellement le taux de no-show et le débit horaire.

Le worker effectue un upsert atomique dans `dori_queue_estimation_stats` et expose des métriques/logs : queues traitées, échantillons rejetés, durée du calcul, erreurs et âge de la dernière statistique.

## 7. Service central d'estimation

Créer un service métier unique, par exemple `QueueWaitEstimationService`, utilisé par toutes les opérations qui exposent une ETA.

Responsabilités :

1. obtenir le classement opérationnel actuel depuis la même logique que `callNext` ;
2. compter les candidats qui ont réellement une probabilité de passer avant l'inscription ;
3. récupérer les sessions actives et leur état ;
4. sélectionner la statistique calculée sur l'activité du jour ou, si elle n'est pas encore disponible, la dernière estimation calculée ;
5. calculer et arrondir l'ETA ;
6. retourner la méthode, la fraîcheur et la fiabilité ;
7. appliquer les fallbacks sans dupliquer la logique dans les contrôleurs.

Éviter de réutiliser `countWaitingBefore` tel quel : il ne reproduit pas le score du moteur de sélection. Extraire du repository du moteur une méthode commune de classement/preview utilisable par `callNext`, `next-preview`, la position publique et l'estimation.

### 7.1 Formule V1

```text
personnes_devant = rang_opérationnel - 1
capacité_active  = nombre de sessions actives réellement disponibles
cycle_minutes    = P50 sélectionné, exprimé en minutes

ETA_minutes = ceil(personnes_devant × cycle_minutes / capacité_active)
```

La formule devra intégrer le travail résiduel des clients déjà `in_progress`. En V1, on peut ajouter au numérateur un cycle partiel par session occupée, borné entre 0 et `cycle`.

Si aucun guichet n'est actif, ne pas diviser artificiellement par 1. Retourner une estimation indisponible ou une valeur fondée sur un prochain horaire d'ouverture explicitement connu.

### 7.2 Fallbacks

Ordre :

1. P50 calculé à partir de l'activité du jour pour le site et la file ;
2. dernière estimation calculée disponible pour le site et la file si le calcul du jour n'est pas encore disponible ;
3. temps théorique configuré sur la queue si aucune estimation calculée n'existe ;
4. temps théorique hérité du site ;
5. estimation indisponible.

### 7.3 Contrat interne proposé

```ts
interface WaitEstimate {
  estimatedWaitMinutes: number | null;
  position: number | null;
  method:
    | 'queue_daily_p50'
    | 'last_calculated'
    | 'theoretical_queue'
    | 'theoretical_site'
    | 'unavailable';
  sampleSize: number | null;
  calculatedAt: Date;
  statsCalculatedAt: Date | null;
  isReliable: boolean;
}
```

## 8. Évolution des services et endpoints

### 8.1 Création d'une inscription

`POST /api/v1/registrations` :

- walk-in : renseigner `checked_in_at` immédiatement ;
- ne calculer ni ne persister d'estimation initiale dans `dori_registration` ;
- ajouter au DTO existant de réponse, sans créer inutilement un DTO parallèle :

```text
estimatedWaitMinutes
estimationMethod
estimationReliable
```

Pour un rendez-vous simplement réservé, l'ETA d'attente sur site n'est pas encore pertinente : retourner `NULL` ou ne renseigner les champs optionnels qu'au check-in.

### 8.2 Check-in d'un rendez-vous

`POST /api/v1/registrations/:registrationId/check-in` :

- renseigner `checked_in_at` ;
- faire passer le rendez-vous à `waiting` ;
- ne pas calculer ni persister d'estimation dans la transaction de check-in ;
- retourner l'ETA dans le DTO existant associé à cette opération.

### 8.3 Suivi public

Faire évoluer l'endpoint existant :

```text
GET /api/v1/public/registrations/position
```

Il reste le service principal exposant l'information au client. Aucun nouvel endpoint public n'est nécessaire.

Faire évoluer `RegistrationPositionResponseDto` avec :

```text
estimatedWaitMinutes: number | null
estimationMethod: string
estimationReliable: boolean
estimationCalculatedAt: string
```

Conserver les comportements :

- `in_progress` : position 0 et ETA 0 ;
- état final : ne plus produire d'ETA ;
- `waiting` : calculer l'ETA selon la position avec la statistique du jour, ou retourner la dernière estimation calculée si la statistique du jour n'est pas encore disponible ;
- réponse publique sans donnée personnelle supplémentaire ;
- `Cache-Control: no-store, private` conservé.

### 8.4 Lecture authentifiée d'une inscription

Faire évoluer le DTO existant retourné par `GET /api/v1/registrations/:registrationId` pour exposer l'ETA courante lorsque l'inscription est `waiting` ou `in_progress`. Calculer le champ au niveau service ; ne pas stocker chaque variation dans `dori_registration`.

### 8.5 Preview

- `GET /api/v1/sites/:siteId/next-preview` : réutiliser le même classement que l'estimation ;

### 8.6 Supervision optionnelle

Un endpoint authentifié réservé à la supervision peut être ajouté ultérieurement pour expliquer la statistique d'une queue : P50/P65/P90, échantillon, fraîcheur et fallback. Il ne doit pas être public et ne doit contenir aucune donnée personnelle.

## 9. Notifications et temps réel

- réutiliser `QueueWaitEstimationService` pour les notifications contenant une attente ;
- recalculer avant envoi plutôt que reprendre l'estimation initiale ;
- lors des événements WebSocket de file, retourner l'ETA courante ou demander au client de rafraîchir le suivi ;
- limiter la fréquence des recalculs côté client afin de ne pas surcharger l'API ;
- ne pas promettre une heure exacte : afficher « environ 45 minutes ».

## 10. DTO, Swagger et compatibilité

- modifier les DTO existants utilisés par les opérations concernées ;
- documenter les champs comme optionnels/nullables lorsque l'estimation est impossible ;
- documenter la différence entre `checkedInAt`, `priorityReferenceTime` et `calledAt` ;
- conserver `estimatedWaitMinutes` pour ne pas casser le front ;
- ajouter les métadonnées d'explication sans exposer la formule interne complète ;
- régénérer `openapi.json`, `openapi.yaml` et `ai/docs-json.json` ;
- vérifier le client généré/front avant de rendre de nouveaux champs obligatoires.

## 11. Tests obligatoires

### 11.1 Migration et contraintes

- backfill des walk-ins ;
- rendez-vous non pointé laissé à `NULL` ;
- rejet d'un walk-in sans `checked_in_at` ;
- rejet d'un appel antérieur au check-in ;
- migration idempotente.

### 11.2 Worker/repository

- cycles correctement partitionnés par session ;
- exclusion des changements de journée/session ;
- exclusion des valeurs aberrantes ;
- calcul P50/P65/P90 ;
- seuil minimal de 30 ;
- fallback vers la dernière estimation calculée lorsque celle du jour n'est pas encore disponible ;
- upsert et verrou anti-concurrence ;
- une erreur sur une queue ne bloque pas les autres.

### 11.3 Service d'estimation

- classement identique au moteur `callNext` ;
- walk-in et rendez-vous prioritaires ;
- plusieurs guichets actifs ;
- guichet occupé et travail résiduel ;
- aucun guichet actif ;
- statistique obsolète ou insuffisante ;
- tous les fallbacks ;
- arrondi par tranche de 5 minutes ;
- `in_progress = 0`, états finaux sans ETA.

### 11.4 API

- création walk-in avec `checked_in_at` et ETA initiale ;
- création appointment sans ETA d'attente sur site ;
- check-in appointment avec ETA ;
- suivi public sans fuite de données ;
- lecture authentifiée avec respect du scope ;
- Swagger conforme.

### 11.5 Calibration

Créer un test/replay sur historique : à chaque ancienne arrivée, recalculer ce que le modèle aurait annoncé, puis comparer à `called_at - checked_in_at`.

Mesures :

```text
MAE                     erreur absolue moyenne
médiane de l'erreur
taux de sous-estimation
taux de surestimation
taux compris dans ±5 et ±10 minutes
erreur P90
```

Comparer P50, P60, P65, P70 et P75 avant de figer le percentile client, en pénalisant davantage la surestimation que la sous-estimation. P50 reste la valeur initiale recommandée.

## 12. Observabilité et garde-fous

- métrique sur l'âge des statistiques par queue ;
- métrique sur la méthode/fallback utilisée ;
- alerte si aucune statistique fiable n'est disponible ;
- métrique de l'erreur réelle une fois le client appelé ;
- logs sans nom, téléphone, email ni jeton de suivi ;
- durée maximale du worker et timeout par queue ;
- conservation limitée des éventuels échantillons bruts.

## 13. Ordre d'implémentation conseillé

### Lot 1 — Données fiables

1. Migration de backfill `checked_in_at` pour les walk-ins.
2. Alimentation à la création d'un walk-in.
3. Conservation du fonctionnement appointment/check-in.
4. Contraintes de cohérence.
5. Mise à jour des rapports pour mesurer l'attente avec `called_at - checked_in_at`.

### Lot 2 — Statistiques

1. Créer `dori_queue_estimation_stats` et son entité/repository.
2. Implémenter les requêtes de cycles valides.
3. Créer le worker et son verrou distribué.
4. Calculer P50/P65/P90 et la fiabilité.
5. Ajouter observabilité et tests.

### Lot 3 — Estimation en ligne

1. Extraire/réutiliser le classement du moteur.
2. Créer `QueueWaitEstimationService`.
3. Implémenter les fallbacks et absence de guichet.
4. Faire évoluer le suivi public.
5. Faire évoluer création, check-in et lecture authentifiée.

### Lot 4 — Calibration

1. Comparer les percentiles produits à partir de l'activité journalière.
2. Ajuster le seuil de fiabilité et le percentile retenu.
3. Ajouter éventuellement `dori_queue_cycle_sample` si nécessaire, sans ajouter de colonnes de calibration à `dori_registration`.

## 14. Définition de terminé

- tous les walk-ins nouveaux et historiques ont un `checked_in_at` cohérent ;
- les rendez-vous non arrivés conservent `checked_in_at = NULL` ;
- une statistique récente et fiable est produite par site, file et journée lorsque les données du jour suffisent ;
- l'ETA utilise le même ordre métier que `callNext` ;
- le suivi public retourne une ETA expliquée et fraîche, ou `NULL` explicitement ;
- tous les fallbacks sont testés ;
- Swagger et DTO existants sont à jour ;
- les migrations sont idempotentes et disposent d'une stratégie de rollback ;
- format, lint, typecheck, build, tests unitaires et e2e sont verts ;
- la précision est mesurée sur historique avant activation générale.

## 15. Points à arbitrer avant développement

- percentile client initial : P50 recommandé pour privilégier une estimation basse, à confirmer par replay ;
- fenêtre : activité du jour uniquement ;
- segmentation : une statistique par site, file et date d'activité ;
- comportement sans guichet actif : ETA `NULL` recommandée ;
- arrondi : tranche de 5 minutes recommandée ;
- seuil de fiabilité : 30 cycles recommandé ;
- stockage des échantillons bruts dès V1 ou ajout seulement si les requêtes deviennent coûteuses ;
- affichage d'une valeur unique ou d'une fourchette au front.

## 16. État d'implémentation — 20 octobre 2026

- [x] Backfill des walk-ins et alimentation de `checked_in_at` à la création.
- [x] Contraintes de cohérence temporelle ajoutées par la migration `011_queue_wait_estimation.sql`.
- [x] Table journalière `dori_queue_estimation_stats` créée avec `site_id`, `queue_id`, `activity_date` et percentiles exprimés en minutes.
- [x] Worker planifié toutes les cinq minutes, verrouillé par file et isolant les erreurs entre files.
- [x] Calcul limité à l'activité du jour, sans traitement particulier dans `callNext`.
- [x] Service central fondé sur la position opérationnelle, le P50 du jour puis la dernière estimation calculée.
- [x] Absence de division artificielle lorsqu'aucun guichet n'est actif : ETA `NULL`.
- [x] Tracking public, statut de file du kiosk, création walk-in, check-in et lecture authentifiée raccordés au service central.
- [x] DTO et contrats OpenAPI régénérés ; `estimatedCallAt` écarté au profit d'une estimation en minutes.
- [x] Rapports d'attente fondés sur `called_at - checked_in_at`.
- [x] Validation réussie : format, lint, typecheck, build, 54 suites/270 tests unitaires et 1 test E2E.

La migration est livrée mais n'est pas appliquée automatiquement à une base partagée par cette modification. Elle sera exécutée par le mécanisme habituel de migration lors du déploiement ou d'une initialisation contrôlée de l'environnement.

<!-- CHECKPOINT id="ckpt_mvg4x9a5_nliah8" time="2026-10-20T03:39:51.485Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvg5a494_efo9ag" time="2026-10-20T03:49:51.496Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvg5mz84_wcfvhn" time="2026-10-20T03:59:51.508Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvg70yaj_1qn6cs" time="2026-10-20T04:38:43.099Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvg7stnl_k9wgi0" time="2026-10-20T05:00:23.457Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvg8bww4_lsmy31" time="2026-10-20T05:15:14.116Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgawo0e_jr5d06" time="2026-10-20T06:27:21.614Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgchkon_rsy1a6" time="2026-10-20T07:11:36.695Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgcufno_zl70n5" time="2026-10-20T07:21:36.708Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgd7amm_tnodpk" time="2026-10-20T07:31:36.718Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgdk5lf_vcs63c" time="2026-10-20T07:41:36.723Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgdx0kd_cavb1n" time="2026-10-20T07:51:36.733Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvge9vje_s51hkg" time="2026-10-20T08:01:36.746Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgemqi1_lrqg6e" time="2026-10-20T08:11:36.746Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgezlh9_msktu1" time="2026-10-20T08:21:36.765Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgfcgfs_cdiq9y" time="2026-10-20T08:31:36.760Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgfpbf3_3xrwv4" time="2026-10-20T08:41:36.783Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgg26du_0231hj" time="2026-10-20T08:51:36.786Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvggf1ct_ti9hfp" time="2026-10-20T09:01:36.797Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvggzf4j_lv2xzi" time="2026-10-20T09:17:27.763Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgii08p_9r7uor" time="2026-10-20T09:59:54.553Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgjffkz_4yoatp" time="2026-10-20T10:25:54.083Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgk6bj1_ylhkh1" time="2026-10-20T10:46:48.541Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgkj6hp_t8xikb" time="2026-10-20T10:56:48.541Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgkw1gl_v9jep2" time="2026-10-20T11:06:48.549Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgl8wfm_fdao0a" time="2026-10-20T11:16:48.562Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgllrei_dmo4qc" time="2026-10-20T11:26:48.570Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvglymd5_5p2b41" time="2026-10-20T11:36:48.569Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mvgmbhez_7feqh2" time="2026-10-20T11:46:48.683Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
