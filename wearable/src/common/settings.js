const KEY = 'navigation.display.v1';
const FONT_COVERAGE = require('./font-coverage');
const DEFAULTS = { font: 'default', fontSize: 36, arrowSize: 160, arrowWeight: 8,
  textColor: 'white', arrowColor: 'mint', arrowStyle: 'solid' };
// 232px + 8px gap + two 62px rows fits the 368px navigation stage, even at 44pt.
const LIMITS = { fontSize: [24, 44], arrowSize: [32, 232], arrowWeight: [4, 10] };
const FONTS = ['default', 'song', 'kai', 'round'];
// 'short' is the compact value shown in the one-line settings row; the picker
// list has room for the full name.
const FONT_OPTIONS = [
  { id: 'default', name: '系统默认', short: '默认', family: 'sans-serif' },
  { id: 'song', name: '宋体', short: '宋体', family: 'BandSong' },
  { id: 'kai', name: '楷体', short: '楷体', family: 'BandKai' },
  { id: 'round', name: '圆体', short: '圆体', family: 'BandRound' }
];
// Vela has no canvas or image tint, so an arrow colour is a set of pre-coloured
// PNGs picked by directory. Keep this list identical to tools/generate-band-assets.ps1.
const COLOR_OPTIONS = [
  { id: 'white', name: '白色', short: '白色', value: '#ffffff' },
  { id: 'mint', name: '薄荷绿', short: '薄荷', value: '#80f5be' },
  { id: 'amber', name: '琥珀黄', short: '琥珀', value: '#ffcf6b' },
  { id: 'sky', name: '天蓝', short: '天蓝', value: '#7cc7ff' }
];
const STYLE_OPTIONS = [
  { id: 'line', name: '线条' },
  { id: 'solid', name: '实心' }
];
const COLORS = COLOR_OPTIONS.map(option => option.id);
const STYLES = STYLE_OPTIONS.map(option => option.id);
const PICKER_TITLES = { font: '选择字体', textColor: '文字颜色', arrowColor: '箭头颜色', arrowStyle: '箭头样式' };

function fontOption(id) {
  return FONT_OPTIONS[FONTS.indexOf(id)] || FONT_OPTIONS[0];
}

function colorOption(id) {
  return COLOR_OPTIONS[COLORS.indexOf(id)] || COLOR_OPTIONS[0];
}

function styleOption(id) {
  return STYLE_OPTIONS[STYLES.indexOf(id)] || STYLE_OPTIONS[0];
}

function optionsFor(kind) {
  if (kind === 'font') return FONT_OPTIONS.slice();
  if (kind === 'textColor' || kind === 'arrowColor') return COLOR_OPTIONS.slice();
  if (kind === 'arrowStyle') return STYLE_OPTIONS.slice();
  return [];
}

function clamp(value, range, fallback) {
  if (typeof value !== 'number' || !isFinite(value)) return fallback;
  return Math.min(range[1], Math.max(range[0], Math.round(value)));
}

function arrowPath(style, color, weight, maneuver) {
  const picked = STYLES.indexOf(style) >= 0 ? style : DEFAULTS.arrowStyle;
  const tint = COLORS.indexOf(color) >= 0 ? color : DEFAULTS.arrowColor;
  const thickness = clamp(weight, LIMITS.arrowWeight, DEFAULTS.arrowWeight);
  const shape = /^[a-z_]{2,12}$/.test(String(maneuver)) ? maneuver : 'unknown';
  return '/common/arrows/' + picked + '/' + tint + '/' + thickness + '/' + shape + '.png';
}

// An uncommon road name or emoji must not disappear because of a font subset.
// Fall back for the whole text block, retaining the notification verbatim.
function fontForText(id, text) {
  const coverage = FONT_COVERAGE[id];
  if (!coverage) return 'sans-serif';
  for (const character of String(text || '')) {
    const point = character.codePointAt(0);
    if (point === 10 || point === 13) continue;
    if (point >= 65536 || !(parseInt(coverage.charAt(point >> 2), 16) & (1 << (point & 3)))) return 'sans-serif';
  }
  return fontOption(id).family;
}

function normalize(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = { font: DEFAULTS.font, fontSize: DEFAULTS.fontSize,
    arrowSize: DEFAULTS.arrowSize, arrowWeight: DEFAULTS.arrowWeight,
    textColor: DEFAULTS.textColor, arrowColor: DEFAULTS.arrowColor, arrowStyle: DEFAULTS.arrowStyle };
  if (FONTS.indexOf(input.font) >= 0) result.font = input.font;
  if (COLORS.indexOf(input.textColor) >= 0) result.textColor = input.textColor;
  if (COLORS.indexOf(input.arrowColor) >= 0) result.arrowColor = input.arrowColor;
  if (STYLES.indexOf(input.arrowStyle) >= 0) result.arrowStyle = input.arrowStyle;
  for (const name of Object.keys(LIMITS)) result[name] = clamp(input[name], LIMITS[name], DEFAULTS[name]);
  return result;
}

// Serialize writes: firmware callbacks may arrive late; only the latest value may win.
function createStore(storage, onLoad, onStatus) {
  let alive = true;
  let revision = 0;
  let pending = null;
  let writing = false;
  function status(value) { if (alive) onStatus(value); }
  function flush() {
    if (writing || !pending) return;
    const job = pending;
    pending = null;
    writing = true;
    let completed = false;
    function finish(ok) {
      if (completed) return;
      completed = true;
      writing = false;
      if (revision === job.revision) status(ok ? '已保存' : '保存失败，本次仍有效');
      flush();
    }
    try {
      storage.set({ key: KEY, value: JSON.stringify(job.value),
        success: () => finish(true), fail: () => finish(false) });
    } catch (error) { finish(false); }
  }
  return {
    load() {
      const started = revision;
      try {
        storage.get({ key: KEY, default: '', success: raw => {
          if (!alive || revision !== started) return;
          let value;
          try { value = JSON.parse(raw || '{}'); } catch (error) { value = {}; }
          onLoad(normalize(value));
        }, fail: () => { if (revision === started) status('读取失败，使用当前设置'); } });
      } catch (error) { status('本次调整无法保存'); }
    },
    save(value) {
      if (!alive) return;
      pending = { revision: ++revision, value: normalize(value) };
      status('保存中');
      flush();
    },
    // Already queued writes may finish after closing; callbacks no longer touch UI.
    dispose() { alive = false; }
  };
}

module.exports = { KEY, DEFAULTS, LIMITS, FONTS, FONT_OPTIONS, COLORS, COLOR_OPTIONS,
  STYLES, STYLE_OPTIONS, PICKER_TITLES, fontOption, colorOption, styleOption, optionsFor,
  arrowPath, fontForText, normalize, createStore };
