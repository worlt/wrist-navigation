// Generate the only update feed needed: an attachment on the same GitHub Release.
const fs = require('node:fs');
const path = require('node:path');
const APPLICATION_ID = 'io.github.mi9pro.navigation';
function validateManifest(json, tag) {
  if (json.schemaVersion !== 1 || json.applicationId !== APPLICATION_ID || json.releaseTag !== tag
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(tag)) throw new Error('Invalid update manifest identity or release tag');
  for (const part of [json.phone, json.band]) {
    if (!part || !Number.isInteger(part.versionCode) || part.versionCode < 1 || part.versionCode > 2147483647
        || typeof part.versionName !== 'string' || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(part.versionName)
        || part.versionName.length > 64) throw new Error('Invalid update version');
  }
  for (const [value, suffix] of [[json.phone.asset, '.apk'], [json.band.fullAsset, '.rpk'], [json.band.noFontAsset, '.rpk']]) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(value) || !value.endsWith(suffix)) throw new Error('Unsafe update asset');
  }
  if (json.band.fullAsset === json.band.noFontAsset) throw new Error('Band variants must be distinct');
  if (json.notes !== undefined && (typeof json.notes !== 'string' || json.notes.length > 6000)) throw new Error('Update notes too long');
  return json;
}
function createManifest({ root = path.resolve(__dirname, '..'), directory, tag, notes = '' }) {
  if (typeof tag !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(tag)) throw new Error('Invalid release tag');
  const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
  const band = JSON.parse(fs.readFileSync(path.join(root, 'wearable/src/manifest.json'), 'utf8'));
  const phoneName = /versionName\s+'([^']+)'/.exec(gradle)?.[1];
  const phoneCode = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1]);
  if (band.package !== APPLICATION_ID) throw new Error('Mismatched band application');
  const codeName = version => version.split('-')[0].split('.').join('');
  const manifest = validateManifest({ schemaVersion: 1, applicationId: APPLICATION_ID, releaseTag: tag,
    phone: { versionName: phoneName, versionCode: phoneCode, asset: `NAV-PHONE-${codeName(phoneName)}.apk` },
    band: { versionName: band.versionName, versionCode: band.versionCode,
      fullAsset: `NAV-BAND-${codeName(band.versionName)}.rpk`, noFontAsset: `NAV-BAND-${codeName(band.versionName)}-NOFONT.rpk` }, notes }, tag);
  for (const name of [manifest.phone.asset, manifest.band.fullAsset, manifest.band.noFontAsset]) {
    const file = path.join(directory, name);
    if (!fs.existsSync(file)) throw new Error('Missing package: ' + name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || !stat.size) throw new Error('Unsafe or empty package: ' + name);
  }
  return manifest;
}
if (require.main === module) {
  try {
    const [directory, tag, notesFile] = process.argv.slice(2);
    if (!directory || !tag || process.argv.length > 5) throw new Error('Usage: node tools/create-update-manifest.cjs <delivery-directory> <actual-release-tag> [notes-file]');
    const output = path.resolve(directory);
    const manifest = createManifest({ directory: output, tag, notes: notesFile ? fs.readFileSync(path.resolve(notesFile), 'utf8').trim() : '' });
    const file = path.join(output, 'update.json');
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    console.log('Created ' + file + '\nVerify APK/RPK embedded versions and original signing before publishing. Include update.json in SHA256SUMS.txt.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { createManifest, validateManifest };
