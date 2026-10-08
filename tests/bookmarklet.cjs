const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const C = require('../extension/colors.js');

(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../bookmarklet/daylight.js'), 'utf8');
  const fixture = fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8');
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/strict') res.setHeader('Content-Security-Policy', "require-trusted-types-for 'script'; trusted-types 'none'");
    res.end(req.url === '/frame' ? '<p>Embedded content</p>' : fixture);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chromium', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1020 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    const chromeKeys = await page.evaluate(() => Object.keys(window.chrome || {}));
    await page.evaluate(source);
    const slider = page.getByRole('slider', { name: 'Light level', exact: true });
    await slider.waitFor();
    await slider.focus();
    await slider.press('Home');
    const dark = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    await slider.press('End');
    const light = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    assert.ok(C.luminance(C.parse(light)) > C.luminance(C.parse(dark)) + 0.5);
    assert.equal(await page.getByRole('checkbox', { name: 'Use on other sites too' }).isVisible(), false);
    assert.deepEqual(await page.evaluate(() => Object.keys(window.chrome || {})), chromeKeys);
    await page.getByRole('button', { name: 'Night', exact: true }).click();
    await page.waitForFunction(() => [...Object.keys(localStorage)].some(k => k.startsWith('daylight:bookmarklet:')));
    await page.reload();
    assert.equal(await page.locator('daylight-control').count(), 0);
    await page.evaluate(source);
    await page.waitForFunction(() => document.querySelector('daylight-control')?.shadowRoot.querySelector('.brightness').value === '0');
    await page.evaluate(source);
    assert.equal(await page.locator('daylight-control').count(), 1);
    await page.getByRole('button', { name: 'Original', exact: true }).click();
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(250, 249, 245)');
    await page.setViewportSize({ width: 375, height: 740 });
    const box = await page.locator('daylight-control .panel').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 375 && box.y >= 0 && box.y + box.height <= 740);
    assert.deepEqual(errors, []);
    const strict = await browser.newPage();
    await strict.goto(url + '/strict');
    assert.equal(await strict.evaluate(() => {
      try {
        document.createElement('div').innerHTML = '<span>Check</span>';
        return false;
      } catch {
        return true;
      }
    }), true);
    await strict.evaluate(source);
    const strictSlider = strict.getByRole('slider', { name: 'Light level', exact: true });
    await strictSlider.waitFor();
    await strictSlider.press('Home');
    const strictDark = await strict.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    await strictSlider.press('End');
    const strictLight = await strict.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    assert.ok(C.luminance(C.parse(strictLight)) > C.luminance(C.parse(strictDark)) + 0.5);
    console.log('Bookmark checks passed: slider, persistence, reopening, restore, mobile layout, host Chrome API preserved, strict Trusted Types.');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
