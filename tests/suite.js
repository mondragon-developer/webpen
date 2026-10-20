const L = require("./lib");
const RED = (p) => p && p[0] > 200 && p[1] < 100 && p[3] > 0;
const BLUE = (p) => p && p[2] > 200 && p[0] < 100 && p[3] > 0;
const CLEAR = (p) => p && p[3] === 0;
const out = [];
const log = (name, ok, info) => { out.push({ name, ok, info }); console.log((ok ? "PASS " : "FAIL ") + name + (info ? "  " + JSON.stringify(info) : "")); };

async function clickBar(page, label) {
  await page.evaluate((label) => {
    const q = (s) => document.querySelector(s) || (document.querySelector(".presenter-host") && document.querySelector(".presenter-host").shadowRoot.querySelector(s));
    const b = Array.from(q(".presenter-bar").querySelectorAll("button")).find((x) => x.textContent.trim().startsWith(label));
    b.click();
  }, label);
  await L.settle(page, 50);
}

async function drawTests(page, name, origin) {
  const ox = origin ? origin.x : 300, oy = origin ? origin.y : 300;
  const u0 = await L.ui(page);
  log(name + ": bar shown inside viewport", u0.hasBar && !u0.barHidden && u0.bar.y + u0.bar.h <= u0.vh && u0.bar.x >= 0, { bar: u0.bar, vh: u0.vh, btns: u0.btns.map((b) => b.w + "x" + b.h + "/" + b.cs).join(" ") });
  log(name + ": canvas covers viewport", u0.canvas && u0.canvas.x === 0 && u0.canvas.y === 0 && u0.canvas.w === u0.vw && u0.canvas.h === u0.vh, u0.canvas);
  const r1 = await L.pen(page, [{ x: ox, y: oy }, { x: ox + 30, y: oy }, { x: ox + 60, y: oy }]);
  await L.settle(page, 100);
  log(name + ": laser pen stroke paints", RED(await L.pixel(page, ox + 60, oy)), { targets: r1.map((r) => r.target + (r.prevented ? "!" : "")).join(",") });
  await clickBar(page, "Pen");
  await L.pen(page, [{ x: ox, y: oy + 40 }, { x: ox + 60, y: oy + 40 }]);
  await L.settle(page, 100);
  log(name + ": pen red paints", RED(await L.pixel(page, ox + 30, oy + 40)));
  await clickBar(page, "Red");
  await L.pen(page, [{ x: ox, y: oy + 80 }, { x: ox + 60, y: oy + 80 }]);
  await L.settle(page, 100);
  log(name + ": pen blue paints", BLUE(await L.pixel(page, ox + 30, oy + 80)));
  await L.pen(page, [{ x: ox, y: oy + 120 }, { x: ox + 60, y: oy + 120 }], { pointerType: "mouse", pointerId: 1 });
  await L.settle(page, 100);
  log(name + ": mouse does not draw", CLEAR(await L.pixel(page, ox + 30, oy + 120)));
  await clickBar(page, "Erase");
  await L.pen(page, [{ x: ox + 30, y: oy + 30 }, { x: ox + 30, y: oy + 50 }]);
  await L.settle(page, 100);
  log(name + ": erase removes red", CLEAR(await L.pixel(page, ox + 30, oy + 40)));
  await clickBar(page, "Undo");
  await L.settle(page, 100);
  log(name + ": undo restores red", RED(await L.pixel(page, ox + 30, oy + 40)));
  const before = await page.evaluate(() => scrollY);
  await page.evaluate(() => window.scrollBy(0, 50));
  await L.settle(page, 200);
  const after = await page.evaluate(() => scrollY);
  if (after !== before) {
    log(name + ": stroke moves with the page on scroll", RED(await L.pixel(page, ox + 30, oy + 40 - (after - before))) && CLEAR(await L.pixel(page, ox + 30, oy + 40)), { before, after });
    await page.evaluate((b) => window.scrollTo(0, b), before);
    await L.settle(page, 200);
  } else log(name + ": scroll test skipped (page not scrollable)", true);
  await clickBar(page, "Clear");
  await L.settle(page, 100);
  log(name + ": clear empties", CLEAR(await L.pixel(page, ox + 30, oy + 40)) && CLEAR(await L.pixel(page, ox + 30, oy + 80)));
  await clickBar(page, "Laser");
}

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
  await L.toggle(sw, page);

  await page.goto("http://127.0.0.1:8765/frames.html", { waitUntil: "domcontentloaded" }); await L.settle(page, 1500);
  await page.evaluate(() => { window.msgs = []; window.addEventListener("message", (e) => { if (e.data && e.data.webpen) window.msgs.push(e.data.type + "@" + e.data.x + "," + e.data.y); }); });
  await L.toggle(sw, page); await L.settle(page, 400);
  const same = page.frames().find((f) => f.url().endsWith("inner.html"));
  const sameRect = await page.evaluate(() => { const r = document.getElementById("same").getBoundingClientRect(); return { x: r.x, y: r.y }; });
  const inFrame = await penInFrame(same, 100, 100, 9);
  await L.settle(page, 150);
  log("frames: pen inside same-origin iframe draws laser on the top overlay", RED(await L.pixel(page, sameRect.x + 162, sameRect.y + 102)), { innerDowns: inFrame, msgs: await page.evaluate(() => window.msgs), painted: await scan(page) });
  const crossRect = await page.evaluate(() => { const r = document.getElementById("cross").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const cross = page.frames().find((f) => f.url().includes("youtube.com"));
  if (cross) {
    try {
      await penInFrame(cross, 60, 60, 11);
      await L.settle(page, 150);
      log("frames: pen inside cross-origin iframe draws laser on the top overlay", RED(await L.pixel(page, crossRect.x + 122, crossRect.y + 62)), { msgs: await page.evaluate(() => window.msgs.length), painted: await scan(page) });
    } catch (e) { log("frames: cross-origin iframe test errored", false, e.message.slice(0, 120)); }
  } else log("frames: cross-origin iframe did not load (network?)", false);
  await L.toggle(sw, page);

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
  const fails = out.filter((o) => !o.ok).length;
  console.log("\n" + (out.length - fails) + " pass, " + fails + " fail");
})().catch((e) => { console.error(e); process.exit(1); });
