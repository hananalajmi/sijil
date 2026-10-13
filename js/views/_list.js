// صفحة قائمة عامة: بحث، تصفية، جدول، تنقل بين السجلات
import { api } from "../api.js";
import { state } from "../store.js";
import { esc, $, $$, debounce } from "../ui.js";
import { KIND_ROUTE, rememberNav, statusPill, go, schoolOptions } from "../kit.js";

export async function listView(main, { kind, title, sub = "", newLabel = "+ جديد", columns, byYear = true, schoolFilter = false, emptyText = "", extraHead = "", rowsFilter, sort, onReady }) {
  const route = KIND_ROUTE[kind];
  main.innerHTML = `<div class="container">
    <div class="page-head"><div><h1>${esc(title)}</h1><div class="sub">${esc(sub)}</div></div>
      <div class="row">${extraHead}<a class="btn primary" href="#/${route}/new">${esc(newLabel)}</a></div></div>
    <div class="toolbar"><input type="search" id="q" placeholder="بحث…" aria-label="بحث">
      ${schoolFilter ? `<select id="fs" aria-label="المدرسة">${schoolOptions("").replace("— اختاري المدرسة —", "كل المدارس")}</select>` : ""}</div>
    <div id="out"><p class="hint">جارٍ التحميل…</p></div></div>`;
  let rows = await api.list({ kind, year: byYear ? state.year : undefined });
  if (rowsFilter) rows = rows.filter(rowsFilter);
  if (sort) rows.sort(sort);
  const out = $("#out", main);
  const paint = () => {
    const q = $("#q", main).value.trim();
    const fs = $("#fs", main)?.value || "";
    const list = rows.filter((r) => (!fs || r.school_id === fs || r.id === fs) && (!q || JSON.stringify([r.title, r.data, columns.map((c) => c.get(r))]).includes(q)));
    rememberNav(kind, list.map((r) => r.id));
    if (!rows.length) { out.innerHTML = `<div class="empty"><h2>لا توجد سجلات${byYear ? " في العام " + esc(state.year) : ""}</h2><p>${esc(emptyText)}</p><div class="row"><a class="btn primary" href="#/${route}/new">${esc(newLabel)}</a></div></div>`; return; }
    if (!list.length) { out.innerHTML = `<div class="empty">لا توجد نتائج مطابقة.</div>`; return; }
    out.innerHTML = `<div class="tbl-wrap"><table class="data"><thead><tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th>الحالة</th></tr></thead>
      <tbody>${list.map((r) => `<tr class="click" data-id="${r.id}" tabindex="0">${columns.map((c) => `<td class="${c.cls || ""}">${c.html ? c.html(r) : esc(c.get(r) ?? "")}</td>`).join("")}<td>${statusPill(r)}</td></tr>`).join("")}</tbody></table></div>
      <p class="hint">${list.length} سجل</p>`;
    $$("tr.click", out).forEach((tr) => { tr.onclick = () => go(`#/${route}/${tr.dataset.id}`); tr.onkeydown = (e) => e.key === "Enter" && tr.onclick(); });
  };
  $("#q", main).oninput = debounce(paint, 200);
  $("#fs", main) && ($("#fs", main).onchange = paint);
  paint();
  onReady && onReady(rows);
}
