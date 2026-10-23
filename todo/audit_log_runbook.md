# Runbook — journal d'audit métier

## Objet

Le journal `dori_audit_event` conserve les opérations sensibles sans stocker le corps des requêtes ni les données métier. Il est alimenté par `AuditInterceptor` pour les routes portant `@AuditEvent`.

## Données enregistrées

- identifiant technique de l'acteur ;
- action normalisée ;
- type et identifiants techniques de la cible ;
- succès ou échec et type d'erreur uniquement ;
- méthode, modèle de route, date et identifiant de corrélation.

Ne jamais ajouter au journal : mot de passe, token, cookie, signature, email, téléphone, nom, contenu de note, body brut, message ou stack d'erreur.

## Déploiement

1. Sauvegarder PostgreSQL selon le runbook de restauration.
2. Appliquer la migration `015_audit_events.sql` avec le runner habituel.
3. Vérifier la présence de la table et de ses trois index.
4. Exécuter une action sensible de test en préproduction.
5. Vérifier l'événement par son `correlation_id`.

## Protection PostgreSQL

Le code applicatif n'expose qu'une insertion. En production, utiliser deux rôles distincts :

- rôle runtime : `INSERT` uniquement sur `dori_audit_event` et usage de la séquence/extension nécessaire ;
- rôle exploitation/audit : `SELECT` uniquement ;
- rôle migrations : propriétaire, non utilisé par l'API.

Retirer explicitement `UPDATE`, `DELETE` et `TRUNCATE` au rôle runtime. Les noms de rôles dépendant de l'infrastructure, ces droits doivent être appliqués par le déploiement et vérifiés après chaque restauration.

## Surveillance

Le mode est volontairement **fail-open** : une panne du stockage d'audit ne transforme pas une mutation métier déjà validée en réponse HTTP ambiguë. Chaque échec produit un log structuré :

```text
Audit persistence failed type=<ErrorType> action=<action>
```

Créer une alerte sur toute occurrence de ce message. Une occurrence signifie une lacune d'audit à investiguer avec les logs corrélés.

## Contrôles périodiques

- comparer le volume d'événements sensibles au volume des routes correspondantes ;
- rechercher les échecs d'écriture d'audit ;
- vérifier les privilèges PostgreSQL du rôle runtime ;
- tester une recherche par acteur, cible, action et corrélation ;
- vérifier qu'aucune donnée interdite n'a été ajoutée au schéma ou aux logs.

## Rétention et purge

La durée de conservation doit être fixée dans PRI-01 avec le DPO/responsable sécurité. La purge doit être exécutée par un rôle de maintenance distinct, jamais par le rôle runtime. Aucun job de purge n'est activé tant que cette durée n'est pas validée.
