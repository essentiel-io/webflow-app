WebState = {
    AUTOCODE_URL: "",
    dependencies: {},
    components: [],
    request: async function(endpoint, params = {}) {
        const loaders = document.getElementsByClassName("loader");
        loaders.forEach((l) => l.style.display = "inherit");
        const {
            data: tables
        } = await axios.post(AUTOCODE_URL + endpoint, {
            dependencies: WebState.dependencies,
            params,
            state: WebState.state
        }).catch(function(error) {
            alert(error.message);
            if (error.response) {
                console.log(error.response.data);
            } else if (error.request) {
                console.log(error.request);
            } else {
                console.log("Error", error.message);
            }
        });
        await idbKeyval.setMany(Object.keys(tables).map((table) => ([table, tables[table]])));
        for (let state of Object.keys(WebState.state)) {
            if (WebState.state[state].toLoad === true) {
                WebState.state[state] = await WebState.get(state);
            }
        }
        WebState.reload();
        loaders.forEach(l => l.style.display = "none");
    },
    reload: () => {
        for (let component of WebState.components) component();
    },
    get: async(key) => {
        const dependency = WebState.dependencies[key](WebState.state);
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
                const clone = {
                    id: record.id
                };
                for (let field of dependency.fields) {
                    clone[field] = record[field];
                }
                return clone;
            });
            return dependency.unique === true ? records[0] : records;
        }
        throw new Error(`There is no dependencies for key "${key}"`);
    },
    run: () => {},
    upsert: () => {},
    delete: () => {},
    state: {},
    init: async(params) => {
        const user = await MemberStack.onReady;
        if (user.loggedIn === true) {
            const {
                email,
                id
            } = user
            WebState.state.user = {
                memberstack_id: id,
                email,
                toLoad: true
            };
            WebState = {...WebState,
                ...params
            };
            document.onload = () => {
                const forms = document.querySelectorAll("form");
                forms.forEach(form => {
                    form.onsubmit = event => {
                        event.preventDefault();
                        const data = new FormData(form);
                        let record = {};
                        for (const [name, value] of data) {
                            record[name] = value;
                        }
                        const table = form.getAttribute("data-webstate-table")
                        WebState.upsert({
                            table,
                            records: [record]
                        });
                        form.reset();
                    }
                });
                WebState.components.push(() => {
                    console.log("Load values");
                    const elements = document.querySelectorAll("[data-webstate-field]");
                    for (let element of elements) {
                        const path = element.getAttribute("data-webstate-field");
                        const [dependency, field] = path.split('.');
                        const record = await WebState.get(dependency);
                        element.value = record[field];
                        element.disabled = element.getAttribute("data-webstate-disabled");
                    }
                });
                WebState.reload();
                WebState.request('syncDB');
            }
        }
    }
}
WebState.init({
    AUTOCODE_URL: "https://dev--solucyon-backend.thomas-essentiel.autocode.gg/",
    dependencies: {
        user: (state) => ({
            table: 'users',
            fields: ['name', 'email', 'account_type', 'active_organization', 'memberstack_id'],
            filters: [{
                key: 'memberstack_id',
                value: state.user.memberstack_id
            }],
            unique: true
        }),
        activeOrganization: (state) => ({
            table: 'organizations',
            fields: ['name', 'logo'],
            filters: [{
                key: 'id',
                value: state.user.active_organization
            }],
            unique: true
        }),
        userRoles: (state) => ({
            table: 'roles',
            fields: ['name', 'category'],
            filters: [{
                key: state.user.id,
                operator: 'IS ANY OF',
                value: 'users'
            }]
        }),
        organizationMembers: (state) => ({
            table: 'users',
            fields: ['name', 'email', 'account_type'],
            filters: [{
                key: state.user.active_organization,
                operator: 'IS ANY OF',
                value: 'organizations'
            }]
        })
    }
});
