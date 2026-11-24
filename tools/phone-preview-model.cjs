// Offline UI model. No device connection, live GitHub requests or package installation.
module.exports = function phonePreviewModel() {
  const key = 'wrist.phone.preview.v1';
  function create(config, storage) {
    const device = part => ({ current: part.versionName, code: part.versionCode, latest: part.versionName,
      latestCode: part.versionCode, auto: true, preview: false, expanded: false, state: 'complete', generation: 0 });
    const model = { phone: device(config.phone), band: device(config.band), scene: 'same' };
    try {
      const saved = JSON.parse(storage?.getItem(key) || 'null');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) for (const name of ['phone', 'band']) {
        for (const setting of ['auto', 'preview']) if (typeof saved[name]?.[setting] === 'boolean') model[name][setting] = saved[name][setting];
      }
    } catch { /* Storage is optional; it cannot prevent an offline preview. */ }
    return model;
  }
  function save(model, storage) {
    try { storage?.setItem(key, JSON.stringify(Object.fromEntries(['phone', 'band'].map(name => [name, { auto: model[name].auto, preview: model[name].preview }])))); } catch { }
  }
  function scenario(model, scene) {
    if (!['same', 'update', 'unknown', 'offline'].includes(scene)) scene = 'same';
    model.scene = scene;
    for (const name of ['phone', 'band']) {
      const device = model[name]; device.generation++; device.state = scene === 'offline' ? 'incomplete' : 'complete';
      device.unknown = name === 'band' && scene === 'unknown';
      device.latest = scene === 'update' ? name === 'phone' ? '0.4.3' : '0.5.2' : device.current;
      device.latestCode = device.code + (scene === 'update' ? 1 : 0);
      device.expanded = false;
    }
  }
  function begin(model, name) { const device = model[name]; device.state = 'checking'; return ++device.generation; }
  function finish(model, name, token) { const device = model[name]; if (device.generation !== token) return; device.state = model.scene === 'offline' ? 'incomplete' : 'complete'; }
  function channel(model, name, checked) { const device = model[name]; device.generation++; device.preview = checked; device.state = model.scene === 'offline' ? 'incomplete' : 'complete'; }
  function view(model, name) {
    const d = model[name], channelName = d.preview ? '正式 + Preview' : '正式版';
    let status = d.unknown ? '手环版本未知' : d.latestCode > d.code ? '有新版本可用' : '当前无需更新';
    if (d.state === 'checking') status = '正在检查更新';
    else if (d.state === 'incomplete') status = '版本信息待确认';
    const detail = d.state === 'checking' ? '模拟检查中，不会访问 GitHub。' : d.state === 'incomplete' ? '模拟网络失败，已有版本待确认。' : d.unknown ? '连接并打开手环应用后，才能判断是否需要升级。' : d.latestCode > d.code ? '核对双端配套后，再手动更新。' : '';
    return { current: d.unknown ? '未知' : d.current, latest: d.latest, status, detail,
      source: channelName + (model.scene === 'update' ? ' · 虚构新版本' : ' · 模拟数据') + (d.state === 'incomplete' ? ' · 待确认' : d.state === 'checking' ? ' · 确认中' : ''),
      channel: channelName, checking: d.state === 'checking', expanded: d.expanded, auto: d.auto, preview: d.preview };
  }
  return { create, save, scenario, begin, finish, channel, view };
};
