import axios from 'https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js';
import idb from 'https://cdn.jsdelivr.net/npm/idb@7/build/umd-with-async-ittr.js';
import Sortable from 'https://cdn.jsdelivr.net/npm/sortablejs@1.14.0/Sortable.min.js';

WebState = (function() {
  let db;
  let url;
  let state = {};
  let database;

  const getClosest = function(elem, selector) {
    for (; elem && elem !== document; elem = elem.parentNode) {
      if (elem.matches(selector)) return elem;
    }
    return null;
  };

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
          if (recordState) {
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
          if (recordState) {
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
          if (recordState) {
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
  ];

  async function initDB() {
    db = await idb.openDB('Solucyon', 4, {
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

  async function clearDB() {
    const tables = [];
    tables.push(db.clear('state'));
    for (const {table} of database) {
      tables.push(db.clear(table));
    }
    await Promise.all(tables).catch(error);
    console.log('Clear done!');
  }

  async function run(endpoint, data) {
    const body = {state};
    if (data) body.data = data;
    const res = await axios.post(url + endpoint, body, {
      headers: {
        'x-access-token': MemberStack.getToken(),
      },
    }).catch(error);
    const {result, stores} = res.data;
    if (res.data.state) await setState(res.data.state);
    if (stores) await sync(stores);
    console.log('Run done!');
    return result;
  }

  async function setState(newState = {}) {
    state = {...state, ...newState};
    const tx = db.transaction('state', 'readwrite');
    const updates = [];
    for (const key in state) {
      if (state.hasOwnProperty(key)) {
        const record = { name: key, ...state[key] };
        updates.push(tx.store.put(record));
      }
    }
    await Promise.all([
      ...updates,
      tx.done,
    ]).catch(error);
    console.log('State set!');
  }

  async function refreshState() {
    for (const key in state) {
      if (state.hasOwnProperty(key)) {
        const {table, id} = state[key];
        if (table && id) {
          state[key].value = await db.get(table, id);
        }
      }
    }
    await setState();
    console.log('State refreshed!', state);
  }

  async function sync(stores) {
    for (const table of Object.keys(stores)) {
      const tx = db.transaction(table, 'readwrite');
      const updates = [];
      for (const record of stores[table]) {
        updates.push(tx.store.put(record));
      }
      await Promise.all([
        ...updates,
        tx.done,
      ]).catch(error);
    }
    await refreshState();
    await hydrate();
    console.log('Sync done!');
  }

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

  function build() {
    const load = function () {
      for (const component of components) {
        const elements = document.querySelectorAll(component.selector +
          ':not([loaded])');
        elements.forEach((element) => {
          console.log('Build ' + component.selector);
          element.setAttribute('loaded', true);
          const dependency = component.build(element);
          if (dependency) dependencies.push(dependency);
        });
      }
    }
    const observer = new MutationObserver(load);
    observer.observe(document, {
      childList: true,
      subtree: true,
    });
    window.onload = () => {
      load();
      observer.disconnect();
      console.log('Build done!');
    };
  }

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

  async function select(table, recordId) {
    await setState({['selected_' + table]: {id: recordId, table}});
    await refreshState();
    await hydrate('state.' + table);
    console.log('Select done!');
  }

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

  function init(params) {
    url = params.env === 'DEV' ? 'https://dev.api.solucyon.com/' : 'https://api.solucyon.com/';
    database = params.database;
    MemberStack.onReady.then(async function(user) {
      if (user.loggedIn === true) {
        await initDB();
        if (user.id !== state.logged_user?.value?.memberstack_id) await clearDB();
        build();
        await run('sync');
        console.log('Init done!');
      }
    });
  }

  return {init};
})();
