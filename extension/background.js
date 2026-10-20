// Toolbar button: ask the page's content script to toggle the bar. A page that
// loaded before the extension was installed has no content script yet, so the
// scripts are injected on demand and the toggle is sent again.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "webpen-toggle" });
  } catch (e) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["presenter.js", "content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "webpen-toggle" });
  }
});
