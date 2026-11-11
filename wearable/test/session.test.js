const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSession } = require('../src/common/session');
const packet = (seq, extra = {}) => ({ v: 1, type: 'navigation', session: 'phone', seq, status: 'active',
  title: '高德地图', rawText: '前方200米右转', maneuver: 'right', instruction: '右转', distance: '200 米',
  actionId: 'turn-1', mode: 'walk', vibrationEnabled: true, ...extra });
function launch(options = {}) {
  const time = require('./helpers/clock')();
  let instances = 0, apkReads = 0;
  const sent = [], vibrations = [], pending = [], exits = [];
  const connection = {
    getApkStatus() { apkReads++; return 'CONNECTED'; },
    getReadyState(callbacks) { if (options.stateThrows) throw Error('state unavailable'); if (options.pending) pending.push(callbacks); else callbacks.success({ status: 1 }); },
    send(callbacks) {
      const wrapped = typeof callbacks.data === 'object';
      if (options.rejectString && !wrapped) { callbacks.fail('invalid args', 202); return; }
      sent.push(JSON.parse(wrapped ? callbacks.data.data : callbacks.data));
      if (callbacks.success) callbacks.success();
    }
  };
  const session = createSession({ ...time, load(name) {
    if (name === '@system.app') return { terminate() { assert.equal(sent.at(-1).type, 'ack'); exits.push(sent.at(-1).phoneExitId); } };
    if (name === '@system.storage') return { get: cb => cb.success(''), set: cb => cb.success() };
    if (name === '@system.interconnect') return { instance() { instances++; return connection; } };
    if (name === '@system.vibrator') { if (options.missingVibrator) throw Error('missing API');
      return { vibrate(request) { assert.equal(sent.at(-1).type, 'ack'); vibrations.push(request.mode); } }; }
    throw Error('unexpected API '+name);
  } });
  return { session, connection, sent, vibrations, pending, exits, instances: () => instances, apkReads: () => apkReads,
    deliver(message) { connection.onmessage({ data: JSON.stringify(message) }); if (!options.manualTime) time.advance(2400); }, advance: time.advance };
}
test('application handles turns and near reminders without any page subscriber', () => {
  const app = launch(); app.session.retry();
  app.deliver(packet(1)); app.deliver(packet(2, { distance: '30 米' })); app.deliver(packet(2));
  assert.deepEqual(app.vibrations, ['long', 'long', 'long', 'long']); assert.equal(app.sent.at(-1).seq, 2);
  assert.equal(app.session.peek().latest.seq, 2);
});
test('closing a page only unsubscribes; app keeps receiving and never replays on resubscribe', () => {
  const app = launch(); app.session.retry(); let paints = 0;
  const unsubscribe = app.session.subscribe(() => paints++);
  app.deliver(packet(1)); unsubscribe(); const count = paints;
  app.deliver(packet(2, { distance: '30 米' })); assert.equal(paints, count);
  app.session.subscribe(() => paints++); app.session.retry(); app.deliver(packet(3, { distance: '20 米' }));
  assert.deepEqual(app.vibrations, ['long', 'long', 'long', 'long']); assert.equal(app.instances(), 1);
});
test('only app disposal disables late events, ACK, vibration and pending queries', () => {
  const app = launch({ pending: true }); app.session.retry(); const receive = app.connection.onmessage;
  app.session.dispose(); app.pending.forEach(callbacks => callbacks.success({ status: 1 }));
  receive({ data: JSON.stringify(packet(1)) }); app.session.retry();
  assert.equal(app.sent.length, 0); assert.equal(app.vibrations.length, 0); assert.equal(app.session.isAlive(), false);
});
test('subscriber failures and missing vibration API cannot drop ACK or latest navigation', () => {
  const app = launch({ missingVibrator: true, rejectString: true }); app.session.retry();
  app.session.subscribe(() => { throw Error('bad UI'); });
  assert.doesNotThrow(() => app.deliver(packet(1)));
  assert.equal(app.sent.at(-1).type, 'ack'); assert.equal(app.session.peek().latest.seq, 1);
  assert.equal(app.session.peek().sendShape, 1);
});

test('snapshot reads do not repeatedly query native APK diagnostics', () => {
  const app = launch(); app.session.retry(); const reads = app.apkReads(); assert.ok(reads > 0);
  for (let n=0;n<20;n++) assert.equal(app.session.peek().apkStatus, 'CONNECTED');
  assert.equal(app.apkReads(), reads);
});
test('late connection query cannot overwrite a newer navigation event', () => {
  const app = launch({ pending: true }); app.session.retry(); app.deliver(packet(1));
  app.pending[0].success({ status: 2 });
  assert.equal(app.session.peek().connected, true);
  assert.equal(app.session.peek().latest.seq, 1);
});
test('query exceptions keep message callbacks usable', () => {
  const app = launch({ stateThrows: true }); assert.doesNotThrow(() => app.session.retry());
  assert.match(app.session.peek().connectionError, /state unavailable/);
  app.deliver(packet(1)); assert.equal(app.sent.at(-1).type, 'ack');
  assert.deepEqual(app.vibrations, ['long', 'long']);
});

test('mute, stop, disconnect and App destruction cancel pending second navigation pulse', () => {
  for (const event of ['mute', 'ended', 'paused', 'disconnect', 'dispose', 'new-session']) {
    const app = launch({ manualTime: true }); app.session.retry(); app.deliver(packet(1));
    assert.deepEqual(app.vibrations, ['long']);
    if (event === 'mute') app.deliver(packet(2, { vibrationEnabled: false }));
    else if (event === 'disconnect') app.connection.onclose('');
    else if (event === 'dispose') app.session.dispose();
    else if (event === 'new-session') app.deliver(packet(2, { session: 'new', status: 'idle' }));
    else app.deliver(packet(2, { status: event }));
    app.advance(5000); assert.deepEqual(app.vibrations, ['long'], event);
  }
});

test('near reminder queued during a turn still produces exactly four pulses', () => {
  const app = launch({ manualTime: true }); app.session.retry();
  app.deliver(packet(1)); app.deliver(packet(2, { distance: '30 米' }));
  app.deliver(packet(3, { distance: '20 米' })); app.advance(4800);
  assert.deepEqual(app.vibrations, ['long', 'long', 'long', 'long']);
});

test('journey start merges with first turn; end and its idle follow-up produce only one pair', () => {
  const app = launch(); app.session.retry();
  const journey = { navigationId: 'nav1', navigationEnded: false };
  app.deliver(packet(1, journey)); assert.equal(app.vibrations.length, 2);
  app.deliver(packet(2, { ...journey, distance: '30 米' })); assert.equal(app.vibrations.length, 4);
  app.deliver(packet(3, { ...journey, navigationEnded: true, status: 'ended', actionId: undefined }));
  assert.equal(app.vibrations.length, 6);
  app.deliver(packet(4, { ...journey, navigationEnded: true, status: 'idle', actionId: undefined }));
  assert.equal(app.vibrations.length, 6);
  app.deliver(packet(5, { navigationId: 'nav2', navigationEnded: false, maneuver: 'straight', actionId: 'turn-2' }));
  assert.equal(app.vibrations.length, 8);
});

test('local switch mutes all events and test vibration; reopening does not replay them', () => {
  const app = launch(); app.session.retry(); app.session.setHapticEnabled(false);
  const journey = { navigationId: 'nav1', navigationEnded: false };
  app.deliver(packet(1, journey)); assert.equal(app.session.testHaptic(), false);
  app.session.setHapticEnabled(true); app.deliver(packet(2, journey));
  assert.equal(app.vibrations.length, 0);
  app.deliver(packet(3, { ...journey, distance: '30 米' })); assert.equal(app.vibrations.length, 2);
  app.session.setHapticEnabled(false);
  app.deliver(packet(4, { ...journey, status: 'idle', navigationEnded: true }));
  app.session.setHapticEnabled(true);
  app.deliver(packet(5, { ...journey, status: 'idle', navigationEnded: true }));
  assert.equal(app.vibrations.length, 2);
});

test('duplicate end update keeps second pulse; switch off cancels it immediately', () => {
  for (const mute of [false, true]) {
    const app = launch({ manualTime: true }); app.session.retry();
    const journey = { navigationId: 'nav1', navigationEnded: false };
    app.deliver(packet(1, journey)); app.advance(2400);
    app.deliver(packet(2, { ...journey, status: 'ended', navigationEnded: true }));
    app.deliver(packet(3, { ...journey, status: 'idle', navigationEnded: true }));
    if (mute) app.session.setHapticEnabled(false);
    app.advance(2400); assert.equal(app.vibrations.length, mute ? 3 : 4);
  }
});

test('pause transition vibrates twice, duplicate pause preserves second pulse and resume rearms', () => {
  const app = launch({ manualTime: true }); app.session.retry();
  app.deliver(packet(1, { reminderEnabled: true })); app.advance(2400);
  const pause = seq => packet(seq, { status: 'paused', vibrationEnabled: false, reminderEnabled: true, actionId: undefined });
  app.deliver(pause(2)); app.deliver(pause(3)); app.advance(2400);
  assert.equal(app.vibrations.length, 4);
  app.deliver(pause(4)); app.advance(2400); assert.equal(app.vibrations.length, 4);
  app.deliver(packet(5, { reminderEnabled: true })); app.deliver(pause(6)); app.advance(2400);
  assert.equal(app.vibrations.length, 6);
});

test('cold paused state, legacy pause and either mute switch never replay pause', () => {
  for (const scenario of ['startup', 'legacy', 'phone-muted', 'band-muted']) {
    const app = launch(); app.session.retry();
    if (scenario !== 'startup') app.deliver(packet(1));
    const before = app.vibrations.length;
    if (scenario === 'band-muted') app.session.setHapticEnabled(false);
    app.deliver(packet(2, { status: 'paused', vibrationEnabled: false,
      reminderEnabled: scenario === 'legacy' ? undefined : scenario !== 'phone-muted' }));
    app.session.setHapticEnabled(true);
    app.deliver(packet(3, { status: 'paused', vibrationEnabled: false, reminderEnabled: true }));
    assert.equal(app.vibrations.length, before, scenario);
  }
});

test('confirmed disconnect alerts once without ACK, repeated errors cannot truncate second pulse', () => {
  const app = launch({ manualTime: true }); app.session.retry();
  app.deliver(packet(1, { reminderEnabled: true })); app.advance(2400);
  const sent = app.sent.length;
  app.connection.onclose('lost'); app.connection.onclose('again');
  app.connection.onerror({ code: 1006 }); app.connection.onerror({ code: 1000 });
  app.advance(2400); assert.equal(app.vibrations.length, 4); assert.equal(app.sent.length, sent);
  app.connection.getReadyState = cb => cb.success({ status: 2 }); app.session.retry();
  app.advance(2400); assert.equal(app.vibrations.length, 4);
  app.deliver(packet(2, { reminderEnabled: true }));
  app.connection.onclose('second outage'); app.advance(2400); assert.equal(app.vibrations.length, 6);
});

test('ready-state and explicit 1006 detect loss but startup and diagnostic errors stay silent', () => {
  for (const kind of ['state', 'error', 'query-error', 'diagnostic', 'cold']) {
    const app = launch({ manualTime: true });
    if (kind !== 'cold') { app.session.retry(); app.deliver(packet(1, { reminderEnabled: true })); app.advance(2400); }
    const before = app.vibrations.length;
    if (kind === 'state' || kind === 'cold') { app.connection.getReadyState = cb => cb.success({status:2}); app.session.retry(); }
    else if (kind === 'query-error') { app.connection.getReadyState = cb => cb.fail('lost',1006); app.session.retry(); }
    else app.connection.onerror({code:kind === 'error' ? 1006 : 1000});
    app.advance(2400);
    assert.equal(app.vibrations.length, before + (['cold','diagnostic'].includes(kind) ? 0 : 2), kind);
  }
});

test('disconnect honors saved phone preference and local switch; recovery cancels pending second pulse', () => {
  for (const kind of ['legacy', 'phone-muted', 'band-muted', 'reconnect', 'dispose']) {
    const app = launch({ manualTime: true }); app.session.retry();
    app.deliver(packet(1, { reminderEnabled: kind === 'legacy' ? undefined : kind !== 'phone-muted' }));
    app.advance(2400); const before = app.vibrations.length;
    if (kind === 'band-muted') app.session.setHapticEnabled(false);
    app.connection.onclose('lost');
    if (kind === 'reconnect') app.connection.onopen();
    if (kind === 'dispose') app.session.dispose();
    app.advance(2400);
    assert.equal(app.vibrations.length, before + (['reconnect','dispose'].includes(kind) ? 1 : 0), kind);
  }
});

test('switching off or resuming cancels a pause pair, muted pause is consumed', () => {
  for (const stop of ['phone', 'band', 'resume', 'dispose']) {
    const app = launch({ manualTime: true }); app.session.retry();
    app.deliver(packet(1, { reminderEnabled: true })); app.advance(2400);
    app.deliver(packet(2, { status: 'paused', vibrationEnabled: false, reminderEnabled: true }));
    if (stop === 'phone') app.deliver(packet(3, { status: 'paused', vibrationEnabled: false, reminderEnabled: false }));
    if (stop === 'band') app.session.setHapticEnabled(false);
    if (stop === 'resume') app.deliver(packet(3, { reminderEnabled: true }));
    if (stop === 'dispose') app.session.dispose();
    app.advance(2400); assert.equal(app.vibrations.length, 3, stop);
  }
});

test('explicit phone exit ACK precedes native termination and does not vibrate', () => {
  const a = launch({ manualTime: true }); a.session.retry();
  a.deliver(packet(1, { phoneExitId: 'exit-1', reminderEnabled: true }));
  assert.equal(a.sent.at(-1).phoneExitId, 'exit-1'); assert.equal(a.exits.length, 0);
  a.connection.onclose({}); a.advance(300);
  assert.deepEqual(a.exits, ['exit-1']); assert.equal(a.vibrations.length, 0);
});
test('newer foreground packet cancels exit; duplicate and stale packets cannot terminate', () => {
  const a = launch({ manualTime: true }); a.session.retry();
  a.deliver(packet(1, { phoneExitId: 'exit-1' })); a.advance(200);
  a.deliver(packet(2, { vibrationEnabled: false })); a.deliver(packet(1, { phoneExitId: 'exit-1' }));
  a.advance(1000); assert.equal(a.exits.length, 0);
  a.deliver(packet(3, { phoneExitId: 'exit-2' })); a.session.dispose(); a.advance(1000);
  assert.equal(a.exits.length, 0);
});

test('an exit ACK failing synchronously cannot produce a disconnect vibration', () => {
  const a = launch({ manualTime: true }); a.session.retry();
  a.deliver(packet(1, { reminderEnabled: true })); a.advance(2400);
  const before = a.vibrations.length;
  a.connection.send = callbacks => callbacks.fail({ code: 1006 }, 1006);
  a.deliver(packet(2, { phoneExitId: 'exit-1', reminderEnabled: true })); a.advance(3000);
  assert.equal(a.vibrations.length, before);
});
