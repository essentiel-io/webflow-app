WebState = {
  AUTOCODE_URL: "",
  dependencies: {},
  components: [],
  request: async (endpoint, params = {}) => {
    const { data: tables } = await axios.post(AUTOCODE_URL + endpoint, { 
      user: WebState.user,
      dependencies: WebState.dependencies,
      params,
    }).catch(function (error) {
        alert(error.message);
        if (error.response) {
          console.log(error.response.data);
        } else if (error.request) {
          console.log(error.request);
        } else {
          console.log('Error', error.message);
        }
      });
    await idbKeyval.setMany(Object.keys(tables).map(table => ([table, tables[table]])));
    WebState.reload();
  },
  reload: () => {
    for (let component of WebState.components) component();
  },
  get: (key) => {
    const dependency = WebState.dependencies[key];
    if (dependency) {
      let records = await idbKeyval.get(dependency.table);
      records = records.filter(record => {
        let i = 0;
        let valid = true;
        do {
          const filter = dependency.filters[i];
          switch (filter.operator) {
            case "IS ANY OF":
              valid = value.indexOf(record[filter.key]) > -1;
              break;
            default:
              valid = record[filter.key] == filter.value;
              break;
          }
          i++;
        } while (valid === true && i < dependency.filters.length);
        return valid;
      });
      records = records.map(record => {
        const clone = { id: record.id };
        for (let field of dependency.fields) {
          clone[field] = record[field];
        }
        return clone;
      });
      return dependency.unique === true ? records[0] : records;
    }
    throw new Error(`There is no dependencies for key "${key}"`);
  },
  upsert: () => {},
  delete: () => {},
  user: null,
  init: async (params) => {
    const user = await MemberStack.onReady;
    if (user.loggedIn === true) {
      const { email, id } = user
      WebState.user = { memberstack_id: id, email, ready: false };
      WebState = { ...Webstate, ...params };
      WebState.request('syncDB');
      document.onload = () => {
        
        Webstate.reload()
      }
    }
  }
}
WebState.init({
  AUTOCODE_URL: "https://dev--solucyon-backend.thomas-essentiel.autocode.gg/",
  dependencies: {
    loggedUser: (context) => ({
      table: 'users',
      fields: ['name', 'email', 'account_type', 'active_organization', 'memberstack_id'],
      filters: [{ key: 'memberstack_id', value: context.user.memberstack_id }],
      unique: true
    }),
    activeOrganization: (context) => ({
      table:'organizations',
      fields: ['name', 'logo'], 
      filters: [{ key: 'id', value: context.user.active_organization }],
      unique: true
    }),
    userRoles: (context) => ({
      table: 'roles',
      fields: ['name', 'category'], 
      filters: [{ key: context.user.id, operator: 'IS ANY OF', value: 'users' }]
    }),
    organizationMembers: (context) => ({
      table: 'users',
      fields: ['name', 'category'], 
      filters: [{ key: context.user.active_organization, operator: 'IS ANY OF', value: 'organizations' }]
    })
  }
});






Autocode = {
  actions: async function(actions = []) {
    const logged = await MemberStack.onReady;
    if (!!logged) {
      const { getLoggedUser } = Autocode.data
      const user = !!getLoggedUser && getLoggedUser.memberstack_id === logged.id ? getLoggedUser : { memberstack_id: logged.id, init: true };
      const loaders = document.getElementsByClassName('loader');
      actions = actions.map(a => ({ ...a, body: a.body || Autocode.history[a.action]}));
      for (let a of actions) Autocode.history[a.action] = a.body;
      loaders.forEach(l => l.style.display = "inherit");
      console.log("Run actions : ", actions);
      const { data } = await axios.post(`https://dev--solucyon-backend.thomas-essentiel.autocode.gg/index/`, { actions, user }).catch(function (error) {
        alert(error.message);
        if (error.response) {
          console.log(error.response.data);
        } else if (error.request) {
          console.log(error.request);
        } else {
          console.log('Error', error.message);
        }
      });
      loaders.forEach(l => l.style.display = "none");
      console.log("Results : ", data);
      for (let response of data) Autocode.data[response.action] = response.data;
      localStorage.setItem('AutocodeData', JSON.stringify(Autocode.data));
      Autocode.reload();
    }
  },
  data: JSON.parse(localStorage.getItem('AutocodeData') || '{}'),
  components: [],
  reload: () => {
    for (let component of Autocode.components) component();
  },
  history: {}
}

<!-- Autocode -->
<script>
  try {
    const forms = document.querySelectorAll("form");
    forms.forEach(form => {
      form.onsubmit = event => {
        event.preventDefault();
        const data = new FormData(form);
        let body = {};
        for (const [name, value] of data) {
          body[name] = value;
        }
        const actionsAfterSubmit = form.getAttribute('data-autocode-onsubmit').split(',');
        Autocode.actions([
          {
            action: form.id,
            body
          }, ...actionsAfterSubmit.map(action => ({ action }))
        ]);
        form.reset();
      }
    });
	Autocode.components.push(() => {
      console.log("Load values");
      const elements = document.querySelectorAll("[data-autocode-field]");
      for (let element of elements) {
        const path = element.getAttribute("data-autocode-field");
        const [action, field] = path.split('.');
        element.value = Autocode.data[action] && Autocode.data[action][field];
        element.disabled = element.getAttribute("data-autocode-disabled");
      }
    });
    Autocode.reload();
    const actions = [];
    for (let json of document.getElementsByClassName("json")) {
      actions.push({ ...JSON.parse(json.innerText), async: true });
    }
    Autocode.actions(actions);
  } catch(e) {
   	console.log(e);
    alert(e);
  }
</script>
