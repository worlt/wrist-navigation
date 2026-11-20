const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSession } = require('../src/common/session');
const manifest = require('../src/manifest.json');
const clock = require('./helpers/clock');
function boot(options = {}) {
  const time = clock(), sent = [], loads = [], vibrations = [], exits = [];
  const connection = { send(cb) { const packet = typeof cb.data === 'string' ? JSON.parse(cb.data) : JSON.parse(cb.data.data); sent.push(packet);
    if (options.rejectString && typeof cb.data === 'string') cb.fail({}, 202); else cb.success(); } };
  if (!options.noReady) connection.getReadyState = cb => cb.success({status: '1'});
  const session = createSession({ now: time.now, schedule: time.schedule, unschedule: time.unschedule, load(name) {
    loads.push(name);
    if (name === '@system.interconnect') { if (options.missingLink) throw TypeError('API missing private route'); return {instance:()=>connection}; }
    if (name === '@system.storage') return {get:cb=>cb.success(''),set:cb=>cb.success()};
    if (name === '@system.vibrator') return {vibrate:()=>vibrations.push(1)};
    if (name === '@system.app') return {terminate:()=>exits.push(1)};
    throw Error('unexpected');
  }});
  return {session,connection,sent,loads,vibrations,exits,time};
}
function packet(seq, extra) { return Object.assign({v:1,type:'navigation',session:'phone',seq,status:'active',title:'高德',rawText:'私人路线',instruction:'右转',maneuver:'right',distance:'30 米',actionId:'turn',mode:'walk',vibrationEnabled:true},extra); }
test('construction and pre-page resume perform no native API calls',()=>{const r=boot();r.session.resume();assert.deepEqual(r.loads,[]);r.session.retry();assert.ok(r.loads.includes('@system.interconnect'));});
test('string ready state is accepted and missing check API does not disable callbacks',()=>{let r=boot();r.session.retry();assert.equal(r.session.peek().connected,true);r=boot({noReady:true});r.session.retry();r.connection.onopen();r.session.resume();assert.equal(r.session.peek().connected,true);r.connection.onmessage({data:JSON.stringify(packet(1))});assert.equal(r.session.peek().latest.seq,1);});
test('diagnostics answer only an explicit phone query and remain bounded and private',()=>{const r=boot({rejectString:true});r.session.retry();r.connection.onmessage({data:'bad private route'});r.connection.onmessage({data:JSON.stringify(packet(1))});assert.equal(r.sent.some(p=>p.type==='band-diagnostics'),false);r.connection.onmessage({data:JSON.stringify({v:1,type:'diagnostics-query',requestId:'diag-1'})});const report=r.sent.findLast(p=>p.type==='band-diagnostics');assert.ok(report);assert.equal(report.appVersion.versionCode,manifest.versionCode);assert.ok(!JSON.stringify(report).includes('私人路线'));assert.ok(JSON.stringify(report).length<3500);r.session.dispose();r.time.advance(10000);});
test('missing link diagnostics remain on screen and do not claim delivery',()=>{const r=boot({missingLink:true});r.session.retry();assert.equal(r.session.peek().connected,false);assert.ok(r.session.diagnosticLines().some(x=>x.includes('link-init')));assert.ok(!r.session.diagnosticLines().join('').includes('private route'));});
