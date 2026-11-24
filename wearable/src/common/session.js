const protocol = require('./protocol');
const createDiagnostics = require('./diagnostics').createDiagnostics;
const createAppExit = require('./app-exit').createAppExit;
const presentation = require('./presentation');
const createReminders = require('./reminders').createReminders;
const createHaptics = require('./haptics').createHaptics;
const installedManifest = require('../manifest.json');
const createJourneyReminders = require('./journey-reminders').createJourneyReminders;

// App-owned transport. Pages observe snapshots; they never own the native callbacks.
function createSession(options) {
  const load = options.load;
  const version = options.version || installedManifest;
  function appVersion() {
    return { applicationId: version.package, versionName: version.versionName, versionCode: version.versionCode };
  }
  const now = options.now || (() => Date.now());
  const diagnostic = createDiagnostics(now);
  diagnostic.record('created');
  let started = false, lastDiagnosticQuery = '', diagnosticQueryAt = -1;
  const reminders = createReminders();
  const journeys = createJourneyReminders();
  let alive = true, connection = null, generation = 0, sendEpoch = 0;
  let latest = null, receivedAt = 0, connected = false, connectionError = '';
  let sendShape = 0, lastSend = '尚未发送';
  let listeners = [];
  let lastReadyAt = -1, lastCheckAt = -1;
  let displayedSession = null, displayedSequence = 0;
  let apkStatusText = '未检测', eventRevision = 0, queryRevision = 0;
  // Official interconnect: onclose, ready-state=2 or error code 1006 prove link loss.
  // https://iot.mi.com/vela/quickapp/zh/features/network/interconnect.html
  let linkEstablished = false, lossRevision = 0, interruption = '';
  let activeLink = null, pendingLink = null;
  const handledLinks = [];
  function claimLink(kind, packet) {
    const id = kind === 'exit' ? packet.phoneExitId : packet.phoneOpenId;
    const key = kind + ':' + packet.session + ':' + id;
    if (handledLinks.indexOf(key) >= 0) return null;
    handledLinks.push(key); if (handledLinks.length > 32) handledLinks.shift();
    return { kind, id, session: packet.session, at: now() };
  }
  function linkReminderAllowed(event) {
    return alive && activeLink === event && latest && latest.session === event.session &&
      latest.reminderEnabled === true && now() - event.at >= 0 && now() - event.at < 10000 &&
      (event.kind === 'exit' ? appExit.isClosing() && latest.phoneExitId === event.id : !appExit.isClosing());
  }
  function flushLinkReminder() {
    const event = pendingLink;
    if (!event || !haptics.peek().ready) return;
    pendingLink = null;
    if (!linkReminderAllowed(event) || !haptics.peek().enabled) return;
    // A slow preference read must not start a pair that native termination would cut off.
    if (event.kind === 'exit' && now() + haptics.peek().duration + 300 > event.deadline) return;
    haptics.play(() => linkReminderAllowed(event));
  }
  const haptics = createHaptics({ load, now, schedule: options.schedule,
    unschedule: options.unschedule, changed: notify, onError: diagnostic.record });
  const appExit = createAppExit({ load, schedule: options.schedule, unschedule: options.unschedule,
    onError(error) { diagnostic.record('terminate', error); connectionError = presentation.errorText('退出应用失败', error); notify(); } });

  function readApkStatus() {
    if (!connection) return '未检测';
    try {
      if (typeof connection.getApkStatus !== 'function') return '接口不可用';
      return String(connection.getApkStatus() || '未知');
    } catch (error) { return '读取失败'; }
  }
  function peek() {
    return { latest, receivedAt, connected, connectionError, sendShape, lastSend,
      apkStatus: apkStatusText, hasConnection: !!connection, haptic: haptics.peek() };
  }
  function notify() {
    if (!alive) return;
    flushLinkReminder();
    const state = peek();
    for (const listener of listeners.slice()) {
      try { listener(state); } catch (error) { /* One closed/failed UI must not interrupt ACK. */ }
    }
  }
  function fail(stage, data, code) {
    if (!alive) return;
    if (stage !== '连接断开' && (Number(code) === 1006 || Number(data && data.code) === 1006)) {
      linkLost(data); return;
    }
    if (stage === '连接检查失败' && linkEstablished) { diagnostic.record('ready-fail', data, code); notify(); return; }
    diagnostic.record(stage === '互联初始化失败' ? 'link-init' : stage === '连接检查失败' ? 'ready-fail' : 'link-error', data, code);
    connected = false; eventRevision++;
    lastReadyAt = lastCheckAt = -1;
    if (interruption !== 'disconnect' && !(interruption === 'exit' && appExit.isClosing())) haptics.cancel();
    connectionError = presentation.errorText(stage, data, code);
    notify();
  }
  function linkReady() {
    if (!linkEstablished) {
      lossRevision++;
      if (interruption === 'disconnect') { haptics.cancel(); interruption = ''; }
    }
    linkEstablished = true; connected = true;
  }
  function linkLost(data) {
    diagnostic.record('link-close', data);
    sendEpoch++;
    const transition = linkEstablished;
    linkEstablished = false;
    if (transition) { lossRevision++; if (!appExit.isClosing()) { haptics.cancel(); interruption = 'disconnect'; } }
    fail('连接断开', data);
    const token = lossRevision, lostAt = now();
    if (transition && !appExit.isClosing() && latest && latest.reminderEnabled === true) {
      haptics.play(() => alive && !linkEstablished && lossRevision === token &&
        latest && latest.reminderEnabled === true && now() - lostAt >= 0 && now() - lostAt < protocol.EXPIRY_MS);
    }
  }
  function send(message) {
    if (!alive || !connection) return;
    const revision = generation, epoch = sendEpoch;
    const optional = message.type === 'display' || message.type === 'app-version' || message.type === 'band-diagnostics';
    let payload;
    try { payload = JSON.stringify(message); }
    catch (error) { failedEncoding(error); return; }
    function failedEncoding(error) {
      diagnostic.increment('txfail'); diagnostic.record('send-fail', error);
      if (!optional) fail('发送失败', error);
    }
    function attempt(shape) {
      // Capture the attempted format, not the global preference: several frames
      // can be awaiting native callbacks when the first 202 negotiates a format.
      let settled = false;
      const request = shape === 0 ? { data: payload } : { data: { data: payload } };
      diagnostic.increment('tx');
      request.success = () => {
        if (settled || !alive || revision !== generation || epoch !== sendEpoch) return;
        settled = true;
        // Only a successful nested send selects it for later frames. A late
        // success of an older string attempt must not undo that negotiation.
        if (shape === 1) sendShape = 1;
        if (message.type !== 'display') lastSend = '已发送 ' + (message.type || '') + (shape === 0 ? '' : '（嵌套）');
        if (message.type !== 'ack' && message.type !== 'display') notify();
      };
      request.fail = (data, code) => {
        if (settled || !alive || revision !== generation || epoch !== sendEpoch) return;
        settled = true;
        const errorCode = code === undefined || code === null ? data && data.code : code;
        diagnostic.increment('txfail'); diagnostic.record('send-fail', data, errorCode);
        if (Number(errorCode) === 202) {
          diagnostic.record('send-202', data, errorCode);
          if (shape === 0) { attempt(1); return; }
          // Invalid parameters are not proof of physical link loss. In
          // particular an ACK failure must not blank a valid inbound route.
          lastSend = '手机回传失败 202（封包参数被拒）'; notify(); return;
        }
        if (optional) return;
        lastSend = '发送失败 ' + (errorCode === undefined ? '' : errorCode);
        fail('发送失败', data, errorCode);
      };
      try { connection.send(request); }
      catch (error) { request.fail(error); }
    }
    attempt(sendShape);
  }
  function sendReady() {
    lastReadyAt = now();
    send({ v: 1, type: 'ready', appVersion: appVersion() });
  }
  function resume() {
    if (!alive || !started) return;
    const recent = Math.max(lastReadyAt, lastCheckAt), age = now() - recent;
    // App and page can both receive show callbacks during the same wake.
    if (recent >= 0 && age >= 0 && age < 1000) return;
    if (connected) { sendReady(); notify(); }
    else retry();
  }
  function reportDisplay(session, seq) {
    if (!alive || !connected || !latest || latest.displayDiagnostics !== true || latest.phoneExitId
        || latest.session !== session || latest.seq !== seq) return;
    const age = now() - receivedAt;
    if ((latest.status === 'active' || latest.status === 'demo') && (age < 0 || age >= protocol.EXPIRY_MS)) return;
    if (displayedSession === session && displayedSequence === seq) return;
    displayedSession = session; displayedSequence = seq;
    send({ v: 1, type: 'display', session, seq, state: 'applied' });
  }
  function retry() {
    if (!alive) return;
    if (!started) { started = true; diagnostic.record('page-ready'); haptics.load(); }
    lastCheckAt = now();
    connectionError = '';
    if (!connection) {
      try {
        connection = load('@system.interconnect').instance();
        const revision = ++generation;
        const current = () => alive && revision === generation;
        connection.onopen = () => {
          if (!current()) return;
          diagnostic.record('link-open');
          linkReady(); connectionError = ''; eventRevision++;
          apkStatusText = readApkStatus();
          sendReady(); notify();
        };
        connection.onclose = data => { if (current()) linkLost(data); };
        connection.onerror = data => { if (current()) fail('连接异常', data); };
        connection.onmessage = event => {
          if (!current()) return;
          diagnostic.increment('rx');
          // Optional control query is independent from navigation sequence and haptics.
          try {
            let text = event && event.data;
            if (typeof ArrayBuffer !== 'undefined' && text instanceof ArrayBuffer && text.byteLength <= 512) {
              const bytes = new Uint8Array(text); let escaped = '';
              for (let i = 0; i < bytes.length; i++) escaped += '%' + ('0' + bytes[i].toString(16)).slice(-2);
              text = decodeURIComponent(escaped);
            }
            if (typeof text === 'string' && text.length <= 512) {
              const query = JSON.parse(text);
              if (query && query.v === 1 && query.type === 'diagnostics-query' && typeof query.requestId === 'string'
                  && /^[A-Za-z0-9-]{1,80}$/.test(query.requestId)) {
                const age = now() - diagnosticQueryAt;
                if (query.requestId !== lastDiagnosticQuery && (diagnosticQueryAt < 0 || age >= 1000 || age < 0)) {
                  lastDiagnosticQuery = query.requestId; diagnosticQueryAt = now(); diagnostic.record('query');
                  send(Object.assign({v:1,type:'band-diagnostics',requestId:query.requestId,appVersion:appVersion(),
                    connected,sendShape}, diagnostic.snapshot()));
                }
                return;
              }
              if (query && query.v === 1 && query.type === 'version-query' && typeof query.requestId === 'string'
                  && query.requestId.length > 0 && query.requestId.length <= 80) {
                send({ v: 1, type: 'app-version', requestId: query.requestId, appVersion: appVersion() });
                return;
              }
            }
          } catch (ignored) { /* Normal protocol decoding still handles malformed inputs safely. */ }
          const packet = protocol.decode(event && event.data);
          if (!protocol.accept(latest, packet)) { diagnostic.increment('rejected'); diagnostic.record('rx-reject'); return; }
          diagnostic.increment('accepted'); diagnostic.record('rx-accept');
          const previous = latest;
          const previousSession = previous && previous.session;
          linkReady();
          latest = packet; receivedAt = now(); connectionError = ''; eventRevision++;
          if (packet.phoneExitId) {
            const event = claimLink('exit', packet);
            if (event) { haptics.cancel(); interruption = 'exit'; activeLink = event; pendingLink = event; }
            reminders.consume(packet, false); journeys.consume(packet, false);
            const preference = haptics.peek();
            const delay = packet.reminderEnabled === true && (!preference.ready || preference.enabled) ? preference.duration + 300 : 300;
            if (event) event.deadline = now() + delay;
            appExit.consume(packet, delay);
            send({ v: 1, type: 'ack', session: packet.session, seq: packet.seq, phoneExitId: packet.phoneExitId });
            notify();
            return;
          }
          appExit.consume(packet);
          if (interruption === 'exit') { haptics.cancel(); activeLink = pendingLink = null; interruption = ''; }
          const opening = packet.phoneOpenId ? claimLink('open', packet) : null;
          if (opening) { haptics.cancel(); interruption = 'open'; activeLink = opening; pendingLink = opening; }
          const openingAlive = activeLink && activeLink.kind === 'open' && linkReminderAllowed(activeLink);
          const paused = packet.status === 'paused' && packet.reminderEnabled === true;
          const pauseTransition = packet.status === 'paused' && previous &&
            previous.session === packet.session && previous.status !== 'paused';
          if (interruption === 'pause' && !paused) { haptics.cancel(); interruption = ''; }
          const ending = packet.navigationEnded && (packet.status === 'ended' || packet.status === 'idle');
          if ((!ending && packet.status !== 'active' && !paused) || (!packet.vibrationEnabled && !paused) ||
              (previousSession && previousSession !== packet.session)) {
            if (!openingAlive) { haptics.cancel(); activeLink = pendingLink = null; if (interruption === 'open') interruption = ''; }
          }
          if (pauseTransition) { haptics.cancel(); interruption = 'pause'; }
          const preferences = haptics.peek();
          const eligible = preferences.ready && preferences.enabled;
          const turn = reminders.consume(packet, eligible);
          const journey = journeys.consume(packet, eligible);
          const reminder = opening ? null : journey || turn;
          if (journey === 'end') haptics.cancel();
          const ack = { v: 1, type: 'ack', session: packet.session, seq: packet.seq };
          if (packet.phoneOpenId) ack.phoneOpenId = packet.phoneOpenId;
          send(ack);
          notify();
          if (!opening && pauseTransition && paused && current() && connected) {
            haptics.play(() => current() && connected && latest && latest.session === packet.session &&
              latest.status === 'paused' && latest.reminderEnabled === true &&
              now() - receivedAt >= 0 && now() - receivedAt < protocol.EXPIRY_MS);
          }
          // No page visibility check: handle messages while the App remains alive.
          if (reminder && current() && connected) haptics.play(() => current() && connected &&
            latest && latest.vibrationEnabled && latest.session === packet.session &&
            (journey === 'end' ? latest.navigationEnded && latest.navigationId === packet.navigationId &&
                (latest.status === 'ended' || latest.status === 'idle') :
              latest.status === 'active' && (journey === 'start' ? latest.navigationId === packet.navigationId : latest.actionId === packet.actionId)) &&
            now() - receivedAt >= 0 && now() - receivedAt < protocol.EXPIRY_MS);
        };
      } catch (error) {
        connection = null; generation++;
        fail('互联初始化失败', error);
        return;
      }
    }
    const revision = generation, query = ++queryRevision, event = eventRevision;
    apkStatusText = readApkStatus();
    if (typeof connection.getReadyState !== 'function') {
      diagnostic.record('ready-missing'); notify(); return;
    }
    diagnostic.record('ready-check');
    try {
      connection.getReadyState({
        success(data) {
          if (!alive || revision !== generation || query !== queryRevision || event !== eventRevision) return;
          if (data && Number(data.status) === 2 && (linkEstablished || interruption === 'disconnect')) {
            linkLost(data); return;
          }
          connected = !!data && Number(data.status) === 1; connectionError = '';
          if (connected) { linkReady(); sendReady(); }
          notify();
        },
        fail(data, code) { if (alive && revision === generation && query === queryRevision && event === eventRevision) fail('连接检查失败', data, code); }
      });
    } catch (error) {
      // A diagnostic failure must not erase the callbacks registered above.
      fail('连接检查失败', error);
    }
    notify();
  }
  function dispose() {
    if (!alive) return;
    diagnostic.record('disposed');
    alive = false; generation++; listeners = [];
    appExit.dispose();
    haptics.dispose();
    if (connection) {
      try {
        connection.onmessage = () => {}; connection.onopen = () => {};
        connection.onclose = () => {}; connection.onerror = () => {};
      } catch (error) { /* Some firmware rejects callback changes after disconnect. */ }
    }
    connection = null; latest = null; connected = false;
  }
  return { peek, retry, resume, reportDisplay, send, fail, dispose, isAlive: () => alive,
    recordDiagnostic: diagnostic.record, diagnosticLines: diagnostic.lines,
    selectHaptic(id) { if (alive) haptics.select(id); },
    setHapticEnabled(value) { if (alive) haptics.setEnabled(value); },
    testHaptic() { return alive && haptics.test(); },
    cancelHapticTest() { haptics.cancelTest(); },
    subscribe(listener) {
      if (!alive) return () => {};
      listeners.push(listener);
      return () => { listeners = listeners.filter(item => item !== listener); };
    }
  };
}

// Browser/standalone-page fallback. Native pages prefer this.$app.$def.navigationSession.
let fallback = null;
function getSession(load, now, schedule, unschedule) {
  if (!fallback || !fallback.isAlive()) fallback = createSession({ load, now, schedule, unschedule });
  return fallback;
}
module.exports = { createSession, getSession };
