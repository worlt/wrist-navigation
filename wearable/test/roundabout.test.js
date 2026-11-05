const { test } = require('node:test');
const assert = require('node:assert/strict');
const presentation = require('../src/common/presentation');

const roundabout = rawText => ({ icon: 'roundabout', live: true, rawText, instruction: '进入环岛' });

test('roundabout exit comes only from an explicit ordinal in the current guidance', () => {
  for (const [text, number] of [
    ['前方200米进入环岛，从第3个出口驶出', '3'],
    ['环岛第二出口驶出', '2'], ['进入环岛，由第十二个出口离开', '12'],
    ['进入环岛，从第 ４ 个出口驶出', '4'], ['环岛第九十九出口', '99'],
    ['环岛\n第2出口', '2']
  ]) assert.equal(presentation.roundaboutExit(roundabout(text)), number, text);
  const view = roundabout('');
  view.instruction = '环岛第5出口驶出';
  assert.equal(presentation.roundaboutExit(view), '5');
});

test('missing, contradictory or unrelated exit numbers never become instructions', () => {
  for (const text of ['进入环岛', '进入环岛，行驶300米', '环岛共有4个出口',
    '环岛第0出口', '环岛第100出口', '环岛第3.5出口', '环岛第十一二出口',
    '环岛第3出口或第4出口', '从第3出口进入环岛']) {
    assert.equal(presentation.roundaboutExit(roundabout(text)), '', text);
  }
  assert.equal(presentation.roundaboutExit({ icon: 'straight', rawText: '前方直行，随后环岛第2出口' }), '');
  assert.equal(presentation.roundaboutExit({ icon: 'unknown', rawText: '环岛第3出口' }), '');
  assert.equal(presentation.roundaboutExit({ ...roundabout('环岛第3出口'), instruction: '环岛第2出口' }), '');
});

test('roundabout number scales with the icon without taking space from the original guidance', () => {
  for (const arrowSize of [32, 64, 100, 160, 232]) {
    for (const number of ['3', '12']) {
      const rawText = '前方200米进入环岛，第' + number + '出口驶出';
      const model = presentation.navigationLayout(roundabout(rawText), { fontSize: 36, arrowSize }, '');
      assert.equal(model.roundaboutExit, number);
      assert.equal(model.guidanceLines.join(''), rawText);
      assert.ok(model.exitNumberLeft >= model.arrowLeft);
      assert.ok(model.exitNumberLeft + model.exitNumberWidth <= model.arrowLeft + model.arrowDrawSize);
      assert.ok(model.exitNumberTop >= 0);
      assert.ok(model.exitNumberTop + model.exitNumberHeight <= model.arrowDrawSize);
      // Tight frame [0, 5, 70] moves the original (40, 34) ring centre.
      assert.ok(Math.abs(model.exitNumberLeft + model.exitNumberWidth / 2 - model.arrowLeft - model.arrowDrawSize * 4 / 7) < 0.001);
      assert.ok(Math.abs(model.exitNumberTop + model.exitNumberHeight / 2 - model.arrowDrawSize * 29 / 70) < 0.001);
    }
  }
});
