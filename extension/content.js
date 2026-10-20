// Runs in the extension's isolated world next to presenter.js, so Presenter is in
// scope here even though the page itself never sees it. The guard matters because
// background.js injects both files again when a toolbar click beats document_idle;
// a second listener would answer the same toggle and undo the first.
(function () {
  if (window.webpenBound || !window.Presenter) return;
  window.webpenBound = true;

  if (Presenter.inFrame) {
    chrome.runtime.sendMessage({ type: "webpen-state?" }).then(function (s) {
      if (s) Presenter.frameState(s);
    }, function () {});
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.type === "webpen-state") Presenter.frameState(msg.state);
    });
    return;
  }

  function report(state) {
    chrome.runtime.sendMessage({ type: "webpen-state", state: state }).catch(function () {});
  }
  Presenter.onChange(report);
  // Frames that loaded before this top frame asked for the state and got nothing.
  report(Presenter.state());

  chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
    if (!msg) return;
    if (msg.type === "webpen-toggle") {
      Presenter.toggle();
      reply({ ok: true, on: Presenter.shown() });
    } else if (msg.type === "webpen-state?") {
      reply(Presenter.state());
    }
  });
})();
