/* Presenter overlay for live classes taught from a tablet.
   Zoom shares pixels only, so a pencil hovering over a shared lesson is invisible to
   students unless the page itself draws it. This script loads on every lesson and does
   nothing for students. It shows a small "Pointer" chip when the page is opened with
   ?present=1 (or #present), or when the engine's Session reports instructor walkthrough
   or an instructor account; the chip opens a tool bar: Laser, Mark, Pen, Erase, Clear,
   Finger, Hide.

   Drop-in: this file is self-contained (it injects its own styles, needs no library and
   no other file). On another site add <script src="presenter.js"></script> and open the
   page with ?present=1, or call Presenter.show() from the page's own instructor check.
   The window.Session hook below is the only thing specific to these lessons and is
   ignored when absent. Class names are prefixed "presenter-" and z-index starts at 5900;
   adjust STYLES if the host page sits higher.

   Input rule: a pen (Apple Pencil, pointerType "pen") is captured in every mode, so it
   never scrolls or selects; fingers keep working the lesson underneath. In Mark and Pen
   modes the pen draws. In Laser mode a pen drag only moves the dot, and a quick tap
   (under TAP_MOVE px and TAP_TIME ms) is replayed as a click on whatever sits under it,
   so the instructor can point at a button and press it with the same pencil; sliders,
   scrolling and text selection stay with the finger. Pencil hover (iPadOS 16.4+) moves
   the laser without touching. A mouse moves the laser on hover but clicks through, so
   the overlay is usable from a computer too. "Finger" makes every input draw, for tablets without a pen;
   while it is on, the lesson cannot be tapped. Settings persist for the tab, so moving
   between lessons keeps the bar on.

   Geometry rule: everything is measured against the visual viewport, never the layout
   viewport. iPad Safari pins position: fixed boxes to the layout viewport, while a pinch
   zoom, a Stage Manager resize or Safari's own bars move the visual viewport inside it;
   a canvas sized from innerWidth/innerHeight then drifts away from the pencil and the bar
   ends up off screen. The canvas and the bar are translated to the visual viewport's
   corner on every viewport change, and strokes are kept in page coordinates (pageX/pageY),
   which every engine reports from the document origin regardless of zoom.

   Laser trail rule: the laser doubles as a scratch pen. Every pressed stroke stays on
   screen while the instructor keeps writing, lifts included, so "12 + 7 = 19" can be
   written stroke by stroke; once nothing has touched the screen for LASER_HOLD ms the
   whole note fades out together over LIFT_FADE ms. A hovering pencil or a mouse has
   nothing to lift, so that trail fades point by point after LASER_LIFE ms instead, and
   hovering does not keep a note alive. */
(function () {
  if (window.Presenter) return;

  var STORE = "presenter";
  var LASER_LIFE = 1200; // ms a hover trail point stays visible; long enough to survive Zoom's low frame rate
  var LASER_HOLD = 2000; // ms the laser notes stay after the last lift before they fade
  var LIFT_FADE = 300; // ms the notes take to vanish once the hold is over
  var HOVER_IDLE = 1500;
  var MAX_TRACE = 12000; // pressed trace points; coalesced pen events add several per frame
  var ERASE_RADIUS = 14; // px around the eraser point; a stroke's half width is added on top

  /* Lessons style bare canvas elements for their charts (white background, border, width
     100%), so every property that could paint over the page is pinned here. The canvas and
     the dock get size and translate from the script; inset: 0 or 100vh would drift on iPad
     Safari after a pinch zoom or window resize. The bar sits bottom-left because this
     site's proctor chip owns the bottom-right corner. */
  var STYLES = [
    "canvas.presenter-canvas{position:fixed;left:0;top:0;transform-origin:0 0;z-index:2147483000;",
    "pointer-events:none;display:none;margin:0;padding:0;border:0;border-radius:0;",
    "background:transparent;box-shadow:none;max-width:none;max-height:none}",
    "canvas.presenter-canvas-on{display:block}",
    "canvas.presenter-canvas-capture{pointer-events:auto;touch-action:none}",
    ".presenter-dock{position:fixed;left:0;top:0;transform-origin:0 0;z-index:2147483001;pointer-events:none}",
    ".presenter-chip,.presenter-bar{position:absolute;left:12px;bottom:12px;pointer-events:auto;",
    "font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
    ".presenter-chip{padding:6px 12px;border:0;border-radius:999px;background:#0f172a;color:#e2e8f0;",
    "cursor:pointer;opacity:.55;box-shadow:0 4px 14px rgba(0,0,0,.25)}",
    ".presenter-chip:hover,.presenter-chip:focus-visible{opacity:1}",
    ".presenter-bar{display:flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:20px;",
    "max-width:calc(100vw - 24px);background:rgba(15,23,42,.92);box-shadow:0 4px 14px rgba(0,0,0,.25)}",
    ".presenter-btn{min-width:44px;min-height:32px;padding:4px 10px;border:0;border-radius:999px;",
    "background:transparent;color:#e2e8f0;font:inherit;cursor:pointer;touch-action:manipulation}",
    ".presenter-btn:hover,.presenter-btn:focus-visible{background:#334155}",
    ".presenter-active{background:#dc2626;color:#fff}",
    ".presenter-active:hover,.presenter-active:focus-visible{background:#b91c1c}",
    ".presenter-swatch{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;",
    "vertical-align:-1px;box-shadow:0 0 0 1.5px #e2e8f0}",
    ".presenter-chip[hidden],.presenter-bar[hidden]{display:none}",
    "@media print{.presenter-canvas,.presenter-dock{display:none!important}}"
  ].join("");
  var MAX_PIXELS = 16777216; // backing store cap; older iOS refuses larger canvases and zoom multiplies the size
  var TAP_MOVE = 10; // px of pencil travel that still counts as a tap in Laser mode
  var TAP_TIME = 500; // ms
  var PEN_COLORS = { red: "#dc2626", blue: "#2563eb" };
  var MAX_UNDO = 40;
  var state = { on: false, mode: "laser", allInput: false, color: "red", thick: false };
  var allowed = false;
  var strokes = [];
  var undoStack = []; // stroke lists as they were before each stroke, erase or clear, for Undo
  var eraseSnap = null; // strokes before the current erase gesture, kept until it changes something
  var laser = [];
  var current = null;
  var activePointer = null;
  var tap = null;
  var eraser = null;
  var released = 0; // performance.now() when the last pressed trace was lifted
  var dirty = true;
  var raf = 0;
  var lastHover = 0;
  var canvas, ctx, dock, chip, bar;
  var vp = { x: 0, y: 0, w: 1, h: 1, pageX: 0, pageY: 0, scale: 1 };
  var px = 1;

  try {
    var saved = JSON.parse(sessionStorage.getItem(STORE) || "null");
    if (saved && typeof saved === "object") {
      state.on = !!saved.on;
      state.mode = /^(mark|pen|erase)$/.test(saved.mode) ? saved.mode : "laser";
      state.allInput = !!saved.allInput;
      state.color = saved.color === "blue" ? "blue" : "red";
      state.thick = !!saved.thick;
    }
    allowed = sessionStorage.getItem(STORE + ":allowed") === "1";
  } catch (e) {}

  function persist() {
    try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
  }

  function urlFlag() {
    return /[?&]present=1(&|$)/.test(location.search) || location.hash === "#present";
  }

  function sessionFlag() {
    var s = window.Session;
    return !!(s && typeof s === "object" && (s.walkthrough || s.instructor));
  }

  /* ---- UI ---- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function button(label, title, onTap) {
    var b = el("button", "presenter-btn", label);
    b.type = "button";
    b.title = title;
    b.addEventListener("click", onTap);
    return b;
  }

  var modeButtons = {};
  var fingerButton, colorButton, colorSwatch, colorLabel, thickButton;

  function build() {
    var style = el("style");
    style.textContent = STYLES;
    document.head.appendChild(style);

    canvas = el("canvas", "presenter-canvas");
    canvas.setAttribute("aria-hidden", "true");
    ctx = canvas.getContext("2d");

    chip = button("Pointer", "Show the presenter tools", function () { setOn(true); });
    chip.className = "presenter-chip presenter-ui";

    bar = el("div", "presenter-bar presenter-ui");
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Presenter tools");
    modeButtons.laser = button("Laser", "Red dot with a fading trail", function () { setMode("laser"); });
    modeButtons.mark = button("Mark", "Translucent highlighter, stays until Clear", function () { setMode("mark"); });
    modeButtons.pen = button("Pen", "Line that stays until Clear; color and thickness from the next two buttons", function () { setMode("pen"); });
    colorButton = button("", "Pen color: tap to switch between red and blue", function () {
      setColor(state.color === "red" ? "blue" : "red");
    });
    colorSwatch = el("span", "presenter-swatch");
    colorLabel = el("span");
    colorButton.appendChild(colorSwatch);
    colorButton.appendChild(colorLabel);
    thickButton = button("Thick", "Thicker pen and highlighter", function () { setThick(!state.thick); });
    modeButtons.erase = button("Erase", "Rub out part of a mark or line", function () { setMode("erase"); });
    fingerButton = button("Finger", "Draw with fingers too (the lesson cannot be tapped while on)", function () {
      setAllInput(!state.allInput);
    });
    bar.appendChild(modeButtons.laser);
    bar.appendChild(modeButtons.mark);
    bar.appendChild(modeButtons.pen);
    bar.appendChild(colorButton);
    bar.appendChild(thickButton);
    bar.appendChild(modeButtons.erase);
    bar.appendChild(button("Undo", "Take back the last stroke, erase or clear", undo));
    bar.appendChild(button("Clear", "Erase every mark and line", clear));
    bar.appendChild(fingerButton);
    bar.appendChild(button("Hide", "Hide the tools and the overlay", function () { setOn(false); }));

    dock = el("div", "presenter-dock");
    dock.appendChild(chip);
    dock.appendChild(bar);
    document.body.appendChild(canvas);
    document.body.appendChild(dock);

    layout();
    window.addEventListener("resize", layout);
    window.addEventListener("scroll", layout, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", layout);
      window.visualViewport.addEventListener("scroll", layout);
    }
    bindInput();
    render();
  }

  function render() {
    chip.hidden = state.on;
    bar.hidden = !state.on;
    canvas.classList.toggle("presenter-canvas-on", state.on);
    canvas.classList.toggle("presenter-canvas-capture", state.on && state.allInput);
    Object.keys(modeButtons).forEach(function (m) {
      modeButtons[m].classList.toggle("presenter-active", state.mode === m);
      modeButtons[m].setAttribute("aria-pressed", String(state.mode === m));
    });
    fingerButton.classList.toggle("presenter-active", state.allInput);
    fingerButton.setAttribute("aria-pressed", String(state.allInput));
    colorSwatch.style.background = PEN_COLORS[state.color];
    colorLabel.textContent = state.color === "red" ? "Red" : "Blue";
    thickButton.classList.toggle("presenter-active", state.thick);
    thickButton.setAttribute("aria-pressed", String(state.thick));
    dirty = true;
    schedule();
  }

  function setOn(on) {
    state.on = on;
    if (!on) { laser = []; current = null; activePointer = null; }
    persist();
    render();
  }

  function setMode(mode) {
    state.mode = mode;
    current = null;
    eraser = null;
    persist();
    render();
  }

  function setAllInput(v) {
    state.allInput = v;
    persist();
    render();
  }

  function setColor(c) {
    state.color = c;
    persist();
    render();
  }

  function setThick(v) {
    state.thick = v;
    persist();
    render();
  }

  function strokeWidth(mode) {
    if (mode === "mark") return state.thick ? 34 : 22;
    return state.thick ? 7 : 3.5;
  }

  function remember(list) {
    undoStack.push(list);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  function undo() {
    if (!undoStack.length) return;
    strokes = undoStack.pop();
    current = null;
    eraseSnap = null;
    dirty = true;
    schedule();
  }

  function clear() {
    if (strokes.length) remember(strokes);
    strokes = [];
    current = null;
    dirty = true;
    schedule();
  }

  function viewport() {
    var v = window.visualViewport;
    if (v && v.width) {
      return { x: v.offsetLeft, y: v.offsetTop, w: v.width, h: v.height,
               pageX: v.pageLeft, pageY: v.pageTop, scale: v.scale || 1 };
    }
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight,
             pageX: window.scrollX, pageY: window.scrollY, scale: 1 };
  }

  function layout() {
    vp = viewport();
    var w = Math.max(1, Math.round(vp.w));
    var h = Math.max(1, Math.round(vp.h));
    px = Math.min((window.devicePixelRatio || 1) * vp.scale, Math.sqrt(MAX_PIXELS / (w * h)));
    var bw = Math.round(w * px);
    var bh = Math.round(h * px);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    dock.style.width = w + "px";
    dock.style.height = h + "px";
    var shift = "translate(" + vp.x + "px, " + vp.y + "px)";
    canvas.style.transform = shift;
    dock.style.transform = shift;
    dirty = true;
    schedule();
  }

  /* ---- Input ---- */

  function isUi(e) {
    return !!(e.target && e.target.closest && e.target.closest(".presenter-ui"));
  }

  function draws(e) {
    return state.on && !isUi(e) && (state.allInput || e.pointerType === "pen");
  }

  function hovers(e) {
    return state.on && state.mode === "laser" && !isUi(e) && e.buttons === 0 &&
      (e.pointerType === "pen" || e.pointerType === "mouse");
  }

  /* The pen never reaches the lesson, so a Laser-mode tap is replayed as a click on the
     element under it. The canvas has pointer-events: none here, so elementFromPoint skips
     it. Only click and focus are replayed: that works for buttons, links, checkboxes,
     radios and text fields, not for sliders or selects, which keep needing a finger. */
  function tapThrough(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el || (el.closest && el.closest(".presenter-ui"))) return;
    if (typeof el.focus === "function") {
      try { el.focus({ preventScroll: true }); } catch (err) { el.focus(); }
    }
    if (typeof el.click === "function") el.click();
  }

  function docPoint(e) {
    return { x: e.pageX, y: e.pageY };
  }

  function addLaser(e, pressed, start) {
    laser.push({ x: e.pageX, y: e.pageY, t: performance.now(), pressed: !!pressed, start: !!start });
    if (laser.length > MAX_TRACE) laser.shift();
    lastHover = performance.now();
    dirty = true;
    schedule();
  }

  function pointsOf(e) {
    var list = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : null;
    return list && list.length ? list : [e];
  }

  function segmentDistance(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var l2 = dx * dx + dy * dy;
    var t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y);
  }

  /* Removes every point whose neighbouring segments pass within the eraser and splits the
     stroke into the runs that remain. Segments are tested, not just points, because a fast
     pen stroke leaves gaps of tens of px between samples. Lone points left by a split are
     dropped so the eraser does not leave dots behind. */
  function eraseAt(p) {
    var out = [];
    var changed = false;
    for (var s = 0; s < strokes.length; s++) {
      var st = strokes[s];
      var pts = st.pts;
      var r = ERASE_RADIUS + (st.width || strokeWidth(st.mode)) / 2;
      var hit = [];
      var any = false;
      for (var i = 0; i < pts.length; i++) {
        var h = pts.length === 1
          ? Math.hypot(pts[0].x - p.x, pts[0].y - p.y) < r
          : (i > 0 && segmentDistance(p, pts[i - 1], pts[i]) < r) ||
            (i + 1 < pts.length && segmentDistance(p, pts[i], pts[i + 1]) < r);
        hit.push(h);
        if (h) any = true;
      }
      if (!any) { out.push(st); continue; }
      changed = true;
      var run = [];
      for (var k = 0; k <= pts.length; k++) {
        if (k < pts.length && !hit[k]) { run.push(pts[k]); continue; }
        if (run.length > 1) out.push({ mode: st.mode, color: st.color, width: st.width, pts: run });
        run = [];
      }
    }
    if (changed) {
      if (eraseSnap) { remember(eraseSnap); eraseSnap = null; }
      strokes = out;
    }
    return changed;
  }

  function onDown(e) {
    if (!draws(e)) return;
    e.preventDefault();
    e.stopPropagation();
    activePointer = e.pointerId;
    tap = null;
    if (state.mode === "laser") {
      addLaser(e, true, true);
      if (!state.allInput) tap = { x: e.clientX, y: e.clientY, t: performance.now() };
      return;
    }
    if (state.mode === "erase") {
      eraser = docPoint(e);
      eraseSnap = strokes;
      eraseAt(eraser);
      dirty = true;
      schedule();
      return;
    }
    current = {
      mode: state.mode,
      color: state.mode === "pen" ? PEN_COLORS[state.color] : "#facc15",
      width: strokeWidth(state.mode),
      pts: [docPoint(e)]
    };
    remember(strokes);
    strokes = strokes.concat([current]);
    dirty = true;
    schedule();
  }

  function onMove(e) {
    if (activePointer !== null && e.pointerId === activePointer) {
      e.preventDefault();
      e.stopPropagation();
      var pts = pointsOf(e);
      if (state.mode === "erase") {
        for (var m = 0; m < pts.length; m++) { eraser = docPoint(pts[m]); eraseAt(eraser); }
        dirty = true;
        schedule();
        return;
      }
      if (state.mode === "laser" || !current) {
        for (var j = 0; j < pts.length; j++) addLaser(pts[j], true);
        if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_MOVE) tap = null;
        return;
      }
      for (var i = 0; i < pts.length; i++) current.pts.push(docPoint(pts[i]));
      dirty = true;
      schedule();
      return;
    }
    if (hovers(e)) {
      if (e.pointerType === "pen") e.preventDefault();
      addLaser(e);
    }
  }

  function onUp(e) {
    if (activePointer === null || e.pointerId !== activePointer) return;
    if (draws(e)) { e.preventDefault(); e.stopPropagation(); }
    activePointer = null;
    current = null;
    eraser = null;
    eraseSnap = null;
    released = performance.now();
    dirty = true;
    schedule();
    var t = tap;
    tap = null;
    if (t && e.type === "pointerup" && performance.now() - t.t < TAP_TIME) tapThrough(t.x, t.y);
  }

  /* Safari synthesizes scrolling, text selection and click from touch events, not pointer
     events, so a stylus touch has to be cancelled here too or the pencil scrolls the page. */
  function onTouch(e) {
    if (!state.on || isUi(e)) return;
    if (state.allInput) { e.preventDefault(); return; }
    var touches = e.changedTouches || e.touches;
    for (var i = 0; i < touches.length; i++) {
      if (touches[i].touchType === "stylus") { e.preventDefault(); return; }
    }
  }

  function bindInput() {
    var cap = { capture: true, passive: false };
    document.addEventListener("pointerdown", onDown, cap);
    document.addEventListener("pointermove", onMove, cap);
    document.addEventListener("pointerup", onUp, cap);
    document.addEventListener("pointercancel", onUp, cap);
    document.addEventListener("touchstart", onTouch, cap);
    document.addEventListener("touchmove", onTouch, cap);
    document.addEventListener("selectstart", function (e) {
      if (activePointer !== null) e.preventDefault();
    }, true);
  }

  /* ---- Drawing ---- */

  function schedule() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function frame() {
    raf = 0;
    if (!state.on) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    var now = performance.now();
    var before = laser.length;
    laser = laser.filter(function (p) {
      if (p.pressed) return activePointer !== null || now - released < LASER_HOLD + LIFT_FADE;
      return now - p.t <= LASER_LIFE;
    });
    // Points that just expired must be painted away even when nothing else changed,
    // or a throttled tab (1 Hz in the background) keeps the last trail on screen.
    if (laser.length !== before) dirty = true;
    var liveLaser = laser.length > 0;
    if (dirty || liveLaser) paint(now);
    dirty = false;
    if (liveLaser) schedule();
  }

  function paint(now) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.setTransform(px, 0, 0, px, 0, 0);
    ctx.translate(-vp.pageX, -vp.pageY);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (var s = 0; s < strokes.length; s++) drawStroke(strokes[s]);
    if (eraser) drawEraser();
    if (laser.length) drawLaser(now);
  }

  function drawEraser() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(eraser.x, eraser.y, ERASE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(15, 23, 42, 0.7)";
    ctx.stroke();
    ctx.restore();
  }

  function drawStroke(st) {
    var pts = st.pts;
    if (!pts.length) return;
    if (st.mode === "mark") {
      ctx.globalCompositeOperation = "multiply";
      ctx.strokeStyle = "rgba(250, 204, 21, 0.55)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = st.color || PEN_COLORS.red;
    }
    ctx.lineWidth = st.width || strokeWidth(st.mode);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 1) ctx.lineTo(pts[0].x + 0.1, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  function drawLaser(now) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    var since = now - released;
    var lift = activePointer !== null || since < LASER_HOLD ? 1 : 1 - (since - LASER_HOLD) / LIFT_FADE;
    for (var i = 1; i < laser.length; i++) {
      if (laser[i].start) continue;
      var a = laser[i].pressed ? lift : 1 - (now - laser[i].t) / LASER_LIFE;
      if (a <= 0) continue;
      ctx.strokeStyle = "rgba(239, 68, 68, " + (a * 0.6).toFixed(3) + ")";
      ctx.lineWidth = 2 + 6 * a;
      ctx.beginPath();
      ctx.moveTo(laser[i - 1].x, laser[i - 1].y);
      ctx.lineTo(laser[i].x, laser[i].y);
      ctx.stroke();
    }
    var head = laser[laser.length - 1];
    var idle = now - lastHover;
    var headAlpha = idle > HOVER_IDLE ? Math.max(0, 1 - (idle - HOVER_IDLE) / 600) : 1;
    if (head.pressed) headAlpha = Math.max(0, lift);
    if (headAlpha > 0) {
      ctx.globalAlpha = headAlpha;
      var glow = ctx.createRadialGradient(head.x, head.y, 2, head.x, head.y, 26);
      glow.addColorStop(0, "rgba(239, 68, 68, 0.55)");
      glow.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(head.x, head.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.beginPath();
      ctx.arc(head.x - 2, head.y - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---- Activation ---- */

  function enable() {
    if (allowed && canvas) return;
    allowed = true;
    try { sessionStorage.setItem(STORE + ":allowed", "1"); } catch (e) {}
    if (!canvas) build();
  }

  function init() {
    if (allowed || urlFlag()) { enable(); return; }
    if (sessionFlag()) { enable(); return; }
    var tries = 0;
    var timer = setInterval(function () {
      if (sessionFlag()) { clearInterval(timer); enable(); }
      else if (++tries > 7200) clearInterval(timer);
    }, 1000);
  }

  window.Presenter = {
    enable: enable,
    show: function () { enable(); setOn(true); },
    hide: function () { if (canvas) setOn(false); },
    clear: function () { if (canvas) clear(); },
    undo: function () { if (canvas) undo(); },
    viewport: function () { return vp; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
