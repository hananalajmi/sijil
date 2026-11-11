// صفحة قائمة عامة: بحث، تصفية، جدول، تنقل بين السجلات
import { api } from "../api.js";
import { state } from "../store.js";
import { esc, $, $$, debounce, toast, modal, download } from "../ui.js";
import { KIND_ROUTE, rememberNav, statusPill, go, schoolOptions, PRINTABLE } from "../kit.js";

// إرسال أكثر من سجل مرة واحدة: ملف PDF واحد يجمعها، أو ملف لكل سجل (يُرسلون معاً)
async function bulkPdf(ids, names) {
  const one = await modal({ title: `إرسال ${ids.length} PDF`, body: `<p>كيف تريدين إرسالها؟</p>`,
    actions: [{ label: "إلغاء", value: null }, { label: "ملف لكل واحدة", value: "many" }, { label: "ملف واحد يجمعها", kind: "primary", value: "one" }] });
  if (!one) return;
  const host = document.createElement("div"); host.style.cssText = "position:fixed;left:-30000px;top:0;width:auto"; host.setAttribute("aria-hidden", "true"); document.body.appendChild(host);
  try {
    const { resolveReport, builderFor } = await import("./print.js"), { paginate } = await import("../report/paginate.js"), { sheetsToPdf } = await import("../report/pdf.js");
    const wraps = [];
    for (let k = 0; k < ids.length; k++) {
      toast(`جارٍ تجهيز ${k + 1} من ${ids.length}…`);
      const [ctx, name] = await resolveReport(ids[k], {}); const rep = await builderFor(ctx)(ctx);
      const w = document.createElement("div"); w.className = "sheets"; host.appendChild(w); await paginate(rep, w); wraps.push([w, name || names[k] || "ملف"]);
    }
    const safe = (n) => String(n).replace(/[\\/:*?"<>|]/g, "-");
    const files = one === "one" ? [new File([await sheetsToPdf(host)], `${safe(wraps.map(([, n]) => n)[0])} وغيرها (${ids.length}).pdf`, { type: "application/pdf" })]
      : await Promise.all(wraps.map(async ([w, n], i) => new File([await sheetsToPdf(w)], `${i + 1}- ${safe(n)}.pdf`, { type: "application/pdf" })));
    const canShare = !!(navigator.canShare && navigator.canShare({ files }));
    await modal({ title: "الملفات جاهزة", body: `<p>${files.length} ملف PDF. ${canShare ? "اضغطي «إرسال» ثم اختاري واتساب أو البريد." : "ستُنزَّل الملفات لترسليها من جهازك."}</p>`,
      actions: [{ label: "إلغاء", value: null }, { label: canShare ? "إرسال" : "تنزيل", kind: "primary", value: () => { if (canShare) navigator.share({ files }).catch(() => {}); else files.forEach((f) => download(f, f.name)); return true; } }] });
  } catch (e) { console.error(e); toast("تعذّر تجهيز الملفات: " + e.message, "error"); }
  finally { host.remove(); }
}

export async function listView(main, { kind, title, sub = "", newLabel = "+ جديد", columns, byYear = true, schoolFilter = false, emptyText = "", extraHead = "", rowsFilter, sort, onReady, newHref }) {
  const route = KIND_ROUTE[kind]; const NEW = newHref || `#/${route}/new`;
  main.innerHTML = `<div class="container">
    <div class="page-head"><div><h1>${esc(title)}</h1><div class="sub">${esc(sub)}</div></div>
      <div class="row">${extraHead}<a class="btn primary" href="${NEW}">${esc(newLabel)}</a></div></div>
    <div class="toolbar"><input type="search" id="q" placeholder="بحث…" aria-label="بحث">${PRINTABLE.has(kind) ? `<button class="btn" id="sel-mode" type="button">تحديد للإرسال</button><button class="btn primary" id="sel-send" type="button" hidden>إرسال المحدد PDF</button>` : ""}
      ${schoolFilter ? `<select id="fs" aria-label="المدرسة">${schoolOptions("").replace("— اختاري المدرسة —", "كل المدارس")}</select>` : ""}</div>
    <div id="out"><p class="hint">جارٍ التحميل…</p></div></div>`;
  let rows = await api.list({ kind, year: byYear ? state.year : undefined });
  if (rowsFilter) rows = rows.filter(rowsFilter);
  if (sort) rows.sort(sort);
  const out = $("#out", main);
  let selMode = false; const picked = new Set();
  const selBtn = $("#sel-mode", main), sendBtn = $("#sel-send", main);
  const upd = () => { if (sendBtn) { sendBtn.hidden = !selMode; sendBtn.textContent = `إرسال المحدد PDF (${picked.size})`; sendBtn.disabled = !picked.size; } };
  if (selBtn) selBtn.onclick = () => { selMode = !selMode; picked.clear(); selBtn.textContent = selMode ? "إلغاء التحديد" : "تحديد للإرسال"; upd(); paint(); };
  if (sendBtn) sendBtn.onclick = () => { const ids = [...picked]; bulkPdf(ids, ids.map((id) => rows.find((r) => r.id === id)?.title || "")); };
  const paint = () => {
    const q = $("#q", main).value.trim();
    const fs = $("#fs", main)?.value || "";
    const list = rows.filter((r) => (!fs || r.school_id === fs || r.id === fs) && (!q || JSON.stringify([r.title, r.data, columns.map((c) => c.get(r))]).includes(q)));
    rememberNav(kind, list.map((r) => r.id));
    if (!rows.length) { out.innerHTML = `<div class="empty"><h2>لا توجد سجلات${byYear ? " في العام " + esc(state.year) : ""}</h2><p>${esc(emptyText)}</p><div class="row"><a class="btn primary" href="${NEW}">${esc(newLabel)}</a></div></div>`; return; }
    if (!list.length) { out.innerHTML = `<div class="empty">لا توجد نتائج مطابقة.</div>`; return; }
    out.innerHTML = `<div class="tbl-wrap"><table class="data"><thead><tr>${selMode ? `<th><input type="checkbox" id="sel-all" aria-label="تحديد الكل"></th>` : ""}${columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th>الحالة</th></tr></thead>
      <tbody>${list.map((r) => `<tr class="click" data-id="${r.id}" tabindex="0">${selMode ? `<td><input type="checkbox" data-pick="${r.id}" ${picked.has(r.id) ? "checked" : ""} aria-label="تحديد"></td>` : ""}${columns.map((c) => `<td class="${c.cls || ""}">${c.html ? c.html(r) : esc(c.get(r) ?? "")}</td>`).join("")}<td>${statusPill(r)}</td></tr>`).join("")}</tbody></table></div>
      <p class="hint">${list.length} سجل</p>`;
    $$("tr.click", out).forEach((tr) => { tr.onclick = () => { if (selMode) { const id = tr.dataset.id, cb = tr.querySelector("[data-pick]"); if (picked.has(id)) picked.delete(id); else picked.add(id); cb.checked = picked.has(id); upd(); return; } go(`#/${route}/${tr.dataset.id}`); };
      tr.onkeydown = (e) => e.key === "Enter" && tr.onclick(); });
    $$("[data-pick]", out).forEach((cb) => (cb.onclick = (e) => e.stopPropagation(), cb.onchange = () => { if (cb.checked) picked.add(cb.dataset.pick); else picked.delete(cb.dataset.pick); upd(); }));
    const all = $("#sel-all", out); if (all) all.onchange = () => { list.forEach((r) => (all.checked ? picked.add(r.id) : picked.delete(r.id))); upd(); paint(); };
  };
  $("#q", main).oninput = debounce(paint, 200);
  $("#fs", main) && ($("#fs", main).onchange = paint);
  paint();
  onReady && onReady(rows);
}
