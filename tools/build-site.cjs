// Bundle the three preview pages into a static folder that any file host can
// serve (Vercel, Netlify, GitHub Pages). Run: npm run site
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const previews = path.join(root, 'outputs/previews');
const site = path.join(root, 'site');
const { noticeFiles } = require('./preview-notices.cjs');

for (const script of ['preview-wearable.cjs', 'preview-settings.cjs', 'preview-icons.cjs']) {
  execFileSync(process.execPath, [path.join(__dirname, script)], { stdio: 'inherit' });
}

// The icon gallery is the smaller landing page. The
// interactive preview embeds every font and arrow, so it stays a secondary page.
const pages = [
  ['wearable-icons.html', 'index.html'],
  ['wearable-source.html', 'preview.html'],
  ['wearable-settings-preview.html', 'settings.html']
];

fs.mkdirSync(site, { recursive: true });
const keep = new Set(pages.map(([, to]) => to));
for (const entry of fs.readdirSync(site)) {
  if (entry.endsWith('.html') && !keep.has(entry)) fs.unlinkSync(path.join(site, entry));
}
for (const [from, to] of pages) {
  const source = path.join(previews, from);
  if (!fs.existsSync(source)) throw new Error('missing generated page: ' + from);
  fs.copyFileSync(source, path.join(site, to));
}

const licenses = path.join(site, 'licenses');
fs.mkdirSync(licenses, { recursive: true });
for (const file of noticeFiles) fs.copyFileSync(path.join(root, file), path.join(licenses, path.basename(file)));

const bytes = pages.reduce((total, [, to]) => total + fs.statSync(path.join(site, to)).size, 0);
console.log('静态站点已生成：' + site + '（' + pages.length + ' 页，' + (bytes / 1048576).toFixed(1) + ' MB）');
for (const [, to] of pages) console.log('  /' + to);
