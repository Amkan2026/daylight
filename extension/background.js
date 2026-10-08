const defaults = { enabled: false, level: 72, warmth: 35, everywhere: false, hidden: false };
const originKey = url => {
  try { return `daylight:site:${new URL(url).origin}`; } catch { return null; }
};

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.type !== "daylight:settings") return;
  const key = originKey(sender.tab?.url);
  chrome.storage.local.get(["daylight:default", key].filter(Boolean)).then(data => {
    reply({ key, settings: { ...defaults, ...(data["daylight:default"] || {}), ...(data[key] || {}) } });
  }).catch(() => reply({ key, settings: defaults }));
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["colors.js", "ui.js", "content.js"] });
    } catch {}
  }
});
