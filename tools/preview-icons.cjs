// Offline preview of the exact PNG resources used by the wearable.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const settings = require('../wearable/src/common/settings');
const artwork = require('../wearable/src/common/arrow-artwork.json');
const { notices } = require('./preview-notices.cjs');
const ringFrame = artwork.frames.roundabout;
const ring = artwork.roundabout;
const maneuvers = [
  ['straight','直行'], ['left','左转'], ['right','右转'],
  ['slight_left','稍向左'], ['slight_right','稍向右'],
  ['sharp_left','急左转'], ['sharp_right','急右转'],
  ['uturn','掉头'], ['arrive','到达'], ['unknown','未知']
];
const allManeuvers = maneuvers.concat([['roundabout','环岛']]);
const weights = Array.from({length: 7}, (_, i) => i + 4);
const assets = {};
for (const style of settings.STYLES) for (const colour of settings.COLORS) {
  for (const weight of weights) for (const [maneuver] of allManeuvers) {
    const key = [style, colour, weight, maneuver].join('/');
    assets[key] = 'data:image/png;base64,' + fs.readFileSync(
      path.join(root, 'wearable/src/common/arrows', key + '.png')).toString('base64');
  }
}
function glyph(style, maneuver, label, exit) {
  return '<div class="glyph" role="img" aria-label="' + style.name + ' · ' + label + '">' +
    '<img data-style="' + style.id + '" data-maneuver="' + maneuver + '" alt="" width="100" height="100">' +
    (exit ? '<span class="exit-number" style="left:' + (ring.centerX-ringFrame[0]-ring.labelSize/2)/ringFrame[2]*100 +
      '%;top:' + (ring.centerY-ringFrame[1]-ring.labelSize/2)/ringFrame[2]*100 + '%;width:' + ring.labelSize/ringFrame[2]*100 +
      '%;height:' + ring.labelSize/ringFrame[2]*100 + '%;font-size:calc(var(--arrow-size)*' + ring.fontSize/ringFrame[2] + ')">' + exit + '</span>' : '') + '</div>';
}
function card(maneuver, label, exit) {
  return '<figure><figcaption>' + label + '</figcaption>' +
    settings.STYLE_OPTIONS.map(style => '<div class="sample">' + glyph(style, maneuver, label, exit) +
      '<span class="style-label">' + style.name + '</span></div>').join('') + '</figure>';
}
const cards = maneuvers.map(([key, label]) => card(key, label)).join('');
const rings = [1,2,3,4,''].map(number => card('roundabout', number ? '第 ' + number + ' 出口' : '未提供出口', number)).join('');
const groups = settings.STYLE_OPTIONS.map(style => settings.COLOR_OPTIONS.map(colour =>
  '<section class="group"><h3>' + style.name + ' · ' + colour.name + '</h3><div class="table-scroll"><table>' +
  '<thead><tr><th scope="col">转向</th>' + weights.map(weight => '<th scope="col">粗细 ' + weight + '</th>').join('') + '</tr></thead><tbody>' +
  allManeuvers.map(([maneuver,label]) => '<tr><th scope="row">' + label + '</th>' +
    weights.map(weight => '<td><div class="tile"><img data-asset="' + [style.id,colour.id,weight,maneuver].join('/') +
      '" width="56" height="56" alt="' + style.name + ' ' + colour.name + ' ' + label + ' 粗细 ' + weight + '" loading="lazy"></div></td>').join('') + '</tr>').join('') +
  '</tbody></table></div></section>').join('')).join('');
const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
'<title>腕上导航 · 箭头图标总览</title><style>' + String.raw`
*{box-sizing:border-box}
:root{--ink:#25382c;--muted:#52675a;--page:#f0f3ed;--screen:#101a14;--tint:#80f5be;--arrow-size:100px;--cell-size:126px}
body{margin:0;background:var(--page);color:var(--ink);font-family:"Microsoft YaHei",sans-serif;padding:30px 32px 64px}
main,header,nav{max-width:1400px;margin-left:auto;margin-right:auto}
h1{font-size:26px;line-height:1.4;margin:0 0 8px;font-weight:700}
h2{font-size:19px;margin:0;font-weight:700}
h3{font-size:16px;margin:0 0 12px}
.intro{font-size:14px;line-height:1.8;max-width:850px;margin:0;color:var(--muted)}
nav{display:flex;gap:8px;flex-wrap:wrap;padding:20px 0 24px;font-size:14px}
nav a{padding:8px 13px;border:1px solid #bac8bd;border-radius:8px;background:#fff;color:var(--ink);text-decoration:none}
nav a[aria-current]{background:var(--ink);color:#fff;border-color:var(--ink)}
.toolbar{display:flex;gap:20px 32px;align-items:center;flex-wrap:wrap;padding:18px 20px;background:#fff;border:1px solid #d5dfd7;border-radius:12px;margin-bottom:28px}
.control{display:flex;align-items:center;gap:12px;font-size:13px}
.control label,.control-title{font-weight:700;white-space:nowrap}
.colors{display:flex;gap:6px}
.color{font:inherit;display:flex;align-items:center;gap:6px;border:1px solid transparent;background:transparent;color:var(--ink);padding:7px 8px;border-radius:6px;cursor:pointer}
.color[aria-pressed=true]{border-color:#25382c;background:#eef4ef}
.swatch{width:15px;height:15px;background:var(--swatch);box-shadow:inset 0 0 0 1px #0003;border-radius:50%}
input[type=range]{accent-color:#315d46;width:110px;cursor:pointer}
output{min-width:38px;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--muted)}
.section-head{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.section-head p{font-size:13px;color:var(--muted);margin:0;line-height:1.7}
.comparison{display:grid;grid-template-columns:repeat(auto-fit,minmax(var(--cell-size),1fr));gap:12px}
figure{margin:0;min-width:0;border-radius:12px;background:var(--screen);color:#e5eee8;overflow:hidden;text-align:center}
figcaption{font-size:13px;padding:15px 6px 8px}
.sample{position:relative;display:flex;align-items:center;flex-direction:column;padding:5px 0 12px}
.sample+.sample{border-top:1px solid #ffffff12;padding-top:12px}
.glyph{position:relative;flex:none;width:var(--arrow-size);height:var(--arrow-size);color:var(--tint)}
.glyph img{display:block;width:100%;height:100%}
.exit-number{position:absolute;font-family:Arial,sans-serif;font-weight:700;line-height:1.333333;text-align:center;font-variant-numeric:tabular-nums}
.style-label{font-size:11px;line-height:1.5;color:#9eafa4;margin-top:3px}
.roundabouts{margin-top:30px}
.roundabouts .comparison{grid-template-columns:repeat(auto-fit,minmax(var(--cell-size),1fr))}
.note{font-size:13px;line-height:1.8;color:var(--muted);max-width:850px;margin:12px 0 0}
details{margin-top:32px;border-top:1px solid #cbd7ce;padding-top:18px}
summary{font-size:15px;font-weight:700;cursor:pointer;padding:6px 0}
.archive{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,600px),1fr));gap:28px;margin-top:24px}
.table-scroll{overflow:auto;border-radius:10px}
table{width:100%;border-collapse:collapse;background:#fff}
th,td{padding:6px;border-bottom:1px solid #e7ede8;text-align:center;white-space:nowrap}
thead th{font-size:12px;color:var(--muted);font-weight:400;background:#e8eee9}
tbody th{font-size:12px;text-align:left;padding-left:12px}
.tile{width:60px;height:60px;background:var(--screen);border-radius:8px;margin:auto;display:grid;place-items:center}
.tile img{display:block}
footer{font-size:12px;color:var(--muted);margin-top:26px;line-height:1.8}
:focus-visible{outline:3px solid #477654;outline-offset:4px}
@media(max-width:760px){body{padding:20px 16px 40px}.toolbar{padding:14px;gap:16px}.control{flex-wrap:wrap;gap:8px}.colors{flex-wrap:wrap}.roundabouts .comparison{grid-template-columns:repeat(auto-fit,minmax(var(--cell-size),1fr))}h1{font-size:23px}}
` + '</style></head><body><header><h1>腕上导航 · 箭头图标总览</h1>' +
'<p class="intro">线条与实心，上下对照。调整颜色、粗细和大小，查看手环实际使用的箭头；环岛中央的数字表示第几个出口。</p></header>' +
'<nav aria-label="预览页面"><a href="preview.html">交互预览</a><a href="settings.html">设置原型</a><a href="index.html" aria-current="page">图标总览</a></nav>' +
'<main><div class="toolbar" aria-label="箭头预览设置"><div class="control"><span class="control-title">箭头颜色</span><div class="colors">' +
settings.COLOR_OPTIONS.map(colour => '<button class="color" type="button" data-colour="' + colour.id + '" aria-pressed="' +
  (colour.id===settings.DEFAULTS.arrowColor) + '"><span class="swatch" aria-hidden="true" style="--swatch:' + colour.value + '"></span>' +
  colour.name + '</button>').join('') + '</div></div>' +
'<div class="control"><label for="weight">粗细</label><input id="weight" type="range" min="4" max="10" step="1" value="' + settings.DEFAULTS.arrowWeight +
'"><output for="weight" id="weight-value">' + settings.DEFAULTS.arrowWeight + ' 档</output></div>' +
'<div class="control"><label for="size">显示大小</label><input id="size" type="range" min="32" max="' + settings.LIMITS.arrowSize[1] + '" step="2" value="' + settings.DEFAULTS.arrowSize +
'"><output for="size" id="size-value">' + settings.DEFAULTS.arrowSize + ' px</output></div></div>' +
'<section aria-labelledby="turns-title"><div class="section-head"><h2 id="turns-title">转向箭头</h2><p>上排线条 · 下排实心</p></div><div class="comparison">' + cards + '</div></section>' +
'<section class="roundabouts" aria-labelledby="ring-title"><div class="section-head"><h2 id="ring-title">环岛，看清第几出口</h2><p>入口 + 环行方向 + 出口序号</p></div><div class="comparison">' + rings + '</div>' +
'<p class="note">以上为出口序号示例。实际导航只显示原文明确提供的序号；没有序号时保留环岛图标与原文。环行箭头表示绕行方向，不代表路口的实际出口角度。</p></section>' +
'<details id="all-assets"><summary>全部 616 张资源 · 4 种颜色 × 7 档粗细</summary><div class="archive">' + groups + '</div></details>' +
'<footer>' + artwork.pngSize + ' × ' + artwork.pngSize + ' 透明底源图，与手环共用同一套资源。预览中的显示大小为 CSS 像素；浏览器预览不等于真机验收。</footer></main>' +
'<script>const assets=' + JSON.stringify(assets) + ';const colours=' + JSON.stringify(settings.COLOR_OPTIONS) +
';let colour=' + JSON.stringify(settings.DEFAULTS.arrowColor) + ';' + String.raw`
const weight = document.getElementById('weight');
const size = document.getElementById('size');
function render() {
  document.documentElement.style.setProperty('--tint', colours.find(item => item.id === colour).value);
  document.documentElement.style.setProperty('--arrow-size', size.value + 'px');
  document.documentElement.style.setProperty('--cell-size', Math.max(112,Number(size.value)+26) + 'px');
  document.getElementById('weight-value').textContent = weight.value + ' 档';
  document.getElementById('size-value').textContent = size.value + ' px';
  document.querySelectorAll('[data-style]').forEach(img => {
    img.src = assets[[img.dataset.style,colour,weight.value,img.dataset.maneuver].join('/')];
  });
  document.querySelectorAll('[data-colour]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.colour === colour)));
}
document.querySelectorAll('[data-colour]').forEach(button => button.addEventListener('click', () => { colour = button.dataset.colour; render(); }));
weight.addEventListener('input',render);
size.addEventListener('input',render);
document.getElementById('all-assets').addEventListener('toggle', event => {
  if (event.target.open) document.querySelectorAll('[data-asset]').forEach(img => {
    if (!img.hasAttribute('src')) img.src = assets[img.dataset.asset];
  });
});
render();
` + '</script></body></html>';
const output = path.join(root,'outputs/previews/wearable-icons.html');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,html.replace('</body>', notices() + '</body>'));
console.log(output);
