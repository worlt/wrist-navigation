const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHaptics, KEY } = require('../src/common/haptics');
const clock = require('./helpers/clock');
function launch(config = {}) {
  const time = clock(), pulses = [], writes = [];
  let read;
  const haptics = createHaptics({ ...time, load(name) {
    if (name === '@system.vibrator') return { vibrate(request) {
      if (config.missing) throw Error('unsupported');
      pulses.push({ mode: request.mode, at: time.now() });
    } };
    if (name === '@system.storage') return { get(cb) {
      read = cb; if (!config.pending) cb.success(config.saved || '');
    }, set(cb) { writes.push(cb); if (!config.pendingWrites) cb.success(); } };
    throw Error(name);
  } });
  haptics.load();
  return { haptics, time, pulses, writes, read: () => read };
}
test('default long pair and selectable short pair are separated in time', () => {
  const app = launch(); app.haptics.play(() => true);
  assert.deepEqual(app.pulses, [{ mode: 'long', at: 100000 }]);
  app.time.advance(1199); assert.equal(app.pulses.length, 1);
  app.time.advance(1); assert.equal(app.pulses[1].mode, 'long');
  app.time.advance(1200); assert.equal(app.time.count(), 0);
  app.haptics.select('gentle'); app.haptics.test(); app.time.advance(350);
  assert.deepEqual(app.pulses.slice(2).map(p => p.mode), ['short', 'short']);
  assert.equal(app.writes[0].key, KEY); assert.equal(JSON.parse(app.writes[0].value).profile, 'gentle');
});
test('late reads and serialized writes cannot overwrite the newest selection', () => {
  const app = launch({ pending: true, pendingWrites: true });
  app.haptics.select('gentle'); app.haptics.select('noticeable'); app.haptics.select('gentle');
  app.read().success('noticeable'); assert.equal(app.haptics.peek().profile, 'gentle');
  assert.equal(app.writes.length, 1); app.writes[0].success();
  assert.equal(app.writes.length, 2); assert.equal(JSON.parse(app.writes[1].value).profile, 'gentle');
  app.writes[1].fail(); assert.match(app.haptics.peek().status, /保存失败/);
});
test('stop, invalid guidance, API failure, delayed wake and disposal suppress the second pulse', () => {
  for (const event of ['cancel', 'invalid', 'missing', 'suspend', 'dispose']) {
    const app = launch({ missing: event === 'missing' }); let valid = true;
    app.haptics.play(() => valid);
    if (event === 'cancel') app.haptics.cancel();
    if (event === 'invalid') valid = false;
    if (event === 'dispose') app.haptics.dispose();
    if (event === 'suspend') app.time.suspend(10000); else app.time.advance(5000);
    assert.equal(app.pulses.length, event === 'missing' ? 0 : 1, event);
    assert.equal(app.time.count(), 0, event);
  }
});
test('rapid test taps do not queue and navigation takes priority over test vibration', () => {
  const app = launch(); assert.equal(app.haptics.test(), true);
  assert.equal(app.haptics.test(), false);
  app.time.advance(2400); assert.equal(app.pulses.length, 2);
  app.haptics.test(); app.haptics.play(() => true); app.time.advance(2400);
  assert.equal(app.pulses.length, 5);
  app.haptics.test(); app.haptics.cancelTest(); app.time.advance(2400);
  assert.equal(app.pulses.length, 6);
});
test('turn followed immediately by approach produces two non-overlapping pairs', () => {
  const app = launch(); app.haptics.play(() => true); app.haptics.play(() => true);
  app.time.advance(4800);
  assert.deepEqual(app.pulses.map(p => p.at), [100000, 101200, 102400, 103600]);
});
test('restored setting applies before a page exists; corrupt data falls back', () => {
  for (const saved of ['gentle', 'bad-data']) {
    const app = launch({ saved }); app.haptics.play(() => true); app.time.advance(2400);
    assert.deepEqual(app.pulses.map(p => p.mode), saved === 'gentle' ? ['short', 'short'] : ['long', 'long']);
  }
});

test('master switch persists with profile, cancels pending pulse and blocks manual test', () => {
  const app = launch(); app.haptics.test(); app.haptics.setEnabled(false); app.time.advance(5000);
  assert.equal(app.pulses.length, 1); assert.equal(app.haptics.test(), false);
  app.haptics.select('gentle');
  const saved = app.writes.at(-1).value;
  assert.deepEqual(JSON.parse(saved), { profile: 'gentle', enabled: false });
  const restored = launch({ saved }); assert.equal(restored.haptics.peek().enabled, false);
  assert.equal(restored.haptics.play(() => true), false);
  restored.haptics.setEnabled(true); restored.haptics.test(); restored.time.advance(350);
  assert.deepEqual(restored.pulses.map(p => p.mode), ['short', 'short']);
});

test('startup waits for saved master switch before any navigation or test pulse', () => {
  const app = launch({ pending: true });
  assert.equal(app.haptics.play(() => true), false); assert.equal(app.haptics.test(), false);
  app.read().success(JSON.stringify({ profile: 'gentle', enabled: false }));
  assert.equal(app.haptics.play(() => true), false); assert.equal(app.pulses.length, 0);
  app.haptics.setEnabled(true); app.haptics.test(); app.time.advance(350);
  assert.deepEqual(app.pulses.map(p => p.mode), ['short', 'short']);
});
