const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const dep = createRequire(path.resolve(__dirname, '../../wearable/package.json'));
function directory(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrist-toolchain-'));
  t.after(() => {
    const resolved = fs.realpathSync(dir);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('wrist-toolchain-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return dir;
}

test('ZIP writer, reader and extractor preserve content and block traversal', t => {
  const AdmZip = dep('adm-zip');
  const dir = directory(t);
  const zip = new AdmZip();
  zip.addFile('page/main.js', Buffer.from('navigation'));
  const loaded = new AdmZip(zip.toBuffer());
  assert.equal(loaded.readAsText('page/main.js'), 'navigation');
  loaded.extractAllTo(path.join(dir, 'safe'));
  assert.equal(fs.readFileSync(path.join(dir, 'safe/page/main.js'), 'utf8'), 'navigation');
  // Mutate the ZIP headers because addFile itself normalizes unsafe paths.
  const attack = new AdmZip();
  attack.addFile('aa/probe.txt', Buffer.from('probe'));
  const buffer = attack.toBuffer();
  for (let index = buffer.indexOf('aa/probe.txt'); index !== -1; index = buffer.indexOf('aa/probe.txt', index + 1)) {
    buffer.write('../probe.txt', index, 'utf8');
  }
  new AdmZip(buffer).extractAllTo(path.join(dir, 'unsafe'));
  assert.equal(fs.readFileSync(path.join(dir, 'unsafe/probe.txt'), 'utf8'), 'probe');
  assert.equal(fs.existsSync(path.join(dir, 'probe.txt')), false);
  const target = path.join(dir, 'target');
  const outside = path.join(dir, 'outside');
  fs.mkdirSync(target);
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(target, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  const linked = new AdmZip();
  linked.addFile('link/probe.txt', Buffer.from('probe'));
  assert.throws(() => linked.extractAllTo(target));
  assert.equal(fs.existsSync(path.join(outside, 'probe.txt')), false);
});

test('toolkit file filtering and rimraf glob APIs retain intended file selection', async t => {
  const FileUtil = dep('@aiot-toolkit/shared-utils/lib/utils/FileUtil').default;
  const dir = directory(t);
  fs.mkdirSync(path.join(dir, 'page'));
  fs.writeFileSync(path.join(dir, 'page/main.js'), 'keep');
  fs.writeFileSync(path.join(dir, 'page/old.tmp'), 'remove');
  assert.equal(FileUtil.match('page/.hidden.js', '**/*.js'), true);
  assert.equal(FileUtil.include('page/main.js', '**/*.js', '**/*.tmp'), true);
  assert.equal(FileUtil.include('page/old.tmp', undefined, '**/*.tmp'), false);
  assert.equal(FileUtil.readAlldirSync(dir, '**/*.js').length, 1);
  await FileUtil.del(path.join(dir, '**/*.tmp').split(path.sep).join('/'));
  assert.equal(fs.existsSync(path.join(dir, 'page/old.tmp')), false);
  assert.equal(fs.readFileSync(path.join(dir, 'page/main.js'), 'utf8'), 'keep');
});

test('external editor temporary files remain compatible and reject path escape', t => {
  const tmp = dep('tmp');
  const dir = directory(t);
  const filename = tmp.tmpNameSync({ tmpdir: dir, prefix: 'navigation', postfix: '.txt' });
  assert.equal(path.dirname(filename), dir);
  fs.writeFileSync(filename, 'navigation');
  assert.throws(() => tmp.tmpNameSync({ tmpdir: dir, prefix: '../outside' }));
  assert.throws(() => tmp.tmpNameSync({ tmpdir: dir, prefix: ['../outside'] }));
  assert.throws(() => tmp.tmpNameSync({ tmpdir: dir, dir: '..' }));
  const { ExternalEditor } = dep('external-editor');
  const editor = new ExternalEditor('navigation', { tmpdir: dir, prefix: 'editor', postfix: '.txt' });
  assert.equal(fs.readFileSync(editor.tempFile, 'utf8'), 'navigation');
  editor.cleanup();
  assert.equal(fs.existsSync(editor.tempFile), false);
});

test('toolkit clones a local Git template with the updated simple-git interface', async t => {
  const dir = directory(t);
  const source = path.join(dir, 'source');
  fs.mkdirSync(source);
  function git(args) {
    const result = spawnSync('git', args, { cwd: source, encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
  }
  git(['init', '--quiet']);
  fs.writeFileSync(path.join(source, 'template.txt'), 'template');
  git(['add', 'template.txt']);
  git(['-c', 'user.name=Toolchain Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'fixture']);
  const NetworkUtil = dep('@aiot-toolkit/shared-utils/lib/utils/NetworkUtil').default;
  await NetworkUtil.gitClone(source, path.join(dir, 'cloned'), false);
  assert.equal(fs.readFileSync(path.join(dir, 'cloned/template.txt'), 'utf8'), 'template');
  const { simpleGit } = dep('simple-git');
  await assert.rejects(simpleGit(source).raw(['-c', 'core.sshCommand=toolchain-probe', 'ls-remote', 'ssh://example.invalid/repo']), error => {
    assert.equal(error.plugin, 'unsafe');
    assert.match(error.message, /core\.sshCommand is not permitted/);
    return true;
  });
});

test('UX parser retains AST and loop bindings with the updated ts-morph', () => {
  const ParserUtil = dep('@aiot-toolkit/parser/lib/utils/ParserUtil').default;
  const CfTranslate = dep('@aiot-toolkit/parser/lib/ux/translate/vela/wrap/CfTranslate').default;
  const source = ParserUtil.createSourceFile('const nav = {direction: "straight", distance: 488};', 'test.ts');
  assert.equal(source.getVariableDeclarationOrThrow('nav').getInitializer().getText(), '{direction: "straight", distance: 488}');
  const options = { filePath: 'fixture.ux', onLog(log) { throw new Error(JSON.stringify(log)); } };
  for (const [value, index, item, list] of [['(index, item) in list', 'index', 'item', 'list'], ['item in nav.steps', '$idx', 'item', 'nav.steps'], ['list', '$idx', '$item', 'list']]) {
    const nodes = CfTranslate.extractForNodes({ value, name: 'for' }, options);
    assert.equal(nodes.indexNode.escapedText || nodes.indexNode.getText(), index);
    assert.equal(nodes.itemNode.escapedText || nodes.itemNode.getText(), item);
    assert.equal(nodes.listNode.getText(), list);
  }
});

test('prebuilt file watcher loads and receives changes with install scripts disabled', async t => {
  const watcher = dep('@parcel/watcher');
  const dir = directory(t);
  let timer;
  let accept;
  let reject;
  const event = new Promise((resolve, fail) => { accept = resolve; reject = fail; });
  const subscription = await watcher.subscribe(dir, (error, events) => {
    if (error) return reject(error);
    if (events.some(item => path.basename(item.path) === 'probe.txt')) accept();
  });
  t.after(async () => { clearTimeout(timer); await subscription.unsubscribe(); });
  timer = setTimeout(() => reject(new Error('Watcher did not report the file change')), 8000);
  fs.writeFileSync(path.join(dir, 'probe.txt'), 'navigation');
  await event;
});
