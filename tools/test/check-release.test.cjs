const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { checkRelease, assetNames, releaseAssetNames } = require('../check-release.cjs');
function fixture(t, assetNames = releaseAssetNames['v0.4.8']) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrist-release-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const name of assetNames) if (name !== 'SHA256SUMS.txt') fs.writeFileSync(path.join(dir, name), name.endsWith('.txt') ? 'Synthetic fixture: MIT License, SIL OPEN FONT LICENSE, Apache License' : Buffer.from([0, 1, 2]));
  const sums = assetNames.filter(name => name !== 'SHA256SUMS.txt').map(name => createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex') + '  ' + name).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), sums);
  return dir;
}
test('release gate accepts only the explicit delivery set with valid hashes', t => {
  assert.equal(checkRelease(fixture(t)).length, assetNames.length);
});
test('release gate rejects extra private or accidental attachments', t => {
  const dir = fixture(t); fs.writeFileSync(path.join(dir, 'private.pem'), 'synthetic');
  assert.throws(() => checkRelease(dir), /Unexpected/);
});
test('release gate rejects changed files and unsafe checksum paths', t => {
  const dir = fixture(t); fs.appendFileSync(path.join(dir, 'TESTING.txt'), 'changed');
  assert.throws(() => checkRelease(dir), /SHA-256/);
  fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), 'a'.repeat(64) + '  ../private.pem\n');
  assert.throws(() => checkRelease(dir), /checksum/);
});
test('release gate requires full license headings and rejects missing assets', t => {
  const dir = fixture(t); fs.writeFileSync(path.join(dir, 'THIRD_PARTY_NOTICES.txt'), 'MIT License');
  assert.throws(() => checkRelease(dir), /license/);
  fs.unlinkSync(path.join(dir, 'NAV-PHONE-032.apk'));
  assert.throws(() => checkRelease(dir), /Missing/);
});

test('release gate keeps the historical v0.4.6 attachment set separate from v0.4.7', t => {
  const old = fixture(t, releaseAssetNames['v0.4.6']);
  assert.equal(checkRelease(old, 'v0.4.6').length, assetNames.length);
  assert.throws(() => checkRelease(old, 'v0.4.7'), /Unexpected/);
  assert.throws(() => checkRelease(fixture(t), 'v0.4.6'), /Unexpected/);
  assert.throws(() => checkRelease(fixture(t), 'v0.4.7'), /Unexpected/);
});
test('release gate rejects an unknown release profile', t => {
  assert.throws(() => checkRelease(fixture(t), 'unknown'), /Unknown release/);
});

test('release gate accepts v0.4.8 phone diagnostics while preserving v0.4.7 assets', t => {
  const previous = fixture(t, releaseAssetNames['v0.4.7']);
  assert.equal(checkRelease(previous, 'v0.4.7').length, assetNames.length);
  assert.throws(() => checkRelease(previous, 'v0.4.8'), /Unexpected/);
  assert.equal(checkRelease(fixture(t), 'v0.4.8').length, assetNames.length);
});
