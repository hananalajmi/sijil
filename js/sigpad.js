// لوحة رسم التوقيع بالإصبع أو القلم (Apple Pencil): خلفية شفافة، تُقص حول التوقيع وتُعاد كصورة PNG
export async function drawSignature({ modal, toast, title = "رسم التوقيع", hint = "وقّعي داخل المربع بإصبعك أو بالقلم.", saveLabel = "حفظ التوقيع", line = true }) {
  const box = document.createElement("div");
  box.innerHTML = `<p class="hint" style="margin:0 0 8px">${hint}</p>
    <div style="position:relative;border:1px dashed var(--line,#bbb);border-radius:10px;background:#fff;touch-action:none">
      <canvas id="sp-cv" style="display:block;width:100%;height:220px;touch-action:none;cursor:crosshair" aria-label="مساحة التوقيع"></canvas>
      ${line ? '<div style="position:absolute;inset-inline:24px;bottom:46px;border-bottom:1px solid #d9d4c7;pointer-events:none"></div>' : ""}</div>
    <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center">
      <label>اللون <select id="sp-col"><option value="#14254a">كحلي</option><option value="#1d4ed8">أزرق</option><option value="#111111">أسود</option></select></label>
      <label>السُّمك <select id="sp-w"><option value="2">رفيع</option><option value="3" selected>متوسط</option><option value="4.5">عريض</option></select></label>
      <button class="btn small" type="button" id="sp-undo">تراجع</button><button class="btn small ghost" type="button" id="sp-clr">مسح</button></div>`;
  const strokes = []; let cur = null, cv, g, dpr = 1;
  const setup = () => {
    cv = box.querySelector("#sp-cv"); if (!cv || !cv.clientWidth) return false;
    dpr = Math.max(2, window.devicePixelRatio || 1); cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
    g = cv.getContext("2d"); g.lineCap = g.lineJoin = "round"; redraw(); return true; };
  const seg = (s, a, b, c) => { // خط ناعم بين نقطتين بسماكة حسب ضغط القلم
    g.strokeStyle = s.col; g.lineWidth = s.w * dpr * (0.55 + (b.p ?? 0.5) * 0.9);
    g.beginPath(); g.moveTo(a.x * dpr, a.y * dpr); g.quadraticCurveTo(b.x * dpr, b.y * dpr, ((b.x + c.x) / 2) * dpr, ((b.y + c.y) / 2) * dpr); g.stroke(); };
  const drawStroke = (s) => { const P = s.pts; if (!P.length) return;
    if (P.length < 3) { g.fillStyle = s.col; g.beginPath(); g.arc(P[0].x * dpr, P[0].y * dpr, s.w * dpr * 0.6, 0, 7); g.fill(); return; }
    let a = P[0]; for (let i = 1; i < P.length - 1; i++) { seg(s, a, P[i], P[i + 1]); a = { x: (P[i].x + P[i + 1].x) / 2, y: (P[i].y + P[i + 1].y) / 2, p: P[i].p }; } };
  const redraw = () => { if (!g) return; g.clearRect(0, 0, cv.width, cv.height); strokes.forEach(drawStroke); };
  const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pointerType === "pen" && e.pressure ? e.pressure : 0.5 }; };
  const bind = () => {
    if (!setup()) return requestAnimationFrame(bind);
    cv.addEventListener("pointerdown", (e) => { e.preventDefault(); cv.setPointerCapture?.(e.pointerId);
      cur = { col: box.querySelector("#sp-col").value, w: Number(box.querySelector("#sp-w").value), pts: [pt(e)] }; strokes.push(cur); redraw(); });
    cv.addEventListener("pointermove", (e) => { if (!cur) return; e.preventDefault();
      const ev = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; for (const x of ev.length ? ev : [e]) cur.pts.push(pt(x)); redraw(); });
    const end = () => { cur = null; }; cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end); cv.addEventListener("pointerleave", end);
    box.querySelector("#sp-undo").onclick = () => { strokes.pop(); redraw(); };
    box.querySelector("#sp-clr").onclick = () => { strokes.length = 0; redraw(); };
    box.querySelector("#sp-col").onchange = (e) => { strokes.forEach((s) => (s.col = e.target.value)); redraw(); };
  };
  requestAnimationFrame(bind);
  const blob = await modal({ title, body: box, actions: [{ label: "إلغاء", value: null }, { label: saveLabel, kind: "primary", value: () => exportPng() }] });
  return blob ? new File([blob], "signature-drawn.png", { type: "image/png" }) : null;

  // قص حول الرسم بهامش صغير وتصدير PNG شفاف (يُستدعى قبل إغلاق النافذة)
  function exportPng() {
    if (!strokes.some((s) => s.pts.length)) { toast("لم يُرسم شيء"); return null; }
    const d = g.getImageData(0, 0, cv.width, cv.height).data; let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const m = Math.round(6 * dpr); x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(cv.width - 1, x1 + m); y1 = Math.min(cv.height - 1, y1 + m);
    const o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext("2d").drawImage(cv, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return new Promise((res) => o.toBlob((b) => res(b), "image/png"));
  }
}
