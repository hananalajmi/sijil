// الإحصائيات: تُحسب مباشرة من السجلات الفعلية، وكل رقم مربوط بمصدره
import { api } from "../api.js";
import { state, opts, schoolById } from "../store.js";
import { esc, $, $$, dayName, fmtDate, toast } from "../ui.js";
import { go, schoolOptions } from "../kit.js";
import { visitStatsContext, examStatsContext } from "../report/context.js";
import { STATS } from "../templates.js";

export default async function view(main, { name, params }) {
  const stats = () => view(main, { name, params });
  const termParam = params.term ?? (opts("terms")[0] || "");
  const term = termParam === "all" ? "" : termParam;
  const termSel = `<select id="term" aria-label="الفترة">${[["all", "كل الفترات"], ...opts("terms").map((t) => [t, "الفترة " + t])].map(([v, l]) => `<option value="${esc(v)}" ${v === termParam ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")).toString();

  if (name === "stats-visits") {
    const school = params.school || "";
    const ctx = await visitStatsContext({ year: state.year, term, school });
    const p = qs({ year: state.year, term, school });
    const over = ctx.rows.filter((r) => r.visits.length > 3);
    main.innerHTML = `<div class="container">
      <div class="page-head"><div><h1>إحصائية زيارات المعلمين</h1><div class="sub">العام ${esc(state.year)} — تُحسب من سجلات زيارة المعلم مباشرة؛ كل زيارة تُحسب مرة واحدة</div></div>
        <div class="row"><a class="btn primary" href="#/print/stats-visits?${p}&auto=1">طباعة / PDF</a><a class="btn" href="#/print/stats-visits?${p}">معاينة</a><a class="btn" href="#/print/stats-visits?${p}&word=1">Word</a></div></div>
      <div class="toolbar">${termSel}<select id="school" aria-label="المدرسة">${schoolOptions(school).replace("— اختاري المدرسة —", "كل المدارس")}</select></div>
      <div class="tiles" style="margin-bottom:14px"><div class="tile"><span class="num">${ctx.total}</span><b>زيارة محسوبة</b><span>بلا تكرار</span></div>
        <div class="tile"><span class="num">${ctx.rows.filter((r) => r.visits.length).length}</span><b>معلماً تمت زيارتهم</b></div>
        <div class="tile"><span class="num">${ctx.rows.filter((r) => !r.visits.length && !r.reason).length}</span><b>لم تتم زيارتهم</b><span>بدون سبب مسجّل</span></div>
        <div class="tile"><span class="num">${ctx.rows.filter((r) => r.reason).length}</span><b>بعذر</b><span>إجازة، مجلس، وضع…</span></div></div>
      ${over.length ? `<div class="alert" style="margin-bottom:12px">${over.length} معلم لهم أكثر من 3 زيارات في هذه الفترة. النموذج الرسمي فيه 3 خانات فقط، فتظهر أول 3 زيارات في الطباعة، وتبقى البقية في سجل المعلم.</div>` : ""}
      ${ctx.rows.length ? `<div class="tbl-wrap"><table class="data"><thead><tr><th>م</th><th>المدرسة</th><th>اسم المعلم</th><th>الزيارة الأولى</th><th>الزيارة الثانية</th><th>الزيارة الثالثة</th><th>سبب عدم الزيارة</th></tr></thead><tbody>
        ${ctx.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.school)}</td><td>${esc(r.teacher)}</td>
          ${[0, 1, 2].map((k) => { const v = r.visits[k]; return `<td>${v ? `<a class="src-link" href="#/teacher-visits/${v.id}" title="فتح الزيارة المصدر">${dayName(v.date)} ${fmtDate(v.date)}</a><br><small>${esc(v.cls)}</small>` : ""}</td>`; }).join("")}
          <td>${r.visits.length >= 3 ? "" : term ? `<select class="why" data-t="${r.teacher_id}" aria-label="سبب عدم زيارة ${esc(r.teacher)}"><option value="">—</option>${[...new Set([...opts("no_visit_reasons"), r.reason].filter(Boolean))].map((o) => `<option ${o === r.reason ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>` : `<span class="why-t">${esc(r.reason)}</span>`}</td></tr>`).join("")}</tbody></table></div>`
        : `<div class="empty">لا توجد أسماء معلمات بعد. <a href="#/schools">أضيفيها من صفحة المدارس</a></div>`}
      <p class="hint">اضغطي على أي تاريخ لفتح الزيارة التي جاء منها. إذا لم تُزر المعلمة لسبب (إجازة دراسية، مجلس، وضع…) اختاريه من «سبب عدم الزيارة»${term ? "" : " بعد اختيار الفترة"}، فيظهر في الطباعة مكان الزيارات الناقصة.</p></div>`;
    const nav = () => go(`#/stats-visits?${qs({ term: $("#term", main).value, school: $("#school", main).value })}`);
    $("#term", main).onchange = nav; $("#school", main).onchange = nav;
    $$("select.why", main).forEach((sel) => (sel.onchange = async () => {
      const i = state.teachers.findIndex((t) => t.id === sel.dataset.t); if (i < 0) return;
      const t = state.teachers[i], key = `${state.year}|${term}`;
      const no_visit = { ...(t.data?.no_visit || {}) };
      if (sel.value) no_visit[key] = sel.value; else delete no_visit[key];
      sel.disabled = true;
      try { state.teachers[i] = await api.update(t.id, { data: { ...(t.data || {}), no_visit } }, t.version); toast("حُفظ السبب"); stats(); }
      catch (e) { toast("تعذر الحفظ: " + e.message, "error"); sel.disabled = false; }
    }));
    return;
  }

  const examType = name === "stats-practical" ? "practical" : "theory";
  const versions = STATS[examType].versions;
  const version = params.version || versions[0].id;
  const ctx = await examStatsContext({ year: state.year, term, examType, version });
  const p = qs({ year: state.year, term, type: examType, version });
  main.innerHTML = `<div class="container">
    <div class="page-head"><div><h1>إحصائية متابعة الامتحان ${examType === "theory" ? "النظري" : "العملي"}</h1><div class="sub">العام ${esc(state.year)} — من سجلات «متابعة الامتحانات»</div></div>
      <div class="row"><a class="btn" href="#/exams/new?type=${examType}">+ متابعة امتحان</a><a class="btn primary" href="#/print/stats-exams?${p}&auto=1">طباعة / PDF</a><a class="btn" href="#/print/stats-exams?${p}">معاينة</a><a class="btn" href="#/print/stats-exams?${p}&word=1">Word</a></div></div>
    <div class="toolbar">${termSel}${versions.length > 1 ? `<select id="ver" aria-label="إصدار القالب">${versions.map((v) => `<option value="${v.id}" ${v.id === version ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select>` : ""}</div>
    ${versions.length > 1 ? `<p class="hint">يوجد إصداران رسميان لهذا القالب يختلفان في العنوان فقط: «للفترة الدراسية» (2025-2026) و«للفصل الدراسي» (2024-2025). اختاري المطلوب.</p>` : ""}
    ${ctx.rows.length ? `<div class="tbl-wrap"><table class="data"><thead><tr><th>م</th><th>المدرسة</th><th>امتحان الصف</th><th>اليوم والتاريخ</th><th>امتحان الصف</th><th>اليوم والتاريخ</th><th>امتحان الصف</th><th>اليوم والتاريخ</th></tr></thead><tbody>
      ${ctx.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.school)}</td>${[0, 1, 2].map((k) => { const e = r.exams[k]; return e ? `<td>${esc(e.grade)}</td><td><a class="src-link" href="#/exams/${e.id}">${dayName(e.date)} ${fmtDate(e.date)}</a></td>` : "<td></td><td></td>"; }).join("")}</tr>`).join("")}
      </tbody></table></div><p class="hint">${ctx.total} متابعة. إذا زادت متابعات المدرسة عن 3 تنتقل إلى صف إضافي لنفس المدرسة.</p>`
      : `<div class="empty"><h2>لا توجد متابعات ${examType === "theory" ? "نظرية" : "عملية"} في هذه الفترة</h2><div class="row"><a class="btn primary" href="#/exams/new?type=${examType}">+ متابعة امتحان</a></div></div>`}</div>`;
  const nav = () => go(`#/${name}?${qs({ term: $("#term", main).value, version: $("#ver", main)?.value })}`);
  $("#term", main).onchange = nav; $("#ver", main) && ($("#ver", main).onchange = nav);
}
