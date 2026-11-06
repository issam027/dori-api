# Livraison Oracle Cloud

## Emails du site

Les nouvelles demandes du site declenchent une notification commerciale a
ijoober@gmail.com et une confirmation au demandeur, depuis noreply@dorify.fr.
Le fournisseur est selectionne par EMAIL_PROVIDER (resend ou disabled).
La cle RESEND_API_KEY est uniquement dans le fichier prive du site
dori-site/.env.oracle.local et dans le .env distant ; jamais dans une image.
Le script Oracle du site transfere sa configuration privee et complete les
valeurs manquantes sans ecraser celles deja renseignees sur la VM.

La demande JSON est conservee meme en cas de panne d'envoi. Une file persistante
reprend les erreurs temporaires et suit les acceptations du fournisseur ;
elle ne renvoie pas les anciennes demandes. Voir dori-site/MAIL.md pour les
tentatives, les limites d'idempotence et les etats stockes dans le volume.
Les donnees des messages en attente suivent la retention de leur demande.

Pour livrer localement le site avec sa configuration mail :
`docker compose --env-file .env.oracle.local -f compose.site.cloud.yaml up -d --build --wait`
depuis dori-site. Pour Oracle : `.\deploy-oracle.ps1` depuis ce meme depot.

## Demandes du site (cloud)

Le pied de page du site propose Administration, vers
https://app.dorify.fr/admin/site-requests. La connexion est celle de Dorify ;
la consultation est reservee strictement au role root, sans nouvelle permission.
La page permet recherche, pagination et consultation du detail, sans modification
des demandes. Le formulaire explique site/file et recueille le total des files
et le volume estime de personnes par jour, tous sites confondus (facultatifs).

Les demandes restent en JSON dans dorify-site-requests, avec retention de 90 jours
par defaut. Les anciens fichiers sans quantites restent compatibles.
L'API appelle http://site:8080/internal/requests sur le reseau Docker partage.
SITE_REQUESTS_SECRET doit etre identique dans les environnements API et site ;
il est conserve uniquement cote serveur. Le Compose API Oracle exige sa presence.
L'ajouter dans .env.oracle.local avant livraison API pour completer le .env distant.
Les Compose locaux attendent egalement cette variable pour permettre la lecture.
Caddy bloque /internal et /internal/* sur www ; ne pas publier cette interface.
Pour cette evolution, livrer API avec -DeployProxy, puis site et web, sans migration
BDD ni reset. Les fichiers des demandes existantes sont conserves.

## Scripts PowerShell locaux

Chaque depot contient `deploy-oracle.ps1`. Executer depuis PowerShell avec
Docker Desktop demarre (conteneurs Linux), SSH et SCP disponibles :

```powershell
.\deploy-oracle.ps1 -BuildOnly
.\deploy-oracle.ps1
# API uniquement :
.\deploy-oracle.ps1 -Migrate
.\deploy-oracle.ps1 -Seed
.\deploy-oracle.ps1 -ResetDatabase
.\deploy-oracle.ps1 -DeployProxy
```

`-Seed` applique aussi les migrations, comme la commande db:seed du projet.
`-ResetDatabase` demande de saisir `RESET dorify`, sauvegarde puis supprime les
schemas dorify et dorify_agent, applique les migrations et le seed ; public
est preserve. Le script ne supprime jamais les volumes PostgreSQL.

Options communes : `-Server`, `-IdentityFile`, `-RemoteDirectory`, `-Version`.
La destination par defaut est ubuntu@88.96.60.173:/home/ubuntu/dorify.
La cle par defaut est ../autres/dorify_key. Les images ciblent linux/amd64.
Chaque script est autonome ; aucune dependance aux autres depots.

Le script API prepare maintenant le .env distant automatiquement. S'il existe,
ses valeurs non vides sont conservees, y compris les secrets. Pour fournir les
valeurs manquantes, copier .env.oracle.example vers .env.oracle.local (ignore par
Git) et le remplir, ou passer `-EnvFile chemin`. Le .env de developpement n'est
jamais envoye automatiquement. Le fichier Oracle est transfere par SCP dans un
dossier prive, fusionne sur la VM puis supprime ; le .env final est en mode 600.
Un .env existant est sauvegarde avant modification. Aucun secret n'est affiche.

POSTGRES_PASSWORD et JWT_SECRET doivent exister sur la VM ou dans le fichier
fourni. DATABASE_URL est construite si absente, avec le mot de passe encode et
l'hote Docker postgres. Avec les volumes existants, reutiliser le vrai mot de
passe PostgreSQL : changer cette variable ne change pas le mot de passe en base.
Les informations supplementaires du site peuvent etre ajoutees au fichier local.
Le script API cree les volumes externes manquants. Livrer l'API avant le web
et le site. Pour une base vierge, utiliser `-Seed` lors de cette premiere
livraison pour appliquer le schema et les donnees de reference.

Les scripts sauvegardent les definitions et le .env dans releases/<composant>-<version>,
conservent les anciennes images et attendent la sante des conteneurs. Les dumps
BDD sont dans backups/. En cas d'echec, le script s'arrete : consulter les logs
et restaurer les definitions precedentes si necessaire. Pas de rollback SQL
automatique ; apres echec de maintenance, le moteur reste arrete pour inspection.
Ne pas reutiliser une version. Les archives distantes sont conservees ; leur
nettoyage est manuel pour ne pas effacer une image utile au retour arriere.

Les informations legales du site sont des valeurs de demonstration, LEGAL_DEMO
vaut true par defaut. Le web est construit avec VITE_APP_ENV=development et
VITE_DORIFY_DEPLOYMENT_MODE=cloud : cela indique une demonstration fonctionnelle,
mais le bundle Vite reste compile pour la production. Avant publication definitive,
fournir les vraies mentions legales et adapter le build web en consequence.

`-DeployProxy` est explicite : il remplace le Caddyfile apres validation et
recree Caddy pour appliquer les nouveaux ports. Cela peut interrompre brievement
les connexions. Il faut livrer les trois composants et preparer les DNS avant
ce basculement. Les scripts ne modifient ni DNS ni pare-feu OCI.

Configuration pour la VM Ubuntu x86_64 existante : trois images applicatives
preconstruites, PostgreSQL, Redis et Caddy. Aucun build sur la VM de 1 Gio.
Chaque Compose applicatif appartient au depot de son composant :

- dori-api/compose.api.oracle.yaml et .env.oracle.example
- dori-web/compose.web.oracle.yaml et .env.oracle.example
- dori-site/compose.site.oracle.yaml et .env.oracle.example

Le proxy commun (compose.proxy.oracle.yaml), le Caddyfile et cette procedure
(README.oracle.md) se trouvent egalement a la racine de dori-api.
Les Compose cloud/intra de simulation restent inchanges.

| Domaine HTTPS | Destination sur la VM |
| --- | --- |
| www.dorify.fr | 127.0.0.1:8081 (site) |
| app.dorify.fr | 127.0.0.1:8080 (web) |
| api.dorify.fr | 127.0.0.1:9090 (API) |

Caddy utilise le reseau host Linux et reserve 80/443. Le domaine nu redirige
vers www. Les DNS A des quatre noms doivent viser 88.96.60.173 ; les eventuels
AAAA doivent aussi mener a cette VM ou etre retires. Autoriser TCP 80/443
dans OCI et le pare-feu Ubuntu. Les ports applicatifs restent sur loopback ;
PostgreSQL et Redis ne publient aucun port hote.

## Images et configuration

Assembler les trois Compose applicatifs, compose.proxy.oracle.yaml et Caddyfile dans un
nouveau repertoire de livraison sur la VM. Fusionner les valeurs des trois
`.env.oracle.example` dans un fichier `.env` et les renseigner (chmod 600 .env).
Utiliser des tags de livraison uniques ou des digests, disponibles via un
registre ou `docker load`. Les trois images doivent cibler linux/amd64.

Pour une production definitive, l'image web doit etre construite en mode cloud avec VITE_APP_ENV=production,
VITE_DORIFY_DEPLOYMENT_MODE=cloud et
VITE_PUBLIC_TRACKING_URL=https://app.dorify.fr. Ses mentions legales VITE_LEGAL_*
doivent etre renseignees dans le fichier de build : le Dockerfile les expose
desormais comme arguments. Le script web lit son .env.oracle.local ou le fichier
passe avec -BuildEnvFile. Seules les variables publiques VITE_* prevues sont
transmises au build. Ces valeurs sont figees au build ;
un environment Compose au runtime ne les change pas.

Le client web de production utilise des URL /api sur sa propre origine.
Caddy les route directement vers le moteur, y compris les flux SSE, pour
conserver HTTPS dans les en-tetes transmis. api.dorify.fr expose egalement
l'API pour les autres clients. Les chemins /api/v1 restent inchanges.

## Donnees et migration

Les volumes sont externes et reprennent les noms verifies sur la VM existante.
Compose echoue s'ils manquent au lieu de creer silencieusement une base vide.
Les noms de projets/services existants sont conserves : ces fichiers remplacent
les definitions actuelles, ils ne constituent pas une seconde installation.
Ne pas lancer les anciens Compose en parallele pour les memes projets.

Avant livraison : sauvegarder PostgreSQL, les demandes du site, la configuration
actuelle et les references des anciennes images. Reutiliser le mot de passe
reel de PostgreSQL et le secret JWT existant si les sessions doivent rester
valides. Ne pas supprimer les volumes.

AUTO_RUN_MIGRATIONS=false par defaut. Si la nouvelle API exige des migrations,
apres sauvegarde et revue SQL, activer true pour le premier demarrage du moteur.
Le mecanisme applicatif execute les migrations versionnees et le seed. Verifier
les journaux et la sante avant de remettre false et recreer le moteur.
Un retour a une ancienne image ne restaure pas le schema de la base.

## Commandes sur la VM

Depuis le dossier de livraison renseigne, valider chaque fichier separement :

```sh
docker compose --env-file .env -f compose.api.oracle.yaml config --quiet
docker compose --env-file .env -f compose.web.oracle.yaml config --quiet
docker compose --env-file .env -f compose.site.oracle.yaml config --quiet
docker compose --env-file .env -f compose.proxy.oracle.yaml config --quiet
```

Apres sauvegarde, images disponibles et decision sur les migrations :

```sh
docker compose --env-file .env -f compose.api.oracle.yaml up -d --wait
docker compose --env-file .env -f compose.web.oracle.yaml up -d --wait
docker compose --env-file .env -f compose.site.oracle.yaml up -d --wait
docker compose --env-file .env -f compose.proxy.oracle.yaml up -d
```

Les nouveaux ports prennent effet a la recreation des services. Le basculement
du proxy doit suivre : une courte interruption est possible. Ne pas fusionner
les quatre fichiers avec plusieurs -f : ils ont des projets distincts.

Verifier ensuite les etats Compose, les journaux Caddy (certificats), les quatre
domaines, la connexion utilisateur, les appels REST et la reception SSE.
La validation statique ne prouve ni la compatibilite des images choisies avec
la base actuelle, ni la configuration DNS/pare-feu, ni le fonctionnement HTTPS.

<!-- CHECKPOINT id="ckpt_mw4b1vdx_ahwk0e" time="2026-11-06T01:37:52.677Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mw4beqcj_86ndn7" time="2026-11-06T01:47:52.675Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mw4brlbf_rz0mm2" time="2026-11-06T01:57:52.683Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mw4c4gac_r7c14z" time="2026-11-06T02:07:52.692Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mw4chb99_3gopwq" time="2026-11-06T02:17:52.701Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->

<!-- CHECKPOINT id="ckpt_mw4cu683_k7k3bb" time="2026-11-06T02:27:52.707Z" note="auto" fixes=0 questions=0 highlights=0 sections="" -->
