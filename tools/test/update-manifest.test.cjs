const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createManifest } = require('../create-update-manifest.cjs');

test('generates phone/band version metadata from source but requires matching delivery filenames', () => {
  const root = path.resolve(__dirname, '../..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrist-update-'));
  try {
    for (const name of ['NAV-PHONE-041.apk', 'NAV-BAND-051.rpk', 'NAV-BAND-051-NOFONT.rpk']) fs.writeFileSync(path.join(dir, name), 'fixture');
    const result = createManifest({ root, directory: dir, tag: 'v0.5.1-preview.1', notes: '实验版，未真机验收' });
    assert.equal(result.applicationId, 'io.github.mi9pro.navigation');
    assert.equal(result.schemaVersion, 1);
    assert.deepEqual(result.phone, { versionName: '0.4.1', versionCode: 26, asset: 'NAV-PHONE-041.apk' });
    assert.deepEqual(result.band, { versionName: '0.5.1', versionCode: 25, fullAsset: 'NAV-BAND-051.rpk', noFontAsset: 'NAV-BAND-051-NOFONT.rpk' });
    assert.equal(result.releaseTag, 'v0.5.1-preview.1');
    assert.equal(result.notes, '实验版，未真机验收');
    assert.equal(result.prerelease, undefined, 'channel is authoritative from GitHub, not metadata');
    assert.throws(() => createManifest({ root, directory: dir, tag: '../evil' }), /tag/i);
    fs.unlinkSync(path.join(dir, 'NAV-PHONE-041.apk'));
    assert.throws(() => createManifest({ root, directory: dir, tag: 'v0.4.9' }), /Missing package/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('manifest is an explicit release attachment, old release profiles remain unchanged', () => {
  const { releaseAssetNames } = require('../check-release.cjs');
  for (const tag of ['v0.4.6', 'v0.4.7', 'v0.4.8']) assert.ok(!releaseAssetNames[tag].includes('update.json'));
  assert.equal(releaseAssetNames['v0.4.9'], undefined, 'new profiles require validated metadata with an explicit tag');
});

function feedFixture(t, tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrist-update-gate-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const manifest = {
    schemaVersion: 1, applicationId: 'io.github.mi9pro.navigation', releaseTag: tag,
    phone: { versionName: '0.3.5', versionCode: 20, asset: 'NAV-PHONE-035.apk' },
    band: { versionName: '0.4.7', versionCode: 21, fullAsset: 'NAV-BAND-047.rpk', noFontAsset: 'NAV-BAND-047-NOFONT.rpk' }
  };
  const values = { 'NAV-PHONE-035.apk': 'fixture', 'NAV-BAND-047.rpk': 'fixture', 'NAV-BAND-047-NOFONT.rpk': 'fixture',
    'TESTING.txt': 'not a device verification', 'THIRD_PARTY_NOTICES.txt': 'MIT License\nSIL OPEN FONT LICENSE\nApache License', 'update.json': JSON.stringify(manifest) };
  for (const [name, value] of Object.entries(values)) fs.writeFileSync(path.join(dir, name), value);
  const { createHash } = require('node:crypto');
  const sums = Object.entries(values).map(([name, value]) => `${createHash('sha256').update(value).digest('hex')}  ${name}`);
  fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
  return { dir, manifest };
}

test('new stable and preview releases require metadata and checksum it', t => {
  const { checkRelease } = require('../check-release.cjs');
  const { dir } = feedFixture(t, 'v0.4.9-preview.1');
  assert.equal(checkRelease(dir, 'v0.4.9-preview.1').length, 7);
  assert.throws(() => checkRelease(dir, 'v0.4.9-preview.2'), /identity/);
  fs.appendFileSync(path.join(dir, 'update.json'), ' ');
  assert.throws(() => checkRelease(dir, 'v0.4.9-preview.1'), /SHA-256 mismatch/);
});

test('metadata validation rejects bad schema, paths, fractional codes and oversize notes', () => {
  const { validateManifest } = require('../create-update-manifest.cjs');
  const valid = { schemaVersion: 1, applicationId: 'io.github.mi9pro.navigation', releaseTag: 'v0.4.9',
    phone: { versionName: '0.3.5', versionCode: 20, asset: 'NAV-PHONE-035.apk' },
    band: { versionName: '0.4.7', versionCode: 21, fullAsset: 'NAV-BAND-047.rpk', noFontAsset: 'NAV-BAND-047-NOFONT.rpk' } };
  assert.doesNotThrow(() => validateManifest(valid, valid.releaseTag));
  for (const mutate of [v => v.schemaVersion = 2, v => v.phone.versionCode = 20.5, v => v.phone.asset = '../../evil.apk',
    v => v.band.noFontAsset = v.band.fullAsset, v => v.notes = 'x'.repeat(6001)]) {
    const bad = structuredClone(valid); mutate(bad);
    assert.throws(() => validateManifest(bad, valid.releaseTag));
  }
});
