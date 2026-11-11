const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReminders, distanceMeters } = require('../src/common/reminders');
const packet = (extra = {}) => ({ session: 'phone', status: 'active', actionId: 'turn-1',
  maneuver: 'right', mode: 'walk', vibrationEnabled: true, distance: '200 米', ...extra });

test('new turn once, near once, no repeats from distance updates or jitter', () => {
  const policy = createReminders();
  assert.equal(policy.consume(packet(), true), 'turn');
  for (const distance of ['180 米', '100 米', '31 米']) assert.equal(policy.consume(packet({ distance }), true), null);
  assert.equal(policy.consume(packet({ distance: '30 米' }), true), 'near');
  for (const distance of ['29 米', '35 米', '30 米', '0 米']) assert.equal(policy.consume(packet({ distance }), true), null);
  assert.equal(policy.consume(packet({ actionId: 'turn-2' }), true), 'turn');
});

test('first message already near merges turn and advisory, including kilometers', () => {
  for (const [mode, distance] of [['walk', '0.03 公里'], ['cycle', '0.1 km']]) {
    const policy = createReminders();
    assert.equal(policy.consume(packet({ mode, distance }), true), 'turn');
    assert.equal(policy.consume(packet({ mode, distance: '1 米' }), true), null);
  }
});

test('cycle uses 100m and walk uses 30m without guessing mode', () => {
  const policy = createReminders();
  assert.equal(policy.consume(packet({ mode: 'cycle' }), true), 'turn');
  assert.equal(policy.consume(packet({ mode: 'cycle', distance: '101 米' }), true), null);
  assert.equal(policy.consume(packet({ mode: 'cycle', distance: '100 米' }), true), 'near');
});

test('only recognized real turns with complete opt-in metadata remind', () => {
  for (const extra of [ { status: 'demo' }, { status: 'idle' }, { status: 'ended' },
    { status: 'paused' }, { status: 'unavailable' }, { maneuver: 'straight' },
    { maneuver: 'arrive' }, { maneuver: 'unknown' }, { actionId: undefined },
    { vibrationEnabled: undefined }, { mode: undefined } ]) {
    assert.equal(createReminders().consume(packet(extra), true), null);
  }
  for (const maneuver of ['left', 'right', 'slight_left', 'slight_right', 'sharp_left', 'sharp_right', 'uturn', 'roundabout']) {
    assert.equal(createReminders().consume(packet({ maneuver }), true), 'turn');
  }
});

test('hidden and muted updates consume opportunities without delayed bursts', () => {
  for (const muted of [false, true]) {
    const policy = createReminders();
    assert.equal(policy.consume(packet({ vibrationEnabled: !muted }), muted), null);
    assert.equal(policy.consume(packet(), true), null);
    assert.equal(policy.consume(packet({ distance: '20 米', vibrationEnabled: !muted }), muted), null);
    assert.equal(policy.consume(packet({ distance: '20 米' }), true), null);
  }
});

test('disconnect, expired display and terminal messages do not clear dedup history', () => {
  const policy = createReminders();
  assert.equal(policy.consume(packet(), true), 'turn');
  assert.equal(policy.consume(packet({ status: 'ended' }), true), null);
  assert.equal(policy.consume(packet(), true), null);
  assert.equal(policy.consume(packet({ session: 'new-phone' }), true), 'turn');
});

test('bounded history remembers the newest 32 turns without growing indefinitely', () => {
  const policy = createReminders();
  for (let n = 0; n < 33; n++) assert.equal(policy.consume(packet({ actionId: 't'+n, distance: '10 米' }), true), 'turn');
  assert.equal(policy.consume(packet({ actionId: 't1', distance: '10 米' }), true), null);
  assert.equal(policy.consume(packet({ actionId: 't32', distance: '10 米' }), true), null);
  assert.equal(policy.consume(packet({ actionId: 't0', distance: '10 米' }), true), 'turn');
});

test('distance parser is strict, unit-aware and rejects route summaries and invalid numbers', () => {
  for (const [text, value] of [['0 米',0], ['30m',30], [' 0.03 KM ',30], ['1.2 千米',1200]]) assert.equal(distanceMeters(text), value);
  for (const text of ['', '-1 米', 'NaN 米', 'Infinity m', '1e2 m', '剩余30米', '前方30米', '30', '30 mi', '1,000 m', '9'.repeat(400)+'m', null]) assert.equal(distanceMeters(text), null);
});
