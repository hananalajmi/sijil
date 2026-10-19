// تقرير الفعالية / التنمية المهنية (وفق ملف Word المرفق)
import { api } from "../api.js";
import { state, schoolById, opts } from "../store.js";
import { $, today, dayName, fmtDate, academicYearOf } from "../ui.js";
import { field, bindFields, recordPage, schoolOptions, photoSlots } from "../kit.js";
import { listView } from "./_list.js";
import { printOptionsPanel, bindPrintOptions } from "./teacherVisit.js";
import { LOGOS } from "../templates.js";
import { EV_LOGO_DEFAULT } from "../report/builders.js";
// الشعارات المتاحة لرأس تقرير الفعالية
const EV_LOGO_CHOICES = ["ministry_event", "ministry_hd", "ministry", "emblem", "seal_gold", "directorate_event", "directorate", "general_science", "science_guidance", "new_kuwait"];

export default async function (main, { id }) {
  if (!id) return listView(main, { kind: "event_report", title: "تقرير الفعالية / التنمية المهنية", newLabel: "+ تقرير فعالية",
    columns: [{ label: "التاريخ", get: (r) => fmtDate(r.record_date) }, { label: "الفعالية", get: (r) => r.data.event_name }, { label: "عنوان التنمية المهنية", get: (r) => r.data.pd_title }, { label: "المكان", get: (r) => r.data.place || schoolById(r.school_id)?.title || "" }] });
  const rec = id === "new" ? { kind: "event_report", title: "", record_date: today(), academic_year: state.year, data: {} } : await api.get(id);
  if (!rec) { main.innerHTML = `<div class="container"><div class="empty">السجل غير موجود</div></div>`; return; }
  await recordPage(main, { rec, title: "تقرير الفعالية / التنمية المهنية", beforeApprove: (r) => [!r.data.event_name && "اسم الفعالية", !r.record_date && "التاريخ", !r.data.place && "المكان"].filter(Boolean),
    render(body, ed) {
      const r = ed.rec, d = r.data;
      body.innerHTML = `<section class="panel"><div class="form">
        ${field({ label: "اسم الفعالية", key: "event_name", value: d.event_name, required: true, wide: true })}
        ${field({ label: "عنوان التنمية المهنية", key: "pd_title", value: d.pd_title })}
        ${field({ label: "الجهة المنفذة", key: "organizer", value: d.organizer })}
        ${field({ label: "التاريخ", key: "record_date", type: "date", value: r.record_date, required: true })}
        <div class="f"><span class="lab">اليوم</span><input readonly id="day" value="${dayName(r.record_date)}"></div>
        ${field({ label: "المكان", key: "place", value: d.place, required: true, placeholder: "مثال: ثانوية جمانة بنت الحسن / مركز التدريب" })}
        ${field({ label: "دور الموجه في الفعالية", key: "guide_role", type: "select", options: ["قدّمها الموجه", "أشرف عليها / حضرها", "اجتازها الموجه"], value: d.guide_role, custom: false, hint: "يحدد الجدول الذي تظهر فيه في الإنجازات الشهرية؛ لا يُطبع في تقرير الفعالية" })}
        ${field({ label: "الفئة المستهدفة", key: "target", type: "select", options: opts("target_groups"), value: d.target })}
        ${field({ label: "نبذة مختصرة عن التنمية المهنية", key: "summary", type: "textarea", value: d.summary, wide: true, rows: 6 })}
      </div></section>
      <section class="panel"><h2>الشعارات في رأس التقرير</h2><p class="hint">اختاري شعاراً أو اثنين أو ثلاثة، وحددي مكان كل شعار. «بدون» يترك المكان فارغاً.</p><div class="form">
        ${[["r", "اليمين"], ["c", "الوسط"], ["l", "اليسار"]].map(([k, l]) => { const v = (d.evLogos || EV_LOGO_DEFAULT)[k] ?? ""; return `<div class="f"><label for="evl-${k}">شعار ${l}</label><select id="evl-${k}" data-evl="${k}">
          <option value="" ${!v ? "selected" : ""}>بدون</option>${EV_LOGO_CHOICES.filter((x) => LOGOS[x]).map((x) => `<option value="${x}" ${x === v ? "selected" : ""}>${LOGOS[x].label}</option>`).join("")}</select></div>`; }).join("")}
      </div></section>
      <section class="panel"><h2>صور معبرة</h2><p class="hint">أضيفي صورة أو أكثر؛ تُطبع كلها بنفس الحجم وحولها إطار بسيط.</p><div id="photo"></div></section>${printOptionsPanel(ed)}`;
      bindFields(body, (k, v) => {
        ed.change((x) => {
          if (k === "school_id") x.school_id = v || null;
          else if (k === "record_date") { x.record_date = v || null; x.academic_year = academicYearOf(v || undefined); } else x.data[k] = v;
          x.title = x.data.event_name || "";
        });
        if (k === "record_date") $("#day", body).value = dayName(ed.rec.record_date);
      });
      // صور متعددة: خانة فارغة إضافية دائماً بعد آخر صورة (حتى 9 صور)
      const photos = () => [...(ed.rec.data.photos || []), ...(ed.rec.data.photo && !(ed.rec.data.photos || []).length ? [ed.rec.data.photo] : [])].filter(Boolean);
      const paintPhotos = () => photoSlots($("#photo", body), photos(), Math.min(9, photos().length + 1), (ids) => {
        ed.change((x) => { x.data.photos = ids.filter(Boolean); x.data.photo = x.data.photos[0] || null; }, { immediate: true }); paintPhotos(); }, { recordId: r.id });
      paintPhotos();
      body.querySelectorAll("[data-evl]").forEach((sel) => (sel.onchange = () => ed.change((x) => { x.data.evLogos = { ...EV_LOGO_DEFAULT, ...(x.data.evLogos || {}), [sel.dataset.evl]: sel.value }; })));
      bindPrintOptions(body, ed);
    } });
}
