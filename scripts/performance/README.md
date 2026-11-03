# Banc de charge isolé

Ce banc cible exclusivement le projet Docker `dorify-perf`, ses ports et ses
bases `dorify_perf`. Il ne lit pas `DATABASE_URL` et ne cible pas Neon.
Il nécessite les images locales `dorify/engine:dev`, `dorify/app:dev` et
`dorify/agent:dev`, Docker Compose et les dépendances npm du dépôt.

Depuis la racine du dépôt, sur un banc neuf :

```powershell
node scripts/performance/prepare-isolated.cjs
docker compose --env-file .tmp-consolidation/performance/runtime.env -f compose.performance.yaml up -d --wait intra-db cloud-db intra-redis cloud-redis
node scripts/performance/isolated-fixture.cjs
docker compose --env-file .tmp-consolidation/performance/runtime.env -f compose.performance.yaml up -d intra-api cloud-api intra-ui cloud-ui agent
```

Attendre que les API et les projections soient prêtes. Les identifiants, mots de
passe et jetons sont générés dans `.tmp-consolidation/performance/`, ignoré par Git.
La fixture refuse de réinitialiser un banc possédant déjà `fixture.json`.

Mesurer d'abord la limitation de trafic inchangée :

```powershell
docker compose --env-file .tmp-consolidation/performance/runtime.env -f compose.performance.yaml run --rm loadgen protection
```

Pour mesurer ensuite la capacité, relever les limites **du banc uniquement** :

```powershell
node scripts/performance/prepare-isolated.cjs --capacity
docker compose --env-file .tmp-consolidation/performance/runtime.env -f compose.performance.yaml up -d --force-recreate intra-api cloud-api
docker compose --env-file .tmp-consolidation/performance/runtime.env -f compose.performance.yaml restart intra-ui cloud-ui
```

Exécuter les phases successivement, jamais en parallèle. La réservation sur le
créneau limité doit être testée une seule fois par fixture :

```powershell
node scripts/performance/sample-resources.cjs
# Dans un autre terminal :
docker compose --env-file .tmp-consolidation/performance/runtime.env -f compose.performance.yaml run --rm loadgen bookings
docker compose --env-file .tmp-consolidation/performance/runtime.env -f compose.performance.yaml run --rm loadgen sse
docker compose --env-file .tmp-consolidation/performance/runtime.env -f compose.performance.yaml run --rm loadgen mixed
docker compose --env-file .tmp-consolidation/performance/runtime.env -f compose.performance.yaml run --rm loadgen cloudFanout
node --max-old-space-size=160 scripts/performance/isolated-load.cjs outage
$env:PERF_OUTAGE_KIND = 'link'
node --max-old-space-size=160 scripts/performance/isolated-load.cjs outage
Remove-Item Env:PERF_OUTAGE_KIND
```

Le générateur Docker est limité à 1 CPU et 256 Mio. Le collecteur s'arrête après
20 minutes ; le relancer pour une session plus longue. Le mode `mixed` dure trois
minutes par défaut. `outage` arrête seulement l'API cloud de test pendant 35 s ;
`link` coupe le réseau cloud de l'agent de test pendant 130 s. Les mutations de
langue servent à suivre des mises à jour réelles de projections et sont restaurées.
Les pannes utilisent Docker depuis l'hôte. Attendre le retour des projections
en français avant d'enchaîner deux phases de panne.

Pour comparer deux versions, les variables `PERF_API_IMAGE` et `PERF_AGENT_IMAGE`
permettent de sélectionner des images dédiées dans le fichier privé `runtime.env`.
Recréer les API puis redémarrer les proxies nginx après un changement d'image.
Conserver les résultats de référence avant de rejouer un mode qui les remplace.
Le scénario SSE relève aussi le nombre de requêtes SQL d'estimation et le nombre
de tickets traités, lorsque l'image API expose ces compteurs.

`docker compose ... run --rm -e PERF_SSE_TARGETS=500,2000 loadgen sse` permet de
rejouer seulement ces paliers. Les autres valeurs admises sont 100 et 1 000.
Le générateur de synthèse accepte un chemin de sortie en argument pour conserver
la référence : `node scripts/performance/summarize-readiness.cjs reports/performance/readiness-optimized-2026-11-03.json`.

Les fichiers JSON sont des observations, pas une certification de capacité.
`passed` contrôle les invariants fonctionnels ; il ne valide aucun SLA de latence.
Consulter séparément p95, erreurs, ressources et configuration des limites.
Le client SSE teste le protocole HTTP, sans rendu navigateur ni TLS.

La collection Postman est un contrôle REST complémentaire. Le mode `environment`
exporte son environnement privé. Respecter les protections mémoire du générateur
Postman : un arrêt par protection invalide la campagne, sans prouver une limite API.

Après sauvegarde des résultats et vérification que le projet est bien
`dorify-perf`, supprimer uniquement ce banc :

```powershell
docker compose --env-file .tmp-consolidation/performance/runtime.env -f compose.performance.yaml down --volumes
```

Pour une nouvelle fixture, archiver les résultats puis retirer seulement le
`fixture.json` de ce banc après suppression de ses bases. Ne jamais publier les
fichiers privés d'identité ou d'environnement.

## Campagne renforcée

Le plan exploratoire est versionné dans `stress-plan.json`. Arrêter les
environnements habituels libère les ressources avant cette campagne ; ils
restent arrêtés après les essais. Les volumes habituels ne sont pas supprimés.

Sur un banc neuf, préparer la fixture avec `PERF_LIVE_TICKETS=8000` et utiliser
`-f compose.performance.yaml -f compose.performance.stress.yaml` pour les phases
Docker. Le second fichier réserve 2 CPU et 512 Mio au générateur ; les API gardent
2 CPU, 768 Mio et leur pool de 10 connexions. Les protections mémoire restent actives.

- `run --rm -e PERF_SSE_TARGETS=2000,4000,6000,8000 loadgen sse` : montée avec rafale
  de relectures ; arrêt des paliers après dépassement du seuil d'erreurs.
- `run --rm -e PERF_SSE_TARGETS=8000 -e PERF_SSE_REFETCH=false loadgen sse` : transport
  seul. Les distributions de relectures vides ne représentent aucune mesure REST.
- `run --rm loadgen sustained` : 2 000 SSE maintenus, arrivées imposées de 20, 50,
  100 puis 200 lectures/s, une minute par palier, avec au plus 256 requêtes en vol.
  Les demandes abandonnées au plafond de concurrence sont comptées ; un palier
  lent ne réduit pas silencieusement le débit demandé. Arrêt de la montée au
  dépassement des seuils de latence, d'erreurs ou de ressources du générateur.

Archiver chaque `sse-ramp.json` avant le mode suivant. Pour une comparaison avec
l'ancien code, changer uniquement l'image de l'API intra sur le même jeu de
données, redémarrer son proxy et rejouer un palier identique sans autre charge.
Remettre ensuite l'image optimisée avant de poursuivre. Les erreurs client
`status=0` se distinguent des réponses HTTP 5xx. Une mesure sans compteur disponible
est marquée `null`, jamais interprétée comme une absence de requêtes SQL.
