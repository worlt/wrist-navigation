const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inflateSync } = require('node:zlib');
const settings = require('../../wearable/src/common/settings');

// Decode the generated RGBA PNGs without adding dependencies to offline tests.
function pixels(file) {
  const png = fs.readFileSync(file);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.equal(png[24], 8, '8-bit channels');
  assert.equal(png[25], 6, 'RGBA');
  assert.equal(png[28], 0, 'non-interlaced');
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const size = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + size));
    offset += 12 + size;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * 4;
  const data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const left = x >= 4 ? data[i - 4] : 0;
      const up = y ? data[i - stride] : 0;
      const corner = x >= 4 && y ? data[i - stride - 4] : 0;
      let prediction = 0;
      if (filter === 1) prediction = left;
      if (filter === 2) prediction = up;
      if (filter === 3) prediction = Math.floor((left + up) / 2);
      if (filter === 4) {
        const p = left + up - corner;
        const a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - corner);
        prediction = a <= b && a <= c ? left : b <= c ? up : corner;
      }
      data[i] = raw[y * (stride + 1) + 1 + x] + prediction;
    }
  }
  return { width, height, data };
}

test('all 616 arrows fill their frames without cutting off a tip or antialiasing edge', () => {
  const root = path.resolve(__dirname, '../../wearable/src/common/arrows');
  const shapes = Object.keys(require('../../wearable/src/common/arrow-artwork.json').frames);
  for (const style of settings.STYLES) for (const color of settings.COLORS) for (let weight = 4; weight <= 10; weight++) {
    for (const shape of shapes) {
      const name = [style, color, weight, shape + '.png'].join('/');
      const { width, height, data } = pixels(path.join(root, name));
      assert.equal(width, 256, name);
      assert.equal(height, 256, name);
      assert.ok(width >= settings.LIMITS.arrowSize[1], 'no upscaling at maximum size');
      let l = width, t = height, r = -1, b = -1;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (!x || !y || x === width - 1 || y === height - 1) assert.equal(alpha, 0, name + ': outline reaches image edge');
        if (alpha < 8) continue;
        l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x); b = Math.max(b, y);
      }
      assert.ok(Math.max(r - l + 1, b - t + 1) / width >= 0.82, name + ': excessive transparent padding');
    }
  }
});
