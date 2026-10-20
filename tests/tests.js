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

function summary() {
  const fails = out.filter((o) => !o.ok).length;
  console.log("\n" + (out.length - fails) + " pass, " + fails + " fail");
  return fails;
}

module.exports = { RED, BLUE, CLEAR, log, clickBar, drawTests, summary };
