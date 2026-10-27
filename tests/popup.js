const L = require("./lib");
const T = require("./tests");

// Opens the popup as a page aimed at the test tab (?tabId=) and drives it like a mouse
// user would, checking the page's bar and canvas after each click. Also fires the
// keyboard command handler the way chrome.commands would.
(async () => {
  const { ctx, sw } = await L.launch();
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8765/fixed.html"); await L.settle(page, 500);
  await page.bringToFront();
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].id);
  const extId = sw.url().split("/")[2];
  const popup = await ctx.newPage();
  await popup.goto("chrome-extension://" + extId + "/popup.html?tabId=" + tabId); await L.settle(popup, 400);
  // The page tab must stay in front: a hidden tab gets no animation frames, so the
  // overlay canvas would never repaint. The popup tab keeps working in the background.
  await page.bringToFront();
  const text = (sel) => popup.evaluate((s) => document.querySelector(s).textContent, sel);
  const pressed = (sel) => popup.evaluate((s) => document.querySelector(s).getAttribute("aria-pressed"), sel);
  T.log("popup: opens with the bar hidden", (await text("#toggle")) === "Show the bar" && (await popup.evaluate(() => document.getElementById("note").textContent)) === "");
  await popup.click("#toggle"); await L.settle(popup, 300);
  let u = await L.ui(page);
  T.log("popup: toggle shows the bar on the page", u.hasBar && u.barHidden === false && (await text("#toggle")) === "Hide the bar", { barHidden: u.barHidden });
  await popup.click("[data-mode=pen]"); await L.settle(popup, 300);
  T.log("popup: pen pressed in popup", (await pressed("[data-mode=pen]")) === "true");
  await L.pen(page, [{ x: 300, y: 300 }, { x: 360, y: 300 }]); await L.settle(page, 100);
  T.log("popup: page draws a red pen line", T.RED(await L.pixel(page, 330, 300)));
  await popup.click("#color"); await L.settle(popup, 300);
  T.log("popup: color flips to blue", (await text("#colorLabel")) === "Blue");
  await popup.click("#thick"); await L.settle(popup, 300);
  const st1 = await sw.evaluate(async (id) => chrome.tabs.sendMessage(id, { type: "webpen-state?" }, { frameId: 0 }), tabId);
  const r2 = await L.pen(page, [{ x: 300, y: 340 }, { x: 360, y: 340 }]); await L.settle(page, 100);
  T.log("popup: thick blue line paints 3 px off centre", T.BLUE(await L.pixel(page, 330, 343)) && (await pressed("#thick")) === "true", { st1, targets: r2.map((r) => r.target).join(","), px: [await L.pixel(page, 330, 340), await L.pixel(page, 330, 342), await L.pixel(page, 330, 343)] });
  await popup.click("[data-mode=rect]"); await popup.click("#fill"); await L.settle(popup, 300);
  await L.pen(page, [{ x: 400, y: 420 }, { x: 450, y: 450 }, { x: 500, y: 480 }]); await L.settle(page, 100);
  const tint = await L.pixel(page, 450, 450);
  T.log("popup: Box and Fill draw a filled box", T.BLUE(await L.pixel(page, 450, 420)) && tint && tint[3] > 30 && tint[3] < 90 && (await pressed("[data-mode=rect]")) === "true" && (await pressed("#fill")) === "true", { tint });
  await popup.click("#undo"); await popup.click("#fill"); await popup.click("[data-mode=pen]"); await L.settle(popup, 300);
  await popup.click("#undo"); await L.settle(popup, 300);
  T.log("popup: undo removes the blue line", T.CLEAR(await L.pixel(page, 330, 340)));
  await popup.click("#clear"); await L.settle(popup, 300);
  T.log("popup: clear removes the red line", T.CLEAR(await L.pixel(page, 330, 300)));
  await popup.click("#finger"); await L.settle(popup, 300);
  const st2 = await sw.evaluate(async (id) => chrome.tabs.sendMessage(id, { type: "webpen-state?" }, { frameId: 0 }), tabId);
  const r3 = await L.pen(page, [{ x: 300, y: 380 }, { x: 360, y: 380 }], { pointerType: "mouse", pointerId: 1 }); await L.settle(page, 100);
  T.log("popup: finger mode lets the mouse draw", !T.CLEAR(await L.pixel(page, 330, 380)) && (await pressed("#finger")) === "true", { st2, targets: r3.map((r) => r.target + (r.prevented ? "!" : "")).join(","), px: await L.pixel(page, 330, 380) });
  await popup.click("#finger"); await L.settle(popup, 200);
  await popup.click("[data-mode=laser]"); await L.settle(popup, 200);
  await popup.click("#toggle"); await L.settle(popup, 300);
  u = await L.ui(page);
  T.log("popup: toggle hides the bar again", u.barHidden === true && (await text("#toggle")) === "Show the bar");

  // keyboard command: run the same handler background.js registered
  await sw.evaluate(async (tabId) => {
    const msg = { type: "webpen-cmd", cmd: "toggle" };
    await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 });
  }, tabId);
  await L.settle(page, 200);
  u = await L.ui(page);
  T.log("command: toggle message shows the bar", u.barHidden === false);
  const cmds = await sw.evaluate(async () => (await chrome.commands.getAll()).map((c) => c.name + "=" + c.shortcut));
  T.log("command: toggle-bar registered with its shortcut", cmds.some((c) => c.startsWith("toggle-bar=") && /P$/.test(c)), cmds);

  // popup on a page that refuses scripts
  const blank = await ctx.newPage();
  await blank.goto("chrome://version/"); await L.settle(blank, 300);
  await blank.bringToFront();
  const blankId = await sw.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].id);
  await popup.goto("chrome-extension://" + extId + "/popup.html?tabId=" + blankId); await L.settle(popup, 600);
  T.log("popup: browser page shows the cannot-draw note", (await popup.evaluate(() => document.getElementById("note").textContent)).startsWith("This page cannot be drawn on"));

  await ctx.close();
  process.exit(T.summary() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
