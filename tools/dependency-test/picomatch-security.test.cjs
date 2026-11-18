const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'wearable/package-lock.json')));
const entries = Object.entries(lock.packages).filter(([name]) => name.endsWith('/picomatch'));
const integrity = 'sha512-JroBFEmaejC7szGSfqOhF1QZHLKvX2wTA1+fWyfkpy3BjzdQKNPLKa2FtgeKVUDy5/UPUNkXEeCHJ5ZRBMLTVA==';
const modules = entries.map(([name]) => path.join(root, 'wearable', name));
const dep = createRequire(path.join(root, 'wearable/package.json'));

test('every locked picomatch consumer uses the reviewed signed fork without install scripts', () => {
  assert.ok(entries.length >= 3);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'wearable/package.json'))).overrides.picomatch,
    'npm:@ryotsu/picomatch@4.0.7-a');
  for (const [name, entry] of entries) {
    assert.equal(entry.name, '@ryotsu/picomatch', name);
    assert.equal(entry.version, '4.0.7-a');
    assert.equal(entry.integrity, integrity);
    assert.equal(entry.resolved, 'https://registry.npmjs.org/@ryotsu/picomatch/-/picomatch-4.0.7-a.tgz');
    const directory = path.join(root, 'wearable', name);
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json')));
    assert.equal(metadata.name, entry.name);
    assert.equal(metadata.version, entry.version);
    assert.equal(metadata.dependencies, undefined);
    for (const hook of ['preinstall', 'install', 'postinstall']) assert.equal(metadata.scripts[hook], undefined);
    // Runtime reviewed against provenance commit 3ab5a7627d480259e3d9ca67fbc14c125d374f0e.
    const hashes = {
      'lib/parse.js': 'a59b25c67cce014f5226836f8391cb1f323dc76224dc82b85c6826d10b33922a',
      'lib/constants.js': 'cdcb0716c3c7137f34fbec4fe29613de0aaa0a7de01505601ef3a88a5ba05fb0'
    };
    for (const [file, expected] of Object.entries(hashes)) {
      assert.equal(createHash('sha256').update(fs.readFileSync(path.join(directory, file))).digest('hex'), expected);
    }
  }
});

test('CVE-2026-112366 cases finish in bounded subprocesses for every installed copy', () => {
  const cases = [
    ['+(*a)', 'a'.repeat(80) + '!'], ['*(*a)', 'a'.repeat(80) + '!'],
    ['+(a*)', 'a'.repeat(80) + '/'], ['*(a*)', 'a'.repeat(80) + '/'],
    ['+(*)', 'a'.repeat(80) + '/'], ['*(*)', 'a'.repeat(80) + '/'],
    ['+(*)b', 'a'.repeat(80) + '!'], ['*(*)b', 'a'.repeat(80) + '!'],
    ['+(*a)c', 'a'.repeat(80) + '!'], ['+(a*b)', 'ab'.repeat(40) + '!'],
    ['+(**)', 'a'.repeat(80) + '/.'], ['+(**a)', 'a'.repeat(80) + '!'],
    ['+(@(*a))', 'a'.repeat(80) + '!'], ['+(?(*a))', 'a'.repeat(80) + '!']
  ];
  for (const directory of modules) {
    const script = `const assert = require('node:assert/strict'); const pm = require(${JSON.stringify(directory)});
      for (const opts of [{}, { windows: true }, { capture: true }])
        for (const [pattern, input] of ${JSON.stringify(cases)}) assert.equal(pm.isMatch(input, pattern, opts), false, pattern);`;
    const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
  }
});

test('safe extglob collapse preserves finite matching corpus and rejects unproved complex repeats', () => {
  const script = `const assert = require('node:assert/strict'); const pm = require(${JSON.stringify(modules[0])});
    const patterns = ['+(*)','*(*)','+(*a)','*(*a)','+(a*)','*(a*)','+(a*b)','+(*[ab])','+(@(*a))','+(**)','+(**a)','x+(*a)b'];
    const inputs = ['']; let level = [''];
    for (let length = 1; length <= 4; length++) {
      level = level.flatMap(prefix => ['a','b','.','/','*'].map(ch => prefix + ch)); inputs.push(...level);
    }
    for (const opts of [{}, { dot:true }, { windows:true }, { bash:true }, { capture:true }]) {
      for (const pattern of patterns) {
        const guarded = pm(pattern, opts); const original = pm(pattern, {...opts, maxExtglobRecursion:false});
        for (const input of inputs) assert.equal(guarded(input), original(input), JSON.stringify({pattern,input,opts}));
      }
    }
    for (const pattern of ['+(?(*a))','+(*a/b)','+(*{a,b})']) {
      assert.equal(pm.isMatch(pattern, pattern), true); assert.equal(/\\)[+*]/.test(pm.makeRe(pattern).source), false);
    }
    for (const pattern of ['+(a\\\\*b)','+("*a")','+([*]a)']) {
      assert.equal(pm.makeRe(pattern).source, pm.makeRe(pattern, {maxExtglobRecursion:false}).source);
    }`;
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
});

test('anymatch readdirp and tinyglobby retain build file selection with the fork', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrist-picomatch-'));
  t.after(() => {
    const resolved = fs.realpathSync(dir);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('wrist-picomatch-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  for (const name of ['index.ux','common/session.js','common/settings.js','common/.hidden.js','common/font.ttf']) {
    const target = path.join(dir, name); fs.mkdirSync(path.dirname(target), {recursive:true}); fs.writeFileSync(target, 'sample');
  }
  const expected = ['common/session.js', 'common/settings.js', 'index.ux'];
  const anymatch = dep('anymatch');
  assert.equal(anymatch(['**/*.js','**/*.ux','!**/.hidden.js'], 'common/session.js'), true);
  assert.equal(anymatch(['**/*.js','!**/.hidden.js'], 'common/.hidden.js'), false);
  assert.equal(anymatch('**/*.js', 'common/font.ttf'), false);
  const found = [];
  for await (const entry of dep('readdirp')(dir, { fileFilter: ['*.js','*.ux'] })) found.push(entry.path.replaceAll('\\','/'));
  assert.deepEqual(found.sort(), expected);
  assert.deepEqual(dep('tinyglobby').globSync(['**/*.js','**/*.ux'], {cwd:dir}).sort(), expected);
});
