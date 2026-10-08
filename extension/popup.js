(async () => {
  const root = document.querySelector("#mount").attachShadow({ mode: "open" });
  let tab = null;
  const ui = new DaylightUI(root, {
    floating: false,
    settings: DaylightColors.normalize(),
    onChange: async settings => {
      try { await chrome.tabs.sendMessage(tab.id, { type: "daylight:set", settings }, { frameId: 0 }); }
      catch { ui.error("Reload this page, then try again."); }
    }
  });
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let response;
    try { response = await chrome.tabs.sendMessage(tab.id, { type: "daylight:get" }, { frameId: 0 }); }
    catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["colors.js", "ui.js", "content.js"] });
      response = await chrome.tabs.sendMessage(tab.id, { type: "daylight:get" }, { frameId: 0 });
    }
    ui.update(response.settings);
  } catch {
    root.querySelectorAll("input,button").forEach(el => el.disabled = true);
    document.querySelector("#note").textContent = "Open a regular website to use Daylight. Chrome protects its settings pages, the Web Store, and the built-in PDF viewer.";
  }
})();
