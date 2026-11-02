# Schéma consolidé et démonstration tunisienne

Le schéma final est `src/core/database/sql/migrations/001_schema_final.sql` :
36 tables, 18 fonctions, contraintes intégrées aux `CREATE TABLE`, index et
triggers finaux. Les 25 anciennes migrations restent consultables dans Git.
Le moteur de migration conserve son journal et ses contrôles de checksum.

`seed.sql` installe les références et le compte root. Les données métier de
démonstration sont séparées et ne sont jamais créées au démarrage de l'API.

## Initialisation habituelle

Depuis la racine du dépôt, avec `DATABASE_URL` dans l'environnement :

```powershell
npm run db:init:seed
npm run db:verify
```

`npm run db:reset` est destructif : il réinitialise uniquement `dorify` et
`dorify_agent`. Sauvegarder la base et arrêter API/agent avant cette commande.
Le schéma `neon_auth` reste indépendant.

## Reconstruction de la démonstration

Ces commandes sont destructives et sont destinées à une intervention explicite.
Les cibles autorisées sont `intra` (Docker local, port 15432), `cloud` (Docker
local, port 55432) et `neon` (base neondb sur neon.tech). La connexion est lue
uniquement dans `DATABASE_URL`, jamais passée en argument.

```powershell
npm run db:demo:backup -- intra
npm run db:demo:rebuild -- intra
npm run db:demo:verify -- intra
```

Remplacer `intra` par la cible voulue. Une sauvegarde PostgreSQL avec checksum
est obligatoire et conservée dans `.tmp-consolidation/`, exclu de Git. Une
sauvegarde existante n'est jamais écrasée. Archiver ce répertoire avant une
nouvelle intervention. PostgreSQL 18 est utilisé pour sauvegarder Neon.

Le générateur exporte `seedTunisiaDemo(client, options)` pour un usage contrôlé :
1 site intra ou 10 sites cloud, 90 jours d'historique, 21 jours de rendez-vous,
aléatoire reproductible, fuseau Africa/Tunis et monnaie TND. Les UUID et jetons
restent uniques. Les clients, adresses et notifications sont synthétiques ; les
emails utilisent example.test et les notifications historiques sont simulées.

Les délais et positions affichés ne sont pas précalculés par le seed : les
projections sont produites par les fonctions canoniques de l'application.

Après un reset cloud, réenregistrer les installations intra ou réinstaller leurs
identités et empreintes de jetons sauvegardées avant de redémarrer l'agent.
Les caches Redis doivent également être vidés pour éviter les anciens périmètres.

## Accès de démonstration

- Root : `root` / `Root@123456`, changement obligatoire au premier accès.
- Managers : `tn_cloud01_manager` à `tn_cloud10_manager`, et `tn_intra01_manager`.
- Opérateurs : par exemple `tn_cloud01_q1_op1` ou `tn_intra01_q1_op1`.
- Bornes : par exemple `tn_cloud01_kiosk` ou `tn_intra01_kiosk`.
- Mot de passe des comptes de démonstration : `DemoTn@2026!`.

## Validation de la consolidation

`consolidate-schema.cjs` transforme un dump de structure en schéma complet et
ordonne les tables par dépendances. Il refuse les instructions non prises en
charge. `schema-fingerprint.sql` compare colonnes, contraintes, index, fonctions
et triggers sans dépendre des OID ; les contraintes NOT NULL additionnelles de
PostgreSQL 18 sont couvertes par les attributs des colonnes.

```powershell
npm run test:database-tools
npm run quality:check
```
