const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { checkSigning } = require('./check-signing.cjs');
const { prepareToolchain } = require('./prepare-wearable-toolchain.cjs');

function runWearable(action, root = path.resolve(__dirname, '..'), args = []) {
  const commands = { build: ['build'], release: ['release'], start: ['server', '--watch'] };
  if (!Object.hasOwn(commands, action)) throw new Error('Expected build, release or start.');
  // npm ignore-scripts skips prebuild hooks; keep this guard inside the explicit command.
  checkSigning(root, action === 'release');
  prepareToolchain(root);
  const cwd = path.join(root, 'wearable');
  const result = spawnSync(process.execPath,
    [path.join(cwd, 'node_modules/aiot-toolkit/lib/bin.js'), ...commands[action], ...args],
    { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.signal) throw new Error('Wearable command stopped: ' + result.signal);
  return result.status ?? 1;
}
if (require.main === module) {
  try { process.exitCode = runWearable(process.argv[2], undefined, process.argv.slice(3)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { runWearable };
