# WebState API

L'application charge toutes les données auxquelles l'utilisateur à accès.
À chaque requête, toute la DB client est mise à jour ainsi que l'application.

## Javascript
- `get(table, fields, filters:{ key, operator, value })`
- `upsert(table, records)`
- `delete(table, ids)`
- `run(action)`

## HTML

### Forms
Default:
- `onsubmit`: `upsert`

Attributes:
- `data-ws-form-table`: `table`
- `data-ws-form-record`: `state`
- `data-ws-form-reset`: `true`

Inputs:
- `data-ws-form-fields`: `state.field`

### Lists
Components Params:
- `table`: `table`
- `fields`: `fields,...`
- `filters`: `key|operator|value,...`
- `search`: `boolean`
- `facets`: `fields,...`

Components Attributes:
- `data-ws-list-table`: `true`
- `data-ws-list-fields`: `true`
- `data-ws-list-filters`: `true`
- `data-ws-list-search`: `true`
- `data-ws-list-facets`: `true`
- `data-ws-list`: `true`
- `data-ws-list-record`: `true`
- `data-ws-list-field`: `field`

### Field Attributes
- `data-ws-field`: `state.field`

### Button Attributes
- `data-ws-delete`: `state`
- `data-ws-run`: `action`
