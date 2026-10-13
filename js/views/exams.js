// متابعة الامتحانات النظرية والعملية — كل متابعة تدخل تلقائياً في إحصائيتها
import { api } from "../api.js";
import { state, opts, schoolById } from "../store.js";
import { $, today, dayName, fmtDate, academicYearOf } from "../ui.js";
import { field, bindFields, recordPage, schoolOptions } from "../kit.js";
import { listView } from "./_list.js";

const TYPES = { theory: "نظري", practical: "عملي" };

export default async function (main, { id, params }) {
  if (!id) return listView(main, { kind: "exam_followup", title: "متابعة الامتحانات النظرية والعملية", sub: "كل متابعة تُسجَّل هنا مرة واحدة وتظهر في إحصائيتها تلقائياً", newLabel: "+ متابعة امتحان", schoolFilter: true,
    extraHead: `<a class="btn" href="#/stats-theory">إحصائية النظري</a><a class="btn" href="#/stats-practical">إحصائية العملي</a>`,
    columns: [{ label: "التاريخ", get: (r) => `${dayName(r.record_date)} ${fmtDate(r.record_date)}` }, { label: "المدرسة", get: (r) => schoolById(r.school_id)?.title || "—" },
      { label: "الامتحان", get: (r) => TYPES[r.data.exam_type] || "" }, { label: "امتحان الصف", get: (r) => r.data.grade }, { label: "الفترة", get: (r) => r.term }] });
  const rec = id === "new" ? { kind: "exam_followup", title: "", record_date: today(), academic_year: state.year, term: opts("terms")[0] || "", school_id: params.school || null, data: { exam_type: params.type || "theory" } } : await api.get(id);
  if (!rec) { main.innerHTML = `<div class="container"><div class="empty">السجل غير موجود</div></div>`; return; }
  await recordPage(main, { rec, title: "متابعة امتحان", render(body, ed) {
    const r = ed.rec;
    body.innerHTML = `<section class="panel"><div class="form">
      ${field({ label: "نوع الامتحان", key: "exam_type", type: "select", options: ["نظري", "عملي"], value: TYPES[r.data.exam_type], custom: false, required: true })}
      <div class="f"><label for="sch" class="req">المدرسة</label><select id="sch" data-key="school_id">${schoolOptions(r.school_id, { allowAdd: true })}</select></div>
      ${field({ label: "امتحان الصف", key: "grade", type: "select", options: opts("grades"), value: r.data.grade, required: true })}
      ${field({ label: "التاريخ", key: "record_date", type: "date", value: r.record_date, required: true })}
      <div class="f"><span class="lab">اليوم</span><input readonly id="day" value="${dayName(r.record_date)}"></div>
      ${field({ label: "الفترة / الفصل الدراسي", key: "term", type: "select", options: opts("terms"), value: r.term })}
      ${field({ label: "ملاحظات", key: "notes", type: "textarea", value: r.data.notes, wide: true })}</div></section>`;
    bindFields(body, (k, v) => {
      ed.change((x) => {
        if (k === "school_id") x.school_id = v || null;
        else if (k === "record_date") { x.record_date = v || null; x.academic_year = academicYearOf(v || undefined); }
        else if (k === "term") x.term = v;
        else if (k === "exam_type") x.data.exam_type = v === "عملي" ? "practical" : "theory";
        else x.data[k] = v;
        x.title = [TYPES[x.data.exam_type], schoolById(x.school_id)?.title, x.data.grade].filter(Boolean).join(" — ");
      });
      if (k === "record_date") $("#day", body).value = dayName(ed.rec.record_date);
    });
  } });
}
