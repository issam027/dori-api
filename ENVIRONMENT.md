# Configuration des quatre composants

Les catalogues `.env.example` documentent les variables du code et les entrees
Compose. Une ligne commentee est une option : ne pas la decommenter avec une
valeur vide si le code attend une absence (ex. DATABASE_LISTEN_URL, cles RSA,
certificats mTLS). Les variables systeme de Node/Docker ne sont pas a recopier.

| Composant | Configuration de reference | Configuration Oracle |
| --- | --- | --- |
| API | .env.example ; Compose cloud/intra | .env.oracle.example et .env.oracle.local prive |
| Web | .env.example ; arguments Docker de build | .env.oracle.example et .env.oracle.local pour le build public |
| Site | .env.example ; Compose cloud | .env.oracle.example et .env.oracle.local prive (Resend et secret interne) |
| Agent | .env.example ; Compose intra | Aucune livraison Oracle ; agent propre a l'intra |

Chaque nom de fichier est relatif au depot du composant concerne. Les fichiers
prives ne sont pas interchangeables entre composants. Ne pas copier le .env de
developpement vers Oracle. Ne pas mettre de secret dans une variable VITE_* :
elle est integree au JavaScript public du navigateur.

## API et PostgreSQL

Le Compose definit le mode, les URLs publiques, les pools et la plupart des
reglages non secrets. Le fichier Oracle fournit les secrets et les references
d'images. DATABASE_URL utilise postgres:5432 dans Docker, et le mot de passe
doit correspondre a celui du volume initialise. Un changement de variable ne
change pas le mot de passe PostgreSQL. JWT_SECRET ne doit pas etre remplace
pendant un simple audit ; les cles RSA sont une alternative facultative.

SITE_REQUESTS_URL vise http://site:8080/internal/requests dans le cloud Docker.
Pour une API Node lancee directement sur Windows, le catalogue propose
http://localhost:18090/internal/requests. SITE_REQUESTS_SECRET doit etre identique
entre API et site. Ces variables ne sont pas necessaires au fonctionnement intra.

## Web

Les dix variables VITE_* utilisees par l'application sont declarees et exposees
au build Docker : environnement, mode, URL API, suivi public, delais borne/session
et quatre mentions legales. Les Compose cloud/intra les transmettent au build.
Le script Oracle lit son .env.oracle.local et accepte `-BuildEnvFile chemin`.
Il ne transmet que les noms prevus et ne lit pas le .env de developpement.
`-BuildOnly` permet de verifier sans livrer.

En production compilee, les appels REST/SSE restent sur la meme origine via
le proxy. VITE_API_BASE_URL sert notamment au developpement et a la politique
CSP. PUBLIC_TRACKING_URL est un alias Compose pour VITE_PUBLIC_TRACKING_URL.
Les valeurs de demonstration sont conservees ; passer en production definitive
requiert les vraies mentions legales. Un environment Compose au runtime ne
modifie pas un bundle Vite deja construit.

## Site et mails

Dans Docker, PORT=8080, HOST=0.0.0.0 et DATA_DIR=/app/data sont fixes par l'image
et/ou le Compose. Les valeurs de .env.example decrivent aussi l'execution Node
directe (port 18090 et repertoire ./data).
EMAIL_PROVIDER=resend necessite RESEND_API_KEY ; disabled est le defaut sans
configuration. EMAIL_FROM=noreply@dorify.fr et EMAIL_SALES_TO=ijoober@gmail.com.
Le fichier prive du site configure les mails en local et sur Oracle. Voir MAIL.md
dans dori-site pour la file persistante. Les variables SITE_URL et
PLAYWRIGHT_MODULE du catalogue servent aux outils, pas au serveur public.

## Agent intra

AGENT_SYNC_MAX_BATCHES=100 et AGENT_SYNC_BUDGET_MS=10000 sont declares et
parametrables dans Compose. Les valeurs actives anterieures qui ne les declarent
pas explicitement utilisent deja ces valeurs par defaut du code. Les identifiants
d'installation et jetons sont propres a chaque installation ; les exemples ne
constituent pas un provisionnement. Les certificats mTLS restent facultatifs.

## Controle sans divulgation

Depuis dori-api : `node tools/audit-component-env.cjs` verifie les noms utilises
par le code et ceux interpoles dans les Compose cloud/intra/Oracle, sans afficher
de valeur. L'audit est statique : les fichiers et branches inspectes sont ceux
des quatre depots voisins. Depuis dori-web : `npm run audit:env` controle aussi
les variables des outils et du .env local.

Audit du 6 novembre 2026 : aucune declaration manquante parmi les 109 references
recensees (48 API, 10 web, 20 site, 31 agent), et dix Compose valides. Les options
avec une valeur par defaut dans le code n'ont pas a etre dupliquees dans chaque
conteneur. Les variables obligatoires et la coherence des secrets API/site/BDD
ont ete verifiees en memoire sur Docker local et Oracle, sans affichage des secrets.

Les modeles et le cablage de build ont ete completes sans modifier les conteneurs
existants. Les nouveaux arguments du web et reglages Compose agent prendront
effet a la prochaine livraison de ces composants. Les scripts API/site conservent
les valeurs distantes non vides : leur remplacement necessite une rotation
explicite et coordonnee, pas un simple changement du fichier local.
