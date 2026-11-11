const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { checkSite, pages } = require('../check-site.cjs');
const { noticeFiles } = require('../preview-notices.cjs');
const project = path.resolve(__dirname, '../..');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wrist-site-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, text) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
  for (const [from, to] of pages) { write('outputs/previews/' + from, from); write('site/' + to, from); }
  for (const file of noticeFiles) { write(file, file); write('site/licenses/' + path.basename(file), file); }
  return { root, write };
}
test('Vercel directly serves tracked site files without installing or building', () => {
  const config = JSON.parse(fs.readFileSync(path.join(project, 'vercel.json'), 'utf8'));
  assert.equal(config.outputDirectory, 'site'); assert.equal(config.buildCommand, '');
  assert.equal(config.installCommand, ''); assert.equal(config.framework, null);
  assert.ok(!fs.readFileSync(path.join(project, '.gitignore'), 'utf8').split(/\r?\n/).includes('site/'));
});
test('static site gate verifies every generated page and complete notice copy', t => {
  assert.equal(checkSite(fixture(t).root).length, pages.length + noticeFiles.length);
});
test('static site gate rejects stale generated content', t => {
  const { root, write } = fixture(t); write('site/preview.html', 'outdated');
  assert.throws(() => checkSite(root), /Stale/);
});
test('static site gate rejects missing notices and unexpected private files', t => {
  const { root, write } = fixture(t); fs.unlinkSync(path.join(root, 'site/licenses/LICENSE'));
  assert.throws(() => checkSite(root), /Missing/);
  write('site/licenses/LICENSE', 'LICENSE'); write('site/private.key', 'synthetic');
  assert.throws(() => checkSite(root), /Unexpected/);
});
