const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { noFontSources } = require('../build-wearable-nofont.cjs');
const root = path.resolve(__dirname, '../..');
const regularSettings = fs.readFileSync(path.join(root, 'wearable/src/common/settings.js'), 'utf8');
const regularPage = fs.readFileSync(path.join(root, 'wearable/src/pages/index/index.ux'), 'utf8');
const transformed = noFontSources(regularSettings, regularPage);
function loadSettings() {
  const context = vm.createContext({ module: { exports: {} } });
  vm.runInContext(transformed.settings, context);
  return context.module.exports;
}

test('no-font build loads old custom-font settings with system font and retains display choices', () => {
  const settings = loadSettings();
  for (const font of ['song', 'kai', 'round']) {
    const previous = { font, fontSize: 40, arrowSize: 200, arrowWeight: 9, textColor: 'sky', arrowColor: 'amber', arrowStyle: 'line' };
    let loaded, saved;
    const store = settings.createStore({ get: cb => cb.success(JSON.stringify(previous)), set: cb => { saved = JSON.parse(cb.value); cb.success(); } },
      value => { loaded = value; }, () => {});
    store.load();
    assert.deepEqual(JSON.parse(JSON.stringify(loaded)), { ...previous, font: 'default' });
    store.save(previous);
    assert.deepEqual(saved, { ...previous, font: 'default' });
    assert.equal(settings.fontOption(font).family, 'sans-serif');
    assert.equal(settings.fontForText(font, '右转𠮷祥路🧭'), 'sans-serif');
  }
});

test('no-font settings remove font picker but retain colors and arrow styles', () => {
  const settings = loadSettings();
  assert.equal(settings.optionsFor('font').length, 0);
  for (const kind of ['textColor', 'arrowColor', 'arrowStyle']) assert.ok(settings.optionsFor(kind).length > 1);
  assert.doesNotMatch(transformed.page, /<list-item type="font"|@font-face|\.ttf/);
  assert.match(transformed.page, />v\{\{ versionName \}\} 无字体版<\/text>/);
  assert.match(regularPage, /<list-item type="font"/);
  assert.equal(require('../../wearable/src/common/settings').FONTS.length, 4);
});

test('no-font transform refuses changed source patterns rather than silently leaving broken fonts', () => {
  assert.throws(() => noFontSources(regularSettings.replace('const FONTS', 'const RENAMED'), regularPage), /font IDs/);
  assert.throws(() => noFontSources(regularSettings, regularPage.replace('type="font"', 'type="renamed"')), /font settings row/);
  assert.throws(() => noFontSources(regularSettings, regularPage + regularPage), /font settings row/);
});
