(() => {
  let storage; try { storage = window.localStorage; } catch { }
  const model = phonePreviewModel().create(phoneConfig, storage), api = phonePreviewModel();
  const root = document.getElementById('phone-stage');
  const screens = [...document.querySelectorAll('[data-screen]')];
  const set = (name, field, text) => { document.querySelector(`[data-device="${name}"] [data-field="${field}"]`).textContent = text; };
  function render() {
    for (const name of ['phone', 'band']) {
      const value = api.view(model, name), panel = document.querySelector(`[data-device="${name}"]`);
      for (const field of ['current', 'latest', 'source', 'status', 'detail', 'channel']) set(name, field, value[field]);
      panel.querySelector('[data-field="detail"]').hidden = !value.detail;
      panel.querySelector('[data-action="check"]').disabled = value.checking;
      panel.querySelector('[data-action="check"]').textContent = value.checking ? '正在检查…' : '检查' + (name === 'phone' ? '手机' : '手环') + '更新';
      const toggle = panel.querySelector('[data-action="details"]');
      toggle.setAttribute('aria-expanded', String(value.expanded));
      panel.querySelector('.details-body').hidden = !value.expanded;
      for (const setting of ['auto', 'preview']) document.querySelector(`[data-setting="${setting}"][data-name="${name}"]`).checked = value[setting];
    }
    document.getElementById('settings-summary').textContent = model.phone.preview || model.band.preview ? '检查设置 · 已选择 Preview' : '检查设置';
  }
  function screen(name) {
    screens.forEach(element => { element.hidden = element.dataset.screen !== name; });
    document.querySelectorAll('[data-action="screen"]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.target === name)));
    root.scrollTop = 0;
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const name = button.closest('[data-device]')?.dataset.device;
    if (button.dataset.action === 'screen') screen(button.dataset.target);
    if (button.dataset.action === 'open-updates') { screen('updates'); if (button.dataset.target) document.querySelector(`[data-device="${button.dataset.target}"]`).scrollIntoView({ block: 'nearest', behavior: 'auto' }); }
    if (button.dataset.action === 'close-updates') screen('home');
    if (button.dataset.action === 'details') { model[name].expanded = !model[name].expanded; render(); }
    if (button.dataset.action === 'check') { const token = api.begin(model, name); render(); setTimeout(() => { api.finish(model, name, token); render(); }, 650); }
    if (button.dataset.action === 'kill') document.getElementById('exit-result').textContent = '模拟强杀：手机可能没来得及发送退出通知，手环无法跟随退出。';
    if (button.dataset.action === 'return') document.getElementById('exit-result').textContent = '模拟正常返回：开启退出联动时，手机有机会发送退出通知，手环可跟随退出。';
  });
  document.addEventListener('change', event => {
    const input = event.target;
    if (input.id === 'theme') document.getElementById('phone-frame').dataset.theme = input.value;
    if (input.id === 'scene') { api.scenario(model, input.value); render(); }
    if (input.dataset.setting) {
      const name = input.dataset.name;
      if (input.dataset.setting === 'preview') api.channel(model, name, input.checked); else model[name].auto = input.checked;
      api.save(model, storage); render();
    }
  });
  screen('home'); render();
})();
