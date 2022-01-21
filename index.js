WebState = {
  getStateNameFromTable: function(table) {
    table.replace(/s$/, '');
  },
  run: async function(endpoint, data = null) {
    const loaders = document.getElementsByClassName('loader');
    loaders.forEach((l) => l.style.display = 'inherit');
    const body = {
      state: (await idbKeyval.get('state')) || {},
    };
    if (data) body.data = data;
    const {
      data: {
        tables,
        updatedState,
        results,
      },
    } = await axios.post(WebState.api + endpoint, body, {
      headers: {
        'x-access-token': MemberStack.getToken(),
      },
    }).catch(function(error) {
      alert(error.message);
      if (error.response) {
        console.log(error.response.data);
      } else if (error.request) {
        console.log(error.request);
      } else {
        console.log('Error', error.message);
      }
    });
    await idbKeyval.setMany(Object.keys(tables)
        .map((table) => ([table, tables[table]])));
    await idbKeyval.set('state', updatedState);
    await WebState.build();
    loaders.forEach((l) => l.style.display = 'none');
    return results;
  },
  getTable: async function(table, filters = null, fields = null) {
    let records = await idbKeyval.get(table);
    if (filters) {
      records = records.filter((record) => {
        let i = 0;
        let valid = true;
        do {
          const filter = filters[i];
          switch (filter.operator) {
            case 'IS ANY OF':
              valid = value.indexOf(record[filter.key]) > -1;
              break;
            default:
              valid = record[filter.key] == filter.value;
              break;
          }
          i++;
        } while (valid === true && i < filters.length);
        return valid;
      });
    }
    if (fields) {
      records = records.map((record) => {
        const clone = {
          id: record.id,
        };
        for (const field of fields) {
          clone[field] = record[field];
        }
        return clone;
      });
    }
    return records;
  },
  getActive: async function(name) {
    const state = (await idbKeyval.get('state')) || {};
    return state[name];
  },
  setActive: async function(name, table, id) {
    const state = await idbKeyval.get('state');
    const [record] = await WebState.getTable(table, [{
      key: 'id',
      value: id,
    }]);
    state[name] = record;
    await idbKeyval.set('state', state);
    return state[name];
  },
  upsert: async function(table, records, insertOnly = false) {
    let data;
    let state;
    if (insertOnly === true) {
      data = await idbKeyval.get(table);
    } else if (records.length === 1) {
      const values = await idbKeyval.getMany([table, 'state']);
      data = values[0];
      state = values[1];
    }
    for (const record of records) {
      if (record.id) {
        const index = data.findIndex((r) => r.id === record.id);
        data[index] = record;
      } else {
        data.push(record);
      }
    }
    if (insertOnly === true) {
      await idbKeyval.set(table, data);
    } else if (records.length === 1) {
      state[WebState.getStateNameFromTable(table)] = records[0];
      await idbKeyval.setMany([table, 'state'], [data, state]);
    }
    WebState.build();
    const results = await WebState.run('upsert', {
      table,
      records,
    });
    console.log('Upsert done!');
    return results;
  },
  archive: async function(table, ids) {
    let data = await idbKeyval.get(table);
    data = data.filter((r) => ids.indexOf(r.id) === -1);
    await idbKeyval.set(table, data);
    WebState.build();
    const results = await WebState.run('archive', {
      table,
      ids,
    });
    console.log('Archive done!');
    return results;
  },
  build: async function() {
    // Get State
    const components = [];

    // Get Parent Element Matches Selector
    const getClosest = function(elem, selector) {
      for (; elem && elem !== document; elem = elem.parentNode) {
        if (elem.matches(selector)) return elem;
      }
      return null;
    };

    // Forms
    const forms = document.querySelectorAll('form[data-ws-form]');
    for (let i = 0, form; form = forms[i]; i++) {
      const [
        action,
        tableOrEndpoint,
      ] = form.getAttribute('data-ws-form').split('.');
      components.push({
        dependency: 'state',
        hydrate: function(state) {
          const record = state[WebState.getStateNameFromTable(tableOrEndpoint)];
          if (!!record) {
            form.setAttribute('data-ws-record-id', record.id);
            const fields = form.querySelectorAll('input:not([type="submit"])');
            for (let j = 0, field; field = fields[j]; j++) {
              const name = field.getAttribute('name');
              field.value = record[name];
              field.disabled = !!field.getAttribute('data-ws-disabled');
              console.log(
                  `Hydrate ${name} of ${tableOrEndpoint} ` +
                  `with "${record[name]}"`,
              );
            }
          }
        },
      });
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
            await WebState.upsert(tableOrEndpoint, [record], true);
            break;
          case 'upsert':
            await WebState.upsert(tableOrEndpoint, [record]);
            break;
          case 'run':
            form.reset();
            await WebState.run(tableOrEndpoint, record);
            break;
          default:
            break;
        }
      };
    }

    // Lists
    /* const lists = document.querySelectorAll('[data-ws-button]');
    for (let i = 0, list; list = lists[i]; i++) {

    }*/

    // Buttons
    const buttons = document.querySelectorAll('[data-ws-button]');
    for (let i = 0, button; button = buttons[i]; i++) {
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
            const record = await WebState.getTable(table, [{
              key: 'id',
              value,
            }]);
            await WebState.run(endpoint, record);
            break;
          case 'setActive':
            await WebState.setActive(
                WebState.getStateNameFromTable(table), table, recordId,
            );
            break;
          case 'archive':
            await WebState.archive(table, [recordId]);
            break;
          default:
            break;
        }
      };
    }

    // Texts
    const texts = document.querySelectorAll('[data-ws-field]');
    for (let i = 0, text; text = texts[i]; i++) {
      const [name, field] = text.getAttribute('data-ws-field').split('.');
      components.push({
        dependency: 'state',
        hydrate: function(state) {
          const record = state[name];
          text.innerText = !!record && record[field];
          console.log(`Hydrate ${field} of ${name} with "${record[field]}"`);
        },
      });
    }

    // Load Data Into Components
    console.log('Components', components.length);
    const dependencies = components
        .map((c) => c.dependency)
        .filter((value, index, self) => {
          return self.indexOf(value) === index;
        });
    console.log('Dependencies', dependencies);
    const data = await idbKeyval.getMany(dependencies);
    console.log('Data', data);
    for (const component of components) {
      const index = dependencies.findIndex((d) => component.dependency === d);
      component.hydrate(data[index]);
    }

    console.log('Build done!');
  },
  init: function({
    env,
  }) {
    WebState.api = env === 'DEV' ? 'https://dev.api.solucyon.com/' : 'https://api.solucyon.com/';
    MemberStack.onReady.then(async function(user) {
      if (user.loggedIn === true) {
        document.onload = WebState.build();
        await WebState.run('sync');
        console.log('Init done!');
      } else {
        await idbKeyval.clear();
      }
    });
  },
};
