// الإنجازات الأسبوعية — «تقرير زيارات التوجيه الفني للعلوم»
// الزيارات وملخصاتها تُسحب تلقائياً من زيارات الأسبوع، وتبقى قابلة للتعديل.
import { api } from "../api.js";
import { state, G, opts } from "../store.js";
import { esc, $, $$, today, weekStart, addDays, fmtDate, dayName, academicYearOf, MONTHS_AR, toast } from "../ui.js";
import { field, bindFields, recordPage, go } from "../kit.js";
import { listView } from "./_list.js";
import { weeklyAuto, mergeRows, weekLabel } from "../report/context.js";
import { WEEKLY_REPORT } from "../templates.js";
import { printOptionsPanel, bindPrintOptions } from "./teacherVisit.js";
import { mergeWeekly } from "../svlink.js";

const monthOf = (ws) => ws.slice(0, 7);
const mName = (m) => MONTHS_AR[Number(m.split("-")[1]) - 1];

export default async function (main, { id, params }) {
  if (!id) return listView(main, { kind: "weekly_report", title: "الإنجازات الأسبوعية", sub: "تقرير زيارات التوجيه الفني للعلوم — الزيارات تُعبأ تلقائياً من سجلاتك", newLabel: "+ تقرير أسبوع",
    sort: (a, b) => (b.data.week_start || "").localeCompare(a.data.week_start || ""),
    columns: [{ label: "الأسبوع", get: (r) => `${r.data.week_label || ""} — ${mName(r.data.month || r.data.week_start)}` }, { label: "من", get: (r) => fmtDate(r.data.week_start) }, { label: "إلى", get: (r) => fmtDate(addDays(r.data.week_start, 4)) },
      { label: "الزيارات", get: (r) => (r.data.rows || []).length, cls: "num" }, { label: "أُرسل للتجميع", get: (r) => (r.data.submitted ? "نعم" : "لا") }] });
  let rec;
  if (id === "new") {
    const ws = weekStart(params.week || today());
    const ex = (await api.list({ kind: "weekly_report" })).find((p) => p.data.week_start === ws);
    if (ex) { location.replace(`#/weekly/${ex.id}`); return; }
    rec = { kind: "weekly_report", title: `تقرير زيارات ${fmtDate(ws)}`, record_date: ws, academic_year: academicYearOf(ws),
      data: { template: WEEKLY_REPORT.version, week_start: ws, month: monthOf(ws), week_label: weekLabel(ws), rows: await weeklyAuto(ws), submitted: false, guide_name: G().full_name || "" } };
  } else rec = await api.get(id);
  if (!rec) { main.innerHTML = `<div class="container"><div class="empty">السجل غير موجود</div></div>`; return; }

  await recordPage(main, { rec, title: "الإنجازات الأسبوعية — تقرير زيارات التوجيه الفني للعلوم", async render(body, ed) {
    // مرتبطة بزيارات المدارس والمعلمين: تتحدث تلقائياً عند الفتح (الصفوف المعدّلة يدوياً لا تُمس)
    if (ed.rec.status !== "approved" && ed.rec.data.week_start) {
      const merged = mergeWeekly(ed.rec.data.rows || [], await weeklyAuto(ed.rec.data.week_start));
      if (JSON.stringify(merged) !== JSON.stringify(ed.rec.data.rows || [])) ed.change((x) => (x.data.rows = merged));
    }
    const r = ed.rec, d = r.data;
    body.innerHTML = `
    <section class="panel" id="basic"><div class="form">
      ${field({ label: "الأسبوع (اختاري أي يوم منه)", key: "week", type: "date", value: d.week_start })}
      <div class="f"><span class="lab">الشهر</span><input readonly id="mn" value="${esc(mName(d.month || d.week_start))}"></div>
      ${field({ label: "الأسبوع", key: "week_label", type: "select", options: ["الأول", "الثاني", "الثالث", "الرابع", "الخامس"], value: d.week_label, custom: false })}
      <div class="f"><span class="lab">الفترة</span><input readonly id="range" value="من ${fmtDate(d.week_start)} إلى ${fmtDate(addDays(d.week_start, 4))}"></div></div>
      <label class="row" style="margin-top:10px"><input type="checkbox" id="sub" ${d.submitted ? "checked" : ""}> إرسال التقرير إلى المسؤول عن التجميع (لا يطّلع عليه غيره)</label></section>
    <section class="panel"><div class="page-head" style="margin-bottom:8px"><div><h2>أولاً وثانياً: الزيارات وملخص ما تم إنجازه</h2>
      <div class="sub">صف لكل مدرسة في كل يوم، مرتبط بزيارة الموجه للمدرسة وزيارات المعلمين: يتحدث تلقائياً كلما عدّلتِ الزيارة. الصف الذي تعدّلينه هنا يبقى كما كتبتِه.</div></div>
      <div class="row"><button class="btn" id="sync">تحديث من السجلات</button><button class="btn" id="addrow">+ صف يدوي</button></div></div>
      <div id="rows"></div></section>
    <section class="panel"><h2>ثالثاً: مستوى المعلمين والمتعلمين</h2>${field({ label: "كل نقطة في سطر", key: "level", type: "textarea", value: d.level, wide: true, rows: 5 })}</section>
    <section class="panel"><h2>رابعاً: الإيجابيات والسلبيات والمقترحات</h2><div class="form">
      ${field({ label: "الإيجابيات", key: "positives", type: "textarea", value: d.positives })}${field({ label: "السلبيات", key: "negatives", type: "textarea", value: d.negatives })}${field({ label: "المقترحات", key: "suggestions", type: "textarea", value: d.suggestions })}</div></section>
    <section class="panel"><h2>خامساً: الملاحظات</h2><div class="form">${field({ label: "الملاحظة (اختياري)", key: "note", type: "select", options: opts("weekly_notes"), value: d.note || "", remember: "weekly_notes", wide: true, hint: "تُطبع «خامساً: الملاحظات» فقط إذا اخترتِ ملاحظة — لملاحظة جديدة: «+ إضافة خيار جديد للقائمة»" })}</div></section>
    ${printOptionsPanel(ed, { sigsEveryPage: true })}`;
    const box = $("#rows", body);
    const paint = () => {
      const rows = ed.rec.data.rows || [];
      box.innerHTML = rows.length ? rows.map((x, i) => `<div class="panel wr-row" data-i="${i}" style="background:var(--sunk)"><div class="form">
          <div class="f"><label>التاريخ</label><input type="date" data-c="date" value="${esc(x.date || "")}"></div>
          <div class="f"><span class="lab">اليوم</span><input readonly value="${esc(dayName(x.date))}"></div>
          <div class="f"><label>مكان الزيارة</label><input data-c="place" value="${esc(x.place || "")}"></div>
          <div class="f wide"><label>الهدف من الزيارة</label><textarea data-c="goal" rows="2">${esc(x.goal || "")}</textarea></div>
          <div class="f wide"><label>ملخص الزيارة</label><textarea data-c="summary" rows="4">${esc(x.summary || "")}</textarea></div></div>
          <div class="row" style="margin-top:6px">${!x.auto ? '<span class="pill">يدوي</span>' : x.edited ? '<span class="pill">من الزيارات — عُدّل يدوياً</span> <button class="btn small ghost" data-relink>إرجاعه ليتحدث من الزيارات</button>' : '<span class="pill acc">من زيارة المدرسة — يتحدث تلقائياً</span>'}<span style="flex:1"></span><button class="btn small danger" data-del>حذف الصف</button></div></div>`).join("")
        : `<div class="empty">لا توجد زيارات مسجلة في هذا الأسبوع. سجّلي زياراتك في «زيارة الموجه للمدرسة» أو «زيارة المعلم» ثم اضغطي «تحديث من السجلات»، أو أضيفي صفاً يدوياً.</div>`;
      $$(".wr-row", box).forEach((el) => {
        const i = Number(el.dataset.i);
        // تعديل صف مرتبط يجعله «معدّلاً يدوياً» فلا يُكتب فوقه
        $$("[data-c]", el).forEach((inp) => inp.addEventListener("input", () => ed.change((x) => (x.data.rows[i] = { ...x.data.rows[i], [inp.dataset.c]: inp.value, ...(x.data.rows[i].auto ? { edited: true } : {}) }))));
        const rl = el.querySelector("[data-relink]"); if (rl) rl.onclick = async () => {
          const rows0 = (ed.rec.data.rows || []).map((y, j) => (j === i ? { ...y, edited: false } : y));
          const merged = mergeWeekly(rows0, await weeklyAuto(ed.rec.data.week_start)); ed.change((x) => (x.data.rows = merged)); paint(); };
        el.querySelector("[data-c=date]").addEventListener("change", paint);
        el.querySelector("[data-del]").onclick = () => { ed.change((x) => x.data.rows.splice(i, 1)); paint(); };
      });
    };
    paint();
    $("#sync", body).onclick = async () => {
      const before = JSON.stringify(ed.rec.data.rows || []);
      const rows = mergeWeekly(ed.rec.data.rows || [], await weeklyAuto(ed.rec.data.week_start));
      if (JSON.stringify(rows) !== before) { ed.change((x) => (x.data.rows = rows)); paint(); toast("حُدّثت الزيارات"); } else toast("الزيارات محدّثة");
    };
    $("#addrow", body).onclick = () => { ed.change((x) => (x.data.rows = [...(x.data.rows || []), { date: x.data.week_start }])); paint(); };
    bindFields(body, async (k, v) => {
      if (k === "week") {
        if (!v) return;
        const ws = weekStart(v);
        const ex = (await api.list({ kind: "weekly_report" })).find((p) => p.data.week_start === ws && p.id !== ed.rec.id);
        if (ex) { toast("يوجد تقرير لهذا الأسبوع، فُتح لك"); go(`#/weekly/${ex.id}`); return; }
        const auto = await weeklyAuto(ws);
        ed.change((x) => { x.data.week_start = ws; x.data.month = monthOf(ws); x.data.week_label = weekLabel(ws); x.record_date = ws; x.academic_year = academicYearOf(ws); x.title = `تقرير زيارات ${fmtDate(ws)}`;
          x.data.rows = [...(x.data.rows || []).filter((r) => !r.auto), ...auto]; });
        ed.redraw();
      } else ed.change((x) => (x.data[k] = v));
    });
    $("#sub", body).onchange = (e) => ed.change((x) => { x.data.submitted = e.target.checked; x.data.guide_name = G().full_name || state.profile.full_name; }, { immediate: true });
    bindPrintOptions(body, ed);
  } });
}
