// The popup mirrors the bar for mouse users. Every button sends one command to the
// tab the popup was opened on and repaints from the state the page sends back.
// ?tabId= lets a test open the popup as an ordinary page aimed at another tab.
(function () {
  var COLORS = { red: "#dc2626", blue: "#2563eb" };
  var tabId = Number(new URLSearchParams(location.search).get("tabId"));
  var note = document.getElementById("note");

  function tab() {
    if (tabId) return Promise.resolve(tabId);
    return chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
      return tabs[0] && tabs[0].id;
    });
  }

  function send(cmd, value) {
    return tab().then(function (id) {
      if (!id) return null;
      return chrome.runtime.sendMessage({ type: "webpen-popup", tabId: id, cmd: cmd, value: value });
    }).then(function (state) {
      paint(state);
      return state;
    }, function () { paint(null); });
  }

  function paint(s) {
    var blocked = !s;
    document.querySelectorAll("button").forEach(function (b) { b.disabled = blocked; });
    note.textContent = blocked ? "This page cannot be drawn on (browser pages, the Web Store, PDFs opened directly)." : "";
    if (blocked) return;
    var toggle = document.getElementById("toggle");
    toggle.textContent = s.on ? "Hide the bar" : "Show the bar";
    toggle.setAttribute("aria-pressed", String(s.on));
    document.querySelectorAll("[data-mode]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(s.on && b.dataset.mode === s.mode));
    });
    document.getElementById("swatch").style.background = COLORS[s.color];
    document.getElementById("colorLabel").textContent = s.color === "blue" ? "Blue" : "Red";
    document.getElementById("thick").setAttribute("aria-pressed", String(s.thick));
    document.getElementById("finger").setAttribute("aria-pressed", String(s.allInput));
  }

  document.getElementById("toggle").addEventListener("click", function () { send("toggle"); });
  document.querySelectorAll("[data-mode]").forEach(function (b) {
    b.addEventListener("click", function () {
      send("show").then(function () { send("set", { mode: b.dataset.mode }); });
    });
  });
  document.getElementById("color").addEventListener("click", function () {
    send("state").then(function (s) { if (s) send("set", { color: s.color === "red" ? "blue" : "red" }); });
  });
  document.getElementById("thick").addEventListener("click", function () {
    send("state").then(function (s) { if (s) send("set", { thick: !s.thick }); });
  });
  document.getElementById("finger").addEventListener("click", function () {
    send("state").then(function (s) { if (s) send("set", { allInput: !s.allInput }); });
  });
  document.getElementById("undo").addEventListener("click", function () { send("undo"); });
  document.getElementById("clear").addEventListener("click", function () { send("clear"); });

  send("state");
})();
