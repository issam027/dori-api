# Campagne SaaS persistante locale

Ces outils ciblent uniquement l'intra local. Ils n'effacent pas le jeu de données. Ne pas utiliser les anciens nettoyeurs de fixtures pour ce site.

1. Sauvegarder la base intra. Placer sa connexion locale dans `.tmp-consolidation/saas-performance/database-url.txt` (fichier ignoré). Le seed refuse toute destination autre que `127.0.0.1:15432/dori`.
2. **Une seule fois** : `node scripts/performance/saas-fixture.cjs`. Crée un site, 100 000 inscriptions, 40 000 personnes et 27 comptes de test. Le mot de passe aléatoire est conservé uniquement dans `fixture.json` ignoré. Le script refuse un second seed.
3. Démarrer le profil temporaire : `docker compose -f compose.intra.yaml -f compose.saas-performance.yaml up -d --no-deps engine`, puis redémarrer le nginx UI si l'adresse du conteneur API a changé.
4. Vérifier : `node scripts/performance/saas-load.cjs smoke`. Ouvrir les sessions de test : même commande avec `sessions`. Conserver `sessions.json` ; `active-staff.json` doit contenir les sessions réellement actives (champs `user_id` et `session_id`), pour ne pas simuler un opérateur dont le guichet a été repris par un utilisateur.
5. Charge : `docker compose -f compose.intra.yaml -f compose.saas-performance.yaml run --rm --no-deps staff-load load`. `PERF_STAFF_PROFILE=max` sélectionne seulement le dernier palier. Le scénario effectue de vraies mutations et consomme les tickets en attente du jour. Préparer la date métier avant un rejeu le lendemain, sans modifier les tickets des utilisateurs.
6. Navigation réelle : `node scripts/performance/saas-browser.cjs load` ; ou `mobile` pour le seul rejeu mobile. Nécessite Edge et Playwright installé dans le frontend voisin. `saas-visual.cjs` vérifie les boutons mobiles et les loaders ; seuls ses retards de réponse sont artificiels, les réponses viennent toujours de l'API.
7. Fermer uniquement les sessions enregistrées des opérateurs de test : `node scripts/performance/saas-load.cjs close`. Vérifier les éventuels tickets de test encore en traitement ; ne jamais terminer les tickets d'un utilisateur existant.
8. **Toujours rétablir les seuils** : `docker compose -f compose.intra.yaml up -d --no-deps --no-build --wait engine`, puis `docker restart intra-dorify-ui-app-1`. Conserver la base et les volumes.

`sample-resources.cjs` accepte `PERF_RESOURCE_DIRECTORY` et `PERF_CONTAINER_PREFIX` pour choisir les captures locales. `saas-summary.cjs` agrège les passages retenus de cette campagne, avec leurs limites ; les résultats bruts et credentials restent privés. Les noms des fichiers d'entrée de synthèse correspondent aux passages du 4 novembre et doivent être adaptés pour une nouvelle campagne.
