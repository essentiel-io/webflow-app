const axios = require('axios');
const idb = require('idb');
const Sortable = require('sortablejs');

/**
 * WebState
 * @constructor
 */
WebState = (function() {
  let db;
  const database = [
    {
      table: 'users',
    },
    {
      table: 'organizations',
    },
    {
      table: 'roles',
    },
    {
      table: 'tasks',
    },
    {
      table: 'needs',
    },
  ];
  const url = /(\.webflow\.io)|(127\.0\.0\.1)/.test(window.location.hostname) ?
      'https://dev.api.solucyon.com/' : 'https://api.solucyon.com/';
  let state = {};

  /**
 * Get closest Parent Node
 * @param {object} elem
 * @param {string} selector
 * @return {object}
 */
  const getClosest = function(elem, selector) {
    for (; elem && elem !== document; elem = elem.parentNode) {
      if (elem.matches(selector)) return elem;
    }
    return null;
  };

  /**
 * Manage errors
 * @param {object} err
 */
  function error(err) {
    if (err.response) {
      console.log(err.response.data.error);
    } else if (err.request) {
      console.log(err.request);
    } else if (err.message) {
      console.log(err.message);
    } else {
      console.error(err);
    }
  }

  const dependencies = [];
  const components = [
    {
      selector: 'form[data-ws-form]',
      build: function(form) {
        const [
          action,
          table,
          key,
        ] = form.getAttribute('data-ws-form').split('.');
        form.onsubmit = async function(event) {
          event.preventDefault();
          const data = new FormData(form);
          const record = {};
          for (const [name, value] of data) record[name] = value;
          const recordId = form.getAttribute('data-ws-record-id');
          if (recordId) record.id = recordId;
          switch (action) {
            case 'insert':
              form.reset();
              await upsert(table, [record], true);
              break;
            case 'upsert':
              await upsert(table, [record]);
              break;
            case 'run':
              form.reset();
              await run(table, record);
              break;
            default:
              break;
          }
        };
        const hydrate = async function() {
          const recordState = state[key || `selected_${table}`];
          if (recordState && recordState.value) {
            const record = recordState.value;
            form.setAttribute('data-ws-record-id', record.id);
            const fields = form.querySelectorAll('input:not([type="submit"])');
            for (let j = 0, field; field = fields[j]; j++) {
              const name = field.getAttribute('name');
              field.value = record[name];
              field.disabled = !!field.getAttribute('data-ws-disabled');
            }
          }
        };
        hydrate();
        return {
          path: 'state.'+ table,
          hydrate,
        };
      },
    },
    {
      selector: 'table[data-ws-grid]',
      build: function(grid) {
        const body = grid.querySelector('tbody');
        const tr = body.querySelector('tr');
        const td = body.querySelector('td');
        body.innerHTML = '';
        const table = grid.getAttribute('data-ws-grid');
        // const filters = grid.getAttribute('data-ws-filters');
        const headers = grid.querySelectorAll('[data-ws-header]');
        const hydrate = async function() {
          const records = await db.getAll(table).catch(error);
          const rows = records.map((record) => {
            const row = tr.cloneNode(true);
            row.innerHTML = '';
            for (const header of headers) {
              const cell = td.cloneNode(true);
              cell.innerText = record[header.getAttribute('data-ws-header')];
              row.appendChild(cell);
            }
            return row;
          });
          body.innerHTML = '';
          rows.forEach(function(row) {
            body.appendChild(row);
          });
          Sortable.create(body);
        };
        hydrate();
        return {
          path: table,
          hydrate,
        };
      },
    },
    {
      selector: '[data-ws-button]',
      build: function(button) {
        button.onclick = async function(event) {
          event.preventDefault();
          const [
            action,
            endpoint,
          ] = button.getAttribute('data-ws-button').split('.');
          const [
            table,
            recordId,
          ] = getClosest(button.parentNode, '[data-ws-record-id]').split('.');
          switch (action) {
            case 'run':
              await run(endpoint);
              break;
            case 'select':
              await select(table, recordId);
              break;
            case 'archive':
              await archive(table, [recordId]);
              break;
            default:
              break;
          }
        };
      },
    },
    {
      selector: '[data-ws-field]',
      build: function(field) {
        const [table, name, key] =
        field.getAttribute('data-ws-field').split('.');
        const hydrate = async function() {
          const recordState = state[key || `selected_${table}`];
          if (recordState && recordState.value) {
            const record = recordState.value;
            field.innerText = !!record && record[name];
          }
        };
        hydrate();
        return {
          path: 'state.' + table,
          hydrate,
        };
      },
    },
    {
      selector: '[data-ws-image]',
      build: function(image) {
        const [table, name, key] =
        image.getAttribute('data-ws-image').split('.');
        const hydrate = async function() {
          const recordState = state[key || `selected_${table}`];
          if (recordState && recordState.value) {
            const record = recordState.value;
            image.src = !!record && record[name][0];
            image.alt = !!record && record.name;
          }
        };
        hydrate();
        return {
          path: 'state.' + table,
          hydrate,
        };
      },
    },
    {
      selector:'[data-ws-toggle]', 
      build: function(toggle) {
        let id = toggle.getAttribute('data-ws-toggle');
        if (id === 'recordId') {
          id = toggle.getAttribute('data-ws-record-id')
        }
        const key = 'toggle_' + id;
        const button = toggle.querySelector('[data-ws-toggle-button]');
        const status = button.getAttribute('data-ws-toggle-button');
        const content = toggle.querySelector('[data-ws-toggle-content]');
        const initStatus = content.getAttribute('data-ws-toggle-content');
        const update = function(init = false) {
          let { open } = (state[key] || { open: status === "open" });
          if (!init) open = !open;
          if (open) {
            content.style.display = initStatus;
            button.getElementsByClassName('material-icons')[0].innerText = 'expand_more';
          } else {
            content.style.display = 'none';
            button.getElementsByClassName('material-icons')[0].innerText = 'chevron_right';
          }
          return open;
        }
        toggle.onclick = async function(e) {
          e.preventDefault();
          const open = update();
          if (!state[key] || open !== state[key].open) {
            await setState({ [key]: { open }});
          }
        }
        update(true);
      }
    }
  ];

  /**
 * Init Database
 */
  async function initDB() {
    db = await idb.openDB('Solucyon', 6, {
      upgrade(db) {
        const storeNames = Object.values(db.objectStoreNames);
        try {
          if (!storeNames.includes('state')) {
            db.createObjectStore('state', {
              keyPath: 'name',
            });
          }
          for (const {table, indexes} of database) {
            if (!storeNames.includes(table)) {
              const store = db.createObjectStore(table, {
                keyPath: 'id',
              });
              if (indexes) {
                for (const index of indexes) {
                  store.createIndex(index, index);
                }
              }
            }
          }
        } catch (e) {
          error(e);
        }
      },
    }).catch(error);
    state = (await db.getAll('state')).reduce((r, {name, ...s}) =>
      ({...r, [name]: s}), {});
  }

  /**
 * Execute request
 * @param {string} endpoint
 * @param {object} data
 */
  async function run(endpoint, data) {
    console.log(`Run ${url}${endpoint}`);
    if (data) console.log('Data : ', data);
    const body = {state};
    if (data) body.data = data;
    const res = await axios.post(url + endpoint, body, {
      headers: {
        'x-access-token': MemberStack.getToken(),
      },
    }).catch(error);
    const {result, stores, state: updatedState} = res.data;
    if (stores) {
      await sync(stores, updatedState);
    } else if (updatedState) {
      await setState(updatedState);
    }
    console.log('Run done!');
    return result;
  }

  /**
 * Clear Database
 */
  async function clearDB() {
    const tables = [];
    tables.push(db.clear('state'));
    for (const {table} of database) {
      tables.push(db.clear(table));
    }
    await Promise.all(tables).catch(error);
    console.log('Clear done!');
  }

  /**
 * Sync Client Database with Server
 * @param {object} stores
 * @param {object} updatedState
 */
  async function sync(stores, updatedState) {
    await clearDB();
    for (const table of Object.keys(stores)) {
      const tx = db.transaction(table, 'readwrite');
      const updates = [];
      for (const record of stores[table]) {
        updates.push(tx.store.add(record));
      }
      await Promise.all([
        ...updates,
        tx.done,
      ]).catch(error);
    }
    await setState(updatedState);
    console.log('Sync done!');
  }

  /**
 * Set new
 * @param {object} newState
 * @param {string} path
 */
  async function setState(newState = {}, path) {
    state = {...state, ...newState};
    for (const key in state) {
      if (state.hasOwnProperty(key)) {
        const {table, id} = state[key];
        if (table && id) {
          state[key].value = await db.get(table, id);
        }
      }
    }
    const tx = db.transaction('state', 'readwrite');
    const updates = [];
    for (const key in state) {
      if (state.hasOwnProperty(key)) {
        const record = {name: key, ...state[key]};
        updates.push(tx.store.put(record, key));
      }
    }
    await Promise.all([
      ...updates,
      tx.done,
    ]).catch(error);
    await hydrate(path);
    console.log('State set!');
  }

  /**
 * Rebuild DOM with data
 * @param {string} path
 */
  async function hydrate(path) {
    const hydrates = [];
    for (const dependency of dependencies) {
      if (!!path || path === dependency.path) {
        hydrates.push(dependency.hydrate());
      }
    }
    await Promise.all(hydrates);
    console.log('Hydrate done!');
  }

  /**
 * Build DOM with data
 */
  function build() {
    console.log('Build start', state);
    const load = () => {
      for (const component of components) {
        const attribute = component.selector.match(/(?<=\[)data-ws-[a-z\-]+(?=\])/)[0]
        const elements = document.querySelectorAll(component.selector +
          `:not([${attribute}-loaded])`);
        elements.forEach((element) => {
          console.log('Build ' + component.selector);
          element.setAttribute(attribute + '-loaded', true);
          const dependency = component.build(element);
          if (dependency) dependencies.push(dependency);
        });
      }
    };
    const observer = new MutationObserver(load);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    window.onload = function() {
      load();
      observer.disconnect();
      console.log('Build done!');
    };
    load();
  }

  /**
 * Upsert data
 * @param {string} table
  * @param {array} records
  * @param {boolean} insertOnly
 */
  async function upsert(table, records, insertOnly = false) {
    const tx = db.transaction(table, 'readwrite');
    const store = tx.objectStore(table);
    const upserts = [];
    for (const record of records) {
      if (!!record.id) {
        upserts.push(store.get(record.id).then((data) => {
          store.put({...data, ...record});
        }));
      } else {
        const id = Math.floor(Math.random() * 1000000);
        upserts.push(store.add({...record, id}));
      }
    }
    await Promise.all([
      ...upserts,
      tx.done,
    ]);
    if (insertOnly === false && records.length === 1) {
      await select(table, records[0].id);
    }
    await Promise.all([
      hydrate(table),
      run('upsert', {table, records}),
    ]);
    console.log('Upsert done!');
  }

  /**
 * Select state
 * @param {string} table
  * @param {string} recordId
 */
  async function select(table, recordId) {
    await setState({
      ['selected_' + table]: {id: recordId, table},
    }, 'state.' + table);
    console.log('Select done!');
  }

  /**
 * Archive data
 * @param {string} table
  * @param {array} ids
 */
  async function archive(table, ids) {
    const tx = db.transaction(table, 'readwrite');
    const store = tx.objectStore(table);
    const archives = [];
    for (const id of ids) {
      archives.push(store.delete(id));
    }
    await Promise.all([
      ...archives,
      tx.done,
    ]);
    await Promise.all([
      hydrate(table),
      run('archive', {table, ids}),
    ]);
    console.log('Archive done!');
  }

  MemberStack.onReady.then(async function(user) {
    if (user.loggedIn === true) {
      console.log('Logged in!');
      await initDB();
      if (user.id !== state.logged_user?.value?.memberstack_id) {
        await clearDB();
      }
      build();
      await run('sync');
      console.log('Init done!');
    } else {
      await initDB();
      await clearDB();
      console.log('Logged out');
    }
  });

  return () => state;
})();
