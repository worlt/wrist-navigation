// Source wiring contract only; native rendering requires device verification.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../android/app/src/main/java/io/github/mi9pro/navigation/MainActivity.java'), 'utf8');
test('home offers separate explicit phone and band update buttons', () => {
  assert.match(source, /homeUpdateCheck = filledButton\("检查手机更新"/);
  assert.match(source, /homeBandUpdateCheck = filledButton\("检查手环更新"/);
  assert.match(source, /bandUpdates\.check\(true\)/);
});
test('each update section has its own persistent native Preview checkbox', () => {
  assert.match(source, /CheckBox preview = new CheckBox\(this\)/);
  assert.match(source, /preview\.setChecked\(checker\.experimental\(\)\)/);
  assert.match(source, /preview\.setOnCheckedChangeListener\(\(view, checked\) -> checker\.setExperimental\(checked\)\)/);
  assert.match(source, /updateSection\(options, updates, false\)/);
  assert.match(source, /updateSection\(options, bandUpdates, true\)/);
});
test('independent running states and unknown band version are explicit', () => {
  assert.match(source, /checkButtonState\(homeUpdateCheck, updates,/);
  assert.match(source, /checkButtonState\(homeBandUpdateCheck, bandUpdates,/);
  const presentation = fs.readFileSync(path.join(__dirname, '../../android/app/src/main/java/io/github/mi9pro/navigation/UpdatePresentation.java'), 'utf8');
  assert.match(presentation, /手环版本未知/);
  assert.match(source, /bridge\.bandVersionCode\(\)/);
});

test('version panels distinguish installed and GitHub versions even without an upgrade', () => {
  assert.match(source, /class UpdateCardViews/);
  assert.match(source, /"当前安装"/);
  assert.match(source, /"GitHub 最新版本"/);
  assert.match(source, /UpdateFeed\.Version listed = checker\.latestVersion\(\)/);
  assert.match(source, /UpdatePresentation\.version\(listed, band\)/);
  assert.match(source, /screenWidthDp >= 360/);
  assert.match(source, /fontScale <= 1\.25f/);
});
test('release details and secondary settings are independently collapsed by default', () => {
  assert.match(source, /card\.detailsBody\.setVisibility\(View\.GONE\)/);
  assert.match(source, /card\.expanded = !card\.expanded/);
  assert.match(source, /setStateDescription/);
  assert.match(source, /settingsBody\.setVisibility\(View\.GONE\)/);
  assert.match(source, /UpdatePresentation\.notes\(listed\)/);
  assert.doesNotMatch(source, /text \+=.*listed\.notes/);
});
test('expanding a sheet recalculates its scrollable height', () => {
  assert.match(source, /body\.addOnLayoutChangeListener/);
  assert.match(source, /Math\.min\(body\.getMeasuredHeight\(\),/);
});
