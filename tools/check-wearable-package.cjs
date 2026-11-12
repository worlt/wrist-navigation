// Smoke-check the JavaScript actually shipped in an RPK, with native APIs mocked.
// This validates packaging and startup behavior, not the Vela native renderer.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Zip = require('../wearable/node_modules/adm-zip');
const project = path.resolve(__dirname, '..');
const sourceManifest = JSON.parse(fs.readFileSync(path.join(project, 'wearable/src/manifest.json'), 'utf8'));
const noFonts = process.argv.includes('--no-fonts');
const rpk = path.resolve(process.argv.slice(2).find(arg => arg !== '--no-fonts') || path.join(project, 'wearable/dist', sourceManifest.package + '.debug.' + sourceManifest.versionName + '.rpk'));
const archive = new Zip(rpk);
const manifest = JSON.parse(archive.readAsText('manifest.json'));
assert.equal(manifest.versionName, sourceManifest.versionName);
assert.equal(manifest.versionCode, sourceManifest.versionCode);
assert.equal(manifest.package, sourceManifest.package);
if (noFonts) {
  for (const entry of archive.getEntries()) {
    assert.doesNotMatch(entry.entryName, /(?:^|\/)fonts\/|font-coverage|\.(?:ttf|otf|woff2?)$/i);
    if (/\.js$/.test(entry.entryName)) assert.doesNotMatch(entry.getData().toString(), /BandSong|BandKai|BandRound|common\/fonts/);
  }
}
let apiLoads = 0;
let available = false;
const sent = [];
const vibrations = [];
const terminations = [];
let appApiMissing = false;
let vibratorMissing = false;
const connection = { getReadyState: callbacks => callbacks.success({ status: 1 }), send(callbacks) {
  const data = typeof callbacks.data === 'object' ? callbacks.data.data : callbacks.data;
  sent.push(JSON.parse(data));
} };
const screenRequests = [];
const saved = [];
const hapticClock = require('../wearable/test/helpers/clock')();
let storedHaptic = '', allowTestVibration = false;
let storedDisplay = '';
const system = {
  setInterval: () => 1, clearInterval() {}, setTimeout: hapticClock.schedule, clearTimeout: hapticClock.unschedule,
  $app_require$(name) {
    apiLoads++;
    if (name === '@app-module/system.storage') return {
      get: callbacks => callbacks.success(callbacks.key === 'navigation.haptics.v1' ? storedHaptic : storedDisplay),
      set: callbacks => {
        if (callbacks.key === 'navigation.haptics.v1') storedHaptic = callbacks.value;
        else saved.push(JSON.parse(callbacks.value));
        callbacks.success();
      }
    };
    if (name === '@app-module/system.app') {
      if (appApiMissing) throw new Error('mock missing app API');
      return { terminate() { assert.equal(sent.at(-1).type, 'ack'); assert.ok(sent.at(-1).phoneExitId); terminations.push(sent.at(-1).phoneExitId); } };
    }
    if (name === '@app-module/system.brightness') return { setKeepScreenOn({ keepScreenOn }) { screenRequests.push(keepScreenOn); } };
    if (name === '@app-module/system.vibrator') {
      if (vibratorMissing) throw new Error('mock missing vibration API');
      return { vibrate(request) {
        if (!allowTestVibration) assert.equal(sent.at(-1).type, 'ack', 'compiled ACK precedes vibration');
        vibrations.push(request.mode);
      } };
    }
    if (available && name === '@app-module/system.interconnect') return { instance: () => connection };
    throw new Error('mock unavailable firmware API');
  }
};
const context = vm.createContext({
  $app_require$: system.$app_require$, console, Date: { now: hapticClock.now },
  aiot: {
    __ce__(type, binding, children) { return { type, options: binding.__opts__, children: children.flat() }; },
    __cf__(binding, create) { return binding.__opts__.exp().flatMap((item, index) => create(index, item)); },
    __ci__(binding, create) { return binding.__opts__.shown() ? create() : []; }
  }
});
function load(file) {
  const source = archive.readAsText(file).replace(/^export default /, '');
  const entry = vm.runInContext('(' + source + ')', context, { filename: file });
  const container = {};
  entry(system, system, system, container, () => {});
  if (container.entry) container.entry(container);
  return container.default;
}
const application = load('app.js');
assert.ok(application);
assert.doesNotThrow(() => application.onCreate());
const startupLoads = apiLoads;
const definition = load('pages/index/index.js');
const page = Object.assign({}, definition.data, definition, { $app: { $def: application } });
page.onInit();
assert.equal(apiLoads, startupLoads, 'page creation uses App session; no native transport re-initialization');
page.onReady();
assert.match(page.status, /连接不可用/);
page.onShow();
available = true;
page.retry();
connection.onmessage({ data: JSON.stringify({ v: 1, type: 'navigation', session: 'package-check', seq: 1,
  status: 'active', title: '高德地图', rawText: '右转进入示例路', maneuver: 'right', instruction: '右转', distance: '200 米' }) });
assert.equal(page.distance, '200 米');
assert.equal(page.status, '高德导航');
assert.equal(typeof page.localDemo, 'undefined');
assert.ok(manifest.features.some(feature => feature.name === 'system.brightness'));
assert.ok(manifest.features.some(feature => feature.name === 'system.vibrator'));
assert.equal(vibrations.length, 0, 'legacy phone frames never vibrate');
assert.deepEqual(screenRequests, [true]);
const tree = page.template(page);
const styles = Object.fromEntries(definition.style.map(rule => [rule[0][0][1], rule[1]]));
assert.equal(tree.type, 'div');
let rows = 0;
function visit(node) {
  if (node.type === 'list' || node.type === 'list-item') {
    const style = Object.assign({}, ...node.options.classList.map(name => styles[name]));
    assert.ok(parseInt(style.height) > 0, node.type + ' needs an explicit height');
    assert.ok(parseInt(style.width) > 0, node.type + ' needs an explicit width');
    if (node.type === 'list-item') rows++;
  }
  if (node.type === 'image') {
    const source = typeof node.options.src === 'function' ? node.options.src() : node.options.src;
    assert.ok(archive.getEntry(source.replace(/^\//, '')), 'image missing: ' + source);
  }
  node.children.forEach(visit);
}
visit(tree);
assert.ok(rows > 0);
function byClass(node, name) {
  if ((node.options.classList || []).includes(name)) return node;
  for (const child of node.children) { const found = byClass(child, name); if (found) return found; }
  return null;
}
function click(name, within) {
  const node = byClass(within || page.template(page), name);
  assert.ok(node, 'missing clickable node: ' + name);
  node.options.events.click({});
}
click('settings-entry');
assert.equal(page.settingsOpen, true);
assert.equal(byClass(page.template(page), 'home'), null, 'home must be removed, not left behind the settings page');
const settingsTree = byClass(page.template(page), 'settings');
assert.ok(settingsTree);
for (const name of ['settings', 'home']) {
  assert.equal(styles[name].position, 'absolute');
  assert.equal(styles[name].top, '0px');
  assert.equal(styles[name].left, '0px');
}
for (let i = 0; i < 6; i++) click('increase', byClass(page.template(page), 'font-size-row'));
assert.equal(page.fontSize, 42);
assert.equal(saved.at(-1).fontSize, 42);
assert.equal(page.versionName, manifest.versionName);
if (noFonts) {
  assert.ok(!Object.values(styles).some(style => style.fontface), 'no compiled custom font faces');
  assert.ok(!settingsTree.children.some(node => node.options.type === 'font'));
  const settingsList = byClass(page.template(page), 'settings-list');
  assert.ok(!settingsList.children.some(node => node.options.type === 'font'), 'font settings row removed');
  page.openPicker('font');
  assert.equal(page.pickerOpen, false, 'removed font picker cannot open');
  for (const font of ['song', 'kai', 'round']) {
    page.saveSettings({ ...page.currentSettings(), font });
    assert.equal(page.font, 'default');
    assert.equal(page.fontFamily, 'sans-serif');
    assert.equal(page.guidanceFontFamily, 'sans-serif');
    assert.equal(saved.at(-1).font, 'default');
    assert.equal(page.fontSize, 42, 'font fallback retains font size');
  }
  const version = byClass(page.template(page), 'version');
  assert.ok(version);
  assert.match(archive.readAsText('pages/index/index.js'), /无字体版/);
} else {
  click('picker-selector');
  assert.equal(page.pickerOpen, true);
  assert.equal(page.settingsTitle, '选择字体');
  assert.equal(byClass(page.template(page), 'settings-list'), null);
  for (let i = 1; i <= 3; i++) {
    if (!page.pickerOpen) click('picker-selector');
    click('option-card', byClass(page.template(page), 'option-list').children[i]);
    assert.equal(page.font, ['default', 'song', 'kai', 'round'][i]);
    assert.equal(saved.at(-1).font, page.font);
    assert.equal(page.pickerOpen, false);
    const family = page.fontFamily;
    assert.ok(archive.getEntry('common/fonts/' + family + '.ttf'));
    assert.ok(archive.getEntry('common/fonts/' + family + '-OFL.txt'));
    assert.ok(styles[family].fontface, 'compiled font-face definition: ' + family);
    assert.ok(archive.readFile('common/fonts/' + family + '.ttf').equals(
      fs.readFileSync(path.join(project, 'wearable/src/common/fonts', family + '.ttf'))));
  }
}
for (const [kind, value] of [['textColor', 'mint'], ['arrowColor', 'amber'], ['arrowStyle', 'solid']]) {
  page.openPicker(kind);
  assert.equal(page.pickerOpen, true);
  assert.equal(page.settingsTitle, { textColor: '文字颜色', arrowColor: '箭头颜色', arrowStyle: '箭头样式' }[kind]);
  const options = byClass(page.template(page), 'option-list').children;
  const index = page.pickerOptions.findIndex(option => option.id === value);
  assert.ok(index >= 0, 'option available: ' + kind + '/' + value);
  click('option-card', options[index]);
  assert.equal(page[kind], value, 'saved ' + kind);
  assert.equal(page.pickerOpen, false);
  assert.equal(saved.at(-1)[kind], value);
}
assert.match(page.arrowSrc, /^\/common\/arrows\/solid\/amber\/8\//);
click('reset-defaults');
assert.equal(page.font, 'default');
assert.equal(page.fontSize, 36);
assert.equal(page.arrowSize, 160);
assert.equal(page.arrowWeight, 8);
assert.equal(page.textColor, 'white');
assert.equal(page.arrowColor, 'mint');
assert.equal(page.arrowStyle, 'solid');
click('back');
assert.equal(byClass(page.template(page), 'settings'), null);
assert.ok(byClass(page.template(page), 'navigation-stage'));
assert.equal(byClass(page.template(page), 'rest'), null);
assert.equal(page.guidanceLines.join(''), '右转进入示例路');
page.saveSettings({ ...page.currentSettings(), fontSize: 44, arrowSize: 232 });
page.paint();
assert.equal(page.arrowSize, 232);
assert.equal(page.arrowDrawSize, 232, 'compiled navigation keeps the maximum arrow at the maximum font');
assert.ok(page.contentTop >= 24);
assert.ok(page.contentTop + page.contentHeight <= 392);
page.resetSettings();
assert.ok(archive.getEntry('common/settings.png'));
for (let i = 0; i < 3; i++) { click('settings-entry'); click('back'); }
for (const style of ['line', 'solid']) {
  for (const color of ['white', 'mint', 'amber', 'sky']) {
    for (let weight = 4; weight <= 10; weight++) {
      for (const maneuver of ['left', 'right', 'straight', 'slight_left', 'slight_right', 'sharp_left', 'sharp_right', 'uturn', 'roundabout', 'arrive', 'unknown']) {
        const name = 'common/arrows/' + style + '/' + color + '/' + weight + '/' + maneuver + '.png';
        assert.ok(archive.getEntry(name));
        assert.ok(archive.readFile(name).equals(fs.readFileSync(path.join(project, 'wearable/src', name))),
          'packaged arrow matches the current preview: ' + name);
      }
    }
  }
}
for (const [seq, maneuver, rawText, expected] of [
  [2, 'roundabout', '前方200米进入环岛，第3出口驶出', '3'],
  [3, 'roundabout', '前方200米进入环岛', ''],
  [4, 'right', '前方200米右转', '']
]) {
  connection.onmessage({ data: JSON.stringify({ v: 1, type: 'navigation', session: 'package-check', seq,
    status: 'active', title: '高德地图', rawText, maneuver, instruction: '', distance: '200 米' }) });
  assert.equal(page.roundaboutExit, expected);
  assert.equal(!!byClass(page.template(page), 'exit-number'), !!expected, 'compiled exit label visibility');
}
page.onDestroy();
assert.deepEqual(screenRequests, [true, false, true, false, true, false, true, false, true, false]);
// Run the haptic checks against the bundled/transpiled modules, not source-only imports.
if (noFonts) storedDisplay = JSON.stringify({ font: 'kai', fontSize: 40, arrowSize: 200, textColor: 'sky' });
page.onInit(); page.onReady(); page.onShow();
if (noFonts) {
  assert.equal(page.font, 'default', 'startup restores old font as system font');
  assert.equal(page.fontFamily, 'sans-serif');
  assert.equal(page.fontSize, 40);
  assert.equal(page.arrowSize, 200);
  assert.equal(page.textColor, 'sky');
  storedDisplay = '';
  page.resetSettings();
}
const haptic = (seq, extra = {}) => ({ v: 1, type: 'navigation', session: 'haptic-package', seq,
  status: 'active', title: '高德地图', rawText: '前方200米右转', maneuver: 'right', instruction: '右转',
  distance: '200 米', actionId: 'turn-1', mode: 'walk', vibrationEnabled: true, ...extra });
const deliver = message => { connection.onmessage({ data: JSON.stringify(message) }); hapticClock.advance(2400); };
deliver(haptic(1)); deliver(haptic(1)); page.paint();
assert.deepEqual(vibrations, ['long', 'long']);
deliver(haptic(2, { distance: '30 米' })); deliver(haptic(3, { distance: '20 米' }));
assert.deepEqual(vibrations, ['long', 'long', 'long', 'long']);
page.onHide(); deliver(haptic(4, { actionId: 'turn-2', distance: '10 米' }));
page.onShow(); deliver(haptic(5, { actionId: 'turn-2', distance: '10 米' }));
assert.deepEqual(vibrations, ['long', 'long', 'long', 'long', 'long', 'long']);
vibratorMissing = true;
assert.doesNotThrow(() => deliver(haptic(6, { actionId: 'turn-3' })));
assert.equal(sent.at(-1).seq, 6); assert.equal(page.status, '高德导航');
page.onDestroy();
vibratorMissing = false;
deliver(haptic(7, { actionId: 'turn-4' }));
assert.deepEqual(vibrations, ['long', 'long', 'long', 'long', 'long', 'long', 'long', 'long']);
const nextPage = Object.assign({}, definition.data, definition, { $app: { $def: application } });
nextPage.onInit(); nextPage.onReady(); nextPage.onShow();
assert.equal(nextPage.distance, '200 米', 'new page restores App snapshot');
deliver(haptic(8, { actionId: 'turn-4' })); assert.equal(vibrations.length, 8);
nextPage.onDestroy();
const receive = connection.onmessage; application.onDestroy(); const ackCount = sent.length;
receive({ data: JSON.stringify(haptic(9, { actionId: 'turn-5' })) });
assert.equal(sent.length, ackCount); assert.equal(vibrations.length, 8);
// Compile-time handlers must reach App-owned preferences and real delayed second pulse.
application.onCreate(); page.onInit(); page.onReady(); page.onShow();
click('settings-entry');
click('picker-selector', byClass(page.template(page), 'haptic-row'));
assert.equal(page.settingsTitle, '提醒震感');
click('option-card', byClass(page.template(page), 'option-list').children[0]);
assert.equal(page.hapticName, '轻柔'); assert.equal(JSON.parse(storedHaptic).profile, 'gentle');
allowTestVibration = true;
click('haptic-test'); click('haptic-test');
assert.equal(vibrations.length, 9); hapticClock.advance(349); assert.equal(vibrations.length, 9);
hapticClock.advance(1); assert.deepEqual(vibrations.slice(-2), ['short', 'short']);
hapticClock.advance(350);
page.onDestroy(); application.onDestroy(); application.onCreate();
page.onInit(); page.onReady(); page.onShow();
assert.equal(page.hapticName, '轻柔', 'saved profile restores at App startup');
click('settings-entry'); click('reset-defaults');
assert.equal(page.hapticName, '明显'); assert.equal(JSON.parse(storedHaptic).profile, 'noticeable');
click('haptic-test'); page.onHide(); hapticClock.advance(2400);
assert.equal(vibrations.length, 11, 'leaving the page cancels only the test second pulse');
page.onDestroy(); application.onDestroy(); allowTestVibration = false;
application.onCreate(); page.onInit(); page.onReady(); page.onShow();
connection.onmessage({ data: JSON.stringify(haptic(1)) });
page.onDestroy(); hapticClock.advance(1200);
assert.deepEqual(vibrations.slice(-2), ['long', 'long'], 'page destruction keeps navigation second pulse');
application.onDestroy(); hapticClock.advance(10000);
assert.equal(hapticClock.count(), 0);
application.onCreate(); page.onInit(); page.onReady(); page.onShow(); click('settings-entry');
click('haptic-toggle'); assert.equal(page.hapticEnabled, false);
assert.equal(JSON.parse(storedHaptic).enabled, false);
const quiet = vibrations.length;
click('haptic-test'); assert.equal(page.hapticStatus, '请先开启振动提醒');
const journey = (seq, extra = {}) => haptic(seq, { navigationId: 'nav-1', navigationEnded: false, ...extra });
deliver(journey(1)); assert.equal(vibrations.length, quiet);
page.onDestroy(); application.onDestroy(); application.onCreate();
page.onInit(); page.onReady(); page.onShow(); assert.equal(page.hapticEnabled, false);
click('settings-entry'); click('haptic-toggle'); assert.equal(page.hapticEnabled, true);
deliver(journey(1)); assert.equal(vibrations.length, quiet + 2, 'start and turn merge into one pair');
deliver(journey(2, { distance: '30 米' })); assert.equal(vibrations.length, quiet + 4);
deliver(journey(3, { status: 'ended', navigationEnded: true, actionId: undefined }));
deliver(journey(4, { status: 'idle', navigationEnded: true, actionId: undefined }));
assert.equal(vibrations.length, quiet + 6, 'end only once');
click('haptic-toggle');
deliver(journey(5, { navigationId: 'nav-2', maneuver: 'straight', actionId: 'turn-9' }));
deliver(journey(6, { navigationId: 'nav-2', navigationEnded: true, status: 'ended' }));
assert.equal(vibrations.length, quiet + 6, 'switch suppresses both start and end');
page.onDestroy(); application.onDestroy(); hapticClock.advance(10000);
// Pause ACK is still sent first; loss uses the last phone preference without a network send.
application.onCreate(); page.onInit(); page.onReady(); page.onShow();
application.navigationSession.setHapticEnabled(true);
const interruptFrame = (seq, extra = {}) => haptic(seq, { reminderEnabled: true, ...extra });
deliver(interruptFrame(1)); const beforePause = vibrations.length;
const pausedFrame = seq => interruptFrame(seq, { status: 'paused', vibrationEnabled: false, actionId: undefined });
connection.onmessage({ data: JSON.stringify(pausedFrame(2)) });
connection.onmessage({ data: JSON.stringify(pausedFrame(3)) });
page.onHide(); hapticClock.advance(2400);
assert.equal(vibrations.length, beforePause + 2, 'compiled hidden pause pair, no repeated second pulse');
deliver(pausedFrame(4)); assert.equal(vibrations.length, beforePause + 2);
const beforeLoss = vibrations.length, sendsBeforeLoss = sent.length;
allowTestVibration = true; // No ACK exists for a native link-loss event.
connection.onclose({ code: 1006 }); connection.onerror({ code: 1006 });
page.onDestroy(); hapticClock.advance(2400);
assert.equal(vibrations.length, beforeLoss + 2, 'compiled app-owned loss pair without a page');
assert.equal(sent.length, sendsBeforeLoss, 'disconnect never sends an ACK');
application.navigationSession.setHapticEnabled(false);
connection.onopen(); connection.onclose({ code: 1006 }); hapticClock.advance(2400);
assert.equal(vibrations.length, beforeLoss + 2, 'master switch suppresses loss');
application.navigationSession.setHapticEnabled(true);
deliver(interruptFrame(5, { reminderEnabled: false, vibrationEnabled: false }));
connection.onclose({ code: 1006 }); hapticClock.advance(2400);
assert.equal(vibrations.length, beforeLoss + 2, 'phone preference suppresses loss');
application.onDestroy(); hapticClock.advance(10000); allowTestVibration = false;

// Test the actual compiled optional v1 exit command, not a substitute source module.
assert.ok(manifest.features.some(feature => feature.name === 'system.app'));
application.onCreate();
const exitFrame = (seq, phoneExitId) => ({ v: 1, type: 'navigation', session: 'exit-package', seq,
  status: 'paused', title: '', rawText: '', instruction: '手机应用已退出', maneuver: 'unknown', distance: '',
  keepScreenOn: false, vibrationEnabled: false, reminderEnabled: true, ...(phoneExitId ? { phoneExitId } : {}) });
const exitDeliver = (seq, id) => connection.onmessage({ data: JSON.stringify(exitFrame(seq, id)) });
const quietExit = vibrations.length;
exitDeliver(1, 'close-1'); assert.equal(sent.at(-1).phoneExitId, 'close-1');
hapticClock.advance(200); exitDeliver(2, 'close-1'); hapticClock.advance(99);
assert.equal(terminations.length, 0); hapticClock.advance(1);
assert.deepEqual(terminations, ['close-1']); assert.equal(vibrations.length, quietExit);
exitDeliver(3, 'close-2'); hapticClock.advance(200); exitDeliver(4); hapticClock.advance(1000);
assert.equal(terminations.length, 1, 'compiled foreground update cancels exit');
appApiMissing = true; exitDeliver(5, 'close-3'); hapticClock.advance(300);
assert.match(application.navigationSession.peek().connectionError, /退出应用失败/);
assert.equal(terminations.length, 1); appApiMissing = false;
exitDeliver(6, 'close-4'); application.onDestroy(); hapticClock.advance(1000);
assert.equal(terminations.length, 1, 'compiled App destroy cancels exit timer');
console.log('RPK ' + manifest.versionName + ': startup, compiled click handlers, font/colour/style choices and resources, exclusive page trees, settings persistence/reset, navigation, screen lifecycle, assets and compiled App-session/double-vibration/dedup/hidden/page-recreation/App-shutdown/API-failure and compiled phone-exit ACK/delay/cancel/dedup/API-failure checks passed.');
