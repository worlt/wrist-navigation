const protocol = require('./protocol');
const createAppExit = require('./app-exit').createAppExit;
const presentation = require('./presentation');
const createReminders = require('./reminders').createReminders;
const createHaptics = require('./haptics').createHaptics;
const createJourneyReminders = require('./journey-reminders').createJourneyReminders;

// App-owned transport. Pages observe snapshots; they never own the native callbacks.
function createSession(options) {
  const load = options.load;
  const now = options.now || (() => Date.now());
  const reminders = createReminders();
  const journeys = createJourneyReminders();
  let alive = true, connection = null, generation = 0;
  let latest = null, receivedAt = 0, connected = false, connectionError = '';
  let sendShape = 0, lastSend = '尚未发送';
  let listeners = [];
  let apkStatusText = '未检测', eventRevision = 0, queryRevision = 0;
  // Official interconnect: onclose, ready-state=2 or error code 1006 prove link loss.
  // https://iot.mi.com/vela/quickapp/zh/features/network/interconnect.html
  let linkEstablished = false, lossRevision = 0, interruption = '';
  const haptics = createHaptics({ load, now, schedule: options.schedule,
    unschedule: options.unschedule, changed: notify });
  haptics.load();
  const appExit = createAppExit({ load, schedule: options.schedule, unschedule: options.unschedule,
    onError(error) { connectionError = presentation.errorText('退出应用失败', error); notify(); } });

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
    connected = false; eventRevision++;
    if (interruption !== 'disconnect') haptics.cancel();
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
    const transition = linkEstablished;
    linkEstablished = false;
    if (transition) { lossRevision++; haptics.cancel(); interruption = 'disconnect'; }
    fail('连接断开', data);
    const token = lossRevision, lostAt = now();
    if (transition && !appExit.isClosing() && latest && latest.reminderEnabled === true) {
      haptics.play(() => alive && !linkEstablished && lossRevision === token &&
        latest && latest.reminderEnabled === true && now() - lostAt >= 0 && now() - lostAt < protocol.EXPIRY_MS);
    }
  }
  function send(message) {
    if (!alive || !connection) return;
    const revision = generation;
    try {
      const payload = JSON.stringify(message);
      const request = sendShape === 0 ? { data: payload } : { data: { data: payload } };
      request.success = () => {
        if (!alive || revision !== generation) return;
        lastSend = '已发送 ' + (message.type || '') + (sendShape === 0 ? '' : '（嵌套）');
        notify();
      };
      request.fail = (data, code) => {
        if (!alive || revision !== generation) return;
        if (Number(code) === 202 && sendShape === 0) {
          sendShape = 1;
          lastSend = '字符串格式被拒，改用嵌套格式';
          send(message);
          return;
        }
        lastSend = '发送失败 ' + (code === undefined ? '' : code);
        fail('发送失败', data, code);
      };
      connection.send(request);
    } catch (error) { fail('发送失败', error); }
  }
  function retry() {
    if (!alive) return;
    connectionError = '';
    if (!connection) {
      try {
        connection = load('@system.interconnect').instance();
        const revision = ++generation;
        const current = () => alive && revision === generation;
        connection.onopen = () => {
          if (!current()) return;
          linkReady(); connectionError = ''; eventRevision++;
          apkStatusText = readApkStatus();
          send({ v: 1, type: 'ready' }); notify();
        };
        connection.onclose = data => { if (current()) linkLost(data); };
        connection.onerror = data => { if (current()) fail('连接异常', data); };
        connection.onmessage = event => {
          if (!current()) return;
          const packet = protocol.decode(event && event.data);
          if (!protocol.accept(latest, packet)) return;
          const previous = latest;
          const previousSession = previous && previous.session;
          linkReady();
          latest = packet; receivedAt = now(); connectionError = ''; eventRevision++;
          if (packet.phoneExitId) {
            haptics.cancel(); interruption = '';
            reminders.consume(packet, false); journeys.consume(packet, false);
            appExit.consume(packet);
            notify();
            send({ v: 1, type: 'ack', session: packet.session, seq: packet.seq, phoneExitId: packet.phoneExitId });
            return;
          }
          appExit.consume(packet);
          const paused = packet.status === 'paused' && packet.reminderEnabled === true;
          const pauseTransition = packet.status === 'paused' && previous &&
            previous.session === packet.session && previous.status !== 'paused';
          if (interruption === 'pause' && !paused) { haptics.cancel(); interruption = ''; }
          const ending = packet.navigationEnded && (packet.status === 'ended' || packet.status === 'idle');
          if ((!ending && packet.status !== 'active' && !paused) || (!packet.vibrationEnabled && !paused) ||
              (previousSession && previousSession !== packet.session)) haptics.cancel();
          if (pauseTransition) { haptics.cancel(); interruption = 'pause'; }
          const preferences = haptics.peek();
          const eligible = preferences.ready && preferences.enabled;
          const turn = reminders.consume(packet, eligible);
          const journey = journeys.consume(packet, eligible);
          const reminder = journey || turn;
          if (journey === 'end') haptics.cancel();
          notify();
          send({ v: 1, type: 'ack', session: packet.session, seq: packet.seq });
          if (pauseTransition && paused && current() && connected) {
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
    try {
      connection.getReadyState({
        success(data) {
          if (!alive || revision !== generation || query !== queryRevision || event !== eventRevision) return;
          if (data && data.status === 2 && (linkEstablished || interruption === 'disconnect')) {
            linkLost(data); return;
          }
          connected = !!data && data.status === 1; connectionError = '';
          if (connected) { linkReady(); send({ v: 1, type: 'ready' }); }
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
  return { peek, retry, send, fail, dispose, isAlive: () => alive,
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
