// Toolbar button: ask the top frame's content script to toggle the bar. A page that
// loaded before the extension was installed, or whose document_idle has not come yet,
// has no listener, so the scripts are injected on demand and the toggle is sent again.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "webpen-toggle" }, { frameId: 0 });
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["presenter.js", "content.js"]
      });
      await chrome.tabs.sendMessage(tab.id, { type: "webpen-toggle" }, { frameId: 0 });
    } catch (err) {
      // chrome://, the Web Store and other extensions' pages refuse scripts.
    }
  }
});

// Frames cannot see the top frame's Presenter, so state travels through here: the top
// frame reports every change to every frame of its tab, and a frame that loads later
// asks the top frame for the current state.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || !sender.tab) return;
  if (msg.type === "webpen-state") {
    chrome.tabs.sendMessage(sender.tab.id, { type: "webpen-state", state: msg.state }).catch(() => {});
  } else if (msg.type === "webpen-state?") {
    chrome.tabs.sendMessage(sender.tab.id, { type: "webpen-state?" }, { frameId: 0 }).then(reply, () => reply(null));
    return true;
  }
});
