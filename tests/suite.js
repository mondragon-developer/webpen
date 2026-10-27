const path = require("path");
const L = require("./lib");
const T = require("./tests");
const { RED, CLEAR, log, drawTests } = T;

async function scan(page) {
  return page.evaluate(() => {
    const c = document.querySelector(".presenter-host").shadowRoot.querySelector("canvas");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0, minx = 1e9, miny = 1e9, maxx = 0, maxy = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { n++; const p = i / 4, x = p % c.width, y = (p / c.width) | 0; minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); }
    return n ? [minx, miny, maxx, maxy] : "none";
  });
}

async function penInFrame(frame, x, y, id) {
  return frame.evaluate(({ x, y, id }) => {
    const mk = (n, b, cx) => new PointerEvent(n, { bubbles: true, cancelable: true, composed: true, pointerType: "pen", pointerId: id, isPrimary: true, clientX: cx, clientY: y, buttons: b, pressure: b ? 0.5 : 0, view: window });
    const t = document.elementFromPoint(x, y) || document.body;
    t.dispatchEvent(mk("pointerdown", 1, x));
    t.dispatchEvent(mk("pointermove", 1, x + 60));
    t.dispatchEvent(mk("pointerup", 0, x + 60));
    return window.innerDowns;
  }, { x, y, id });
}

(async () => {
  const { ctx, sw } = await L.launch();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  pageerror:", e.message));

  await page.goto("http://127.0.0.1:8765/fixed.html"); await L.settle(page, 400);
  await L.toggle(sw, page); await L.settle(page);
  await drawTests(page, "fixed");
  await T.shapeTests(page, "fixed");
  // A site lifts its own bottom-left buttons with this variable, so it must follow the
  // bar's real top when the bar wraps to more rows and when only the chip is left.
  const barTop = () => page.evaluate(() => {
    const root = document.querySelector(".presenter-host").shadowRoot;
    const el = root.querySelector(".presenter-bar").hidden ? root.querySelector(".presenter-chip") : root.querySelector(".presenter-bar");
    return { css: getComputedStyle(document.documentElement).getPropertyValue("--webpen-presenter-bar").trim(), real: Math.round(innerHeight - el.getBoundingClientRect().top) + "px" };
  });
  const wide = await barTop();
  await page.setViewportSize({ width: 360, height: 740 }); await L.settle(page, 200);
  const narrow = await barTop();
  await page.setViewportSize({ width: 1200, height: 800 }); await L.settle(page, 200);
  log("fixed: --webpen-presenter-bar matches the bar's top, wide and wrapped", wide.css === wide.real && narrow.css === narrow.real && parseFloat(narrow.css) > parseFloat(wide.css), { wide, narrow });
  const hostile = await L.ui(page);
  log("fixed: bar buttons keep own style under page button css", hostile.btns.every((b) => b.h <= 40 && b.w < 120 && b.cs === "999px"), hostile.btns.map((b) => b.w + "x" + b.h).join(" "));
  await L.pen(page, [{ x: 200, y: 30 }, { x: 260, y: 30 }]); await L.settle(page, 100);
  log("fixed: laser visible over fixed header", RED(await L.pixel(page, 260, 30)));
  const pe = await page.evaluate(() => window.pageEvents.filter((x) => x !== "down:mouse" && x !== "move").length);
  const pm = await page.evaluate(() => window.pageEvents.filter((x) => x === "down:mouse").length);
  log("fixed: page document capture handlers saw the mouse but no pen", pe === 0 && pm === 1, { pen: pe, mouse: pm });
  const bb = await page.evaluate(() => { const r = document.getElementById("pagebtn").getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }; });
  await L.pen(page, [bb]); await L.settle(page, 100);
  log("fixed: laser tap presses page button", (await page.evaluate(() => document.getElementById("hits").textContent)) === "1");
  log("fixed: page canvas keeps its css", await page.evaluate(() => getComputedStyle(document.querySelector("main canvas")).borderTopWidth === "3px"));
  await L.toggle(sw, page); await L.settle(page);
  const h = await L.ui(page);
  log("fixed: toggle hides bar and canvas", h.barHidden === true && h.canvasDisplay === "none");
  const chipTop = await barTop();
  log("fixed: --webpen-presenter-bar follows the chip while the bar is hidden", chipTop.css === chipTop.real, chipTop);
  await L.injectAndToggle(sw, page); await L.settle(page);
  const h2 = await L.ui(page);
  log("fixed: toggle after a second injection still shows the bar", h2.barHidden === false, { barHidden: h2.barHidden });
  await L.toggle(sw, page); await L.settle(page);
  const h3 = await L.ui(page);
  log("fixed: and hides again", h3.barHidden === true, { barHidden: h3.barHidden });

  await page.goto("http://127.0.0.1:8765/transform.html"); await L.settle(page, 300);
  await L.toggle(sw, page); await L.settle(page);
  await page.evaluate(() => window.scrollTo(0, 600)); await L.settle(page, 200);
  const t = await L.ui(page);
  log("transform: canvas and bar stay in viewport after scroll with transformed body", t.canvas.y === 0 && t.bar.y + t.bar.h <= t.vh, { canvas: t.canvas, bar: t.bar });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.reload(); await L.settle(page, 600);
  const t2 = await L.ui(page);
  log("transform: the bar is back on after a reload, from the extension's saved state", t2.hasBar && t2.barHidden === false, { barHidden: t2.barHidden });
  await L.toggle(sw, page);

  await page.goto("http://127.0.0.1:8765/frames.html", { waitUntil: "domcontentloaded" }); await L.settle(page, 1500);
  await page.evaluate(() => { window.msgs = []; window.addEventListener("message", (e) => { if (e.data && e.data.webpen) window.msgs.push(e.data.type + "@" + e.data.x + "," + e.data.y); }); });
  await L.toggle(sw, page); await L.settle(page, 400);
  const same = page.frames().find((f) => f.url().endsWith("inner.html"));
  const sameRect = await page.evaluate(() => { const r = document.getElementById("same").getBoundingClientRect(); return { x: r.x, y: r.y }; });
  const inFrame = await penInFrame(same, 100, 100, 9);
  await L.settle(page, 150);
  log("frames: pen inside same-origin iframe draws laser on the top overlay", RED(await L.pixel(page, sameRect.x + 162, sameRect.y + 102)), { innerDowns: inFrame, msgs: await page.evaluate(() => window.msgs), painted: await scan(page) });

  // A page's own iframe forging pen messages aimed above and left of its box: without the
  // token nothing happens; with a token (a page can read its honest frames' messages) the
  // point is clamped to the frame's corner and a tap is never replayed, so the button
  // outside the frame stays unclicked.
  const btn = await page.evaluate(() => { const r = document.getElementById("topbtn").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const forge = (token) => same.evaluate(({ token, x, y }) => {
    const base = { webpen: "webpen-presenter", token, pointerType: "pen", pointerId: 99, tag: "evil", x, y };
    parent.postMessage(Object.assign({ type: "pointerdown", buttons: 1 }, base), "*");
    parent.postMessage(Object.assign({ type: "pointerup", buttons: 0 }, base), "*");
  }, { token, x: -40, y: btn.y - sameRect.y });
  await forge(undefined);
  await L.settle(page, 150);
  const clicks1 = await page.evaluate(() => window.topClicks || 0);
  log("frames: forged message without the token draws nothing and clicks nothing", clicks1 === 0 && CLEAR(await L.pixel(page, btn.x, btn.y)) && CLEAR(await L.pixel(page, sameRect.x + 3, sameRect.y + 3)), { clicks: clicks1 });
  const token = await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const s = await chrome.tabs.sendMessage(tab.id, { type: "webpen-state?" }, { frameId: 0 });
    return s && s.token;
  });
  await forge(token);
  await L.settle(page, 150);
  const clicks2 = await page.evaluate(() => window.topClicks || 0);
  log("frames: forged message with the token is clamped to the frame's box and replays no tap", typeof token === "string" && clicks2 === 0 && CLEAR(await L.pixel(page, btn.x, btn.y)) && RED(await L.pixel(page, sameRect.x + 3, sameRect.y + 3)), { clicks: clicks2, tokenLength: token && token.length });
  const crossRect = await page.evaluate(() => { const r = document.getElementById("cross").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const cross = page.frames().find((f) => f.url().includes("youtube.com"));
  if (cross) {
    try {
      await penInFrame(cross, 60, 60, 11);
      await L.settle(page, 150);
      log("frames: pen inside cross-origin iframe draws laser on the top overlay", RED(await L.pixel(page, crossRect.x + 122, crossRect.y + 62)), { msgs: await page.evaluate(() => window.msgs.length), painted: await scan(page) });
    } catch (e) { log("frames: cross-origin iframe test errored", false, e.message.slice(0, 120)); }
  } else log("frames: cross-origin iframe did not load (network?)", false);
  // In Box mode a frame must not treat its pen as a laser tap, or it would click itself.
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await chrome.tabs.sendMessage(tab.id, { type: "webpen-cmd", cmd: "set", value: { mode: "rect" } }, { frameId: 0 });
  });
  await L.settle(page, 300);
  await same.evaluate(() => { document.getElementById("innerbtn").textContent = "inner button"; });
  const ib = await same.evaluate(() => { const r = document.getElementById("innerbtn").getBoundingClientRect(); return { x: r.x + 10, y: r.y + r.height / 2 }; });
  await same.evaluate(({ x, y }) => {
    const mk = (n, b, cx, cy) => new PointerEvent(n, { bubbles: true, cancelable: true, composed: true, pointerType: "pen", pointerId: 13, isPrimary: true, clientX: cx, clientY: cy, buttons: b, pressure: b ? 0.5 : 0, view: window });
    const t = document.elementFromPoint(x, y);
    t.dispatchEvent(mk("pointerdown", 1, x, y));
    t.dispatchEvent(mk("pointermove", 1, x + 40, y + 30));
    t.dispatchEvent(mk("pointerup", 0, x + 40, y + 30));
    const u = document.elementFromPoint(x, y);
    u.dispatchEvent(mk("pointerdown", 1, x, y));
    u.dispatchEvent(mk("pointerup", 0, x, y));
  }, ib);
  await L.settle(page, 150);
  const ibText = await same.evaluate(() => document.getElementById("innerbtn").textContent);
  log("frames: a box drawn inside an iframe lands on the top overlay and a tap clicks nothing", RED(await L.pixel(page, sameRect.x + ib.x + 20, sameRect.y + ib.y + 30)) && ibText === "inner button", { ibText, painted: await scan(page) });
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await chrome.tabs.sendMessage(tab.id, { type: "webpen-cmd", cmd: "clear" }, { frameId: 0 });
    await chrome.tabs.sendMessage(tab.id, { type: "webpen-cmd", cmd: "set", value: { mode: "laser" } }, { frameId: 0 });
  });
  await L.settle(page, 300);
  // Once the notes above have faded: a CSS-scaled iframe must map its points through the
  // scale, or they land outside the frame's visible box.
  await L.settle(page, 2600);
  await page.evaluate(() => { const f = document.getElementById("same"); f.style.transformOrigin = "0 0"; f.style.transform = "scale(.5)"; });
  await L.settle(page, 100);
  await penInFrame(same, 100, 100, 12);
  await L.settle(page, 150);
  log("frames: pen inside a scaled iframe lands inside its scaled box", RED(await L.pixel(page, sameRect.x + 81, sameRect.y + 51)) && CLEAR(await L.pixel(page, sameRect.x + 162, sameRect.y + 102)), { painted: await scan(page) });
  await page.evaluate(() => { document.getElementById("same").style.transform = ""; });
  await L.toggle(sw, page);

  // A fresh tab, so the extension has no saved state for this origin. The page writes the
  // overlay's storage keys and reopens itself with ?present=1: the extension's copy must
  // stay unbuilt, and its frames must post nothing to the page.
  const p2 = await ctx.newPage();
  p2.on("pageerror", (e) => console.log("  pageerror:", e.message));
  await p2.goto("http://127.0.0.1:8765/frames.html"); await L.settle(p2, 300);
  await p2.evaluate(() => {
    const on = JSON.stringify({ on: true, mode: "laser" });
    for (const k of ["webpen-presenter", "presenter"]) { sessionStorage.setItem(k, on); sessionStorage.setItem(k + ":allowed", "1"); }
  });
  await p2.goto("http://127.0.0.1:8765/frames.html?present=1#present", { waitUntil: "domcontentloaded" }); await L.settle(p2, 1500);
  await p2.evaluate(() => { window.msgs = []; window.addEventListener("message", (e) => { if (e.data && e.data.webpen) window.msgs.push(e.data.type); }); });
  const same2 = p2.frames().find((f) => f.url().endsWith("inner.html"));
  await same2.evaluate(() => {
    for (const x of [50, 120, 130]) document.body.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, composed: true, pointerType: "mouse", pointerId: 1, clientX: x, clientY: x, buttons: 0, view: window }));
  });
  await L.settle(p2, 200);
  const seeded = await p2.evaluate(() => ({ hosts: document.querySelectorAll(".presenter-host").length, msgs: window.msgs.length }));
  log("activation: page storage and ?present=1 do not switch the extension on", seeded.hosts === 0 && seeded.msgs === 0, seeded);

  // A site that embeds presenter.js itself, with the extension installed: one overlay, the
  // page's own, and one laser tap is one click.
  await p2.route(/\/presenter\.js$/, (route) => route.fulfill({ path: path.join(__dirname, "..", "src", "presenter.js"), contentType: "application/javascript" }));
  await p2.goto("http://127.0.0.1:8765/embed.html?present=1"); await L.settle(p2, 800);
  const yielded = await L.toggle(sw, p2); await L.settle(p2, 200);
  await p2.evaluate(() => Presenter.show()); await L.settle(p2, 200);
  const eb = await p2.evaluate(() => { const r = document.getElementById("embedbtn").getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }; });
  await L.pen(p2, [eb]); await L.settle(p2, 100);
  const emb = await p2.evaluate(() => ({ hosts: document.querySelectorAll(".presenter-host").length, z: getComputedStyle(document.querySelector(".presenter-host")).zIndex, clicks: window.embedClicks || 0 }));
  log("embed: the page's own copy keeps the page and the extension yields", emb.hosts === 1 && emb.z === "5900" && !!(yielded && yielded.yielded), { emb, yielded });
  log("embed: one laser tap clicks once", emb.clicks === 1, emb);
  await p2.close();
  await page.bringToFront();

  const sites = [
    ["wikipedia", "https://en.wikipedia.org/wiki/Normal_distribution"],
    ["mdn", "https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent"],
    ["excalidraw", "https://excalidraw.com/"],
    ["geogebra", "https://www.geogebra.org/calculator"],
    ["bbc", "https://www.bbc.com/news"],
  ];
  for (const [name, url] of sites) {
    try {
      let ok = false;
      for (let i = 0; i < 3 && !ok; i++) {
        try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }); ok = true; } catch (e) { if (i === 2) throw e; await L.settle(page, 2000); }
      }
      await L.settle(page, 3000);
      await L.toggle(sw, page); await L.settle(page, 200);
      await drawTests(page, name, { x: 500, y: 400 });
      await L.toggle(sw, page);
    } catch (e) { log(name + ": errored", false, e.message.slice(0, 160)); }
  }
  await ctx.close();
  process.exit(T.summary() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
