// Official Vela app API: https://iot.mi.com/vela/quickapp/zh/features/basic/app.html
// Transport sends ACK first. The short grace period allows an immediate phone re-entry to cancel.
const EXIT_DELAY_MS = 300;
function createAppExit(options) {
  const schedule = options.schedule || ((fn, delay) => setTimeout(fn, delay));
  const unschedule = options.unschedule || (id => clearTimeout(id));
  let alive = true, closing = false, timer = null, pending = '', handled = '', revision = 0;
  function cancel() {
    revision++;
    if (timer !== null) unschedule(timer);
    timer = null; pending = '';
  }
  function consume(packet) {
    if (!alive) return false;
    const id = packet && packet.phoneExitId;
    if (!id) { if (pending) handled = pending; cancel(); closing = false; return false; }
    if (pending === id || handled === id) return true;
    cancel(); pending = id; closing = true;
    const token = revision;
    timer = schedule(() => {
      timer = null;
      if (!alive || token !== revision || pending !== id) return;
      pending = ''; handled = id;
      try { options.load('@system.app').terminate(); }
      catch (error) { closing = false; if (options.onError) options.onError(error); }
    }, EXIT_DELAY_MS);
    return true;
  }
  return { consume, isClosing: () => closing,
    dispose() { alive = false; closing = false; cancel(); } };
}
module.exports = { createAppExit, EXIT_DELAY_MS };
