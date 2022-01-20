// Init WebState
WebState = {
    run: async function(endpoint) {
        const loaders = document.getElementsByClassName("loader");
        loaders.forEach((l) => l.style.display = "inherit");
        const {
            data: { tables, updatedState }
        } = await axios.post("https://dev--solucyon-backend.thomas-essentiel.autocode.gg/" + endpoint, {
            state: await idbKeyval.get("state")
        }).catch(function (error) {
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
        await idbKeyval.set("state", updatedState);
        await WebState.build();
        loaders.forEach(l => l.style.display = "none");
    },
    getTable: async function(table, fields, filters) {
        let records = await idbKeyval.get(table);
        records = records.filter(record => {
            let i = 0;
            let valid = true;
            do {
                const filter = filters[i];
                switch (filter.operator) {
                    case "IS ANY OF":
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
        records = records.map(record => {
            const clone = {
                id: record.id
            };
            for (let field of fields) {
                clone[field] = record[field];
            }
            return clone;
        });
        return records;
    },
    getActive: () => {
        //TODO
    },
    setActive: () => {
        //TODO
    },
    upsert: () => {
        //TODO
    },
    delete: () => {
        //TODO
    },
    build: async function() {
        // TODO : Build app's components
        /*const forms = document.querySelectorAll("form");
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
        WebState.components.push(async () => {
            console.log("Load values");
            const elements = document.querySelectorAll("[data-webstate-field]");
            for (let element of elements) {
                const path = element.getAttribute("data-webstate-field");
                const [dependency, field] = path.split('.');
                const record = await WebState.get(dependency);
                element.value = record[field];
                element.disabled = element.getAttribute("data-webstate-disabled");
            }
        });*/
    },
    init: async function(params) {
        const user = await MemberStack.onReady;
        if (user.loggedIn === true) {
            await idbKeyval.set("state", {
                user: { 
                    memberstack_id: user.id, 
                    email: user.email
                } 
            });
            document.onload = WebState.build();
            await WebState.run('syncDB');
            console.log("Init done!");
        }
    }
}
WebState.init();
