(() => {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const linear = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const encoded = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);
  const luminance = c => 0.2126 * linear(c.r / 255) + 0.7152 * linear(c.g / 255) + 0.0722 * linear(c.b / 255);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  const composite = (a, b) => ({ r: a.r * a.a + b.r * (1 - a.a), g: a.g * a.a + b.g * (1 - a.a), b: a.b * a.a + b.b * (1 - a.a), a: 1 });
  const parse = value => {
    if (!value || value === "none" || value === "currentcolor") return null;
    if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    if (/^#[\da-f]{3,8}$/i.test(value)) {
      let h = value.slice(1);
      if (h.length === 3 || h.length === 4) h = [...h].map(x => x + x).join("");
      if (h.length !== 6 && h.length !== 8) return null;
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
    }
    if (!/^rgba?\(/i.test(value)) return null;
    const parts = value.slice(value.indexOf("(") + 1, -1).trim().split(/[\s,\/]+/);
    if (parts.length < 3 || parts.length > 4) return null;
    const channels = parts.slice(0, 3).map(x => clamp(parseFloat(x) * (x.endsWith("%") ? 2.55 : 1), 0, 255));
    const alpha = parts[3] === undefined ? 1 : clamp(parseFloat(parts[3]) / (parts[3].endsWith("%") ? 100 : 1));
    if ([...channels, alpha].some(x => !Number.isFinite(x))) return null;
    return { r: channels[0], g: channels[1], b: channels[2], a: alpha };
  };
  const toLch = color => {
    const r = linear(color.r / 255), g = linear(color.g / 255), b = linear(color.b / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, C: Math.hypot(a, bb), h: Math.atan2(bb, a), a: color.a };
  };
  const rawRgb = (L, C, h) => {
    const a = C * Math.cos(h), b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return { r: encoded(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), g: encoded(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), b: encoded(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s) };
  };
  const fromLch = (L, C, h, a = 1) => {
    let color = rawRgb(clamp(L), C, h);
    for (let i = 0; i < 18 && [color.r, color.g, color.b].some(x => x < -0.01 || x > 255.01); i++) {
      C *= 0.82;
      color = rawRgb(clamp(L), C, h);
    }
    return { r: clamp(color.r, 0, 255), g: clamp(color.g, 0, 255), b: clamp(color.b, 0, 255), a: clamp(a) };
  };
  const css = c => `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Math.round(c.a * 1000) / 1000})`;
  const key = c => c ? `${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${c.a.toFixed(3)}` : "none";
  const surface = (source, settings, nativeDark = false) => {
    const input = toLch(source);
    const level = clamp(settings.level / 100), warmth = clamp(settings.warmth / 100);
    const base = 0.19 + 0.78 * level;
    const depth = clamp(nativeDark ? input.L - 0.16 : 0.98 - input.L, 0, 0.8);
    const direction = 1 - 2 * level;
    const L = clamp(base + depth * direction * (input.C > 0.045 ? 0.27 : 0.16), 0.12, 0.985);
    const C = input.C > 0.045 ? Math.min(input.C * 0.65, 0.13) : 0.004 + 0.019 * warmth;
    const h = input.C > 0.045 ? input.h : (warmth > 0.12 ? 75 : 255) * Math.PI / 180;
    return fromLch(L, C, h, source.a);
  };
  const readable = (source, background, settings, minimum = 4.6) => {
    const input = toLch(source);
    const dark = fromLch(0.08, 0, 0), light = fromLch(0.995, 0, 0);
    const useLight = contrast(light, background) > contrast(dark, background);
    const C = input.C > 0.035 ? Math.min(input.C, 0.18) : 0.006 * settings.warmth / 100;
    const h = input.C > 0.035 ? input.h : 75 * Math.PI / 180;
    let L = useLight ? 0.87 : 0.29;
    let color = fromLch(L, C, h);
    for (let i = 0; i < 45 && contrast(color, background) < minimum; i++) {
      L = useLight ? Math.min(1, L + 0.012) : Math.max(0, L - 0.012);
      color = fromLch(L, C, h);
    }
    if (contrast(color, background) < minimum) color = useLight ? light : dark;
    return color;
  };
  const map = (source, role, background, settings, nativeDark = false) => {
    if (!source || source.a === 0) return source;
    if (role === "surface") return surface(source, settings, nativeDark);
    const bg = surface({ ...background, a: 1 }, settings, nativeDark);
    if (role === "shadow") return fromLch(0.06, 0.008, 75 * Math.PI / 180, source.a * (0.4 + settings.level / 180));
    const minimum = role === "border" ? 1.5 : role === "icon" ? 3 : 4.6;
    const color = readable(source, bg, settings, minimum);
    if (role === "border") {
      const alpha = Math.max(source.a, 0.38);
      return { ...color, a: alpha };
    }
    return { ...color, a: 1 };
  };
  const normalize = input => ({
    enabled: input?.enabled === true,
    level: Number.isFinite(input?.level) ? clamp(input.level, 0, 100) : 72,
    warmth: Number.isFinite(input?.warmth) ? clamp(input.warmth, 0, 100) : 35,
    everywhere: input?.everywhere === true,
    hidden: input?.hidden === true
  });
  const api = { clamp, parse, toLch, fromLch, luminance, contrast, composite, css, key, surface, readable, map, normalize };
  globalThis.DaylightColors = api;
  if (typeof module !== "undefined") module.exports = api;
})();
