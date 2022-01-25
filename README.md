# WebState API

## Philosophie

- Toutes les données de l'application accessible à l'utilisateur sont disponibles côté Client et mise à jour à chaque requête.
- La DB Serveur est synchronisées après les changements effectués sur la DB Client.
- La recherche est effectuée via Algolia, synchronisée avec la DB Server.
- L'application est designée à 100% dans Webflow, les composants sont enrichis par l'API suivant leur configuration.
- Les données en cours d'utilisation (active) sont accessible dans l'état de l'application.

## Composants

### Formulaires

- `form[data-ws-form]`: insert|upsert|run.(Nom de la table ou du endpoint) Le formulaire se reset à l'insert
- `form[data-ws-record-id]`: identifiant du record actif
- `input[name]`: Nom du champs du record, est pré-rempli si un record de la table connecté au formulaire est actif
- `input[data-ws-disabled]`: Désactive un champs

### Listes

- `table[data-ws-table]`: Nom de la table
- `[data-ws-filters]`: key|operator|value,...
- `[data-ws-header`: Nom du champ
  
- `input[data-ws-search]`: Nom de la table
- `[data-ws-facets]`: Nom de la table

- `[data-ws-record-id]`: Identifiant du record de la ligne

### Boutons

- `[data-ws-button]`: run.(Nom du endpoint)|archive|setActive (L'activation se base sur un ID et une table récupérés plus haut dans l'arbre HTML)

### Textes

- `[data-ws-field]`: (Nom d'un record actif).(Nom d'un champ)

## Javascript

- `WebState.getTable(table, filters:[{ key, operator, value }], fields:[])`
- `WebState.getActive(name)`
- `WebState.setActive(name, table, id)`
- `WebState.upsert(table, records:[])`
- `WebState.archive(table, ids:[])`
- `WebState.run(endpoint, data)`
