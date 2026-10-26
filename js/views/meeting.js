// التقرير الأسبوعي للتوجيه الفني (محضر اجتماع الموجهين الأسبوعي) — ملف مشترك: ملف واحد لكل أسبوع يعدّله الموجهون
// يُحفظ كسجل مشترك (نفس صلاحيات ملف الإنجازات المشترك) ويُميَّز بـ data.doc = "weekly_meeting".
// النص الثابت في النموذج (العنوان، «الفترة»، «تم اجتماع موجهي وموجهات…»، «الحضور»، «الغياب»، «ونوقشت فيه البنود») لا يُعدَّل؛ الباقي يُعبّأ.
import { api } from "../api.js";
import { state, G, opts, canFillShared } from "../store.js";
import { esc, $, $$, today, fmtDate, academicYearOf, weekStart, addDays, toast, modal } from "../ui.js";
import { field, bindFields, recordPage, go } from "../kit.js";
import { FIRST_SUPERVISOR } from "../templates.js";

export const DOC = "weekly_meeting";
const KIND = "shared_achievements";
export const isMeeting = (r) => r?.data?.doc === DOC;
const keyOf = (ws) => `wm:${ws}`;
export const ABSENCE_REASONS = ["للتكليف", "إجازة", "مهمة رسمية", "دورة تدريبية", "عذر"];
const myName = () => G().full_name || state.profile?.full_name || "";

export function emptyMeeting(ws) {
  return { doc: DOC, month: keyOf(ws), week_start: ws, subject: G().subject || "الكيمياء", period_from: ws, period_to: addDays(ws, 4), meeting_date: addDays(ws, 4),
    attendees: [], absent: [], items: [], reporter: "", first_name: G().first_supervisor || FIRST_SUPERVISOR.name || "" };
}

// أسماء الموجهين للقوائم المنسدلة: زملاء الحساب + اسمي + الأسماء المضافة للقائمة
async function guideNames() {
  const col = await api.rpc("list_colleagues").catch(() => []);
  return [...new Set([myName(), ...(col || []).map((c) => c.full_name), ...opts("meeting_guides")].map((x) => String(x || "").trim()).filter(Boolean))];
}

export default async function (main, { id, params }) {
  if (!id) return list(main);
  let rec;
  if (id === "new") {
    const ws = weekStart(params.week || today());
    const ex = (await api.list({ kind: KIND })).find((r) => isMeeting(r) && r.data.month === keyOf(ws));
    if (ex) { location.replace(`#/meeting/${ex.id}`); return; }
    if (!canFillShared()) { main.innerHTML = `<div class="container"><div class="empty"><h2>لا يوجد تقرير لهذا الأسبوع بعد</h2><p>إنشاء التقرير الأسبوعي متاح لمن حدده المشرف لتعبئة الملفات المشتركة.</p></div></div>`; return; }
    try { rec = await api.create({ kind: KIND, title: `التقرير الأسبوعي ${fmtDate(ws)}`, record_date: ws, academic_year: academicYearOf(ws), data: emptyMeeting(ws) }); }
    catch (e) { const again = (await api.list({ kind: KIND })).find((r) => isMeeting(r) && r.data.month === keyOf(ws)); if (!again) throw e; rec = again; }
    history.replaceState(null, "", `#/meeting/${rec.id}`);
  } else rec = await api.get(id);
  if (!rec) { main.innerHTML = `<div class="container"><div class="empty">السجل غير موجود</div></div>`; return; }
  const names = await guideNames();
  await recordPage(main, { rec, title: "التقرير الأسبوعي للتوجيه الفني (ملف مشترك)", merge: true, backHref: "#/meeting", render(body, ed) {
    const d = ed.rec.data;
    const nameSel = (idAttr, value, label) => `<select ${idAttr} aria-label="${esc(label)}"><option value="">— اختاري —</option>${[...new Set([...names, ...(value ? [value] : [])])].map((n) => `<option ${n === value ? "selected" : ""}>${esc(n)}</option>`).join("")}<option value="__add">+ إضافة اسم للقائمة…</option></select>`;
    const chips = (arr, k) => (arr || []).map((n, i) => `<span class="pill" style="display:inline-flex;gap:6px;align-items:center;margin:3px">${esc(n)} <button type="button" class="btn small ghost" data-del-${k}="${i}" aria-label="حذف ${esc(n)}" style="padding:0 6px">×</button></span>`).join("");
    body.innerHTML = `
      <section class="panel"><h2>بيانات التقرير</h2><div class="form">
        ${field({ label: "المادة (تظهر بالأحمر في العنوان)", key: "subject", value: d.subject })}
        ${field({ label: "الفترة: من", key: "period_from", type: "date", value: d.period_from })}
        ${field({ label: "إلى", key: "period_to", type: "date", value: d.period_to })}
        ${field({ label: "تاريخ الاجتماع", key: "meeting_date", type: "date", value: d.meeting_date, hint: "يُكتب اليوم تلقائياً (مثل: يوم الخميس الموافق …)" })}</div></section>
      <section class="panel"><h2>الحضور</h2><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">${nameSel('id="mt-att"', "", "إضافة حاضر")}<button class="btn small" type="button" id="mt-att-all">كل الموجهين</button></div>
        <div id="mt-att-list" style="margin-top:8px">${chips(d.attendees, "att") || '<span class="hint">لم يُضف أحد بعد.</span>'}</div></section>
      <section class="panel"><h2>الغياب</h2><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">${nameSel('id="mt-abs"', "", "إضافة غائب")}
          <select id="mt-reason" aria-label="سبب الغياب">${ABSENCE_REASONS.map((r) => `<option>${esc(r)}</option>`).join("")}</select><button class="btn small" type="button" id="mt-abs-add">إضافة</button></div>
        <div id="mt-abs-list" style="margin-top:8px">${(d.absent || []).map((a, i) => `<span class="pill" style="display:inline-flex;gap:6px;align-items:center;margin:3px">${esc(a.name)} (${esc(a.reason || "")}) <button type="button" class="btn small ghost" data-del-abs="${i}" aria-label="حذف ${esc(a.name)}" style="padding:0 6px">×</button></span>`).join("") || '<span class="hint">لا يوجد غياب.</span>'}</div></section>
      <section class="panel"><h2>البنود التي نوقشت</h2>
        <div class="f"><label for="mt-items">كل بند في سطر (تُرقّم تلقائياً)</label><textarea id="mt-items" rows="9">${esc((d.items || []).join("\n"))}</textarea></div></section>
      <section class="panel"><h2>التوقيع</h2><div class="form">
        <div class="f"><label for="mt-rep">مقرر التقرير الأسبوعي (الموجه المسؤول عن التسليم)</label>${nameSel('id="mt-rep"', d.reporter, "مقرر التقرير")}</div>
        ${field({ label: "الموجه الفني الأول للعلوم", key: "first_name", value: d.first_name })}</div></section>`;
    bindFields(body, (k, v) => ed.change((x) => { x.data[k] = v; if (k === "period_from") { x.title = `التقرير الأسبوعي ${fmtDate(v)}`; } }));
    const addName = async () => { const v = await modal({ title: "إضافة اسم موجه", body: `<div class="f"><input id="mt-nn" type="text" aria-label="الاسم"></div>`, actions: [{ label: "إلغاء", value: null }, { label: "إضافة", kind: "primary", value: (b) => b.querySelector("#mt-nn").value.trim() }] });
      if (!v) return null; try { const { addMyOption } = await import("../store.js"); await addMyOption?.("meeting_guides", v); } catch (_) {} if (!names.includes(v)) names.push(v); return v; };
    const pick = async (sel) => { let v = sel.value; if (v === "__add") v = await addName(); sel.value = ""; return v || ""; };
    $("#mt-att", body).onchange = async (e) => { const v = await pick(e.target); if (!v) return; ed.change((x) => { x.data.attendees = [...new Set([...(x.data.attendees || []), v])]; }); ed.redraw(); };
    $("#mt-att-all", body).onclick = () => { const abs = new Set((ed.rec.data.absent || []).map((a) => a.name)); ed.change((x) => { x.data.attendees = [...new Set([...(x.data.attendees || []), ...names.filter((n) => !abs.has(n))])]; }); ed.redraw(); };
    $("#mt-abs-add", body).onclick = async () => { const sel = $("#mt-abs", body); const v = sel.value === "__add" ? await addName() : sel.value; if (!v) return toast("اختاري الاسم أولاً");
      const reason = $("#mt-reason", body).value; ed.change((x) => { x.data.absent = [...(x.data.absent || []).filter((a) => a.name !== v), { name: v, reason }]; x.data.attendees = (x.data.attendees || []).filter((n) => n !== v); }); ed.redraw(); };
    $("#mt-abs", body).onchange = async (e) => { if (e.target.value === "__add") { const v = await addName(); e.target.value = ""; if (v) { e.target.add(new Option(v, v), e.target.options[e.target.options.length - 1]); e.target.value = v; } } };
    $$("[data-del-att]", body).forEach((b) => (b.onclick = () => { const i = Number(b.dataset.delAtt); ed.change((x) => { x.data.attendees = (x.data.attendees || []).filter((_, j) => j !== i); }); ed.redraw(); }));
    $$("[data-del-abs]", body).forEach((b) => (b.onclick = () => { const i = Number(b.dataset.delAbs); ed.change((x) => { x.data.absent = (x.data.absent || []).filter((_, j) => j !== i); }); ed.redraw(); }));
    $("#mt-items", body).addEventListener("input", (e) => ed.change((x) => { x.data.items = e.target.value.split("\n").map((s) => s.replace(/^\s*\d+\s*[-–.)]\s*/, "").trim()).filter(Boolean); }));
    $("#mt-rep", body).onchange = async (e) => { let v = e.target.value; if (v === "__add") { v = await addName(); if (v) { e.target.add(new Option(v, v), e.target.options[e.target.options.length - 1]); e.target.value = v; } else { e.target.value = ed.rec.data.reporter || ""; return; } }
      ed.change((x) => { x.data.reporter = v; }); };
  } });
}

async function list(main) {
  const rows = (await api.list({ kind: KIND })).filter(isMeeting).sort((a, b) => (b.data.week_start || "").localeCompare(a.data.week_start || ""));
  const cur = weekStart(today());
  main.innerHTML = `<div class="container"><div class="page-head"><div><h1>التقرير الأسبوعي للتوجيه الفني</h1>
      <div class="sub">ملف مشترك بين الموجهين: تقرير واحد لكل أسبوع، يعدّله أي موجه ويُطبع بنفس النموذج.</div></div>
      <div class="row"><input type="date" id="mt-wk" value="${cur}" aria-label="الأسبوع"><a class="btn primary" id="mt-new" href="#/meeting/new?week=${cur}">+ تقرير الأسبوع</a></div></div>
    ${rows.length ? `<div class="tbl-wrap"><table class="data"><thead><tr><th>الفترة</th><th>تاريخ الاجتماع</th><th>المقرر</th><th>البنود</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="click" data-id="${r.id}" tabindex="0"><td>${esc(fmtDate(r.data.period_from))} — ${esc(fmtDate(r.data.period_to))}</td><td>${esc(fmtDate(r.data.meeting_date))}</td><td>${esc(r.data.reporter || "")}</td><td>${(r.data.items || []).length}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty"><h2>لا توجد تقارير بعد</h2><p>اضغطي «+ تقرير الأسبوع» لإنشاء تقرير هذا الأسبوع.</p></div>`}</div>`;
  $("#mt-wk", main).onchange = (e) => { $("#mt-new", main).href = `#/meeting/new?week=${weekStart(e.target.value || today())}`; };
  $$("tr.click", main).forEach((tr) => { tr.onclick = () => go(`#/meeting/${tr.dataset.id}`); tr.onkeydown = (e) => e.key === "Enter" && tr.onclick(); });
}
