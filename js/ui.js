// أدوات الواجهة المشتركة
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const WORK_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
export const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export const pad2 = (n) => String(n).padStart(2, "0");
export const isoDate = (d) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
export const today = () => isoDate(new Date());
export const parseDate = (s) => (s ? new Date(s + "T12:00:00") : null);
export const dayName = (s) => (s ? DAYS[parseDate(s).getDay()] : "");
// تاريخ بصيغة النماذج الرسمية: 13-9-2026
export const fmtDate = (s) => { if (!s) return ""; const d = parseDate(s); return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`; };
export const fmtDateSlash = (s) => { if (!s) return ""; const d = parseDate(s); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); };
export const weekStart = (s) => { const d = parseDate(s); d.setDate(d.getDate() - d.getDay()); return isoDate(d); };

// العام الدراسي يبدأ في سبتمبر: 2026-2027
export function academicYearOf(s) {
  const d = s ? parseDate(s) : new Date();
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${y + 1}`;
}
export const yearLabel = (y) => { const [a, b] = (y || "").split("-"); return a && b ? `${a} -${b}` : y || ""; };

export function debounce(fn, ms) { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.flush = () => { clearTimeout(t); fn(); }; f.cancel = () => clearTimeout(t); return f; }

export function toast(msg, kind = "") {
  const t = document.createElement("div");
  t.className = "toast " + kind; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), kind === "error" ? 6000 : 2600);
}

// نافذة حوار داخل الصفحة (بدون alert/confirm)
export function modal({ title, body = "", actions = [{ label: "إغلاق", value: null }], wide = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "modal-scrim";
    wrap.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h2>${esc(title)}</h2><div class="modal-body"></div><div class="modal-actions"></div></div>`;
    const b = wrap.querySelector(".modal-body");
    if (typeof body === "string") b.innerHTML = body; else b.appendChild(body);
    const act = wrap.querySelector(".modal-actions");
    const done = (v) => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    actions.forEach((a) => {
      const btn = document.createElement("button");
      btn.className = "btn " + (a.kind || "");
      btn.textContent = a.label;
      btn.onclick = () => done(typeof a.value === "function" ? a.value(b) : a.value);
      act.appendChild(btn);
    });
    const onKey = (e) => { if (e.key === "Escape") done(null); };
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    (wrap.querySelector(".modal-body input, .modal-body select, .modal-body textarea") || act.lastChild)?.focus();
  });
}
export const confirmBox = (title, text, okLabel = "تأكيد", danger = false) =>
  modal({ title, body: `<p>${esc(text)}</p>`, actions: [{ label: "إلغاء", value: false }, { label: okLabel, value: true, kind: danger ? "danger" : "primary" }] });

export function download(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

export const fileToDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });

// تصغير الصور قبل الرفع حتى لا تثقل الطباعة
export async function shrinkImage(file, maxSide = 1600, quality = 0.85) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, maxSide / Math.max(img.width, img.height));
    if (k === 1 && file.size < 900000) return file;
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const keepPng = file.type === "image/png";
    const blob = await new Promise((r) => c.toBlob(r, keepPng ? "image/png" : "image/jpeg", quality));
    return new File([blob], file.name.replace(/\.\w+$/, keepPng ? ".png" : ".jpg"), { type: blob.type });
  } finally { URL.revokeObjectURL(url); }
}

// تحويل رابط data: إلى ملف دون fetch
export function dataUrlToBlob(d) {
  const [head, b64] = d.split(",");
  const mime = (head.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
