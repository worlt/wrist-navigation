const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
test('generated browser preview resolves shared session modules and runs real page script', () => {
  execFileSync(process.execPath, [path.join(root, 'tools/preview-wearable.cjs')], { cwd: root });
  const html = fs.readFileSync(path.join(root, 'outputs/previews/wearable-source.html'), 'utf8');
  const bundle = JSON.parse(html.match(/const bundle=(.*);\n/)[1]);
  const cache = {}, sent = [];
  const connection = { getReadyState: callbacks => callbacks.success({ status: 1 }),
    send: callbacks => { sent.push(JSON.parse(callbacks.data)); if (callbacks.success) callbacks.success(); } };
  function load(name) {
    if (name === '@system.interconnect') return { instance: () => connection };
    if (name === '@system.storage') return { get: callbacks => callbacks.success(''), set: callbacks => callbacks.success() };
    if (name === '@system.brightness') return { setKeepScreenOn() {} };
    if (name === '@system.vibrator') return { vibrate() {} };
    if (cache[name]) return cache[name];
    assert.ok(bundle.modules[name], 'missing preview module '+name);
    const module = { exports: {} };
    new Function('module', 'require', bundle.modules[name])(module, child => load(child.startsWith('./') ? name.slice(0, name.lastIndexOf('/')+1)+child.slice(2) : child));
    return cache[name] = module.exports;
  }
  const context = { module: { exports: {} }, require: load, Date: { now: () => 100000 }, setTimeout: () => 1, clearTimeout() {} };
  vm.runInNewContext(bundle.script, context); const definition = context.module.exports;
  const page = Object.assign({}, definition.private, definition); page.onInit(); page.onReady(); page.onShow();
  connection.onmessage({ data: JSON.stringify({ v: 1, type: 'navigation', session: 'preview', seq: 1,
    status: 'active', title: '高德地图', rawText: '前方200米右转', instruction: '右转', maneuver: 'right', distance: '200 米' }) });
  assert.equal(page.status, '高德导航'); assert.equal(sent.at(-1).type, 'ack'); page.onDestroy();
});
