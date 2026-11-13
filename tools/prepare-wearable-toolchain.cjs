const fs = require('node:fs');
const path = require('node:path');

function prepareToolchain(root = path.resolve(__dirname, '..')) {
  const modules = path.join(root, 'wearable/node_modules');
  const toolkit = JSON.parse(fs.readFileSync(path.join(modules, 'aiot-toolkit/package.json'), 'utf8'));
  const git = JSON.parse(fs.readFileSync(path.join(modules, 'simple-git/package.json'), 'utf8'));
  if (toolkit.version !== '2.0.5' || git.version !== '4.0.2') throw new Error('Toolchain changed; review the simple-git compatibility patch.');
  const file = path.join(modules, '@aiot-toolkit/shared-utils/lib/utils/NetworkUtil.js');
  const before = 'var _simpleGit = _interopRequireDefault(require("simple-git"));';
  const after = 'var _simpleGit = { default: require("simple-git").simpleGit };';
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(after) && !source.includes(before)) return;
  if (source.split(before).length !== 2 || source.includes(after)) throw new Error('Unexpected toolkit Git import; refusing to patch.');
  // Toolkit 2.0.5 uses the old default export. simple-git 4 retains the named factory.
  fs.writeFileSync(file, source.replace(before, after), 'utf8');
}
if (require.main === module) {
  try { prepareToolchain(); console.log('Wearable toolchain compatibility prepared.'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { prepareToolchain };
