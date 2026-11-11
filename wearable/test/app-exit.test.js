const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAppExit } = require('../src/common/app-exit');
const protocol = require('../src/common/protocol');
function setup(missing = false) {
  const clock = require('./helpers/clock')(), errors = [], exited = [];
  const exit = createAppExit({ ...clock, load(name) { assert.equal(name, '@system.app');
    if (missing) throw Error('unavailable'); return { terminate: () => exited.push(true) }; }, onError: error => errors.push(error) });
  return { ...clock, exit, exited, errors };
}
test('exit is delayed, deduplicated and only requested by an explicit command', () => {
  const a = setup(); a.exit.consume({}); a.advance(1000); assert.equal(a.exited.length, 0);
  a.exit.consume({ phoneExitId: 'one' }); a.advance(200); a.exit.consume({ phoneExitId: 'one' });
  a.advance(99); assert.equal(a.exited.length, 0); a.advance(1); assert.equal(a.exited.length, 1);
  a.exit.consume({ phoneExitId: 'one' }); a.advance(1000); assert.equal(a.exited.length, 1);
});
test('new foreground snapshot cancels pending exit, even if late callbacks run', () => {
  const a = setup(); a.exit.consume({ phoneExitId: 'one' }); a.advance(200); a.exit.consume({});
  a.advance(1000); assert.equal(a.exited.length, 0);
  a.exit.consume({ phoneExitId: 'two' }); a.advance(300); assert.equal(a.exited.length, 1);
});
test('dispose cancels exit and unsupported firmware fails safely without a loop', () => {
  const a = setup(); a.exit.consume({ phoneExitId: 'one' }); a.exit.dispose(); a.advance(1000);
  assert.equal(a.exited.length, 0); assert.equal(a.count(), 0);
  const b = setup(true); b.exit.consume({ phoneExitId: 'one' }); b.advance(300);
  assert.equal(b.errors.length, 1); b.exit.consume({ phoneExitId: 'one' }); b.advance(300);
  assert.equal(b.errors.length, 1);
});
test('navigation protocol validates optional phone exit command while remaining v1 compatible', () => {
  const p = { v: 1, type: 'navigation', session: 'phone', seq: 1, status: 'idle', title: '', rawText: '', maneuver: 'unknown', instruction: '', distance: '' };
  assert.ok(protocol.decode(JSON.stringify(p)));
  assert.ok(protocol.decode(JSON.stringify({ ...p, phoneExitId: 'exit-1' })));
  for (const phoneExitId of ['', true, 3, null, {}, 'a'.repeat(81)]) assert.equal(protocol.decode(JSON.stringify({ ...p, phoneExitId })), null);
});

test('a previously handled or cancelled exit id never replays after a normal snapshot', () => {
  const a = setup(); a.exit.consume({ phoneExitId: 'one' }); a.advance(300);
  a.exit.consume({}); assert.equal(a.exit.isClosing(), false);
  a.exit.consume({ phoneExitId: 'one' }); a.advance(300); assert.equal(a.exited.length, 1);
  a.exit.consume({ phoneExitId: 'two' }); a.exit.consume({});
  a.exit.consume({ phoneExitId: 'two' }); a.advance(300); assert.equal(a.exited.length, 1);
});
