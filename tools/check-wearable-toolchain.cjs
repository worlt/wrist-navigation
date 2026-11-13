const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { prepareToolchain } = require('./prepare-wearable-toolchain.cjs');
try {
  prepareToolchain();
  const result = spawnSync(process.execPath, ['--test', 'tools/dependency-test/*.test.cjs'],
    { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
