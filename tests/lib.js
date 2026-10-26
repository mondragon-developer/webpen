const { chromium } = require("playwright");
const path = require("path");
const EXT = path.join(__dirname, "..", "extension");

async function launch(opts = {}) {
  // An empty path makes Playwright create a temporary profile and delete it on close.
  const ctx = await chromium.launchPersistentContext("", {
    headless: opts.headless !== false, channel: opts.channel || "chromium",
    viewport: { width: 1200, height: 800 },
    args: ["--disable-extensions-except=" + EXT, "--load-extension=" + EXT, "--no-first-run"],
  });
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent("serviceworker");
  return { ctx, sw };
}

// Without the "tabs" permission the worker cannot see tab URLs, so the harness brings
// the page to the front and the worker acts on the active tab, like a toolbar click.
async function toggle(sw, page) {
  await page.bringToFront();
  return sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) throw new Error("no active tab");
    return chrome.tabs.sendMessage(tab.id, { type: "webpen-cmd", cmd: "toggle" }, { frameId: 0 });
  });
}

// Replays background.js's catch branch (inject then toggle) against a tab that already
// has the content scripts, which is what an early click before document_idle does.
async function injectAndToggle(sw, page) {
  await page.bringToFront();
  return sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["presenter.js", "content.js"] });
    return chrome.tabs.sendMessage(tab.id, { type: "webpen-cmd", cmd: "toggle" }, { frameId: 0 });
  });
}

async function pen(page, pts, o = {}) {
  return page.evaluate(({ pts, o }) => {
    const type = o.pointerType || "pen";
    const id = o.pointerId || 7;
    const mk = (name, p, buttons, extra) => new PointerEvent(name, Object.assign({
      bubbles: true, cancelable: true, composed: true, pointerType: type, pointerId: id, isPrimary: true,
      clientX: p.x, clientY: p.y, buttons, button: name === "pointermove" ? -1 : 0, pressure: buttons ? 0.5 : 0,
      view: window,
    }, extra || {}));
    const target = (p) => document.elementFromPoint(p.x, p.y) || document.body;
    const results = [];
    const fire = (name, p, buttons) => {
      const t = target(p);
      const e = mk(name, p, buttons);
      const notCancelled = t.dispatchEvent(e);
      results.push({ name, target: t.tagName + (t.id ? "#" + t.id : "") + (t.className && typeof t.className === "string" ? "." + t.className.split(" ")[0] : ""), prevented: !notCancelled });
    };
    if (o.hover) { pts.forEach((p) => fire("pointermove", p, 0)); return results; }
    fire("pointerdown", pts[0], 1);
    for (let i = 1; i < pts.length; i++) fire("pointermove", pts[i], 1);
    fire("pointerup", pts[pts.length - 1], 0);
    return results;
  }, { pts, o });
}

async function pixel(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const c = document.querySelector("canvas.presenter-canvas") || (document.querySelector(".presenter-host") && document.querySelector(".presenter-host").shadowRoot.querySelector("canvas"));
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    const d = c.getContext("2d").getImageData(Math.round((x - r.left) * sx), Math.round((y - r.top) * sy), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }, { x, y });
}

async function ui(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s) || (document.querySelector(".presenter-host") && document.querySelector(".presenter-host").shadowRoot.querySelector(s));
    const bar = q(".presenter-bar"), chip = q(".presenter-chip"), canvas = q("canvas.presenter-canvas");
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const btns = bar ? Array.from(bar.querySelectorAll("button")).map((b) => ({ t: b.textContent, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height), cs: getComputedStyle(b).borderRadius })) : null;
    return { hasBar: !!bar, barHidden: bar ? bar.hidden : null, bar: rect(bar), chipHidden: chip ? chip.hidden : null, canvas: rect(canvas), canvasDisplay: canvas ? getComputedStyle(canvas).display : null, canvasZ: canvas ? getComputedStyle(canvas).zIndex : null, btns, vw: innerWidth, vh: innerHeight, scroll: [scrollX, scrollY] };
  });
}

async function settle(page, ms = 150) { await page.waitForTimeout(ms); }

module.exports = { launch, toggle, injectAndToggle, pen, pixel, ui, settle };
