(() => {
  if (globalThis.__daylightRunning) return;
  globalThis.__daylightRunning = true;
  const C = DaylightColors;
  const attr = "data-daylight-id";
  const excluded = "script,style,link,meta,head,title,noscript,template,img,picture,video,audio,canvas,iframe,object,embed,daylight-control,[data-daylight-owned]";
  const records = new Map(), roots = new Map(), tokens = new Map(), parsed = new Map(), pending = new Set();
  let settings = C.normalize(), siteKey = null, controller = null, host = null, sequence = 0, tokenSequence = 0;
  let timer = null, saveTimer = null, scheduled = false, sampling = false, defaultRemoval = false;
  let nativeDark = false, paper = C.parse("#ffffff");
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const parse = value => {
    if (parsed.has(value)) return parsed.get(value);
    let color = C.parse(value);
    if (!color && value && CSS.supports("color", value) && !["none", "currentcolor", "auto"].includes(value)) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const bytes = ctx.getImageData(0, 0, 1, 1).data;
      color = { r: bytes[0], g: bytes[1], b: bytes[2], a: bytes[3] / 255 };
    }
    parsed.set(value, color);
    return color;
  };
  const token = (color, role, background) => {
    const key = `${role}|${C.key(color)}|${C.key(background)}`;
    if (!tokens.has(key)) tokens.set(key, { name: `--daylight-${++tokenSequence}`, color, role, background });
    return `var(${tokens.get(key).name})`;
  };
  const eligible = el => el instanceof Element && !el.matches(excluded) && !el.closest("daylight-control,[data-daylight-owned]");
  const register = root => {
    if (roots.has(root)) return;
    const palette = new CSSStyleSheet(), rules = new CSSStyleSheet();
    roots.set(root, { palette, rules });
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, palette, rules];
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "open", "aria-expanded", "data-theme", "data-color-mode"] });
  };
  const selector = id => Array(4).fill(`:is(#daylight-specificity,[${attr}="${id}"])`).join("");
  const resetInline = record => {
    for (const [prop, original] of record.inline) {
      const current = record.el.style.getPropertyValue(prop);
      if (current !== original.applied || record.el.style.getPropertyPriority(prop) !== "important") {
        original.value = current;
        original.priority = record.el.style.getPropertyPriority(prop);
      }
      if (original.value) record.el.style.setProperty(prop, original.value, original.priority);
      else record.el.style.removeProperty(prop);
    }
  };
  const applyInline = record => {
    for (const [prop, value] of Object.entries(record.values)) {
      if (record.inline.has(prop) || record.el.style.getPropertyPriority(prop) === "important") {
        if (!record.inline.has(prop)) record.inline.set(prop, { value: record.el.style.getPropertyValue(prop), priority: "important" });
        record.inline.get(prop).applied = value;
        record.el.style.setProperty(prop, value, "important");
      }
    }
  };
  const decoration = (value, role, background) => value.replace(/url\((?:[^()"']|"[^"]*"|'[^']*')*\)|(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|#[\da-f]{3,8}\b/gi, match => {
    if (match.startsWith("url(")) return match;
    const color = parse(match);
    return color && color.a > 0 ? token(color, role, background) : match;
  });
  const sampleValues = (style, background, el) => {
    const values = {};
    const foreground = parse(style.color);
    const surface = parse(style.backgroundColor);
    if (foreground?.a > 0) values.color = token(foreground, "text", background);
    if (surface?.a > 0) values["background-color"] = token(surface.a < 0.995 ? { ...background, a: 1 } : surface, "surface", background);
    for (const side of ["top", "right", "bottom", "left"]) {
      if (parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0) {
        const color = parse(style.getPropertyValue(`border-${side}-color`));
        if (color?.a > 0) values[`border-${side}-color`] = token(color, "border", background);
      }
    }
    if (style.outlineStyle !== "none") {
      const color = parse(style.outlineColor);
      if (color?.a > 0) values["outline-color"] = token(color, "icon", background);
    }
    if (style.textDecorationLine !== "none") {
      const color = parse(style.textDecorationColor);
      if (color?.a > 0) values["text-decoration-color"] = token(color, "text", background);
    }
    if (el.matches("input,textarea,[contenteditable]")) values["caret-color"] = token(foreground || C.parse("#222222"), "text", background);
    if (el.matches('input[type="checkbox"],input[type="radio"],input[type="range"],progress')) {
      values["accent-color"] = token(parse(style.accentColor) || C.parse("#688744"), "icon", background);
    }
    if (el instanceof SVGElement) {
      for (const prop of ["fill", "stroke"]) {
        const color = parse(style[prop]);
        if (color?.a > 0) values[prop] = token(color, el.tagName.toLowerCase() === "text" ? "text" : "icon", background);
      }
    }
    if (style.backgroundImage !== "none" && /gradient\(/.test(style.backgroundImage)) {
      values["background-image"] = decoration(style.backgroundImage, style.backgroundClip === "text" ? "text" : "surface", background);
    }
    for (const prop of ["box-shadow", "text-shadow"]) {
      const value = style.getPropertyValue(prop);
      if (value !== "none") values[prop] = decoration(value, "shadow", background);
    }
    return values;
  };
  const refreshPalette = () => {
    if (!settings.enabled || sampling) return;
    const declarations = [...tokens.values()].map(t => `${t.name}:${C.css(C.map(t.color, t.role, t.background, settings, nativeDark))}`).join(";");
    const bg = C.surface(paper, settings, nativeDark);
    const text = C.readable(C.parse("#242424"), bg, settings);
    for (const [root, sheets] of roots) {
      const base = root === document ? `html{background-color:${C.css(bg)}!important;color:${C.css(text)}!important;color-scheme:${C.luminance(bg) < 0.18 ? "dark" : "light"}!important}` : "";
      sheets.palette.replaceSync(`${root === document ? ":root" : ":host"}{${declarations}}${base}`);
    }
  };
  const refreshRules = () => {
    const rules = new Map([...roots.keys()].map(root => [root, []]));
    for (const record of records.values()) {
      if (!record.el.isConnected) {
        resetInline(record);
        if (record.previousId === null) record.el.removeAttribute(attr);
        else record.el.setAttribute(attr, record.previousId);
        records.delete(record.el);
        continue;
      }
      const declarations = values => Object.entries(values).map(([prop, value]) => `${prop}:${value}!important`).join(";");
      const destination = rules.get(record.el.getRootNode());
      if (!destination) continue;
      destination.push(`${selector(record.id)}{${declarations(record.values)}}`);
      for (const [pseudo, values] of record.pseudos) destination.push(`${selector(record.id)}${pseudo}{${declarations(values)}}`);
    }
    for (const [root, list] of rules) roots.get(root).rules.replaceSync(list.join("\n"));
  };
  const schedule = el => {
    if (!settings.enabled || !el) return;
    pending.add(el);
    if (scheduled) return;
    scheduled = true;
    timer = setTimeout(() => requestAnimationFrame(scan), 55);
  };
  const observer = new MutationObserver(mutations => {
    if (!settings.enabled || sampling) return;
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && eligible(mutation.target)) schedule(mutation.target);
      else if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) if (eligible(node)) schedule(node);
        if (mutation.removedNodes.length && eligible(mutation.target)) schedule(mutation.target);
      }
    }
  });
  const scan = () => {
    scheduled = false;
    if (!settings.enabled || !document.documentElement) return;
    sampling = true;
    observer.disconnect();
    for (const record of records.values()) resetInline(record);
    for (const sheets of roots.values()) { sheets.palette.disabled = true; sheets.rules.disabled = true; }
    const candidates = new Set();
    const collect = start => {
      const nodes = start instanceof Element ? [start, ...start.querySelectorAll("*")] : [...start.querySelectorAll("*")];
      for (const el of nodes) {
        if (!eligible(el)) continue;
        candidates.add(el);
        if (el.shadowRoot) { register(el.shadowRoot); collect(el.shadowRoot); }
      }
    };
    for (const start of pending) if (start.isConnected || start === document) collect(start);
    pending.clear();
    const styles = new Map(), backgrounds = new Map();
    const getStyle = el => {
      if (!styles.has(el)) styles.set(el, getComputedStyle(el));
      return styles.get(el);
    };
    const rootStyle = getStyle(document.documentElement);
    const bodyStyle = document.body ? getStyle(document.body) : rootStyle;
    const rootColor = parse(rootStyle.backgroundColor), bodyColor = parse(bodyStyle.backgroundColor);
    paper = rootColor?.a > 0.95 ? rootColor : bodyColor?.a > 0.95 ? bodyColor : C.luminance(parse(bodyStyle.color) || C.parse("#000000")) > 0.5 ? C.parse("#171717") : C.parse("#ffffff");
    nativeDark = C.toLch(paper).L < 0.55;
    const backgroundFor = el => {
      if (backgrounds.has(el)) return backgrounds.get(el);
      const parent = el.parentElement || el.getRootNode().host;
      const behind = parent ? backgroundFor(parent) : paper;
      const own = parse(getStyle(el).backgroundColor);
      let bg = own?.a > 0 ? C.composite(own, behind) : behind;
      const gradient = getStyle(el).backgroundImage;
      if (/gradient\(/.test(gradient) && !/url\(/.test(gradient) && getStyle(el).backgroundClip !== "text") {
        const colors = gradient.match(/rgba?\([^)]*\)|#[\da-f]{3,8}\b/gi)?.map(parse).filter(Boolean);
        if (colors?.length) {
          const avg = colors.reduce((a, c) => ({ r: a.r + c.r / colors.length, g: a.g + c.g / colors.length, b: a.b + c.b / colors.length, a: a.a + c.a / colors.length }), { r: 0, g: 0, b: 0, a: 0 });
          bg = C.composite(avg, bg);
        }
      }
      backgrounds.set(el, bg);
      return bg;
    };
    const sampled = [];
    for (const el of candidates) {
      if (!el.isConnected) continue;
      const style = getStyle(el), bg = backgroundFor(el);
      const values = sampleValues(style, bg, el), pseudos = [];
      for (const pseudo of ["::before", "::after"]) {
        const ps = getComputedStyle(el, pseudo);
        if (ps.content !== "none" && ps.content !== "normal") {
          const own = parse(ps.backgroundColor);
          pseudos.push([pseudo, sampleValues(ps, own?.a > 0 ? C.composite(own, bg) : bg, el)]);
        }
      }
      if (el.matches("input,textarea")) pseudos.push(["::placeholder", { color: token(parse(getComputedStyle(el, "::placeholder").color) || parse(style.color) || C.parse("#777777"), "text", bg), opacity: "1" }]);
      if (el.matches("li")) pseudos.push(["::marker", { color: token(parse(style.color) || C.parse("#444444"), "text", bg) }]);
      sampled.push({ el, values, pseudos });
    }
    for (const sample of sampled) {
      let record = records.get(sample.el);
      if (!record) {
        record = { el: sample.el, id: ++sequence, previousId: sample.el.getAttribute(attr), inline: new Map() };
        records.set(sample.el, record);
        sample.el.setAttribute(attr, record.id);
      }
      record.values = sample.values;
      record.pseudos = sample.pseudos;
    }
    refreshRules();
    sampling = false;
    refreshPalette();
    for (const record of records.values()) applyInline(record);
    for (const [root, sheets] of roots) {
      sheets.palette.disabled = false;
      sheets.rules.disabled = false;
      observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "open", "aria-expanded", "data-theme", "data-color-mode"] });
    }
  };
  const restore = () => {
    observer.disconnect();
    clearTimeout(timer);
    pending.clear();
    scheduled = false;
    for (const record of records.values()) {
      resetInline(record);
      if (record.previousId === null) record.el.removeAttribute(attr);
      else record.el.setAttribute(attr, record.previousId);
    }
    for (const [root, sheets] of roots) root.adoptedStyleSheets = root.adoptedStyleSheets.filter(s => s !== sheets.palette && s !== sheets.rules);
    roots.clear();
    records.clear();
    tokens.clear();
    parsed.clear();
  };
  const apply = next => {
    const wasEnabled = settings.enabled;
    settings = C.normalize(next);
    controller?.update(settings);
    if (!settings.enabled) { if (wasEnabled) restore(); return; }
    if (!wasEnabled) {
      register(document);
      pending.add(document);
      scan();
    } else refreshPalette();
  };
  const persist = async () => {
    if (!siteKey) return;
    const values = { [siteKey]: { ...settings } };
    if (settings.everywhere) values["daylight:default"] = { ...settings, hidden: false };
    try {
      await chrome.storage.local.set(values);
      if (defaultRemoval && !settings.everywhere) await chrome.storage.local.remove("daylight:default");
      defaultRemoval = false;
    } catch { controller?.error("Couldn’t save. Try reloading this page."); }
  };
  const change = next => {
    defaultRemoval ||= settings.everywhere && !next.everywhere;
    apply(next);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 180);
  };
  const mount = () => {
    if (window !== window.top || host || !document.documentElement) return;
    host = document.createElement("daylight-control");
    host.setAttribute("data-daylight-owned", "");
    const shadow = host.attachShadow({ mode: "open" });
    controller = new DaylightUI(shadow, { settings, floating: true, supportsEverywhere: !chrome.daylightBookmarklet, onChange: change });
    document.documentElement.append(host);
    document.addEventListener("pointerdown", event => {
      if (!event.composedPath().includes(host) && !controller.panel.hidden) controller.close();
    }, true);
    document.addEventListener("keydown", event => {
      if (event.altKey && event.shiftKey && event.code === "KeyD") {
        event.preventDefault();
        if (settings.hidden) change({ ...settings, hidden: false });
        controller.toggle();
      }
    });
  };
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message.type === "daylight:get") { reply({ settings, siteKey }); return; }
    if (message.type === "daylight:set") { change(message.settings); reply({ settings }); }
    if (message.type === "daylight:open") { mount(); controller?.open(); reply({ settings }); }
  });
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "local" || !(siteKey in changes || "daylight:default" in changes)) return;
    try {
      const data = await chrome.storage.local.get([siteKey, "daylight:default"].filter(Boolean));
      apply({ ...C.normalize(), ...(data["daylight:default"] || {}), ...(data[siteKey] || {}) });
    } catch {}
  });
  for (const name of ["pointerover", "pointerout", "focusin", "focusout", "change"]) document.addEventListener(name, event => {
    if (!settings.enabled || !eligible(event.target)) return;
    const target = event.target.closest("a,button,input,select,textarea,details,[role=button]") || event.target;
    if (target.shadowRoot && !roots.has(target.shadowRoot)) register(target.shadowRoot);
    schedule(target);
  }, true);
  window.addEventListener("pagehide", () => { if (saveTimer) { clearTimeout(saveTimer); persist(); } });
  const start = async () => {
    try {
      const result = await chrome.runtime.sendMessage({ type: "daylight:settings" });
      siteKey = result.key;
      apply(result.settings);
    } catch { settings = C.normalize(); }
    mount();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
