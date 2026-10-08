const fs = require('node:fs');
const path = require('node:path');
const { minify } = require('terser');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'extension', file), 'utf8').replaceAll('globalThis', 'daylightScope');

(async () => {
  const shim = `
    const daylightScope = window[Symbol.for('daylight:bookmarklet')] ||= {};
    const chrome = daylightScope.chrome ||= (() => {
      const listeners = [], messages = [];
      const prefix = 'daylight:bookmarklet:';
      const local = {
        get: async keys => {
          const result = {};
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            const value = localStorage.getItem(prefix + key);
            if (value) { try { result[key] = JSON.parse(value); } catch {} }
          }
          return result;
        },
        set: async values => {
          const changes = {};
          for (const [key, value] of Object.entries(values)) {
            const previous = await local.get([key]);
            localStorage.setItem(prefix + key, JSON.stringify(value));
            changes[key] = { oldValue: previous[key], newValue: value };
          }
          listeners.forEach(listener => listener(changes, 'local'));
        },
        remove: async key => {
          localStorage.removeItem(prefix + key);
          listeners.forEach(listener => listener({ [key]: {} }, 'local'));
        }
      };
      window.addEventListener('storage', event => {
        if (!event.key?.startsWith(prefix)) return;
        const key = event.key.slice(prefix.length);
        let value;
        try { value = JSON.parse(event.newValue); } catch {}
        listeners.forEach(listener => listener({ [key]: { newValue: value } }, 'local'));
      });
      return {
        daylightBookmarklet: true,
        storage: { local, onChanged: { addListener: listener => listeners.push(listener) } },
        runtime: {
          onMessage: { addListener: listener => messages.push(listener) },
          sendMessage: async () => {
            const key = 'daylight:site:' + location.origin;
            try {
              const data = await local.get([key]);
              return { key, settings: data[key] || {} };
            } catch { return { key, settings: {} }; }
          }
        },
        open: () => messages.forEach(listener => listener({ type: 'daylight:open' }, {}, () => {}))
      };
    })();
  `;
  const source = `(()=>{${shim}\n${read('colors.js')}\nconst DaylightColors=daylightScope.DaylightColors;\n${read('ui.js')}\nconst DaylightUI=daylightScope.DaylightUI;\n${read('content.js')}\nchrome.open();})()`;
  const result = await minify(source, { compress: { passes: 2 }, mangle: true, format: { comments: false } });
  const url = 'javascript:' + encodeURIComponent('void ' + result.code);
  const out = path.join(root, 'bookmarklet');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'daylight.js'), result.code + '\n');
  fs.writeFileSync(path.join(out, 'bookmark-url.txt'), url + '\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install Daylight</title><style>
*{box-sizing:border-box}html{color-scheme:light}body{margin:0;background:#f5f2e9;color:#343c2d;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;display:grid;place-items:center;padding:28px}main{max-width:600px;width:100%}.mark{width:32px;height:32px;border:2px solid #525f3e;border-radius:50%;background:linear-gradient(90deg,#525f3e 50%,transparent 50%);margin-bottom:26px}h1{font-size:42px;letter-spacing:-1.8px;font-weight:500;margin:0 0 14px}p{font-size:15px;line-height:1.7;color:#777e6a;margin:0 0 25px}.install{display:inline-flex;align-items:center;gap:12px;border:1px solid #6a7757;border-radius:12px;background:#556342;color:#f6f3e8;text-decoration:none;padding:15px 25px;font-size:16px;box-shadow:0 3px 12px #3c4b2315;cursor:grab}.small{font-size:12px;margin:20px 0 30px;line-height:1.8}button{font:inherit;font-size:12px;cursor:pointer;color:#58634a;background:transparent;border:1px solid #cbcdbd;border-radius:8px;padding:10px 14px}textarea{display:block;width:100%;height:65px;margin:15px 0;border:1px solid #d5d7c9;border-radius:8px;background:#eeeee5;padding:10px;color:#6b705f;font:11px ui-monospace,monospace}textarea[hidden]{display:none}.footer{border-top:1px solid #dcddce;padding-top:20px;font-size:11px;margin-top:35px}a:focus-visible,button:focus-visible{outline:3px solid #a4ac8b;outline-offset:5px}a.repo{color:#586c42}
</style></head><body><main><div class="mark"></div><h1>Daylight, in one click.</h1><p>A small slider for making a page lighter or darker.<br>Colors stay in tune. Photos stay as they are.</p><a class="install" id="install" href="${url}">◐ Daylight</a><p class="small">Drag this button to your bookmarks bar.<br>On a website, click the bookmark and move the slider.<br>To show the bookmarks bar in Chrome: <strong>⌘ Shift B</strong> on Mac, <strong>Ctrl Shift B</strong> on Windows.</p><button id="copy">Copy bookmark address</button><textarea id="address" aria-label="Daylight bookmark address" readonly hidden></textarea><p class="small" id="status"></p><p class="footer">Free. Runs locally. No account or build step.<br>Click the bookmark again on each new page. Site settings are stored on that site in this browser. Some protected pages and sites with strict script rules won’t allow bookmarklets.<br><a class="repo" href="https://github.com/Amkan2024/daylight">Source and extension version on GitHub →</a></p></main><script>
const address=document.getElementById('address');address.value=document.getElementById('install').getAttribute('href');document.getElementById('copy').addEventListener('click',async()=>{address.hidden=false;address.select();try{await navigator.clipboard.writeText(address.value);document.getElementById('status').textContent='Copied. Add a bookmark named Daylight, then paste this into its address.'}catch{document.getElementById('status').textContent='Copy the selected address. Add a bookmark named Daylight and paste it there.'}});
</script></body></html>`;
  fs.writeFileSync(path.join(out, 'install.html'), html);
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/index.html'), html);
  fs.writeFileSync(path.join(root, 'docs/.nojekyll'), '');
  console.log(`Bookmark button built: ${Buffer.byteLength(result.code)} bytes, address ${url.length} characters.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
