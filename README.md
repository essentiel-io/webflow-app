# WebState API

## Philosophie
- Toutes les données de l'application accessible à l'utilisateur sont disponibles côté Client et mise à jour à chaque requête.
- La DB Serveur est synchronisées après les changements effectués sur la DB Client.
- La recherche est effectuée via Algolia, synchronisée avec la DB Server.
- L'application est designée à 100% dans Webflow, les composants sont enrichis par l'API suivant leur configuration.
- Les données en cours d'utilisation (active) sont accessible dans l'état de l'application.

## Composants

### Formulaires

`<form>`
- `data-ws-form-onsubmit`: (Nom de la table).insert|upsert (Le formulaire se reset à l'insert)

`<input>`
- `name`: Nom du champs du record, est pré-rempli si un record de la table connecté au formulaire est actif
- `data-ws-input-disabled`: Désactive un champs

### Listes
`<div>`
- `data-ws-list-table`: Nom de la table
- `data-ws-list-filters`: key|operator|value,... (Liste des filtres des données à afficher dans cette liste)

`<input>`
- `data-ws-list-search`: Nom de la table

`<div>`
- `data-ws-list-facets`: Nom de la table

`<div><div>`
- `data-ws-list-rowId`: Nom de l'id du record

`<div><div><div>`
- `data-ws-list-field`: Nom du champs

=> Chaque liste est vidée puis reconstruite automatiquement en fonction de sa configuration et des données chargées.

### Boutons
`<button>`, `<a>`
- `data-ws-button-onclick`: run.(Nom de l'action)|delete|setActive (L'activation se base sur un ID et une table récupérés plus haut dans l'arbre HTML)

### Textes
`<h1-6>`, `<p>`
- `data-ws-text-field`: (Nom d'un record actif).(Nom d'un champ)

## Javascript
- `getTable(table, fields, filters:{ key, operator, value })`
- `getActive(table)`
- `setActive(table, id)`
- `upsert(table, records)`
- `delete(table, ids)`
- `run(action, id)`
