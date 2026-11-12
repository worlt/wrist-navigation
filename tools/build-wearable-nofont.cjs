// Build a system-font-only variant from an isolated copy of the regular sources.
// Never strip an already signed RPK or edit the regular source tree in place.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { checkSigning } = require('./check-signing.cjs');

function replaceOnce(source, pattern, replacement, label) {
  const matches = source.match(new RegExp(pattern.source, 'g')) || [];
  assert.equal(matches.length, 1, 'No-font build needs exactly one ' + label);
  return source.replace(pattern, replacement);
}

function noFontSources(settings, page) {
  settings = settings.replace(/\r\n/g, '\n');
  page = page.replace(/\r\n/g, '\n');
  settings = replaceOnce(settings, /const FONT_COVERAGE = require\('\.\/font-coverage'\);\n/, '', 'coverage import');
  settings = replaceOnce(settings, /const FONTS = \[[^\n]+\];/, "const FONTS = ['default'];", 'font IDs');
  settings = replaceOnce(settings, /const FONT_OPTIONS = \[[\s\S]*?\n\];/,
    "const FONT_OPTIONS = [\n  { id: 'default', name: '系统默认', short: '默认', family: 'sans-serif' }\n];", 'font choices');
  settings = replaceOnce(settings, /if \(kind === 'font'\) return FONT_OPTIONS\.slice\(\);/,
    "if (kind === 'font') return [];", 'font picker');
  settings = replaceOnce(settings, /\/\/ An uncommon road name[\s\S]*?function fontForText\(id, text\) \{[\s\S]*?\n\}/,
    "// The no-font variant always uses the device's system font.\nfunction fontForText() { return 'sans-serif'; }", 'text font fallback');
  page = replaceOnce(page, /        <list-item type="font"[\s\S]*?<\/list-item>\n/, '', 'font settings row');
  for (const family of ['BandSong', 'BandKai', 'BandRound']) {
    page = replaceOnce(page, new RegExp('@font-face \\{ font-family: ' + family + ';[^\\n]+\\}\\n'), '', family + ' font face');
  }
  page = replaceOnce(page, /腕上导航 v\{\{ versionName \}\}/, '腕上导航 v{{ versionName }} 无字体版', 'variant label');
  assert.doesNotMatch(settings + page, /BandSong|BandKai|BandRound|font-coverage|@font-face|common\/fonts/);
  return { settings, page };
}

function build(root = path.resolve(__dirname, '..')) {
  checkSigning(root);
  const wearable = fs.realpathSync(path.join(root, 'wearable'));
  const source = path.join(wearable, 'src');
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  const transformed = noFontSources(fs.readFileSync(path.join(source, 'common/settings.js'), 'utf8'),
    fs.readFileSync(path.join(source, 'pages/index/index.ux'), 'utf8'));
  const stage = fs.mkdtempSync(path.join(wearable, '.temp_nofont_'));
  try {
    fs.cpSync(source, path.join(stage, 'src'), { recursive: true, filter(file) {
      const relative = path.relative(source, file).replaceAll('\\', '/');
      return relative !== 'common/fonts' && relative !== 'common/font-coverage.js';
    } });
    fs.writeFileSync(path.join(stage, 'src/common/settings.js'), transformed.settings);
    fs.writeFileSync(path.join(stage, 'src/pages/index/index.ux'), transformed.page);
    fs.copyFileSync(path.join(wearable, 'package.json'), path.join(stage, 'package.json'));
    fs.cpSync(path.join(wearable, 'sign/debug'), path.join(stage, 'sign/debug'), { recursive: true });
    execFileSync(process.execPath, [path.join(wearable, 'node_modules/aiot-toolkit/lib/bin.js'), 'build'],
      { cwd: stage, stdio: 'inherit' });
    const built = path.join(stage, 'dist', manifest.package + '.debug.' + manifest.versionName + '.rpk');
    for (const [tool, args] of [
      ['check-wearable-package.cjs', [built, '--no-fonts']], ['verify-rpk-signature.cjs', [built]]
    ]) execFileSync(process.execPath, [path.join(root, 'tools', tool), ...args], { cwd: root, stdio: 'inherit' });
    const output = path.join(wearable, 'dist', 'NAV-BAND-' + manifest.versionName.replaceAll('.', '') + '-NOFONT.rpk');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(built, output);
    console.log('No-font RPK: ' + output + ' (' + fs.statSync(output).size + ' bytes)');
    return output;
  } finally {
    // Resolve and constrain the cleanup target before any recursive deletion.
    const resolved = fs.realpathSync(stage);
    assert.equal(path.dirname(resolved), wearable);
    assert.ok(path.basename(resolved).startsWith('.temp_nofont_'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try { build(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { noFontSources, build };
