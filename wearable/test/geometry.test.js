const { test } = require('node:test')
const assert = require('node:assert/strict')
const geometry = require('../src/common/geometry')

test('page geometry matches the 336x480 panel shared with Mi Band 9 Pro', () => {
  assert.equal(geometry.WIDTH, 336)
  assert.equal(geometry.HEIGHT, 480)
  assert.equal(geometry.CONTENT_WIDTH, 288)
  assert.equal(geometry.GEAR_LEFT, 136)
  assert.equal(geometry.GEAR_TOP, 400)
  assert.equal(geometry.centerTop(100), 190)
  assert.equal(geometry.centerInContent(42), 123)
})

test('settings list keeps one top rule for every type scale and always ends at the bottom inset', () => {
  for (let titleHeight = 30; titleHeight <= 62; titleHeight++) {
    const top = geometry.settingsListTop(titleHeight)
    assert.ok(top >= geometry.SETTINGS_TOP)
    assert.equal(top, Math.max(geometry.SETTINGS_TOP, 16 + titleHeight + 8))
    assert.equal(top + geometry.settingsListHeight(titleHeight), geometry.HEIGHT - geometry.BOTTOM_INSET)
  }
  assert.equal(geometry.settingsListTop(42), 66)
  assert.equal(geometry.settingsListHeight(42), 398)
})

test('guidance cap leaves the bottom gear target clear', () => {
  const gearClearance = geometry.GEAR_TOP - 16
  assert.ok(geometry.centerTop(geometry.GUIDANCE_MAX) + geometry.GUIDANCE_MAX <= gearClearance,
    'a full guidance block must stay above the settings gear')
  assert.ok(geometry.GEAR_TOP + geometry.GEAR_SIZE <= geometry.HEIGHT)
})
