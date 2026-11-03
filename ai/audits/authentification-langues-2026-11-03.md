# Authentification et langues — 3 novembre 2026

## Comportements livrés

- [x] Changement de mot de passe imposé : formulaire harmonisé avec le design system, les thèmes et le mobile, erreurs de champs, affichage facultatif des mots de passe, état de soumission et textes dans les quatre langues.
- [x] Après validation, expiration locale de la session et retour à la connexion avec confirmation. La révocation des sessions côté serveur reste appliquée. Aucune tentative de recharger un profil avec une session révoquée.
- [x] Après reconnexion, une ancienne destination `/change-password` ne renvoie plus vers ce formulaire. Un compte opérationnel accède au cockpit avec un seul site ; un compte multisite sans site actif accède au portefeuille. Les liens métier et les périmètres autorisés restent respectés.
- [x] Le changement volontaire depuis le profil suit la même fin de session.
- [x] Connexion : la préférence utilisateur retournée par l'API initialise la langue. La restauration de session utilise le profil ; une réponse ancienne sans préférence conserve la sélection existante.
- [x] Kiosque et affichage : la langue par défaut provient du site actif. Tracking : la langue provient de l'inscription, avec repli sur la personne, le site puis le français si absente.
- [x] Les écrans publics appliquent leur langue à l'entrée dans le contexte ; un changement manuel reste possible. La sortie restaure la préférence précédente. Les chargements asynchrones des traductions ne peuvent plus réappliquer une ancienne demande.
- [x] AR-TN conserve la disposition gauche-droite ; AR conserve la disposition droite-gauche.

## API, base et relais intra/cloud

- [x] Contrat OpenAPI exporté et client web régénéré ; aucune modification manuelle des fichiers générés.
- [x] La projection canonique du tracking transporte la langue dans les réponses REST, le protocole agent et les événements SSE cloud.
- [x] Migration `002_tracking_language.sql` appliquée sur Docker intra, Docker cloud et Neon, sans réinitialisation des données ni modification du checksum de la consolidation initiale.
- [x] Les outils de reconstruction appliquent aussi les migrations postérieures au socle.
- [x] Reprise unique des projections déjà acquittées par l'agent. Le cloud accepte le complément de langue à séquence identique uniquement pour la même source et si la langue était absente ; un ancien agent n'efface pas une langue connue.
- [x] La déduplication SSE inclut la langue pour publier ce complément même sans changement de position.
- [x] Les opérateurs disposant de `session_operate` peuvent lister/lire leurs sites pour sélectionner leur contexte. Le filtrage du périmètre est conservé ; les mutations et les autres permissions restent inchangées.

## Validation

- [x] API : contrôle qualité complet, 91 suites / 475 tests ; outils de base de données : 5 tests.
- [x] Agent : contrôle qualité complet et 22 tests.
- [x] Front : lint, typage, architecture, traductions, tokens et budgets de bundle validés.
- [x] Front unitaire : 341 cas validés. Deux tests de traduction ont atteint leur délai pendant les builds Docker simultanés ; les deux fichiers concernés ont été rejoués seuls, sans changement de code ni augmentation du délai : 18/18 réussis.
- [x] Parcours navigateur ciblés : 14 tests réussis, incluant changement imposé mobile/desktop, comptes mono/multisite, changement volontaire, langues des écrans publics et reconnexion.
- [x] Suite navigateur complète finale : 142 tests réussis, 2 scénarios cloud spécifiques ignorés par la configuration habituelle.
- [x] Vérification visuelle des captures du formulaire mobile et desktop.
- [x] Vérification réelle Docker : connexion et lecture des sites avec manager, opérateur et borne, sur intra et cloud ; langue du ticket intra identique en REST natif, REST cloud et premier événement SSE cloud. Aucun changement de mot de passe réel effectué par ces contrôles.
- [x] Images API et front reconstruites et redémarrées pour intra et cloud ; agent intra reconstruit et redémarré après les migrations/API. Les données existantes sont conservées.

Les scénarios navigateur utilisent les fixtures API du dépôt. Le contrôle réel du relais utilise un ticket existant sans exposer son jeton. Les journaux locaux sont conservés dans `.tmp-consolidation/auth-locale-*` (hors Git).

## Commits de réalisation

- API : `27dc5e0` — contrat de langues, projection, migration et tests.
- Agent : `b85d36a` — transport de langue et reprise des projections.
- Web : `ed67b14` — parcours de mot de passe, interface et langues contextuelles.
