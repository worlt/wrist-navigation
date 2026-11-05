// Page geometry for the 1.74in 336x480 band panel. Mi Band 8 Pro, 9 Pro and
// 10 Pro share this panel, and manifest.json keeps designWidth at 336 so Vela
// scales the reference width. Every vertical offset is derived from HEIGHT:
// if a firmware reports a different usable height, changing it here is enough
// for the page and presentation math to stay consistent.
const WIDTH = 336
const HEIGHT = 480
const MARGIN = 24
const CONTENT_WIDTH = WIDTH - MARGIN * 2
const BOTTOM_INSET = 16
const SETTINGS_TOP = 66
const SETTINGS_TITLE_TOP = 16
const SETTINGS_TITLE_GAP = 8
const GEAR_SIZE = 64
const GEAR_BOTTOM = 16
const GEAR_LEFT = (WIDTH - GEAR_SIZE) / 2
const GEAR_TOP = HEIGHT - GEAR_SIZE - GEAR_BOTTOM
const ARROW_GAP = 8
const NAVIGATION_TOP = 24
const NAVIGATION_DEMO_TOP = 72
const NAVIGATION_BOTTOM = GEAR_TOP - 8
const NAVIGATION_HEIGHT = NAVIGATION_BOTTOM - NAVIGATION_TOP
// Cap the scroll viewport at three normal-sized rows; layout rounds to full rows.
const GUIDANCE_MAX = 166
// The arrow gives way to the text, but never below this much.
const MIN_ARROW_SIZE = 64

function centerTop(size) { return (HEIGHT - size) / 2 }
function centerInContent(size) { return (CONTENT_WIDTH - size) / 2 }

// Small content remains centered. Larger arrows use the space above it while
// the last complete text row always stays clear of the settings hit target.
function navigationTop(size) { return Math.min(centerTop(size), NAVIGATION_BOTTOM - size) }

// A taller type scale pushes the list down instead of overlapping the title.
function settingsListTop(titleHeight) {
  return Math.max(SETTINGS_TOP, SETTINGS_TITLE_TOP + titleHeight + SETTINGS_TITLE_GAP)
}

function settingsListHeight(titleHeight) {
  return HEIGHT - BOTTOM_INSET - settingsListTop(titleHeight)
}

module.exports = { WIDTH, HEIGHT, MARGIN, CONTENT_WIDTH, BOTTOM_INSET, SETTINGS_TOP,
  GEAR_SIZE, GEAR_LEFT, GEAR_TOP, ARROW_GAP, GUIDANCE_MAX, MIN_ARROW_SIZE,
  NAVIGATION_TOP, NAVIGATION_DEMO_TOP, NAVIGATION_BOTTOM, NAVIGATION_HEIGHT, navigationTop,
  centerTop, centerInContent, settingsListTop, settingsListHeight }
