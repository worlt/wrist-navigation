const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createJourneyReminders } = require('../src/common/journey-reminders');
const packet = (extra = {}) => ({ session: 'phone', navigationId: 'nav1', navigationEnded: false,
  status: 'active', vibrationEnabled: true, ...extra });
test('one start and one confirmed end per journey, including straight or unknown start', () => {
  const state = createJourneyReminders();
  assert.equal(state.consume(packet({ maneuver: 'straight' }), true), 'start');
  assert.equal(state.consume(packet({ maneuver: 'unknown' }), true), null);
  for (const status of ['idle', 'paused', 'unavailable', 'active']) assert.equal(state.consume(packet({ status }), true), null);
  assert.equal(state.consume(packet({ status: 'ended', navigationEnded: true }), true), 'end');
  assert.equal(state.consume(packet({ status: 'idle', navigationEnded: true }), true), null);
  assert.equal(state.consume(packet({ navigationId: 'nav2' }), true), 'start');
});
test('disabled reminders are consumed, and terminal startup or legacy phone stays silent', () => {
  const state = createJourneyReminders();
  assert.equal(state.consume(packet(), false), null); assert.equal(state.consume(packet(), true), null);
  assert.equal(state.consume(packet({ status:'ended', navigationEnded:true, vibrationEnabled:false }), true), null);
  assert.equal(state.consume(packet({ status:'ended', navigationEnded:true }), true), null);
  assert.equal(createJourneyReminders().consume(packet({ status:'ended', navigationEnded:true }), true), null);
  assert.equal(createJourneyReminders().consume(packet({ navigationId:undefined }), true), null);
});
