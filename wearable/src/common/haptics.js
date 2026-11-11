// Vela exposes short/long, not motor amplitude. start/stop are not documented for bands.
// https://iot.mi.com/vela/quickapp/zh/features/system/vibrator.html
const KEY = 'navigation.haptics.v1';
const DEFAULT = 'noticeable';
const OPTIONS = [
  { id: 'gentle', name: '轻柔', sample: '两次短振', mode: 'short', spacing: 350 },
  { id: 'noticeable', name: '明显', sample: '两次长振', mode: 'long', spacing: 1200 }
];
function profile(id) { return OPTIONS.find(item => item.id === id) || OPTIONS[1]; }

function createHaptics(options) {
  const schedule = options.schedule || ((fn, delay) => setTimeout(fn, delay));
  const unschedule = options.unschedule || (id => clearTimeout(id));
  const now = options.now || (() => Date.now());
  const changed = options.changed || (() => {});
  let alive = true, selected = DEFAULT, enabled = true, ready = false, status = '调整后自动保存';
  let storage = null, revision = 0, writing = false, pendingSave = null;
  let timer = null, generation = 0, busy = false, queued = null, activeKind = '';
  function report(text) { status = text; if (alive) changed(); }
  function flush() {
    if (writing || !pendingSave) return;
    const job = pendingSave; pendingSave = null; writing = true;
    let done = false;
    function finish(ok) {
      if (done) return;
      done = true; writing = false;
      if (alive && revision === job.revision) report(ok ? '已保存' : '保存失败，本次仍有效');
      flush();
    }
    try { storage.set({ key: KEY, value: job.value, success: () => finish(true), fail: () => finish(false) }); }
    catch (error) { finish(false); }
  }
  function cancel() {
    generation++;
    if (timer !== null) unschedule(timer);
    timer = null; busy = false; queued = null; activeKind = '';
  }
  function play(allowed, kind) {
    if (!alive || !ready || !enabled || !allowed()) return false;
    if (busy) {
      // Repeated test taps do not build a queue. Real guidance takes priority.
      if (kind === 'test') return false;
      if (activeKind === 'test') cancel();
      else { queued = { allowed, kind }; return true; }
    }
    const chosen = profile(selected), token = ++generation;
    let vibrator;
    try { vibrator = options.load('@system.vibrator'); vibrator.vibrate({ mode: chosen.mode }); }
    catch (error) { return false; }
    busy = true; activeKind = kind;
    function finish() {
      const next = queued; queued = null; busy = false; activeKind = '';
      if (next) play(next.allowed, next.kind);
    }
    const due = now() + chosen.spacing;
    timer = schedule(() => {
      timer = null;
      // Do not replay the second pulse after the firmware suspends the App.
      if (!alive || token !== generation) return;
      if (now() - due > 2000) { cancel(); return; }
      if (!allowed()) { finish(); return; }
      try { vibrator.vibrate({ mode: chosen.mode }); } catch (error) { cancel(); return; }
      timer = schedule(() => {
        timer = null;
        if (!alive || token !== generation) return;
        if (now() - (due + chosen.spacing) > 2000) { cancel(); return; }
        finish();
      }, chosen.spacing);
    }, chosen.spacing);
    return true;
  }
  return {
    peek: () => ({ profile: selected, enabled, ready, status }),
    load() {
      const started = revision;
      try {
        storage = options.load('@system.storage');
        storage.get({ key: KEY, default: DEFAULT, success(value) {
          if (!alive || revision !== started) return;
          ready = true;
          let saved = value;
          try { saved = JSON.parse(value); } catch (error) { /* Migrate 0.4.3 bare profile. */ }
          selected = profile(saved && typeof saved === 'object' ? saved.profile : saved).id;
          enabled = !(saved && typeof saved === 'object' && saved.enabled === false);
          if (!enabled) cancel();
          changed();
        }, fail() { if (alive && revision === started) { ready = true; report('读取失败，使用当前震感'); } } });
      } catch (error) { ready = true; report('本次震感调整无法保存'); }
    },
    select(id) {
      if (!alive) return;
      selected = profile(id).id; ready = true; revision++; cancel();
      if (!storage) { report('本次震感调整无法保存'); return; }
      pendingSave = { revision, value: JSON.stringify({ profile: selected, enabled }) }; report('保存中'); flush();
    },
    setEnabled(value) {
      if (!alive) return;
      enabled = !!value; ready = true; revision++; cancel();
      if (!storage) { report('本次震感调整无法保存'); return; }
      pendingSave = { revision, value: JSON.stringify({ profile: selected, enabled }) }; report('保存中'); flush();
    },
    play: allowed => play(allowed, 'navigation'),
    test: () => play(() => alive, 'test'),
    cancel,
    cancelTest() { if (activeKind === 'test') cancel(); },
    dispose() { alive = false; cancel(); }
  };
}
module.exports = { KEY, DEFAULT, OPTIONS, profile, createHaptics };
