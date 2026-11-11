const { test } = require('node:test');
const assert = require('node:assert/strict');
const { decode, accept, present } = require('../src/common/protocol');
const packet = () => ({ v: 1, type: 'navigation', session: 'test', seq: 1, status: 'active', title: '高德地图', rawText: '前方200米右转', maneuver: 'right', instruction: '右转', distance: '200 米' });

test('decodes UTF-8 navigation fields', () => {
  assert.equal(decode(JSON.stringify(packet())).rawText, '前方200米右转');
});

test('journey metadata is optional for old phones and validated for new phones', () => {
  const base = { ...packet(), navigationId: 'nav1', navigationEnded: false };
  assert.ok(decode(JSON.stringify(base)));
  for (const extra of [{ navigationId:'' }, { navigationId:7 }, { navigationId:'x'.repeat(81) }, { navigationEnded:'true' }])
    assert.equal(decode(JSON.stringify({ ...base, ...extra })), null);
});
test('accepts UTF-8 ArrayBuffer delivery and rejects invalid UTF-8', () => {
  const bytes = new TextEncoder().encode(JSON.stringify(packet()));
  assert.equal(decode(bytes.buffer).instruction, '右转');
  assert.equal(decode(new Uint8Array([0xff]).buffer), null);
});
test('rejects corrupt, oversized and unsupported frames', () => {
  for (const input of ['{', 'null', '{}', 'x'.repeat(4097), JSON.stringify({ ...packet(), v: 2 }), JSON.stringify({ ...packet(), seq: -1 }), JSON.stringify({ ...packet(), rawText: {} })]) assert.equal(decode(input), null);
});
test('drops duplicates and out-of-order messages within a phone session', () => {
  assert.equal(accept(packet(), packet()), false);
  assert.equal(accept({ ...packet(), seq: 3 }, packet()), false);
  assert.equal(accept(packet(), { ...packet(), seq: 2 }), true);
  assert.equal(accept(packet(), { ...packet(), session: 'new-process' }), true);
});
test('clears actionable directions on disconnect and heartbeat expiry', () => {
  for (const view of [present(packet(), 20000, true), present(packet(), 0, false), present(packet(), -1, true)]) {
    assert.equal(view.live, false);
    assert.equal(view.distance, '');
    assert.equal(view.icon, 'unknown');
    assert.ok(!view.rawText.includes('右转'));
  }
});
test('demo is explicitly labelled and unknown directions never imply straight', () => {
  assert.match(present({ ...packet(), status: 'demo' }, 0, true).status, /演示/);
  assert.equal(decode(JSON.stringify({ ...packet(), maneuver: 'unrecognized' })).maneuver, 'unknown');
});

test('waiting and end states remain valid without idle heartbeats', () => {
  for (const status of ['idle', 'ended', 'paused', 'unavailable']) {
    const result = present({ ...packet(), status }, 60000, true);
    assert.equal(result.live, false);
    assert.doesNotMatch(result.status, /过期/);
  }
});

test('optional screen preference validates type and keeps older packets compatible', () => {
  assert.ok(decode(JSON.stringify(packet())));
  assert.equal(decode(JSON.stringify({ ...packet(), keepScreenOn: false })).keepScreenOn, false);
  assert.equal(decode(JSON.stringify({ ...packet(), keepScreenOn: 'false' })), null);
});


test('optional haptic metadata preserves old packets and rejects malformed extensions', () => {
  assert.ok(decode(JSON.stringify(packet())));
  const haptic = { ...packet(), actionId: 'turn-1', mode: 'walk', vibrationEnabled: true };
  assert.equal(decode(JSON.stringify(haptic)).actionId, 'turn-1');
  for (const extra of [{ actionId: '' }, { actionId: 1 }, { actionId: 'x'.repeat(81) },
    { mode: 'car' }, { mode: null }, { vibrationEnabled: 'true' }, { reminderEnabled: 'true' }, { reminderEnabled: null }]) {
    assert.equal(decode(JSON.stringify({ ...haptic, ...extra })), null);
  }
  assert.equal(decode(JSON.stringify({ ...haptic, reminderEnabled: false })).reminderEnabled, false);
});
