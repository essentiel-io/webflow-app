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
