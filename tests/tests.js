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

// The fill is the pen color at FILL_ALPHA, so it passes RED too; only alpha tells it apart.
const TINT = (p) => p && p[0] > 200 && p[3] > 30 && p[3] < 90;

async function shapeTests(page, name) {
  const ox = 300, oy = 300;
  const drag = (a, b) => L.pen(page, [a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b]);
  // Every pen lift in any mode restarts the laser hold, so the note drawTests wrote at
  // y 300 is still up; let it fade before reading pixels there.
  await L.settle(page, 2600);
  // drawTests leaves the color on blue
  const blue = await page.evaluate(() => Array.from(document.querySelector(".presenter-host").shadowRoot.querySelectorAll("button")).some((b) => b.textContent.trim() === "Blue"));
  if (blue) await clickBar(page, "Blue");
  await clickBar(page, "Box");
  await drag({ x: ox, y: oy }, { x: ox + 100, y: oy + 60 });
  await L.settle(page, 100);
  log(name + ": box outline paints, inside stays empty", RED(await L.pixel(page, ox + 50, oy)) && RED(await L.pixel(page, ox + 100, oy + 30)) && CLEAR(await L.pixel(page, ox + 50, oy + 30)));
  await drag({ x: ox, y: oy + 100 }, { x: ox + 80, y: oy + 176 });
  await L.settle(page, 100);
  log(name + ": nearly even sides snap to a square", RED(await L.pixel(page, ox + 40, oy + 180)) && CLEAR(await L.pixel(page, ox + 40, oy + 176)));
  await clickBar(page, "Fill");
  await clickBar(page, "Oval");
  await drag({ x: ox + 300, y: oy + 60 }, { x: ox + 200, y: oy });
  await L.settle(page, 100);
  const centre = await L.pixel(page, ox + 250, oy + 30);
  log(name + ": oval dragged backwards, filled with a tint", RED(await L.pixel(page, ox + 200, oy + 30)) && TINT(centre) && CLEAR(await L.pixel(page, ox + 202, oy + 2)), { centre });
  await clickBar(page, "Erase");
  await L.pen(page, [{ x: ox + 250, y: oy + 30 }]);
  await L.settle(page, 100);
  log(name + ": erasing inside a filled oval removes it whole", CLEAR(await L.pixel(page, ox + 250, oy + 30)) && CLEAR(await L.pixel(page, ox + 200, oy + 30)));
  await L.pen(page, [{ x: ox + 50, y: oy + 30 }]);
  await L.settle(page, 100);
  log(name + ": erasing inside an outlined box leaves it", RED(await L.pixel(page, ox + 50, oy)));
  await L.pen(page, [{ x: ox + 50, y: oy + 4 }]);
  await L.settle(page, 100);
  const edge = [await L.pixel(page, ox + 50, oy), await L.pixel(page, ox, oy + 30), await L.pixel(page, ox + 40, oy + 180)];
  log(name + ": erasing a box edge removes the whole box", CLEAR(edge[0]) && CLEAR(edge[1]) && RED(edge[2]), { edge });
  await clickBar(page, "Undo");
  await L.settle(page, 100);
  log(name + ": undo brings the box back whole", RED(await L.pixel(page, ox + 50, oy)) && RED(await L.pixel(page, ox, oy + 30)));
  const before = await page.evaluate(() => scrollY);
  await page.evaluate(() => window.scrollBy(0, 50));
  await L.settle(page, 200);
  const after = await page.evaluate(() => scrollY);
  if (after !== before) {
    log(name + ": box moves with the page on scroll", RED(await L.pixel(page, ox + 50, oy - (after - before))) && CLEAR(await L.pixel(page, ox + 50, oy)), { before, after });
    await page.evaluate((b) => window.scrollTo(0, b), before);
    await L.settle(page, 200);
  } else log(name + ": shape scroll test skipped (page not scrollable)", true);
  // A tap in Box mode is a slip: it must leave no undo entry, so the next Undo takes back
  // the oval's erase rather than an invisible zero-size box.
  await clickBar(page, "Box");
  await L.pen(page, [{ x: ox + 500, y: oy }]);
  await clickBar(page, "Undo");
  await L.settle(page, 100);
  log(name + ": a tap in Box mode draws nothing and leaves no undo step", TINT(await L.pixel(page, ox + 250, oy + 30)) && CLEAR(await L.pixel(page, ox + 500, oy)));
  await clickBar(page, "Clear");
  await clickBar(page, "Fill");
  await L.settle(page, 100);
  const left = [await L.pixel(page, ox + 50, oy), await L.pixel(page, ox + 250, oy + 30), await L.pixel(page, ox + 40, oy + 180)];
  log(name + ": clear empties shapes", left.every(CLEAR), { left });
  await clickBar(page, "Laser");
}

async function dockBox(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".presenter-host").shadowRoot;
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), hidden: el.hidden }; };
    return { bar: r(root.querySelector(".presenter-bar")), pill: r(root.querySelector(".presenter-pill")), grip: r(root.querySelector(".presenter-grip")),
             pillText: root.querySelector(".presenter-pill").textContent, v: getComputedStyle(document.documentElement).getPropertyValue("--webpen-presenter-bar").trim(), vw: innerWidth, vh: innerHeight };
  });
}

// Synthetic pen drag that starts on a handle inside the shadow root and moves over the page.
async function penDrag(page, sel, to) {
  return page.evaluate(({ sel, to }) => {
    const h = document.querySelector(".presenter-host").shadowRoot.querySelector(sel);
    const b = h.getBoundingClientRect();
    const from = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const mk = (n, p, buttons) => new PointerEvent(n, { bubbles: true, cancelable: true, composed: true, pointerType: "pen", pointerId: 21, isPrimary: true, clientX: p.x, clientY: p.y, buttons, button: n === "pointermove" ? -1 : 0, view: window });
    h.dispatchEvent(mk("pointerdown", from, 1));
    for (let i = 1; i <= 6; i++) {
      const p = { x: from.x + (to.x - from.x) * i / 6, y: from.y + (to.y - from.y) * i / 6 };
      (document.elementFromPoint(p.x, p.y) || document.body).dispatchEvent(mk("pointermove", p, 1));
    }
    (document.elementFromPoint(to.x, to.y) || document.body).dispatchEvent(mk("pointerup", to, 0));
    return from;
  }, { sel, to });
}

async function clickShadow(page, sel) {
  await page.evaluate((sel) => document.querySelector(".presenter-host").shadowRoot.querySelector(sel).click(), sel);
  await L.settle(page, 50);
}

async function dockTests(page, name, savedState) {
  await clickBar(page, "Pen");
  let d = await dockBox(page);
  // A real mouse drag, with the pointer capture a browser applies to it.
  await page.mouse.move(d.grip.x + d.grip.w / 2, d.grip.y + d.grip.h / 2);
  await page.mouse.down();
  await page.mouse.move(d.vw / 2, d.vh / 2, { steps: 5 });
  await page.mouse.move(d.vw - 20, d.vh / 2, { steps: 5 });
  await page.mouse.up();
  await L.settle(page, 100);
  d = await dockBox(page);
  // Dropped halfway down, the tall bar reaches the bottom corner, so it reports its height.
  const reaches = d.bar.y + d.bar.h > d.vh - 80;
  log(name + ": dragging the grip to the right edge stands the bar upright there", d.bar.x + d.bar.w === d.vw - 12 && d.bar.h > d.bar.w && d.v === (reaches ? d.vh - d.bar.y : 0) + "px", { bar: d.bar, v: d.v });
  const from = await penDrag(page, ".presenter-grip", { x: 400, y: d.vh - 10 });
  await L.settle(page, 100);
  d = await dockBox(page);
  log(name + ": a pen drag on the grip lays the bar along the bottom and draws nothing", d.bar.y + d.bar.h === d.vh - 12 && d.bar.w > d.bar.h && CLEAR(await L.pixel(page, (from.x + 400) / 2, (from.y + d.vh - 10) / 2)) && d.v === (d.vh - d.bar.y) + "px", { bar: d.bar, v: d.v });
  log(name + ": the grip stays under the pen after the bar turns", Math.abs(d.grip.x + d.grip.w / 2 - 400) <= 2, { grip: d.grip });
  // The click that trails a drop is ignored for a moment, so a real tap comes later.
  await L.settle(page, 450);
  await clickShadow(page, ".presenter-grip");
  d = await dockBox(page);
  log(name + ": a tap on the grip moves the bar to the next edge (right)", d.bar.x + d.bar.w === d.vw - 12 && d.bar.h > d.bar.w, { bar: d.bar });
  await clickShadow(page, ".presenter-grip");
  d = await dockBox(page);
  log(name + ": and the next (top)", d.bar.y === 12 && d.bar.w > d.bar.h, { bar: d.bar });
  await clickBar(page, "Fold");
  d = await dockBox(page);
  log(name + ": Fold leaves one pill with the current tool at the same spot", d.bar.hidden && !d.pill.hidden && d.pill.y === 12 && /Pen/.test(d.pillText) && d.v === "0px", { pill: d.pill, text: d.pillText });
  await L.pen(page, [{ x: 300, y: 400 }, { x: 360, y: 400 }]);
  await L.settle(page, 100);
  const inked = await L.pixel(page, 330, 400);
  log(name + ": the pen keeps drawing while folded", !!inked && inked[3] > 0, { inked });
  await penDrag(page, ".presenter-pill", { x: 30, y: d.vh - 10 });
  await L.settle(page, 450);
  d = await dockBox(page);
  log(name + ": the pill drags to the bottom left and reports its height", d.pill.x === 12 && d.pill.y + d.pill.h === d.vh - 12 && d.v === (d.vh - d.pill.y) + "px", { pill: d.pill, v: d.v });
  if (savedState) {
    await page.reload(); await L.settle(page, 600);
    d = await dockBox(page);
    log(name + ": dock and fold are back after a reload", d.bar.hidden && !d.pill.hidden && d.pill.y + d.pill.h === d.vh - 12, { pill: d.pill });
  }
  await clickShadow(page, ".presenter-pill");
  d = await dockBox(page);
  log(name + ": a tap on the pill unfolds the bar where the pill was", !d.bar.hidden && d.pill.hidden && d.bar.x === 12 && d.bar.y + d.bar.h === d.vh - 12, { bar: d.bar });
  await clickBar(page, "Clear");
  await clickBar(page, "Laser");
}

function summary() {
  const fails = out.filter((o) => !o.ok).length;
  console.log("\n" + (out.length - fails) + " pass, " + fails + " fail");
  return fails;
}

module.exports = { RED, BLUE, CLEAR, TINT, log, clickBar, drawTests, shapeTests, dockTests, summary };
