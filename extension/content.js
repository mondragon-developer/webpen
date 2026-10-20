// Runs in the extension's isolated world next to presenter.js, so Presenter is
// in scope here even though the page itself never sees it.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== "webpen-toggle" || !window.Presenter) return;
  const bar = document.querySelector(".presenter-bar");
  if (bar && !bar.hidden) Presenter.hide();
  else Presenter.show();
  reply({ ok: true });
});
