// Public release attachments are an explicit allowlist, never a directory wildcard.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assetNames = ['NAV-PHONE-030.apk', 'NAV-BAND-046.rpk', 'NAV-BAND-046-NOFONT.rpk', 'TESTING.txt', 'THIRD_PARTY_NOTICES.txt', 'SHA256SUMS.txt'];
function checkRelease(directory) {
  const actual = fs.readdirSync(directory);
  for (const name of actual) if (!assetNames.includes(name)) throw new Error('Unexpected release attachment: ' + name);
  for (const name of assetNames) if (!actual.includes(name)) throw new Error('Missing release attachment: ' + name);
  for (const name of assetNames) {
    const stat = fs.lstatSync(path.join(directory, name));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsafe release attachment: ' + name);
  }
  const notices = fs.readFileSync(path.join(directory, 'THIRD_PARTY_NOTICES.txt'), 'utf8');
  for (const heading of ['MIT License', 'SIL OPEN FONT LICENSE', 'Apache License']) if (!notices.includes(heading)) throw new Error('Missing bundled license: ' + heading);
  const sums = new Map();
  for (const line of fs.readFileSync(path.join(directory, 'SHA256SUMS.txt'), 'utf8').trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9_.-]+)$/.exec(line);
    if (!match || match[2] === 'SHA256SUMS.txt' || !assetNames.includes(match[2]) || sums.has(match[2])) throw new Error('Invalid or unsafe checksum entry');
    sums.set(match[2], match[1]);
  }
  if (sums.size !== assetNames.length - 1) throw new Error('Incomplete checksum manifest');
  return assetNames.map(name => {
    const bytes = fs.readFileSync(path.join(directory, name));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (name !== 'SHA256SUMS.txt' && sums.get(name) !== sha256) throw new Error('SHA-256 mismatch: ' + name);
    return { name, size: bytes.length, sha256 };
  });
}
if (require.main === module) {
  try { console.log(JSON.stringify(checkRelease(path.resolve(process.argv[2] || path.join(__dirname, '../outputs/releases/v0.4.6'))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { checkRelease, assetNames };
