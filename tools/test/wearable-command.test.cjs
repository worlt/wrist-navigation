const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runWearable } = require('../run-wearable.cjs');

test('explicit npm commands still reject missing original signatures with lifecycle scripts disabled', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wrist-command-'));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('wrist-command-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const wearable = path.join(root, 'wearable');
  const tools = path.join(root, 'tools');
  fs.mkdirSync(wearable);
  fs.mkdirSync(tools);
  fs.copyFileSync(path.resolve(__dirname, '../../wearable/package.json'), path.join(wearable, 'package.json'));
  fs.copyFileSync(path.resolve(__dirname, '../../wearable/.npmrc'), path.join(wearable, '.npmrc'));
  for (const file of ['run-wearable.cjs', 'check-signing.cjs', 'prepare-wearable-toolchain.cjs']) fs.copyFileSync(path.join(__dirname, '..', file), path.join(tools, file));
  const cli = path.join(wearable, 'node_modules/aiot-toolkit/lib');
  fs.mkdirSync(cli, { recursive: true });
  fs.writeFileSync(path.join(cli, 'bin.js'), 'process.stdout.write("TOOLKIT_MUST_NOT_RUN");');
  for (const action of ['build', 'release', 'start']) {
    assert.throws(() => runWearable(action, root), /缺少原手环签名/);
    // npm test supplies npm_execpath on both Windows and Linux.
    const args = process.env.npm_execpath
      ? [process.env.npm_execpath, '--prefix', wearable, '--ignore-scripts', 'run', action]
      : [path.join(tools, 'run-wearable.cjs'), action];
    const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', env: { ...process.env, npm_config_ignore_scripts: 'true' }, timeout: 15000 });
    assert.equal(result.status, 1, result.error?.message || result.stdout + result.stderr);
    assert.match(result.stderr, /缺少原手环签名/);
    assert.doesNotMatch(result.stdout + result.stderr, /TOOLKIT_MUST_NOT_RUN/);
  }
  assert.equal(fs.existsSync(path.join(wearable, 'sign')), false);
});
