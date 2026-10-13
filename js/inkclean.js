// تنظيف صورة التوقيع أو الختم داخل المتصفح (بدون رفعها لأي خدمة):
// 1) تقدير لون الورق في كل منطقة (لإزالة الظل وتفاوت الإضاءة)  2) فصل الحبر عن الورق تلقائياً
// 3) إزالة النقاط والغبار الصغيرة  4) القص حول التوقيع  5) خلفية شفافة ولون حبر موحّد
// لا يُرسم شيء جديد: الشكل نفسه من صورة الموجهة، فقط تُزال الخلفية.

const loadImage = (file) => new Promise((res, rej) => {
  const u = URL.createObjectURL(file), im = new Image();
  im.onload = () => { URL.revokeObjectURL(u); res(im); };
  im.onerror = () => { URL.revokeObjectURL(u); rej(new Error("تعذّرت قراءة الصورة")); };
  im.src = u;
});

// يحضّر بيانات الصورة: مرحلة أولى سريعة لتحديد مكان التوقيع، ثم مرحلة ثانية بدقة أعلى على المنطقة فقط
// (حتى لا تضيع النقاط الصغيرة إذا كان الختم صغيراً في الصورة)
export async function prepareInk(file) {
  const im = await loadImage(file);
  const nw = im.naturalWidth, nh = im.naturalHeight;
  const p1 = prepRegion(im, 0, 0, nw, nh, Math.min(1, 1000 / Math.max(nw, nh)));
  const box = inkMask(p1, 1).box;
  if (!box) return p1;
  const k1 = p1.k, m = Math.round(Math.max(box.x1 - box.x0, box.y1 - box.y0) * 0.1) + 6;
  const sx = Math.max(0, Math.floor((box.x0 - m) / k1)), sy = Math.max(0, Math.floor((box.y0 - m) / k1));
  const ex = Math.min(nw, Math.ceil((box.x1 + m) / k1)), ey = Math.min(nh, Math.ceil((box.y1 + m) / k1));
  return prepRegion(im, sx, sy, ex - sx, ey - sy, Math.min(2, 1600 / Math.max(ex - sx, ey - sy)));
}

function prepRegion(im, sx, sy, sw, sh, k) {
  const W = Math.max(1, Math.round(sw * k)), H = Math.max(1, Math.round(sh * k));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(im, sx, sy, sw, sh, 0, 0, W, H);
  const src = x.getImageData(0, 0, W, H).data;
  // لون الورق: أفتح لون في كل مربع، ثم تنعيم بين المربعات
  const B = Math.max(24, Math.round(Math.max(W, H) / 30));
  const gw = Math.ceil(W / B), gh = Math.ceil(H / B), grid = new Float32Array(gw * gh * 3);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    // نأخذ النسبة 92% من السطوع بدل الأقصى لتجنب اللمعان
    const lum = [];
    for (let y = gy * B; y < Math.min(H, (gy + 1) * B); y += 2) for (let xx = gx * B; xx < Math.min(W, (gx + 1) * B); xx += 2) { const i = (y * W + xx) * 4; lum.push([src[i] + src[i + 1] + src[i + 2], i]); }
    lum.sort((a, b) => a[0] - b[0]);
    const pick = lum.slice(Math.floor(lum.length * 0.85), Math.floor(lum.length * 0.97) + 1);
    let r = 0, g = 0, b = 0; for (const [, i] of pick) { r += src[i]; g += src[i + 1]; b += src[i + 2]; }
    const n = pick.length || 1, o = (gy * gw + gx) * 3; grid[o] = r / n; grid[o + 1] = g / n; grid[o + 2] = b / n;
  }
  // تنعيم الشبكة (يمنع أن يُحسب مربع مغطى بالحبر ورقاً داكناً)
  const sm = new Float32Array(grid.length);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) for (let ch = 0; ch < 3; ch++) {
    let best = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = gy + dy, xx = gx + dx; if (yy < 0 || xx < 0 || yy >= gh || xx >= gw) continue; best = Math.max(best, grid[(yy * gw + xx) * 3 + ch]); }
    sm[(gy * gw + gx) * 3 + ch] = (best + grid[(gy * gw + gx) * 3 + ch]) / 2;
  }
  // درجة «الحبرية» لكل بكسل: كم هو أغمق من ورقه
  const dark = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / B - 0.5)), y0 = Math.floor(fy), y1 = Math.min(gh - 1, y0 + 1), ty = fy - y0;
    for (let xx = 0; xx < W; xx++) {
      const fx = Math.min(gw - 1, Math.max(0, (xx + 0.5) / B - 0.5)), x0 = Math.floor(fx), x1 = Math.min(gw - 1, x0 + 1), tx = fx - x0;
      const i = (y * W + xx) * 4; let d = 0;
      for (let ch = 0; ch < 3; ch++) {
        const a = sm[(y0 * gw + x0) * 3 + ch] * (1 - tx) + sm[(y0 * gw + x1) * 3 + ch] * tx, b = sm[(y1 * gw + x0) * 3 + ch] * (1 - tx) + sm[(y1 * gw + x1) * 3 + ch] * tx;
        const bg = Math.max(1, a * (1 - ty) + b * ty);
        d = Math.max(d, 1 - Math.min(1, src[i + ch] / bg));
      }
      dark[y * W + xx] = d;
    }
  }
  // عتبة تلقائية (أوتسو) تفصل الحبر عن الورق
  const hist = new Float64Array(256); for (const d of dark) hist[Math.min(255, Math.round(d * 255))]++;
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let wB = 0, sB = 0, best = 0, T = 60;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = dark.length - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; T = t; } }
  return { W, H, k, src, dark, otsu: Math.max(0.08, Math.min(0.5, T / 255)) };
}

// يبني الصورة النظيفة. strength: 0.5 (خفيف) … 1.5 (قوي). color: "auto" | "blue" | "black" | "#rrggbb"
function inkMask(p, strength) {
  const { W, H, dark, otsu } = p;
  const lo = otsu * (0.75 / strength), hi = otsu * (1.25 / strength) + 0.05;
  const alpha = new Float32Array(W * H);
  for (let i = 0; i < alpha.length; i++) { const t = (dark[i] - lo) / (hi - lo); alpha[i] = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }
  // إزالة النقاط الصغيرة: مكونات متصلة أصغر من حد معيّن
  const lab = new Int32Array(W * H), minArea = Math.max(10, Math.round(W * H * 0.00004)), stack = new Int32Array(W * H);
  let id = 0;
  for (let s = 0; s < alpha.length; s++) {
    if (alpha[s] < 0.35 || lab[s]) continue;
    id++; let top = 0, n = 0; stack[top++] = s; lab[s] = id; const members = [];
    while (top) { const q = stack[--top]; members.push(q); n++; const y = (q / W) | 0, x = q - y * W;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= H || xx >= W) continue; const r = yy * W + xx; if (!lab[r] && alpha[r] >= 0.35) { lab[r] = id; stack[top++] = r; } } }
    if (n < minArea) for (const q of members) { alpha[q] = 0; lab[q] = -1; }
  }
  // البكسلات الخفيفة البعيدة عن أي حبر حقيقي تُحذف (بقايا الظل)
  for (let i = 0; i < alpha.length; i++) if (alpha[i] > 0 && alpha[i] < 0.35) {
    const y = (i / W) | 0, x = i - y * W; let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && xx >= 0 && yy < H && xx < W && lab[yy * W + xx] > 0) { near = true; break; } }
    if (!near) alpha[i] = 0;
  }
  // حدود القص
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x] > 0.3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { alpha, box: x1 < 0 ? null : { x0, y0, x1, y1 } };
}

// يبني الصورة النظيفة. strength: 0.6 (خفيف) … 1.6 (قوي). color: "auto" | "blue" | "black" | "#rrggbb"
export function renderInk(p, { strength = 1, color = "auto", maxOut = 1000 } = {}) {
  const { W, H, src } = p;
  const { alpha, box } = inkMask(p, strength);
  if (!box) return null; // لا يوجد حبر
  let { x0, y0, x1, y1 } = box;
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03) + 2;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  // لون الحبر: الوسيط من بكسلات الحبر الواضحة (ثم أغمق قليلاً ليكون واضحاً في الطباعة)
  let ink = [20, 30, 110];
  if (color === "black") ink = [22, 22, 26];
  else if (color === "blue") ink = [24, 44, 140];
  else if (/^#[0-9a-f]{6}$/i.test(color)) ink = [1, 3, 5].map((k) => parseInt(color.slice(k, k + 2), 16));
  else {
    const rs = [], gs = [], bs = [];
    for (let i = 0; i < alpha.length; i += 3) if (alpha[i] > 0.9) { rs.push(src[i * 4]); gs.push(src[i * 4 + 1]); bs.push(src[i * 4 + 2]); }
    if (rs.length > 20) {
      const med = (a) => a.sort((m, n) => m - n)[a.length >> 1];
      const c0 = [med(rs), med(gs), med(bs)], g = (c0[0] + c0[1] + c0[2]) / 3;
      // نبرز اللون (أزرق الحبر) ليظهر كما في الورقة، ونضبط السطوع ليكون واضحاً في الطباعة
      let c1 = c0.map((v) => g + (v - g) * 1.9);
      const L = (c1[0] + c1[1] + c1[2]) / 3, target = Math.min(Math.max(L, 68), 95);
      ink = c1.map((v) => Math.max(0, Math.min(255, Math.round(v + (target - L)))));
    }
  }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const c = document.createElement("canvas"); c.width = cw; c.height = ch;
  const x = c.getContext("2d"), out = x.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) for (let xx = 0; xx < cw; xx++) {
    const a = alpha[(y + y0) * W + xx + x0], o = (y * cw + xx) * 4;
    out.data[o] = ink[0]; out.data[o + 1] = ink[1]; out.data[o + 2] = ink[2]; out.data[o + 3] = Math.round(a * 255);
  }
  x.putImageData(out, 0, 0);
  if (cw <= maxOut) return c;
  const k = maxOut / cw, r = document.createElement("canvas"); r.width = maxOut; r.height = Math.max(1, Math.round(ch * k));
  const rx = r.getContext("2d"); rx.imageSmoothingQuality = "high"; rx.drawImage(c, 0, 0, r.width, r.height);
  return r;
}

export const canvasToBlob = (c) => new Promise((res) => c.toBlob((b) => res(b), "image/png"));

// نافذة: الصورة الأصلية والمعدّلة، مع خيارات بسيطة، وتعيد ملف PNG المعدّل أو الأصل أو null
export async function inkEditor(file, { modal, toast, title = "تعديل الصورة" }) {
  let prep;
  try { prep = await prepareInk(file); } catch (e) { toast(e.message, "error"); return null; }
  const box = document.createElement("div");
  const origUrl = URL.createObjectURL(file);
  box.innerHTML = `<p class="hint" style="margin-top:0">أزلنا الخلفية والظل، وقصصنا حول الصورة، ووحّدنا لون الحبر. راجعي النتيجة ثم احفظي.</p>
    <div class="ink-cmp"><figure><figcaption>الأصلية</figcaption><img src="${origUrl}" alt="الصورة الأصلية"></figure>
      <figure><figcaption>بعد التعديل</figcaption><div class="ink-out" id="ink-out"></div></figure></div>
    <div class="ink-opts">
      <label>لون الحبر <select id="ink-color"><option value="auto">كما في الصورة</option><option value="blue">أزرق</option><option value="black">أسود</option></select></label>
      <label>قوة التنظيف <input type="range" id="ink-str" min="0.6" max="1.6" step="0.1" value="1"></label>
    </div>`;
  let current = null;
  const draw = () => {
    current = renderInk(prep, { strength: Number(box.querySelector("#ink-str").value), color: box.querySelector("#ink-color").value });
    const out = box.querySelector("#ink-out"); out.innerHTML = "";
    if (current) { current.className = "ink-canvas"; out.appendChild(current); } else out.innerHTML = `<p class="hint">لم نجد توقيعاً واضحاً. جرّبي «قوة التنظيف» أعلى، أو صورة أقرب.</p>`;
  };
  draw();
  box.querySelector("#ink-color").onchange = draw;
  box.querySelector("#ink-str").oninput = draw;
  const v = await modal({ title, body: box, wide: true, actions: [{ label: "إلغاء", value: null }, { label: "حفظ الأصلية كما هي", value: "orig" }, { label: "حفظ المعدّلة", kind: "primary", value: "clean" }] });
  URL.revokeObjectURL(origUrl);
  if (v === "orig") return file;
  if (v === "clean" && current) { const b = await canvasToBlob(current); return new File([b], (file.name || "image").replace(/\.[^.]+$/, "") + "-معدلة.png", { type: "image/png" }); }
  return null;
}
