const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSession } = require('../src/common/session');

function boot(send) {
  const time = require('./helpers/clock')();
  const connection = { getReadyState: cb => cb.success({ status: 1 }), send };
  const session = createSession({ ...time, load(name) {
    if (name === '@system.interconnect') return { instance: () => connection };
    if (name === '@system.storage') return { get: cb => cb.success(''), set: cb => cb.success() };
    throw Error('unexpected optional API');
  }});
  session.retry();
  return { session, connection };
}
const packet = { v: 1, type: 'navigation', session: 'phone', seq: 1, status: 'active',
  title: '高德地图', rawText: '48米后左转', maneuver: 'left', instruction: '左转', distance: '48 米' };
const unpack = cb => JSON.parse(typeof cb.data === 'string' ? cb.data : cb.data.data);

test('202 in first callback argument falls back for ready, ACK, display and control replies', () => {
  const attempts = [], accepted = [];
  const app = boot(cb => {
    attempts.push(cb);
    if (typeof cb.data === 'string') cb.fail({ code: '202' });
    else { accepted.push(unpack(cb)); cb.success(); }
  });
  assert.equal(app.session.peek().connected, true);
  assert.equal(app.session.peek().sendShape, 1);
  app.connection.onmessage({ data: JSON.stringify({ ...packet, displayDiagnostics: true }) });
  app.session.reportDisplay('phone', 1);
  for (const type of ['version-query', 'diagnostics-query'])
    app.connection.onmessage({ data: JSON.stringify({ v: 1, type, requestId: type }) });
  assert.deepEqual(accepted.map(p => p.type), ['ready', 'ack', 'display', 'app-version', 'band-diagnostics']);
  assert.equal(app.session.peek().connectionError, '');
  assert.equal(attempts.length, 6);
});

test('each asynchronously rejected string frame gets one nested retry', () => {
  const attempts = [];
  const app = boot(cb => attempts.push(cb));
  app.connection.onmessage({ data: JSON.stringify(packet) });
  const [ready, ack] = attempts;
  ready.fail({}, 202);
  attempts[2].success();
  ack.fail({}, 202);
  assert.equal(attempts.length, 4);
  assert.equal(unpack(attempts[3]).type, 'ack');
  attempts[3].success();
  assert.equal(app.session.peek().connected, true);
  assert.equal(app.session.peek().connectionError, '');
});

test('synchronous 202 exceptions use the same bounded fallback', () => {
  const accepted = [];
  const app = boot(cb => {
    if (typeof cb.data === 'string') throw Object.assign(new TypeError('invalid args'), { code: 202 });
    accepted.push(unpack(cb)); cb.success();
  });
  assert.equal(accepted[0].type, 'ready');
  assert.equal(app.session.peek().connected, true);
  assert.equal(app.session.peek().connectionError, '');
});

test('two rejected formats neither erase received navigation nor claim a disconnect', () => {
  let calls = 0;
  const app = boot(cb => { calls++; cb.fail({ code: 202 }); });
  app.connection.onmessage({ data: JSON.stringify(packet) });
  assert.equal(app.session.peek().latest.seq, 1);
  assert.equal(app.session.peek().connected, true);
  assert.equal(app.session.peek().connectionError, '');
  assert.match(app.session.peek().lastSend, /202/);
  assert.equal(calls, 4);
  app.connection.onclose({ code: 1006 });
  assert.equal(app.session.peek().connected, false);
});

test('optional display 202 negotiates format without blocking navigation', () => {
  let reject = false;
  const accepted = [];
  const app = boot(cb => {
    if (reject && typeof cb.data === 'string') cb.fail({}, 202);
    else { accepted.push(unpack(cb)); cb.success(); }
  });
  app.connection.onmessage({ data: JSON.stringify({ ...packet, displayDiagnostics: true }) });
  reject = true;
  app.session.reportDisplay('phone', 1);
  assert.equal(accepted.at(-1).type, 'display');
  assert.equal(app.session.peek().sendShape, 1);
  assert.equal(app.session.peek().connected, true);
});

test('old failure callbacks cannot damage a completed retry or disposed session', () => {
  const attempts = [];
  const app = boot(cb => attempts.push(cb));
  attempts[0].fail({}, 202);
  assert.equal(app.session.peek().sendShape, 0, 'do not select an unconfirmed format');
  attempts[1].success();
  attempts[0].fail({}, 202);
  assert.equal(attempts.length, 2);
  assert.equal(app.session.peek().connected, true);
  app.session.dispose(); attempts[1].fail({}, 1006);
  assert.equal(attempts.length, 2);
});

test('send callbacks from a lost link cannot retry or invalidate a new inbound route', () => {
  for (const code of [202, 1006]) {
    const attempts = [];
    const app = boot(cb => attempts.push(cb));
    const oldReady = attempts[0];
    app.connection.onclose({ code: 1006 });
    app.connection.onmessage({ data: JSON.stringify(packet) });
    oldReady.fail({ code });
    assert.equal(attempts.length, 2, String(code));
    assert.equal(app.session.peek().connected, true, String(code));
    assert.equal(app.session.peek().connectionError, '');
  }
});
