// توقيع ملف: ترفع الموجهة نموذجاً (PDF أو صورة)، وتضع عليه توقيعها وختمها (المحفوظين في الإعدادات) والتاريخ
// في المكان الذي تختاره، ثم يُحفظ ملف PDF موقّع في الأرشيف ويُرسل. كل شيء داخل المتصفح.
import { api } from "../api.js";
import { G, fileUrl } from "../store.js";
import { esc, $, $$, toast, confirmBox, fmtDate, today, modal } from "../ui.js";

const CAT = "report_file", SUB = "signed";
let pdfjsLib;
async function pdfjs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import("../vendor/pdfjs/pdf.min.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
  return pdfjsLib;
}
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("تعذّرت قراءة الصورة")); i.src = src; });

// ---- ملف PDF بسيط: كل صفحة صورة JPEG بحجم الصفحة الأصلية (بالنقاط)
async function jpegPdf(pages) {
  const enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const push = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n`); body(); push("\nendobj\n"); };
  push("%PDF-1.4\n"); push(new Uint8Array([37, 226, 227, 207, 211, 10])); // سطر ثنائي يُعرّف الملف بأنه ثنائي
  const n = pages.length, kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
  for (let i = 0; i < n; i++) {
    const p = pages[i], pn = 3 + i * 3, cn = pn + 1, im = pn + 2;
    const W = p.w.toFixed(2), H = p.h.toFixed(2);
    obj(pn, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${cn} 0 R >>`));
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(cn, () => push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(im, () => { push(`<< /Type /XObject /Subtype /Image /Width ${p.px} /Height ${p.py} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`); push(p.jpg); push("\nendstream"); });
  }
  const xref = len, total = 3 + n * 3;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let k = 1; k < total; k++) push(String(offs[k]).padStart(10, "0") + " 00000 n \n");
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: "application/pdf" });
}
const canvasJpeg = (c) => new Promise((res) => c.toBlob(async (b) => res(new Uint8Array(await b.arrayBuffer())), "image/jpeg", 0.9));

export default async function (main) {
  const g = G();
  const [sigUrl, stampUrl] = await Promise.all([g.signature ? fileUrl(g.signature) : null, g.stamp ? fileUrl(g.stamp) : null]);
  main.innerHTML = `<div class="container">
    <div class="page-head"><div><h1>توقيع ملف</h1><div class="sub">صوّري الورقة بالكاميرا (تُقص حدودها وتُقوَّم تلقائياً) أو ارفعي PDF أو صورة، وضعي عليه توقيعك وختمك والتاريخ حيث تريدين، ثم احفظيه PDF موقّعاً وأرسليه.</div></div></div>
    <section class="panel" id="pick"><div class="toolbar"><label class="btn primary">📷 تصوير الورقة<input type="file" id="cam" accept="image/*" capture="environment" hidden></label><label class="btn">اختيار ملف<input type="file" id="file" accept="application/pdf,.pdf,image/*,.doc,.docx" hidden></label>
      <label class="btn" id="addpg" hidden>+ صفحة أخرى بالكاميرا<input type="file" id="cam2" accept="image/*" capture="environment" hidden></label>
      <span class="hint" id="fname">PDF أو صورة. ملف Word: افتحيه في Word واحفظيه PDF أولاً.</span></div>
      ${!sigUrl || !stampUrl ? `<p class="hint">${!sigUrl && !stampUrl ? "لم ترفعي توقيعك وختمك بعد" : !sigUrl ? "لم ترفعي توقيعك بعد" : "لم ترفعي ختمك بعد"} — <a href="#/guide">ارفعيهما من «البيانات الرئيسية ← التوقيع والختم»</a>.</p>` : ""}</section>
    <div class="sign-tools" id="tools" hidden>
      <button class="btn" data-add="sig" ${sigUrl ? "" : "disabled"}>+ توقيعي</button>
      <button class="btn" data-add="stamp" ${stampUrl ? "" : "disabled"}>+ ختمي</button>
      <button class="btn" data-add="date">+ التاريخ</button>
      <span class="grow"></span>
      <button class="btn primary" id="save">حفظ الملف الموقّع</button></div>
    <p class="hint" id="howto" hidden>اضغطي «+ توقيعي» أو «+ ختمي» فيظهر على الصفحة الظاهرة أمامك؛ اسحبيه لمكانه، وكبّريه أو صغّريه من الزاوية، واحذفيه بـ ✕.</p>
    <div class="sign-pages" id="pages"></div>
    <section class="panel"><h2>الملفات الموقّعة</h2><div id="done"></div></section>
  </div>`;

  let doc = null; // { name, pages: [{ w, h (نقاط), render(scale) -> canvas }] }
  let marks = []; // { id, page, type, x, y, w (نسب من عرض/ارتفاع الصفحة), src?, text?, ratio }
  const pagesEl = $("#pages", main);

  // ---- فتح الملف
  $("#file", main).onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    if (/\.docx?$/i.test(f.name) || /word/.test(f.type)) { toast("افتحي ملف Word واحفظيه PDF (ملف ← حفظ باسم ← PDF) ثم اختاريه هنا", "error"); return; }
    $("#fname", main).textContent = "جارٍ فتح الملف…";
    try {
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        const lib = await pdfjs();
        const pdf = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
        const pages = [];
        for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
          const pg = await pdf.getPage(i), vp = pg.getViewport({ scale: 1 });
          pages.push({ w: vp.width, h: vp.height, render: async (scale) => { const v = pg.getViewport({ scale }), c = document.createElement("canvas"); c.width = Math.round(v.width); c.height = Math.round(v.height); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); await pg.render({ canvasContext: x, viewport: v }).promise; return c; } });
        }
        doc = { name: f.name.replace(/\.pdf$/i, ""), pages };
      } else if (/^image\//.test(f.type)) {
        // صورة (من الكاميرا أو الجهاز): تحديد حدود الورقة وتقويمها أولاً
        const pg = await scannedPage(f); if (!pg) { $("#fname", main).textContent = ""; return; }
        doc = { name: f.name && !/^image\.|^IMG_|^\d+$/i.test(f.name.replace(/\.[^.]+$/, "")) ? f.name.replace(/\.[^.]+$/, "") : `ورقة ${fmtDate(today())}`, pages: [pg] };
      } else throw new Error("نوع الملف غير مدعوم. اختاري PDF أو صورة.");
      marks = [];
      $("#fname", main).textContent = `${f.name} — ${doc.pages.length} صفحة`;
      $("#tools", main).hidden = false; $("#howto", main).hidden = false; $("#addpg", main).hidden = false;
      await paintPages();
    } catch (err) { $("#fname", main).textContent = ""; toast(err.message || "تعذّر فتح الملف", "error"); }
  };

  // صفحة من صورة: قص وتقويم (ماسح الورق)، بعرض A4
  async function scannedPage(f) {
    const { scanDialog } = await import("../docscan.js");
    const cv = await scanDialog(f, { modal, toast }); if (!cv) return null;
    const w = 595.28, h = (w * cv.height) / cv.width;
    return { w, h, render: async (scale) => { const c = document.createElement("canvas"); c.width = Math.round(w * scale); c.height = Math.round(h * scale); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(cv, 0, 0, c.width, c.height); return c; } };
  }
  $("#cam", main).onchange = (e) => $("#file", main).onchange(e);
  $("#cam2", main).onchange = async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f || !doc) return;
    const pg = await scannedPage(f); if (!pg) return; doc.pages.push(pg); $("#fname", main).textContent = `${doc.name} — ${doc.pages.length} صفحة`; await paintPages(); toast("أُضيفت الصفحة"); };
  async function paintPages() {
    pagesEl.innerHTML = "";
    const avail = Math.min(900, pagesEl.clientWidth || 360);
    for (const [i, p] of doc.pages.entries()) {
      const wrap = document.createElement("div"); wrap.className = "sign-page"; wrap.dataset.page = i;
      const scale = (avail / p.w) * Math.min(2, window.devicePixelRatio || 1);
      const c = await p.render(scale); c.className = "sign-canvas"; wrap.appendChild(c);
      const num = document.createElement("div"); num.className = "sign-num"; num.textContent = `صفحة ${i + 1} من ${doc.pages.length}`;
      pagesEl.appendChild(num); pagesEl.appendChild(wrap);
    }
    paintMarks();
  }
  // الصفحة الظاهرة حالياً على الشاشة (يُضاف إليها التوقيع)
  const visiblePage = () => {
    const ws = $$(".sign-page", pagesEl); let best = 0, bestV = -1;
    ws.forEach((w, i) => { const r = w.getBoundingClientRect(), v = Math.min(innerHeight, r.bottom) - Math.max(0, r.top); if (v > bestV) { bestV = v; best = i; } });
    return best;
  };
  $$("[data-add]", main).forEach((b) => (b.onclick = async () => {
    const t = b.dataset.add, page = visiblePage(), P = doc.pages[page];
    const m = { id: Math.random().toString(36).slice(2), page, type: t };
    if (t === "date") { m.text = fmtDate(today()); m.w = 0.2; m.ratio = 0.28; m.x = 0.68; m.y = 0.8; } // كل عنصر في مكان مختلف حتى لا تتراكب
    else {
      m.src = t === "sig" ? sigUrl : stampUrl;
      const im = await loadImg(m.src); m.ratio = im.naturalHeight / im.naturalWidth;
      m.w = t === "sig" ? 0.22 : 0.26; m.x = t === "sig" ? 0.1 : 0.36;
      m.y = Math.min(0.85, 0.72 - (m.w * m.ratio * P.w) / P.h / 2);
    }
    // في منتصف الجزء الظاهر من الصفحة
    const r = $$(".sign-page", pagesEl)[page].getBoundingClientRect();
    const midY = (Math.min(innerHeight, r.bottom) + Math.max(0, r.top)) / 2;
    m.y = Math.max(0, Math.min(0.95, (midY - r.top) / r.height - (m.w * m.ratio * P.w) / P.h / 2));
    marks.push(m); paintMarks();
  }));

  function paintMarks() {
    $$(".sign-mark", pagesEl).forEach((e) => e.remove());
    for (const m of marks) {
      const page = $$(".sign-page", pagesEl)[m.page]; if (!page) continue;
      const el = document.createElement("div"); el.className = "sign-mark"; el.dataset.id = m.id;
      el.innerHTML = (m.type === "date" ? `<span class="sm-text">${esc(m.text)}</span>` : `<img src="${m.src}" alt="${m.type === "sig" ? "توقيعي" : "ختمي"}" draggable="false">`)
        + `<button type="button" class="sm-x" aria-label="حذف">✕</button><span class="sm-r" aria-hidden="true"></span>`;
      const place = () => { el.style.left = m.x * 100 + "%"; el.style.top = m.y * 100 + "%"; el.style.width = m.w * 100 + "%"; if (m.type === "date") el.style.fontSize = (m.w * page.clientWidth) / 6.8 + "px"; };
      place(); page.appendChild(el);
      el.querySelector(".sm-x").onclick = (ev) => { ev.stopPropagation(); marks = marks.filter((x) => x.id !== m.id); el.remove(); };
      // سحب لتغيير المكان، والزاوية لتغيير الحجم
      const drag = (ev, resize) => {
        ev.preventDefault(); ev.stopPropagation();
        const r = page.getBoundingClientRect(), sx = ev.clientX, sy = ev.clientY, ox = m.x, oy = m.y, ow = m.w;
        const mv = (e2) => {
          const dx = (e2.clientX - sx) / r.width, dy = (e2.clientY - sy) / r.height;
          if (resize) m.w = Math.max(0.05, Math.min(0.9, ow - dx)); // الزاوية في الجهة اليسرى السفلى
          else { m.x = Math.max(0, Math.min(1 - m.w, ox + dx)); m.y = Math.max(0, Math.min(0.98, oy + dy)); }
          if (resize) m.x = Math.max(0, Math.min(1 - m.w, ox + (ow - m.w)));
          place();
        };
        const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); };
        addEventListener("pointermove", mv); addEventListener("pointerup", up);
      };
      el.addEventListener("pointerdown", (ev) => { if (ev.target.classList.contains("sm-x")) return; drag(ev, ev.target.classList.contains("sm-r")); });
    }
  }

  // ---- الحفظ: كل صفحة بدقة جيدة (حوالي 150 نقطة لكل بوصة) مع التوقيعات
  $("#save", main).onclick = async () => {
    if (!marks.length && !(await confirmBox("لا يوجد توقيع", "لم تضيفي توقيعاً أو ختماً. حفظ الملف كما هو؟", "حفظ"))) return;
    const btn = $("#save", main); btn.disabled = true; btn.textContent = "جارٍ التجهيز…";
    try {
      const out = [];
      for (const [i, p] of doc.pages.entries()) {
        const scale = Math.min(2.1, 1800 / p.w), c = await p.render(scale), x = c.getContext("2d");
        for (const m of marks.filter((k) => k.page === i)) {
          const X = m.x * c.width, Y = m.y * c.height, Wd = m.w * c.width;
          if (m.type === "date") { x.fillStyle = "#1a237e"; x.font = `bold ${Math.round(Wd / 6.8)}px Arial, sans-serif`; x.textBaseline = "top"; x.direction = "ltr"; x.fillText(m.text, X, Y); }
          else { const im = await loadImg(m.src); x.drawImage(im, X, Y, Wd, Wd * m.ratio); }
        }
        out.push({ w: p.w, h: p.h, px: c.width, py: c.height, jpg: await canvasJpeg(c) });
      }
      const blob = await jpegPdf(out);
      const file = new File([blob], `${doc.name} - موقّع.pdf`, { type: "application/pdf" });
      await api.upload(file, { category: CAT, subcategory: SUB, title: file.name });
      toast("حُفظ الملف الموقّع في الأرشيف"); paintDone();
      window.__lastSigned = blob;
    } catch (err) { console.error(err); toast("تعذّر الحفظ: " + err.message, "error"); }
    finally { btn.disabled = false; btn.textContent = "حفظ الملف الموقّع"; }
  };

  // ---- الملفات الموقّعة: فتح، إرسال، حذف
  async function paintDone() {
    const list = (await api.files(`&category=eq.${CAT}`).catch(() => [])).filter((f) => f.subcategory === SUB);
    const box = $("#done", main);
    box.innerHTML = list.length ? `<div class="list">${list.map((f) => `<div class="item" data-f="${f.id}"><span class="t">${esc(f.title)}</span><span class="m">${new Date(f.created_at).toLocaleString("ar-KW")}</span>
      <span class="s"><button class="btn small" data-open>فتح</button><button class="btn small primary" data-send>إرسال</button><button class="btn small ghost" data-rm style="color:var(--bad)">حذف</button></span></div>`).join("")}</div>`
      : `<p class="hint">لا توجد ملفات موقّعة بعد.</p>`;
    $$("[data-f]", box).forEach((row) => {
      const f = list.find((x) => x.id === row.dataset.f);
      const blob = () => api.fileBlob(f.storage_path);
      row.querySelector("[data-open]").onclick = async () => { const a = document.createElement("a"); a.href = URL.createObjectURL(await blob()); a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); };
      row.querySelector("[data-send]").onclick = async () => {
        try {
          const file = new File([await blob()], f.title, { type: "application/pdf" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === "AbortError") return; } }
          const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = f.title; document.body.appendChild(a); a.click(); a.remove(); toast("نُزّل الملف؛ أرسليه من البريد أو واتساب");
        } catch (e) { toast(e.message, "error"); }
      };
      row.querySelector("[data-rm]").onclick = async () => { if (await confirmBox("حذف الملف", `حذف «${f.title}» نهائياً؟`, "حذف", true)) { await api.deleteFile(f); paintDone(); } };
    });
  }
  paintDone();
}
