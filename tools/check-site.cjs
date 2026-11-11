// Validate the checked-in static output against freshly generated source previews.
const fs = require('node:fs');
const path = require('node:path');
const { noticeFiles } = require('./preview-notices.cjs');
const pages = [['wearable-icons.html', 'index.html'], ['wearable-source.html', 'preview.html'], ['wearable-settings-preview.html', 'settings.html']];
function checkSite(root = path.resolve(__dirname, '..')) {
  const directory = path.join(root, 'site');
  const expected = new Map(pages.map(([from, to]) => [to, path.join(root, 'outputs/previews', from)]));
  for (const file of noticeFiles) expected.set('licenses/' + path.basename(file), path.join(root, file));
  const actual = [];
  function visit(relative = '') {
    const current = path.join(directory, relative);
    if (!fs.existsSync(current)) throw new Error('Missing static site directory; run npm run site');
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const name = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink()) throw new Error('Unexpected static site symlink: ' + name);
      if (entry.isDirectory()) {
        if (name !== 'licenses') throw new Error('Unexpected static site directory: ' + name);
        visit(name);
      } else if (!entry.isFile() || !expected.has(name)) throw new Error('Unexpected static site file: ' + name);
      else actual.push(name);
    }
  }
  visit();
  for (const [name, source] of expected) {
    if (!actual.includes(name)) throw new Error('Missing static site file: ' + name);
    if (!fs.readFileSync(path.join(directory, name)).equals(fs.readFileSync(source))) throw new Error('Stale static site file: ' + name + '; run npm run site and commit site/');
  }
  return actual.sort();
}
module.exports = { checkSite, pages };
