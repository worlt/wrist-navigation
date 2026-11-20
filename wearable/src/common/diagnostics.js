// Bounded, memory-only metadata. Never retain raw packets, messages, stacks or routes.
const EVENTS = ['created','page-ready','link-init','link-open','link-close','link-error','ready-check','ready-missing','ready-fail','rx-reject','rx-accept','send-202','send-fail','storage-read','storage-write','vibrate','terminate','screen','query','disposed'];
const NAMES = ['Error','TypeError','RangeError','SyntaxError','ReferenceError'];
const COUNTERS = ['rx','accepted','rejected','tx','txfail'];
function createDiagnostics(now) {
  const start = now(), events = [], counters = {rx:0,accepted:0,rejected:0,tx:0,txfail:0};
  function record(id, error, code) {
    if (EVENTS.indexOf(id) < 0) return;
    const number = Number(code === undefined ? error && error.code : code);
    events.push({id, at:Math.min(999999,Math.max(0,Math.floor((now()-start)/1000))),
      code:Number.isInteger(number) && Math.abs(number)<=999999 ? number : 0,
      name:error && NAMES.indexOf(error.name)>=0 ? error.name : ''});
    if (events.length>16) events.shift();
  }
  return {record, increment(id) {if (COUNTERS.indexOf(id)>=0) counters[id]=Math.min(999999,counters[id]+1);},
    snapshot() {return {schema:1,counters:Object.assign({},counters),events:events.map(e=>Object.assign({},e))};},
    lines() {return events.map(e=>e.at+'s '+e.id+' '+e.name+' #'+e.code);} };
}
module.exports={createDiagnostics,EVENTS,NAMES,COUNTERS};
