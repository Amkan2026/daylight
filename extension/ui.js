(() => {
  const node = (tag, attributes = {}, ...children) => {
    const element = ["svg", "circle", "path"].includes(tag) ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
    if (tag === "button") element.type = "button";
    for (const [key, value] of Object.entries(attributes)) {
      if (value === true) element.setAttribute(key, "");
      else if (value !== false && value != null) element.setAttribute(key, String(value));
    }
    for (const child of children.flat()) element.append(typeof child === "string" ? document.createTextNode(child) : child);
    return element;
  };
  const sun = () => node("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, node("circle", { cx: 12, cy: 12, r: 4 }), node("path", { d: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" }));
  const moon = () => node("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, node("path", { d: "M20.5 14.2A8.7 8.7 0 0 1 9.8 3.5 8.8 8.8 0 1 0 20.5 14.2Z" }));
  const style = `
    :host{all:initial!important;color-scheme:light!important;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;font-size:14px!important;line-height:1.4!important}
    *,*::before,*::after{box-sizing:border-box}[hidden]{display:none!important}button,input{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #827756;outline-offset:4px}button{color:inherit}svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
    .launcher{position:fixed;right:20px;bottom:20px;z-index:2147483647;width:38px;height:38px;border:1px solid #ddd6c7;border-radius:50%;background:#f5f1e8;color:#3e4432;box-shadow:0 3px 14px #0002;display:grid;place-items:center;opacity:.76;transition:opacity .15s,transform .15s;touch-action:manipulation}.launcher:hover{opacity:1;transform:translateY(-2px)}.mark{display:block;width:17px;height:17px;border:1.5px solid currentColor;border-radius:50%;background:linear-gradient(90deg,currentColor 50%,transparent 50%)}
    .panel{width:320px;padding:23px;background:#f7f4ed;color:#30352b;border:1px solid #ded9ce;border-radius:21px;box-shadow:0 12px 50px #0003;letter-spacing:normal;text-align:left}.floating .panel{position:fixed;right:20px;bottom:70px;z-index:2147483647;width:min(320px,calc(100vw - 24px));max-height:calc(100dvh - 92px);overflow-y:auto}.popup .panel{border:0;border-radius:0;box-shadow:none}.panel[hidden],.launcher[hidden]{display:none!important}.top{display:flex;align-items:center;justify-content:space-between;gap:12px}.brand{display:flex;gap:10px;align-items:center}.brand .mark{width:21px;height:21px;color:#555d42}.name{font-size:17px;font-weight:650;letter-spacing:-.5px;margin:0}.close{border:0;background:transparent;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:23px;font-weight:300;color:#77786b}.close:hover{background:#e9e4d8}.intro{margin:17px 0 21px;color:#76786b;font-size:12px}.readout{display:flex;justify-content:space-between;align-items:end;margin-bottom:20px}.caption{color:#76786b;font-size:11px}.level{font-size:38px;letter-spacing:-2px;font-weight:500;line-height:1.05}.level small{font-size:16px;letter-spacing:0;margin-left:3px;color:#8b8c80}.palette{display:flex;padding-bottom:4px}.swatch{width:22px;height:22px;border-radius:50%;border:2px solid #f7f4ed;margin-left:-4px;box-shadow:0 0 0 1px #b8b4aa55}.slider-row{display:flex;align-items:center;gap:12px}.slider-row svg{color:#7c806f}input[type=range]{appearance:none;-webkit-appearance:none;height:8px;border-radius:20px;background:linear-gradient(90deg,#242a22,#848773,#f0e7d4);width:100%;min-width:0;margin:10px 0;cursor:ew-resize;touch-action:none}input[type=range]::-webkit-slider-thumb{appearance:none;width:20px;height:20px;background:#f8f5ed;border:2px solid #535d3d;border-radius:50%;box-shadow:0 1px 5px #0002}input[type=range]::-moz-range-thumb{width:17px;height:17px;background:#f8f5ed;border:2px solid #535d3d;border-radius:50%}.ends{display:flex;justify-content:space-between;font-size:10px;color:#858778;padding:2px 29px 0}.presets{display:flex;gap:7px;margin:22px 0 23px}.preset{flex:1;border:1px solid #dbd8ca;background:transparent;border-radius:9px;padding:8px 3px;font-size:11px}.preset:hover{background:#eae6da}.preset[aria-pressed=true]{background:#e3e5d8;border-color:#b7bea1;color:#3e4b2e}.divider{height:1px;background:#e2dfd4;margin:0 0 18px}.warm-label{display:flex;align-items:center;justify-content:space-between;color:#646958;font-size:11px}.warm-value{color:#8a8c7e;font-size:10px}.warmth{background:linear-gradient(90deg,#dae1e7,#dec695)!important;height:5px!important;margin:13px 0 18px!important}.warmth::-webkit-slider-thumb{width:15px!important;height:15px!important;border-width:1px!important}.everywhere{display:flex;align-items:center;gap:9px;font-size:11px;color:#676c5d;cursor:pointer}.everywhere input{accent-color:#606b45;width:14px;height:14px;margin:0}.footer{display:flex;align-items:center;justify-content:space-between;margin-top:20px;gap:6px}.original{border:1px solid #d8d5c7;padding:7px 12px;border-radius:8px;background:#eeece2;font-size:11px}.original[aria-pressed=true]{background:#dedfce;border-color:#bfc3a6}.hide{background:transparent;border:0;color:#858778;font-size:10px;padding:8px 0}.hide:hover{color:#424c32}.status{font-size:10px;color:#858778;margin:13px 0 0;min-height:14px}.error{color:#965846}.popup-note{padding:0 23px 20px;background:#f7f4ed;color:#777c6c;font-size:11px;margin:0;line-height:1.6}.popup-note:empty{display:none}
    @media(prefers-reduced-motion:reduce){*{transition:none!important}}@media(max-height:430px){.floating .panel{bottom:65px;padding:16px}.intro{margin:10px 0}.presets{margin:10px 0}.warmth{margin-bottom:10px!important}.footer{margin-top:10px}}
  `;
  class Controller {
    constructor(root, options) {
      this.root = root;
      this.options = options;
      this.settings = DaylightColors.normalize(options.settings);
      root.replaceChildren(node("style", {}, style), node("div", { class: options.floating ? "floating" : "popup" },
        node("button", { class: "launcher", title: "Daylight · Adjust this page", "aria-label": "Open Daylight", "aria-expanded": "false" }, node("span", { class: "mark" })),
        node("section", { class: "panel", role: "dialog", "aria-label": "Daylight settings", hidden: options.floating },
          node("div", { class: "top" }, node("div", { class: "brand" }, node("span", { class: "mark" }), node("h1", { class: "name" }, "Daylight")), node("button", { class: "close", "aria-label": "Close Daylight" }, "×")),
          node("p", { class: "intro" }, "A little darker. A little lighter. Your call."),
          node("div", { class: "readout" }, node("div", {}, node("div", { class: "caption" }, "Light level"), node("div", { class: "level" }, node("span", { class: "number" }, "72"), node("small", {}, "%"))), node("div", { class: "palette", "aria-label": "Current color palette" }, Array.from({ length: 4 }, () => node("span", { class: "swatch" })))),
          node("div", { class: "slider-row" }, moon(), node("input", { class: "brightness", type: "range", min: 0, max: 100, step: 1, "aria-label": "Light level" }), sun()),
          node("div", { class: "ends" }, node("span", {}, "Darker"), node("span", {}, "Lighter")),
          node("div", { class: "presets" }, [[0, "Night"], [62, "Soft"], [100, "Day"]].map(([level, label]) => node("button", { class: "preset", "data-level": level }, label))),
          node("div", { class: "divider" }), node("label", { class: "warm-label", for: "daylight-warmth" }, "Warmth ", node("span", { class: "warm-value" }, "Balanced")), node("input", { id: "daylight-warmth", class: "warmth", type: "range", min: 0, max: 100, step: 1, "aria-label": "Warmth" }),
          node("label", { class: "everywhere" }, node("input", { type: "checkbox" }), "Use on other sites too"),
          node("div", { class: "footer" }, node("button", { class: "original", "aria-pressed": "true" }, "Original"), node("button", { class: "hide" }, "Hide button")),
          node("p", { class: "status", role: "status", "aria-live": "polite" }, "Saved for this site")
        )
      ));
      this.panel = root.querySelector(".panel");
      this.launcher = root.querySelector(".launcher");
      this.brightness = root.querySelector(".brightness");
      this.warmth = root.querySelector(".warmth");
      this.status = root.querySelector(".status");
      this.launcher.hidden = !options.floating || this.settings.hidden;
      if (options.supportsEverywhere === false) root.querySelector(".everywhere").hidden = true;
      root.querySelector(".close").hidden = !options.floating;
      this.launcher.addEventListener("click", () => this.toggle());
      root.querySelector(".close").addEventListener("click", () => this.close());
      this.brightness.addEventListener("input", () => this.change({ level: Number(this.brightness.value), enabled: true }));
      this.warmth.addEventListener("input", () => this.change({ warmth: Number(this.warmth.value), enabled: true }));
      root.querySelectorAll(".preset").forEach(button => button.addEventListener("click", () => this.change({ level: Number(button.dataset.level), enabled: true })));
      root.querySelector(".everywhere input").addEventListener("change", event => this.change({ everywhere: event.target.checked }));
      root.querySelector(".original").addEventListener("click", () => this.change({ enabled: !this.settings.enabled }));
      root.querySelector(".hide").addEventListener("click", () => {
        this.change({ hidden: !this.settings.hidden });
        if (options.floating) this.close();
      });
      root.addEventListener("keydown", event => {
        if (event.key === "Escape" && options.floating && !this.panel.hidden) {
          event.stopPropagation();
          this.close();
        }
      });
      this.render();
    }
    change(patch) {
      this.settings = DaylightColors.normalize({ ...this.settings, ...patch });
      this.render();
      this.options.onChange(this.settings);
    }
    update(settings) {
      this.settings = DaylightColors.normalize(settings);
      this.render();
    }
    render() {
      const C = DaylightColors, s = this.settings;
      this.brightness.value = s.level;
      this.warmth.value = s.warmth;
      this.root.querySelector(".number").textContent = Math.round(s.level);
      this.brightness.setAttribute("aria-valuetext", `${Math.round(s.level)} percent light`);
      this.root.querySelector(".warm-value").textContent = s.warmth < 20 ? "Cool" : s.warmth > 65 ? "Warm" : "Balanced";
      this.root.querySelector(".everywhere input").checked = s.everywhere;
      this.root.querySelector(".original").setAttribute("aria-pressed", String(!s.enabled));
      this.root.querySelector(".original").textContent = s.enabled ? "Original" : "Original · on";
      this.root.querySelectorAll(".preset").forEach(b => b.setAttribute("aria-pressed", String(s.enabled && Number(b.dataset.level) === s.level)));
      this.root.querySelector(".hide").textContent = s.hidden ? "Show button" : "Hide button";
      this.launcher.hidden = !this.options.floating || s.hidden;
      this.status.textContent = s.everywhere ? "Default for other sites · site choices stay saved" : "Saved for this site";
      this.status.classList.remove("error");
      const paper = C.parse("#ffffff");
      const bg = C.surface(paper, s);
      const palette = [bg, C.surface(C.parse("#e6e6e6"), s), C.readable(C.parse("#53692f"), bg, s), C.readable(C.parse("#202020"), bg, s)];
      this.root.querySelectorAll(".swatch").forEach((node, i) => node.style.backgroundColor = C.css(palette[i]));
    }
    error(message) {
      this.status.textContent = message;
      this.status.classList.add("error");
    }
    toggle() {
      this.panel.hidden = !this.panel.hidden;
      this.launcher.setAttribute("aria-expanded", String(!this.panel.hidden));
      if (!this.panel.hidden) this.brightness.focus();
    }
    open() {
      this.panel.hidden = false;
      this.launcher.setAttribute("aria-expanded", "true");
      this.brightness.focus();
    }
    close() {
      this.panel.hidden = true;
      this.launcher.setAttribute("aria-expanded", "false");
      if (!this.launcher.hidden) this.launcher.focus();
    }
  }
  globalThis.DaylightUI = Controller;
})();
