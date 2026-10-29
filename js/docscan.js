// ماسح الورق من صورة الكاميرا: يكتشف حدود الورقة تلقائياً (مع إمكانية سحب الزوايا الأربع)،
// ثم يقوّم الصورة (تصحيح المنظور) إلى صفحة مستطيلة، ويبيّض الخلفية ويزيل الظل. كل شيء داخل المتصفح.

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("تعذّرت قراءة الصورة")); i.src = src; });

// 1) اكتشاف الزوايا: الورقة أفتح من الخلفية — عتبة «أوتسو» على صورة مصغّرة، ثم أكبر منطقة فاتحة متصلة، ثم أطرافها الأربعة
export function detectCorners(img) {
  const S = 360, k = Math.min(1, S / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(8, Math.round(img.naturalWidth * k)), h = Math.max(8, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true }); g.filter = "blur(2px)"; g.drawImage(img, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data, L = new Uint8Array(w * h), hist = new Array(256).fill(0);
  for (let i = 0; i < w * h; i++) { const v = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11) | 0; L[i] = v; hist[v]++; }
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sB = 0, wB = 0, best = 0, th = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = w * h - wB; if (!wF) break; sB += t * hist[t];
    const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = t; } }
  // أكبر منطقة فاتحة متصلة
  const lab = new Int32Array(w * h).fill(-1); let bestId = -1, bestN = 0;
  const stack = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (L[s] <= th || lab[s] !== -1) continue;
    let sp = 0, n = 0; stack[sp++] = s; lab[s] = s;
    while (sp) { const p = stack[--sp]; n++; const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (q >= 0 && lab[q] === -1 && L[q] > th) { lab[q] = s; stack[sp++] = q; } }
    if (n > bestN) { bestN = n; bestId = s; }
  }
  const fallback = () => { const m = 0.04; return [[m, m], [1 - m, m], [1 - m, 1 - m], [m, 1 - m]].map(([x, y]) => [x * img.naturalWidth, y * img.naturalHeight]); };
  if (bestId < 0 || bestN < w * h * 0.12 || bestN > w * h * 0.985) return fallback();
  let tl, tr, br, bl, a = Infinity, b = -Infinity, cc = -Infinity, d = Infinity;
  for (let p = 0; p < w * h; p++) { if (lab[p] !== bestId) continue; const x = p % w, y = (p / w) | 0;
    if (x + y < a) { a = x + y; tl = [x, y]; } if (x + y > cc) { cc = x + y; br = [x, y]; }
    if (x - y > b) { b = x - y; tr = [x, y]; } if (x - y < d) { d = x - y; bl = [x, y]; } }
  // تُقرَّب الزوايا قليلاً نحو المركز حتى لا يظهر طرف من الخلفية
  const Q = [tl, tr, br, bl].map(([x, y]) => [(x + 0.5) / k, (y + 0.5) / k]), cx = Q.reduce((a2, p) => a2 + p[0], 0) / 4, cy = Q.reduce((a2, p) => a2 + p[1], 0) / 4;
  return Q.map(([x, y]) => [x + (cx - x) * 0.012, y + (cy - y) * 0.012]);
}

// 2) تصحيح المنظور: مصفوفة التحويل من المستطيل الناتج إلى الشكل الرباعي في الصورة
function homography(src, dst) { // يحل 8 معادلات: dst = H·src
  const A = [], B = [];
  for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v); }
  for (let c = 0; c < 8; c++) { let m = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r;
    [A[c], A[m]] = [A[m], A[c]]; [B[c], B[m]] = [B[m], B[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; } }
  return B.map((b, i) => b / A[i][i]).concat(1);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function warp(img, q, { enhance = true, maxSide = 1700 } = {}) {
  let W = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2, H = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
  const r = H / W; if (r > 1.3 && r < 1.55) H = W * 1.4142; // قريبة من A4 طولية: تُضبط على A4 تماماً
  const k = Math.min(1, maxSide / Math.max(W, H)); W = Math.round(W * k); H = Math.round(H * k);
  const sc = document.createElement("canvas"); sc.width = img.naturalWidth; sc.height = img.naturalHeight;
  const sg = sc.getContext("2d", { willReadFrequently: true }); sg.drawImage(img, 0, 0);
  const S = sg.getImageData(0, 0, sc.width, sc.height).data, sw = sc.width, sh = sc.height;
  const Hm = homography([[0, 0], [W, 0], [W, H], [0, H]], q);
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const og = out.getContext("2d"), O = og.createImageData(W, H), D = O.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const z = Hm[6] * x + Hm[7] * y + 1, u = (Hm[0] * x + Hm[1] * y + Hm[2]) / z, v = (Hm[3] * x + Hm[4] * y + Hm[5]) / z;
    const xi = Math.min(sw - 2, Math.max(0, u | 0)), yi = Math.min(sh - 2, Math.max(0, v | 0)), fx = Math.min(1, Math.max(0, u - xi)), fy = Math.min(1, Math.max(0, v - yi));
    const i00 = (yi * sw + xi) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4, o = (y * W + x) * 4;
    for (let ch = 0; ch < 3; ch++) D[o + ch] = (S[i00 + ch] * (1 - fx) + S[i10 + ch] * fx) * (1 - fy) + (S[i01 + ch] * (1 - fx) + S[i11 + ch] * fx) * fy;
    D[o + 3] = 255;
  }
  og.putImageData(O, 0, 0);
  if (enhance) whiten(out);
  return out;
}
// 3) تبييض الورقة وإزالة الظل: قسمة كل بكسل على إضاءة الخلفية المحلية (نسخة مموهة جداً)
export function whiten(c) {
  const W = c.width, H = c.height, g = c.getContext("2d", { willReadFrequently: true });
  const bw = Math.max(8, Math.round(W / 24)), bh = Math.max(8, Math.round(H / 24));
  const b = document.createElement("canvas"); b.width = bw; b.height = bh; const bg = b.getContext("2d", { willReadFrequently: true });
  bg.filter = "blur(2px)"; bg.drawImage(c, 0, 0, bw, bh);
  // الخلفية = أفتح القيم حول كل نقطة (حتى لا يُحسب الحبر خلفية)
  const small = bg.getImageData(0, 0, bw, bh), sd = small.data, mx = new Uint8ClampedArray(sd.length);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) for (let ch = 0; ch < 3; ch++) { let m = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = Math.min(bw - 1, Math.max(0, x + dx)), yy = Math.min(bh - 1, Math.max(0, y + dy)); m = Math.max(m, sd[(yy * bw + xx) * 4 + ch]); }
    mx[(y * bw + x) * 4 + ch] = m; }
  for (let i = 3; i < mx.length; i += 4) mx[i] = 255;
  bg.putImageData(new ImageData(mx, bw, bh), 0, 0);
  const big = document.createElement("canvas"); big.width = W; big.height = H; const gg = big.getContext("2d", { willReadFrequently: true });
  gg.imageSmoothingQuality = "high"; gg.drawImage(b, 0, 0, W, H);
  const P = g.getImageData(0, 0, W, H), d = P.data, B = gg.getImageData(0, 0, W, H).data;
  for (let i = 0; i < d.length; i += 4) for (let ch = 0; ch < 3; ch++) { const v = (d[i + ch] / Math.max(40, B[i + ch])) * 255; d[i + ch] = v > 235 ? 255 : v < 30 ? v * 0.8 : v; }
  g.putImageData(P, 0, 0);
}

// 4) نافذة القص: الصورة مع أربع زوايا قابلة للسحب، وخيار التحسين. تعيد لوحة الصفحة المقوّمة أو null
export async function scanDialog(file, { modal, toast }) {
  const url = URL.createObjectURL(file); let img;
  try { img = await loadImg(url); } catch (e) { toast(e.message, "error"); return null; }
  let q = detectCorners(img);
  const box = document.createElement("div");
  box.innerHTML = `<p class="hint" style="margin-top:0">حددنا حدود الورقة تلقائياً. اسحبي النقاط الأربع إلى زوايا الورقة إن احتاجت تعديلاً.</p>
    <div class="scan-stage" style="position:relative;touch-action:none;user-select:none;max-width:100%;margin:auto">
      <img src="${url}" alt="الصورة" style="display:block;width:100%;height:auto;pointer-events:none">
      <svg class="scan-svg" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible"><polygon fill="rgba(31,111,235,.15)" stroke="#1f6feb" stroke-width="2"></polygon></svg>
      ${[0, 1, 2, 3].map((i) => `<span class="scan-h" data-i="${i}" style="position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#fff;border:3px solid #1f6feb;box-shadow:0 1px 4px rgba(0,0,0,.4);touch-action:none;cursor:grab"></span>`).join("")}
    </div>
    <div class="row" style="gap:10px;margin-top:10px;flex-wrap:wrap;align-items:center">
      <label class="row" style="gap:6px"><input type="checkbox" id="sc-en" checked> تبييض الورقة وإزالة الظل</label>
      <button class="btn small" type="button" id="sc-auto">تحديد تلقائي</button><button class="btn small ghost" type="button" id="sc-full">الصورة كاملة</button></div>`;
  const stage = box.querySelector(".scan-stage"), poly = box.querySelector("polygon"), hs = [...box.querySelectorAll(".scan-h")];
  const sx = () => stage.clientWidth / img.naturalWidth;
  const paint = () => { const s = sx(); hs.forEach((h, i) => { h.style.left = q[i][0] * s + "px"; h.style.top = q[i][1] * s + "px"; }); poly.setAttribute("points", q.map(([x, y]) => `${x * s},${y * s}`).join(" ")); };
  hs.forEach((h, i) => h.addEventListener("pointerdown", (e) => { e.preventDefault(); h.setPointerCapture?.(e.pointerId);
    const mv = (ev) => { const r = stage.getBoundingClientRect(), s = sx(); q[i] = [Math.max(0, Math.min(img.naturalWidth, (ev.clientX - r.left) / s)), Math.max(0, Math.min(img.naturalHeight, (ev.clientY - r.top) / s))]; paint(); };
    const up = () => { h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); };
    h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up); }));
  box.querySelector("#sc-auto").onclick = () => { q = detectCorners(img); paint(); };
  box.querySelector("#sc-full").onclick = () => { const W = img.naturalWidth, H = img.naturalHeight; q = [[0, 0], [W, 0], [W, H], [0, H]]; paint(); };
  const ro = new ResizeObserver(paint); ro.observe(stage); requestAnimationFrame(paint);
  const v = await modal({ title: "حدود الورقة", body: box, wide: true, actions: [{ label: "إلغاء", value: null }, { label: "استخدام الصورة كما هي", value: "raw" }, { label: "قص وتقويم", kind: "primary", value: (b) => ({ enhance: b.querySelector("#sc-en").checked }) }] });
  ro.disconnect();
  if (!v) { URL.revokeObjectURL(url); return null; }
  let out;
  if (v === "raw") { out = document.createElement("canvas"); out.width = img.naturalWidth; out.height = img.naturalHeight; out.getContext("2d").drawImage(img, 0, 0); }
  else { toast("جارٍ تقويم الصفحة…"); await new Promise((r) => setTimeout(r, 30)); out = warp(img, q.map((p) => [...p]), { enhance: v.enhance }); }
  URL.revokeObjectURL(url);
  return out;
}
