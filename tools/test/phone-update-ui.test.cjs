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
  assert.match(source, /手环版本未知/);
  assert.match(source, /bridge\.bandVersionCode\(\)/);
});
