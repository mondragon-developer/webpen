// A command goes to the top frame's content script. A page that loaded before the
// extension was installed, or whose document_idle has not come yet, has no listener,
// so the scripts are injected on demand and the command is sent again. chrome://,
// the Web Store and other extensions' pages refuse scripts; the command then fails
// quietly and the popup shows that the page cannot be drawn on.
async function command(tabId, cmd, value) {
  const msg = { type: "webpen-cmd", cmd, value };
  try {
    return await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 });
  } catch (e) {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["presenter.js", "content.js"]
    });
    return await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 });
  }
}

chrome.commands.onCommand.addListener(async (name, tab) => {
  if (name !== "toggle-bar" || !tab || !tab.id) return;
  try { await command(tab.id, "toggle"); } catch (e) {}
});

// Frames cannot see the top frame's Presenter, so state travels through here: the top
// frame reports every change to every frame of its tab, and a frame that loads later
// asks the top frame for the current state. The popup uses the same channel to send
// commands to the tab it was opened on.
// Only this extension's own contexts reach onMessage, so these checks cost nothing and
// keep each message type on the path it was designed for: state comes from the top
// frame alone, and only an extension page (the popup, or a test that opens it as a
// tab) may aim a command at an arbitrary tab.
function fromExtensionPage(sender) {
  return typeof sender.url === "string" && sender.url.indexOf(chrome.runtime.getURL("")) === 0;
}

// The top frame's last state is kept per tab and origin, the same scope sessionStorage
// had, so the bar stays on from page to page of a site. storage.session is out of reach
// of content scripts by default and is emptied when the browser closes.
function savedKey(sender) {
  let origin = sender.origin;
  if (!origin) try { origin = new URL(sender.url).origin; } catch (e) { origin = ""; }
  return "tab" + sender.tab.id + " " + origin;
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const prefix = "tab" + tabId + " ";
  const all = await chrome.storage.session.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(prefix));
  if (keys.length) await chrome.storage.session.remove(keys);
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg) return;
  if (msg.type === "webpen-state" && sender.tab && sender.frameId === 0) {
    chrome.tabs.sendMessage(sender.tab.id, { type: "webpen-state", state: msg.state }).catch(() => {});
    chrome.storage.session.set({ [savedKey(sender)]: msg.state }).catch(() => {});
  } else if (msg.type === "webpen-saved?" && sender.tab && sender.frameId === 0) {
    const key = savedKey(sender);
    chrome.storage.session.get(key).then((r) => reply(r[key] || null), () => reply(null));
    return true;
  } else if (msg.type === "webpen-state?" && sender.tab) {
    chrome.tabs.sendMessage(sender.tab.id, { type: "webpen-state?" }, { frameId: 0 }).then(reply, () => reply(null));
    return true;
  } else if (msg.type === "webpen-popup" && typeof msg.tabId === "number" && fromExtensionPage(sender)) {
    command(msg.tabId, msg.cmd, msg.value).then(reply, () => reply(null));
    return true;
  }
});
