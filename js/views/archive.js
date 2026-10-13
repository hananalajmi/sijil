// البحث الشامل والأرشيف، سلة المحذوفات، والتقارير المعتمدة
import { api } from "../api.js";
import { state, schoolById, teacherById, refreshPeople } from "../store.js";
import { esc, $, $$, fmtDate, debounce, toast, confirmBox } from "../ui.js";
import { KIND_LABEL, KIND_ROUTE, statusPill, schoolOptions, teacherOptions, go } from "../kit.js";
import { syncSchoolVisit, syncWeekly } from "../svlink.js";

const SEARCHABLE = ["school", "teacher", "teacher_visit", "school_visit", "exam_followup", "weekly_report", "monthly_achievements", "shared_achievements", "monthly_plan", "important_date", "event_report", "note"];

export default async function (main, { name, params }) {
  if (name === "trash") return trash(main);
  if (name === "approved") return approved(main);
  const all = (await api.list({ kinds: SEARCHABLE })).filter((r) => r.kind !== "guide_data");
  const years = [...new Set(all.map((r) => r.academic_year).filter(Boolean))].sort().reverse();
  main.innerHTML = `<div class="container"><div class="page-head"><div><h1>البحث والأرشيف</h1><div class="sub">ابحثي في كل السجلات وكل الأعوام الدراسية</div></div></div>
    <div class="toolbar"><input type="search" id="q" placeholder="كلمة البحث: اسم، درس، توصية…" value="${esc(params.q || "")}">
      <select id="k"><option value="">كل الأنواع</option>${SEARCHABLE.map((k) => `<option value="${k}">${KIND_LABEL[k]}</option>`).join("")}</select>
      <select id="y"><option value="">كل الأعوام</option>${years.map((y) => `<option ${y === params.year ? "selected" : ""}>${y}</option>`).join("")}</select>
      <select id="s">${schoolOptions("").replace("— اختاري المدرسة —", "كل المدارس")}</select>
      <select id="t">${teacherOptions("").replace("— اختاري —", "كل المعلمين")}</select>
      <select id="st"><option value="">كل الحالات</option><option value="draft" ${params.status === "draft" ? "selected" : ""}>مسودة / بانتظار الاعتماد</option><option value="approved">معتمد</option></select>
      <input type="date" id="from" aria-label="من تاريخ"><input type="date" id="to" aria-label="إلى تاريخ"></div><div id="out"></div></div>`;
  const out = $("#out", main);
  const paint = () => {
    const q = $("#q", main).value.trim(), k = $("#k", main).value, y = $("#y", main).value, s = $("#s", main).value, t = $("#t", main).value, st = $("#st", main).value, from = $("#from", main).value, to = $("#to", main).value;
    const list = all.filter((r) => (!k || r.kind === k) && (!y || r.academic_year === y) && (!s || r.school_id === s || r.id === s) && (!t || r.teacher_id === t || r.id === t)
      && (!st || r.status === st) && (!from || (r.record_date || "") >= from) && (!to || (r.record_date || "") <= to)
      && (!q || (r.title + " " + JSON.stringify(r.data) + " " + (schoolById(r.school_id)?.title || "") + " " + (teacherById(r.teacher_id)?.title || "")).includes(q)));
    out.innerHTML = list.length ? `<div class="list">${list.slice(0, 300).map((r) => `<a class="item" href="#/${KIND_ROUTE[r.kind]}/${r.kind === "teacher" ? r.school_id : r.id}"><span class="t">${esc(r.title || KIND_LABEL[r.kind])}</span>
      <span class="m">${KIND_LABEL[r.kind]} · ${esc(r.academic_year || "")}${r.record_date ? " · " + fmtDate(r.record_date) : ""}${schoolById(r.school_id) ? " · " + esc(schoolById(r.school_id).title) : ""}</span><span class="s">${statusPill(r)}</span></a>`).join("")}</div>
      <p class="hint">${list.length} نتيجة${list.length > 300 ? " (تظهر أول 300)" : ""}</p>` : `<div class="empty">لا توجد نتائج.</div>`;
  };
  $$(".toolbar input, .toolbar select", main).forEach((el) => el.addEventListener(el.tagName === "SELECT" || el.type === "date" ? "change" : "input", debounce(paint, 200)));
  paint();
}

async function trash(main) {
  const list = await api.list({ onlyDeleted: true });
  main.innerHTML = `<div class="container"><div class="page-head"><div><h1>سلة المحذوفات</h1><div class="sub">السجلات المحذوفة تبقى هنا حتى تستعيديها أو تحذفيها نهائياً</div></div></div><div id="out"></div></div>`;
  const out = $("#out", main);
  out.innerHTML = list.length ? `<div class="tbl-wrap"><table class="data"><tr><th>السجل</th><th>النوع</th><th>حُذف في</th><th></th></tr>${list.map((r) => `<tr data-id="${r.id}"><td>${esc(r.title || "—")}</td><td>${KIND_LABEL[r.kind]}</td><td>${new Date(r.deleted_at).toLocaleString("ar-KW")}</td>
    <td class="row"><button class="btn small" data-restore>استعادة</button><button class="btn small danger" data-purge>حذف نهائي</button></td></tr>`).join("")}</table></div>` : `<div class="empty">سلة المحذوفات فارغة.</div>`;
  $$("[data-restore]", out).forEach((b) => (b.onclick = async () => {
    const r = list.find((x) => x.id === b.closest("tr").dataset.id);
    try { await api.update(r.id, { deleted_at: null }, r.version); if (["school", "teacher"].includes(r.kind)) await refreshPeople();
      if (r.kind === "teacher_visit") await syncSchoolVisit(r.school_id, r.record_date, { create: !!r.teacher_id, term: r.term }).catch(() => {});
      if (r.kind === "teacher_visit" || r.kind === "school_visit") await syncWeekly(r.record_date).catch(() => {});
      toast("تمت الاستعادة"); trash(main); } catch (e) { toast(e.message, "error"); }
  }));
  $$("[data-purge]", out).forEach((b) => (b.onclick = async () => {
    const r = list.find((x) => x.id === b.closest("tr").dataset.id);
    if (!(await confirmBox("حذف نهائي", `سيُحذف «${r.title || KIND_LABEL[r.kind]}» نهائياً ولا يمكن استعادته.`, "حذف نهائي", true))) return;
    try { await api.remove(r.id); toast("حُذف نهائياً"); trash(main); } catch (e) { toast(e.message, "error"); }
  }));
}

async function approved(main) {
  const list = (await api.list({})).filter((r) => r.status === "approved");
  main.innerHTML = `<div class="container"><div class="page-head"><div><h1>التقارير المعتمدة</h1><div class="sub">نسخ ثابتة لا تتغير بتعديل البيانات الأصلية</div></div></div>
    ${list.length ? `<div class="list">${list.map((r) => `<div class="item"><span class="t">${esc(r.title || KIND_LABEL[r.kind])}</span><span class="m">${KIND_LABEL[r.kind]} · اعتُمد ${new Date(r.approved_at).toLocaleString("ar-KW")}</span>
      <span class="s"><a class="btn small" href="#/print/${r.id}">معاينة / طباعة</a>${r.kind !== "note" ? `<a class="btn small ghost" href="#/${KIND_ROUTE[r.kind]}/${r.id}">فتح السجل</a>` : ""}</span></div>`).join("")}</div>`
      : `<div class="empty">لا توجد تقارير معتمدة بعد. اعتمدي التقرير من شاشته بزر «اعتماد»، أو احفظي نسخة معتمدة من شاشة معاينة الإحصائية.</div>`}</div>`;
}
