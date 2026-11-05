// Execute the actual UX page script and template in a browser adapter.
// Native APIs and rendering are simulated; this is not a Vela firmware emulator.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'wearable/src/pages/index/index.ux'), 'utf8');
const manifest = require('../wearable/src/manifest.json');
const maxArrow = require('../wearable/src/common/settings').LIMITS.arrowSize[1];
const { notices } = require('./preview-notices.cjs');
// Every state and settings view gets its own band so the whole set is visible at once.
const scenes = [
  { scene: 'active', caption: '导航 · 直行 / 可操作' },
  { scene: 'long', caption: '长文字换行 / 可操作' },
  { scene: 'long', caption: '长文字 + 最大字号 44 + 最大箭头 ' + maxArrow, settings: { fontSize: 44, arrowSize: maxArrow, arrowWeight: 6 } },
  { scene: 'ready', caption: '已连接 · 等待手机端' },
  { scene: 'idle', caption: '等待导航' },
  { scene: 'noapk', caption: '手机端未安装' },
  { scene: 'disconnected', caption: '连接已断开' },
  { scene: 'ended', caption: '导航结束' },
  { scene: 'paused', caption: '同步已暂停' },
  { scene: 'expired', caption: '导航已过期' },
  { scene: 'error', caption: '连接不可用 · 错误详情' },
  { scene: 'idle', caption: '显示设置', settingsOpen: true },
  { scene: 'active', caption: '字体选择', settingsOpen: true, picker: 'font' },
  { scene: 'active', caption: '箭头颜色选择', settingsOpen: true, picker: 'arrowColor' },
  { scene: 'roundabout-1', caption: '环岛 · 第1出口 / 实心' },
  { scene: 'roundabout-3', caption: '环岛 · 第3出口 / 线条', settings: { arrowStyle: 'line' } },
  { scene: 'roundabout-12', caption: '环岛 · 第12出口 / 最大箭头', settings: { arrowSize: maxArrow } },
  { scene: 'roundabout-unknown', caption: '环岛 · 原文未提供出口' }
];
const bundle = {
  template: source.match(/<template>([\s\S]*?)<\/template>/)[1],
  script: source.match(/<script>([\s\S]*?)<\/script>/)[1].replace('export default', 'module.exports ='),
  modules: {}, images: {}
};
for (const name of ['protocol', 'presentation', 'settings', 'geometry', 'font-coverage']) {
  bundle.modules['../../common/' + name] = fs.readFileSync(path.join(root, 'wearable/src/common', name + '.js'), 'utf8');
}
bundle.modules['../../manifest.json'] = 'module.exports = ' + JSON.stringify(manifest);
bundle.modules['../../common/arrow-artwork.json'] = 'module.exports = ' + JSON.stringify(require('../wearable/src/common/arrow-artwork.json'));
bundle.scenes = scenes;
function images(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) images(file);
    else if (entry.name.endsWith('.png')) bundle.images['/' + path.relative(path.join(root, 'wearable/src'), file).replace(/\\/g, '/')] =
      'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
  }
}
images(path.join(root, 'wearable/src/common'));
const styles = source.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/url\('\/common\/fonts\/([^']+)'\)/g,
  (_, name) => "url('data:font/ttf;base64," + fs.readFileSync(path.join(root, 'wearable/src/common/fonts', name)).toString('base64') + "')");
const runtime = fs.readFileSync(path.join(__dirname, 'preview-runtime.js'), 'utf8');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>腕上导航 · ${manifest.versionName} 本地调试</title><style>
*{box-sizing:border-box}body{margin:0;background:#f0f3ed;color:#25382c;font-family:"Microsoft YaHei",sans-serif;padding:32px}
h1{font-size:28px;margin:0 0 12px}.intro{font-size:14px;line-height:1.8;margin:0 0 22px;max-width:1000px}
main{display:flex;gap:28px;flex-wrap:wrap}.caption{font-size:14px;margin:16px 4px 0}.controls{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px}
button{border:1px solid #afbeb1;border-radius:9px;padding:9px 14px;background:#fff;color:#25382c;cursor:pointer}
button.selected{background:#25382c;color:#fff}
.site-nav{display:flex;gap:10px;margin:0 0 18px;font-size:14px}
.site-nav a{padding:7px 12px;border:1px solid #afbeb1;border-radius:9px;background:#fff;color:#25382c;text-decoration:none}
.site-nav a[aria-current]{background:#25382c;color:#fff;border-color:#25382c}.band{width:352px;height:496px;padding:8px;border-radius:52px;background:#26372c;box-shadow:0 16px 30px #17261a20;overflow:hidden}
.page{border-radius:44px;overflow:hidden}.page :where(div){display:flex;position:relative}.page{display:flex}
.page :where(p){margin:0;white-space:pre-wrap;overflow:hidden;font-weight:400}.page img{display:block}
.page [style*="font-family: sans-serif"]{font-family:"Microsoft YaHei",sans-serif!important}
.page [role=button]{cursor:pointer}.page [role=button]:focus-visible{outline:2px solid #80f5be;outline-offset:-3px}
.page [data-type=list]{display:block;overflow-y:auto;scrollbar-width:none}.page [data-type=list-item]{display:block}
${styles}
@media(max-width:600px){body{padding:16px}h1{font-size:24px}main{gap:24px}}
</style><h1>腕上导航 · ${manifest.versionName} 本地交互调试</h1>
<nav class="site-nav"><a href="preview.html" aria-current="page">交互预览</a><a href="settings.html">设置原型</a><a href="index.html">图标总览</a></nav>
<p class="intro">下面每个手环对应一种状态或一个设置页，点里面的齿轮、加减、返回即可执行与安装包相同的页面代码，各手环互不影响。设置保存在当前浏览器，“恢复全部预览默认值”会清空所有手环的本地设置。<br>336 × 480；浏览器模拟通信、存储与亮屏接口，不是 Vela 模拟器或真机验收。</p>
<div class="controls" aria-label="模拟状态">
<button id="reset">恢复全部预览默认值</button></div>
<main>${scenes.map((entry, i) => `<section><div class="band" id="band-${i}"></div><p class="caption">${entry.caption}</p></section>`).join('')}</main>
<script>const bundle=${JSON.stringify(bundle).replace(/</g,'\\u003c')};\n${runtime}</script></html>`;
const output = path.join(root, 'outputs/previews/wearable-source.html');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html.replace('</html>', notices() + '</html>'));
console.log(output);
