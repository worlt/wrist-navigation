const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/app.ux'), 'utf8')
  .match(/<script>([\s\S]*?)<\/script>/)[1].replace('export default', 'module.exports =');
function launch(missing = false) {
  const time = require('./helpers/clock')();
  let instances = 0; const sent = [], vibrations = [];
  const connection = { getReadyState: callbacks => callbacks.success({ status: 1 }),
    send(callbacks) { sent.push(JSON.parse(callbacks.data)); if (callbacks.success) callbacks.success(); } };
  const context = { module: { exports: {} }, Date: { now: time.now }, setTimeout: time.schedule, clearTimeout: time.unschedule, require(name) {
    if (name === '@system.storage') return { get: cb => cb.success(''), set: cb => cb.success() };
    if (name === './common/native') return { loadNative: context.require };
    if (name === './common/session') return require('../src/common/session');
    if (name === '@system.interconnect') { if (missing) throw Error('API missing');
      return { instance() { instances++; return connection; } }; }
    if (name === '@system.vibrator') return { vibrate(request) { vibrations.push(request.mode); } };
    throw Error('unexpected '+name);
  } };
  vm.runInNewContext(source, context); return { app: context.module.exports, connection, sent, vibrations, advance: time.advance, instances: () => instances };
}
test('App starts transport without a page, does not double-create, and shuts down at App destruction', () => {
  const run = launch(); run.app.onCreate(); run.app.onCreate(); assert.equal(run.instances(), 1);
  const message = run.connection.onmessage;
  const packet = seq => ({ v: 1, type: 'navigation', session: 'phone', seq, status: 'active', title: '高德地图',
    rawText: '前方200米右转', instruction: '右转', maneuver: 'right', distance: '200 米', actionId: 'turn-'+seq, mode: 'walk', vibrationEnabled: true });
  message({ data: JSON.stringify(packet(1)) }); assert.deepEqual(run.vibrations, ['long']);
  const session = run.app.navigationSession; run.app.onDestroy(); const count = run.sent.length;
  message({ data: JSON.stringify(packet(2)) }); run.app.onShow();
  run.advance(5000);
  assert.equal(session.isAlive(), false); assert.equal(run.sent.length, count); assert.equal(run.vibrations.length, 1);
});
test('missing native API never prevents App creation or a usable error snapshot', () => {
  const run = launch(true); assert.doesNotThrow(() => run.app.onCreate());
  assert.match(run.app.navigationSession.peek().connectionError, /API missing/);
  assert.doesNotThrow(() => run.app.onDestroy());
});
