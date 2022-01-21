WebState = {
    run: async function(endpoint, data = null) {
        const loaders = document.getElementsByClassName("loader");
        loaders.forEach((l) => l.style.display = "inherit");
        const body = {
            state: (await idbKeyval.get("state")) || {}
        };
        if (data) body.data = data;
        const {
            data: {
                tables,
                updatedState,
                results
            }
        } = await axios.post(WebState.api + endpoint, body, {
            headers: {
                "x-access-token": MemberStack.getToken()
            }
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
        await idbKeyval.set("state", updatedState);
        await WebState.build();
        loaders.forEach(l => l.style.display = "none");
        return results;
    },
    getTable: async function(table, filters = null, fields = null) {
        let records = await idbKeyval.get(table);
        if (filters) {
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
        }
        if (fields) {
            records = records.map(record => {
                const clone = {
                    id: record.id
                };
                for (let field of fields) {
                    clone[field] = record[field];
                }
                return clone;
            });
        }
        return records;
    },
    getActive: async function(name) {
        const state = (await idbKeyval.get("state")) || {};
        return state[name];
    },
    setActive: async function(name, table, id) {
        const state = await idbKeyval.get("state");
        const [record] = await WebState.getTable(table, [{
            key: 'id',
            value: id
        }]);
        state[name] = record;
        await idbKeyval.set("state", state);
        return state[name];
    },
    upsert: async function(table, records) {
        let data = await idbKeyval.get(table);
        for (let record of records) {
            if (record.id) {
                const index = data.findIndex(r => r.id === record.id);
                data[index] = record;
            } else {
                data.push(record);
            }
        }
        await idbKeyval.set(table, data);
        WebState.build();
        await WebState.run("upsert", {
            table,
            records
        });
        console.log("Upsert done!");
    },
    archive: async function(table, ids) {
        let data = await idbKeyval.get(table);
        data = data.filter(r => ids.indexOf(r.id) === -1);
        await idbKeyval.set(table, data);
        WebState.build();
        await WebState.run("archive", {
            table,
            ids
        });
        console.log("Archive done!");
    },
    build: async function() {
        // Get State
        const state = (await idbKeyval.get("state")) || {};

        // Get State Name From Table Name
        const getStateName = table => table.replace(/s$/, "");

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
            const [action, tableOrEndpoint] = form.getAttribute("data-ws-form").split(".");
            (function prefill(record) {
                const activeRecord = record || state[getStateName(tableOrEndpoint)];
                if (!!activeRecord) {
                    form.setAttribute('data-ws-record-id', activeRecord.id);
                    const fields = form.querySelectorAll("input");
                    for (let j = 0, field; field = fields[j]; j++) {
                        const name = field.getAttribute("name");
                        field.value = activeRecord[name];
                        field.disabled = !!field.getAttribute("data-ws-disabled")
                    }
                }
            })();
            form.onsubmit = async function(event) {
                event.preventDefault();
                const data = new FormData(form);
                let record = {};
                for (let [name, value] of data) record[name] = value;
                const recordId = form.getAttribute('data-ws-record-id');
                if (recordId) record.id = recordId;
                switch (action) {
                    case 'insert':
                        form.reset();
                        await WebState.upsert(tableOrEndpoint, [record]);
                        break;
                    case 'upsert':
                        const table = tableOrEndpoint;
                        const [result] = await WebState.upsert(table, [record]);
                        await WebState.setActive(getTableName(table), table, result.id);
                        prefill(result);
                        break;
                    case 'run':
                        form.reset();
                        const endpoint = tableOrEndpoint;
                        await WebState.run(endpoint, record);
                        break;
                    default:
                        break;

                }
            });

        // Lists
        const lists = document.querySelectorAll('[data-ws-button]');
        for (let i = 0, list; list = lists[i]; i++) {

        }

        // Buttons
        const buttons = document.querySelectorAll('[data-ws-button]');
        for (let i = 0, button; button = buttons[i]; i++) {
            button.onclick = async function(event) {
                event.preventDefault();
                const [action, endpoint] = button.getAttribute("data-ws-button").split(".");
                const [table, recordId] = getClosest(button.parentNode, "[data-ws-record-id]").split(".");
                switch (action) {
                    case 'run':
                        const record = await WebState.getTable(table, [{
                            key: 'id',
                            value
                        }]);
                        await WebState.run(endpoint, record);
                        break;
                    case 'setActive':
                        await WebState.setActive(getStateName(table), table, recordId);
                        break;
                    case 'archive':
                        await WebState.archive(table, [recordId]);
                        break;
                    default:
                        break;
                }
            }
        }

        //Texts
        const texts = document.querySelectorAll('[data-ws-field]');
        for (let i = 0, text; text = texts[i]; i++) {
            const [name, field] = text.getAttribute('data-ws-field').split('.');
            const record = state[name];
            text.innerText = !!record && record[field];
        }

        console.log('Build done!');
    },
    init: function({
        env
    }) {
        WebState.api = env === "DEV" ? "https://dev.api.solucyon.com/" : "https://api.solucyon.com/";
        MemberStack.onReady.then(async function(user) {
            if (user.loggedIn === true) {
                document.onload = WebState.build();
                await WebState.run('sync');
                console.log("Init done!");
            } else {
                await idbKeyval.clear();
            }
        });
    }
}