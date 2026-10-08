const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
const C = require('../extension/colors.js');

(async () => {
  const fixture = fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8');
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/frame') res.end('<html><body style="background:#eee;color:#222;font:13px sans-serif"><p id="frame-text">The same light level in embedded pages.</p></body></html>');
    else res.end(fixture);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'daylight-tests-'));
  const extension = path.resolve(__dirname, '../extension');
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true, viewport: { width: 1440, height: 1020 }, ignoreDefaultArgs: ['--disable-extensions'],
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const setLevel = async (level, warmth = 35) => {
      await worker.evaluate(async ({ level, warmth }) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => t.url?.startsWith('http://127.0.0.1'));
        return chrome.tabs.sendMessage(tab.id, { type: 'daylight:set', settings: { enabled: true, level, warmth, everywhere: false, hidden: false } }, { frameId: 0 });
      }, { level, warmth });
      await page.waitForFunction(level => document.querySelector('daylight-control')?.shadowRoot.querySelector('.brightness').value === String(level), level);
    };
    const inspect = async selector => page.locator(selector).evaluate(el => {
      const get = node => {
        const s = getComputedStyle(node), color = s.color, background = s.backgroundColor;
        let parent = node;
        let bg = background;
        while (/rgba\([^)]*,\s*0\)/.test(bg) && (parent = parent.parentElement || parent.getRootNode().host)) bg = getComputedStyle(parent).backgroundColor;
        return { color, bg, style: el.getAttribute('style') };
      };
      return get(el);
    });
    const verifyContrast = async selectors => {
      for (const selector of selectors) {
        const result = await inspect(selector);
        const ratio = C.contrast(C.parse(result.color), C.parse(result.bg));
        assert.ok(ratio >= 4.5, `${selector}: contrast ${ratio.toFixed(2)} (${result.color} / ${result.bg})`);
      }
    };
    const url = `http://127.0.0.1:${port}`;
    await page.goto(url);
    await page.locator('daylight-control .launcher').waitFor();
    const original = await inspect('#important');
    const originalBody = await inspect('body');
    const imageBefore = await page.locator('img').evaluate(el => ({ src: el.src, filter: getComputedStyle(el).filter }));
    await page.getByRole('button', { name: 'Open Daylight' }).click();
    for (const level of [0, 25, 45, 55, 62, 75, 100]) {
      await setLevel(level);
      await verifyContrast(['#body-copy', '#link', '#badge', '#note', '#important', '#action']);
    }
    const imageAfter = await page.locator('img').evaluate(el => ({ src: el.src, filter: getComputedStyle(el).filter }));
    assert.deepEqual(imageBefore, imageAfter);
    await setLevel(0);
    await page.evaluate(() => {
      const el = document.createElement('p');
      el.id = 'dynamic'; el.style.cssText = 'background:#eee;color:#444;padding:20px';
      el.textContent = 'Added after load'; document.querySelector('main').append(el);
    });
    await page.waitForFunction(() => document.querySelector('#dynamic').hasAttribute('data-daylight-id'));
    await verifyContrast(['#dynamic']);
    await page.evaluate(() => {
      document.querySelector('#important').style.setProperty('color', '#962f22', 'important');
      document.querySelector('#important').style.setProperty('background-color', '#faf2ef', 'important');
      document.querySelector('#dynamic').style.cssText = 'background:#303040;color:#aaa;padding:21px';
    });
    await page.waitForFunction(() => document.querySelector('#important').style.color.startsWith('var('));
    await verifyContrast(['#important', '#dynamic']);
    await page.waitForFunction(() => document.querySelector('#shadow').shadowRoot.querySelector('p').hasAttribute('data-daylight-id'));
    const frame = page.frames().find(f => f.url().endsWith('/frame'));
    await frame.waitForFunction(() => document.querySelector('#frame-text').hasAttribute('data-daylight-id'));
    assert.ok(C.luminance(C.parse(await frame.locator('body').evaluate(el => getComputedStyle(el).backgroundColor))) < 0.04);
    await page.getByRole('button', { name: 'Original', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('body').hasAttribute('data-daylight-id'));
    assert.equal((await inspect('body')).bg, originalBody.bg);
    assert.equal((await inspect('#important')).color, 'rgb(150, 47, 34)');
    assert.equal((await inspect('#dynamic')).color, 'rgb(170, 170, 170)');
    await page.reload();
    await page.locator('daylight-control .launcher').waitFor();
    assert.equal((await inspect('#important')).style, original.style);
    await page.goto(`${url}/?dark=1`);
    await page.locator('daylight-control .launcher').waitFor();
    for (const level of [0, 55, 100]) { await setLevel(level); await verifyContrast(['#body-copy', '#link', '#note', '#important']); }
    await setLevel(62, 70);
    await page.getByRole('button', { name: 'Open Daylight' }).click();
    await worker.evaluate(async () => new Promise(resolve => setTimeout(resolve, 300)));
    await page.reload();
    await page.waitForFunction(() => document.querySelector('body').hasAttribute('data-daylight-id'));
    await page.getByRole('button', { name: 'Open Daylight' }).click();
    assert.equal(await page.getByRole('slider', { name: 'Light level', exact: true }).inputValue(), '62');
    await page.getByRole('button', { name: 'Hide button', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Open Daylight' }).isVisible(), false);
    await page.keyboard.press('Alt+Shift+D');
    assert.equal(await page.getByRole('button', { name: 'Open Daylight' }).isVisible(), true);
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('body').hasAttribute('data-daylight-id'));
    await setLevel(25, 70);
    await page.getByRole('button', { name: 'Open Daylight' }).click();
    await page.screenshot({ path: path.join(__dirname, '../docs/preview.png') });
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${worker.url().split('/')[2]}/popup.html`);
    await popup.waitForFunction(() => document.querySelector('#note').textContent.length > 0 || document.querySelector('#mount').shadowRoot.querySelector('.number'));
    assert.equal(await popup.locator('daylight-control').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: contrast, media, native themes, dynamic changes, inline styles, shadows, frames, restore, persistence, keyboard, popup.');
  } finally {
    if (context) await context.close();
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
