# Temps réel événementiel et budget PostgreSQL — 3 novembre 2026

## Fonctionnement

Les projections et l'outbox restent la source durable. Les migrations `003` et
`004` ajoutent des notifications PostgreSQL transactionnelles : un rollback ne
publie rien. Les notifications ne transportent ni jeton de tracking ni contenu
personnel. Elles identifient le sujet à relire ou portent les métadonnées de
connexion d'une installation.

Chaque processus API utilise une seule connexion `LISTEN dorify_realtime`, hors
pool de requêtes. Les sujets sont partagés entre les abonnés locaux. Une lecture
en cours conserve une invalidation supplémentaire, sans perdre la dernière mise
à jour et sans accumuler une file de lectures sans limite.

Les flux natifs, le tracking intra relayé dans le cloud et l'administration des
installations ne font plus de lecture SQL toutes les deux secondes. Les
heartbeats SSE sont produits en mémoire. La révocation des sessions/périmètres
déclenche une vérification ; les expirations de jetons ferment les flux par
temporisateur. Les heartbeats d'installation mettent à jour les temporisateurs
de connexion sans relire les tickets. Les expirations de commandes et le passage
hors ligne déclenchent une invalidation du tableau des installations.

Après perte de la connexion PostgreSQL, l'écoute est rétablie avec backoff et
jitter. Le rétablissement déclenche un rattrapage. Une relecture de sécurité des
sujets actifs reste effectuée toutes les cinq minutes, ou toutes les trente
secondes lorsque l'écoute est indisponible. Les heartbeats SSE s'arrêtent dans
ce mode afin que le navigateur détecte la dégradation.

Le kiosque reçoit les événements de file ; son ancien rafraîchissement à trente
secondes devient un contrôle de sécurité à cinq minutes. Les événements
`estimation_updated` et `registration_recalled` sont acceptés par le front. Le
tracking ne déclenche son repli REST qu'en l'absence effective de heartbeat ; une
brève reconnexion n'entraîne pas de lecture supplémentaire. Le repli cesse au
retour du flux ou à l'expiration du jeton.

L'agent écoute les changements locaux. En mode connecté, il ne relit le tracking
que sur événement, demande explicite `SYNC_NOW`, poursuite d'un rattrapage ou
contrôle de sécurité à cinq minutes. Les contrôles d'installation, les heartbeats
de contrôle et les workers métier planifiés restent nécessaires et distincts.

## Dimensionnement par base

```text
connexions allouées =
  DB_API_INSTANCES × (DB_POOL_MAX + 1 connexion LISTEN)
  + DB_AGENT_INSTANCES × (DB_AGENT_POOL_MAX + 1 connexion LISTEN)
  + DB_WORKER_CONNECTIONS
  + DB_RESERVED_CONNECTIONS
```

Le total doit être inférieur ou égal à `DB_MAX_CONNECTIONS`. L'API refuse un
budget qui dépasse la capacité `max_connections` annoncée par PostgreSQL.
Sans `DB_POOL_MAX` explicite, le pool API est réduit selon le nombre de réplicas,
avec un maximum par défaut de dix. Un budget incohérent empêche le démarrage.

| Paramètre                              | Docker intra | Docker cloud |
| -------------------------------------- | -----------: | -----------: |
| Capacité déclarée                      |          100 |          100 |
| Réserve exploitation/autres connexions |           20 |           20 |
| Réplicas API                           |            1 |            1 |
| Pool de chaque API                     |           10 |           10 |
| Agents partageant cette base           |            1 |            0 |
| Pool de chaque agent                   |            3 |            3 |
| Connexions de workers externes         |            0 |            0 |
| Total alloué, réserve comprise         |           35 |           31 |

Les workers NestJS utilisent déjà le pool API : ne pas les compter deux fois.
Les workers déployés séparément doivent être comptés dans
`DB_WORKER_CONNECTIONS`, écoute comprise. Les paramètres API et agent doivent
décrire la même topologie pour une même base.

**La déclaration du nombre de réplicas ne limite pas l'autoscaling de
l'hébergeur.** Configurer également sa limite d'instances. Exemple : dix API sur
une base de 100 connexions, avec une réserve de vingt et aucun agent, disposent
d'un pool de sept chacune, plus leur connexion d'écoute. Ne pas déployer dix
réplicas en conservant un budget déclaré pour un seul.

Pour Neon ou un proxy transactionnel, `DATABASE_LISTEN_URL` doit désigner une
connexion directe/session vers la même base. Pour les URL Neon, le suffixe
`-pooler` est automatiquement retiré de l'hôte d'écoute ; le pool de requêtes
conserve son URL habituelle. Pour les autres proxies, renseigner explicitement
l'URL directe. Les quotas du fournisseur et les autres applications utilisant
la base doivent aussi être inclus dans le budget.

## Délais

| Réglage API/agent                    |   Valeur Docker |
| ------------------------------------ | --------------: |
| Acquisition/connexion                |             5 s |
| Exécution SQL (`statement_timeout`)  |            30 s |
| Attente d'un verrou (`lock_timeout`) |             3 s |
| Transaction inactive                 |            15 s |
| Délai client d'une requête SQL       | délai SQL + 5 s |

Ces valeurs sont appliquées aux connexions de requêtes. La connexion d'écoute
dispose de délais courts pour établir `LISTEN`, du keepalive TCP et d'une
fermeture propre au shutdown. Les migrations sont exécutées séparément des
requêtes applicatives. Les métriques exposent le budget, l'allocation déclarée,
la limite du pool, son attente et l'état de l'écoute.

## Validation

- [x] API : lint, typage, build, architecture et 95 suites / 482 tests réussis.
- [x] Agent : contrôle qualité, build et 24 tests réussis, incluant les cycles
      connectés sans lecture du tracking et les réveils sur notification.
- [x] Front : build et typage, tests ciblés du temps réel, architecture et
      budgets de bundle ; 19 tests navigateur des parcours publics réussis.
- [x] Test réel Docker avec deux abonnés SSE : zéro relecture SQL du tracking
      pendant 22 secondes au repos, heartbeat reçu ; mise à jour après commit reçue
      par les deux clients en 51 ms dans cette exécution locale. Ce n'est pas un
      benchmark de charge ni un engagement de latence de production.
- [x] Rollback sans événement ; complément de langue à séquence identique ;
      changement hors ligne/en ligne sans relecture SQL des tickets ; révocation
      fermant les deux flux.
- [x] Interruption volontaire de la connexion d'écoute PostgreSQL : reconnexion
      et rattrapage du commit manqué sans redémarrer le flux SSE du navigateur.
- [x] Chaîne complète sur une inscription intra existante : modification
      réversible de sa langue, notification locale, réveil de l'agent, réplication
      et réception SSE cloud en 378 ms dans cette exécution locale. La langue
      initiale est restaurée après le test ; aucun jeton n'est affiché.
- [x] Flux natif intra réveillé par la transaction de l'outbox ; événements de
      commande et d'échéance reçus par le tableau des installations ; statut
      `timedOut` vérifié via l'API.
- [x] Délais PostgreSQL vérifiés réellement : requête annulée au délai SQL et
      attente de verrou interrompue au délai de verrouillage.
- [x] Migrations 003/004 appliquées sur Docker intra, Docker cloud et Neon sans
      reset ni réinstallation des seeds. Les objets techniques temporaires du test
      réel sont supprimés ; l'invalidation native utilise l'outbox habituelle.
- [x] API et front cloud/intra, ainsi que l'agent intra, reconstruits et
      redémarrés. La configuration des variables d'un hébergement distant reste à
      adapter au nombre maximal réel de réplicas ; aucun déploiement distant de
      l'application n'est effectué par cette intervention.

Journaux locaux : `.tmp-consolidation/event-realtime-*` (hors Git). Les tests
navigateur utilisent les fixtures du dépôt ; les tests PostgreSQL/SSE réels
ci-dessus interrogent les conteneurs Docker. Aucune mesure de charge intensive
n'est revendiquée.

## Commits

- API : `a7c3d9e` — notifications transactionnelles et budgets PostgreSQL.
- Web : `98b0f46` — réception des estimations et repli après perte de heartbeat.
- Agent : `27d6a3b` — réveils événementiels, pools et délais ; `9c04a8a` —
  suppression de la lecture des compteurs de tracking pendant les cycles de
  contrôle au repos.
