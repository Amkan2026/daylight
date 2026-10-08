const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../extension/colors.js');

test('color conversion preserves the original color and alpha', () => {
  for (const value of ['#fff', '#000', '#fbf2dd', '#14202d', '#ff006e', '#00d0aa', '#3422fb', '#abcd', '#fbf2dd80']) {
    const source = C.parse(value), lch = C.toLch(source);
    const output = C.fromLch(lch.L, lch.C, lch.h, lch.a);
    for (const channel of ['r', 'g', 'b']) assert.ok(Math.abs(source[channel] - output[channel]) < 0.1, `${value}: ${channel}`);
    assert.equal(source.a, output.a);
  }
});

test('page surfaces change continuously in both native themes', () => {
  for (const nativeDark of [false, true]) {
    for (const value of ['#fff', '#ddd', '#181818', '#323232', '#52824a', '#eae5fa']) {
      const source = C.parse(value);
      let previous;
      for (let level = 0; level <= 100; level++) {
        const result = C.surface(source, { level, warmth: 35 }, nativeDark);
        if (previous) assert.ok(Math.abs(C.toLch(previous).L - C.toLch(result).L) < 0.011);
        previous = result;
      }
    }
  }
});

test('text remains readable through every slider step', () => {
  const backgrounds = ['#fff', '#f4eee0', '#dedede', '#b2b2b2', '#202020', '#333', '#5863bc', '#81ba62', '#ffeb62', '#ba466c'];
  const foregrounds = ['#111', '#fff', '#888', '#b22338', '#2766c6', '#267757', '#6b46c1'];
  for (const nativeDark of [false, true]) {
    for (const warmth of [0, 35, 100]) {
      for (let level = 0; level <= 100; level++) {
        const settings = { level, warmth };
        for (const value of backgrounds) {
          const source = C.parse(value), bg = C.surface(source, settings, nativeDark);
          for (const foreground of foregrounds) {
            const text = C.map(C.parse(foreground), 'text', source, settings, nativeDark);
            const ratio = C.contrast(C.parse(C.css(text)), C.parse(C.css(bg)));
            assert.ok(ratio >= 4.5, `contrast ${ratio.toFixed(3)} at ${level}, ${warmth}, ${value}, ${foreground}, ${nativeDark}`);
          }
        }
      }
    }
  }
});

test('transparent surfaces stay transparent and settings reject invalid values', () => {
  assert.equal(C.map(C.parse('transparent'), 'surface', C.parse('#fff'), { level: 0, warmth: 50 }).a, 0);
  assert.deepEqual(C.normalize({ level: Infinity, warmth: -10, enabled: 'yes' }), { enabled: false, level: 72, warmth: 0, everywhere: false, hidden: false });
  assert.deepEqual(C.parse('rgb(100% 0% 50% / 25%)'), { r: 254.99999999999997, g: 0, b: 127.49999999999999, a: 0.25 });
});
