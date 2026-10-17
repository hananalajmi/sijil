// التواريخ الهامة (إجازات، اجتماعات، دورات) — تُعبأ تلقائياً في الخطة الشهرية والإنجازات الشهرية
import { api } from "../api.js";
import { state, opts, officialDates, schoolById } from "../store.js";
import { today, fmtDate, academicYearOf, esc, $, $$, DAYS, MONTHS_AR, pad2, addDays, modal, toast } from "../ui.js";
import { field, bindFields, recordPage, go } from "../kit.js";
import { listView } from "./_list.js";

export default async function (main, { id, params }) {
  if (!id) return calendar(main, params);
  const rec = id === "new" ? { kind: "important_date", title: "", record_date: params.date || today(), academic_year: academicYearOf(params.date || undefined), data: { type: opts("date_types")[0] || "" } } : await api.get(id);
  if (!rec) { main.innerHTML = `<div class="container"><div class="empty">السجل غير موجود</div></div>`; return; }
  await recordPage(main, { rec, title: "تاريخ هام", render(body, ed) {
    const r = ed.rec;
    body.innerHTML = `<section class="panel"><div class="form">
      ${field({ label: "النوع", key: "type", type: "select", options: opts("date_types"), value: r.data.type, required: true })}
      ${field({ label: "العنوان (كما يظهر في الخطة)", key: "title", value: r.title, required: true, placeholder: "مثال: إجازة خاصة / اجتماع اللجنة الفنية" })}
      ${field({ label: "من تاريخ", key: "record_date", type: "date", value: r.record_date, required: true })}
      ${field({ label: "إلى تاريخ (اختياري)", key: "end_date", type: "date", value: r.data.end_date })}
      ${field({ label: "المكان", key: "place", value: r.data.place })}
      ${field({ label: "إدارة الاجتماع / الجهة المنفذة", key: "manager", value: r.data.manager })}
      ${field({ label: "الفئة المستهدفة", key: "target", type: "select", options: opts("target_groups"), value: r.data.target })}
      ${field({ label: "ملاحظات", key: "notes", type: "textarea", value: r.data.notes, wide: true })}</div>
      <p class="hint">الاجتماعات تظهر تلقائياً في «رابعاً: مجال اللجان» والدورات في «خامساً» من الإنجازات الشهرية، والإجازات في الخطة الشهرية.</p></section>`;
    bindFields(body, (k, v) => ed.change((x) => {
      if (k === "title") x.title = v; else if (k === "record_date") { x.record_date = v || null; x.academic_year = academicYearOf(v || undefined); } else x.data[k] = v;
    }));
  } });
}

/* ---------------- الرزنامة: اختاري اليوم ثم أضيفي الفعالية عليه ---------------- */
const TYPE_CLS = { "إجازة": "bad", "اجتماع": "acc", "دورة": "ok", "مكتب": "" };
async function calendar(main, params) {
  const month = params.month || today().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const [all, svs] = await Promise.all([api.list({ kind: "important_date" }), api.list({ kind: "school_visit" }).catch(() => [])]);
  const first = `${month}-01`, last = `${month}-${pad2(new Date(y, m, 0).getDate())}`;
  const inMonth = all.filter((d) => d.record_date && d.record_date <= last && (d.data.end_date || d.record_date) >= first);
  // زيارات الموجه للمدارس: تظهر باسم المدرسة في يومها
  const visits = svs.filter((v) => v.record_date && v.record_date >= first && v.record_date <= last && !v.deleted_at);
  const pinned = officialDates().filter((o) => o.from <= last && o.to >= first);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad2(m - 1)}`, next = m === 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}`;
  const startDow = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate();
  const cells = []; for (let i = 0; i < startDow; i++) cells.push(null); for (let d = 1; d <= days; d++) cells.push(d); while (cells.length % 7) cells.push(null);
  const t = today();
  main.innerHTML = `<div class="container">
    <div class="page-head"><div><h1>التواريخ الهامة</h1><div class="sub">اضغطي على أي يوم لإضافة إجازة أو اجتماع أو دورة. تظهر تلقائياً في الخطة الشهرية والإنجازات الشهرية.</div></div></div>
    <div class="toolbar cal-nav"><a class="btn" href="#/dates?month=${prev}">→ الشهر السابق</a><b class="cal-title">${MONTHS_AR[m - 1]} ${y}</b><a class="btn" href="#/dates?month=${next}">الشهر التالي ←</a>
      <a class="btn ghost" href="#/dates?month=${t.slice(0, 7)}">اليوم</a></div>
    <div class="cal">${DAYS.map((d, k) => `<div class="cal-h ${k >= 5 ? "we" : ""}">${d}</div>`).join("")}
      ${cells.map((d, k) => {
        if (!d) return `<div class="cal-d empty"></div>`;
        const iso = `${month}-${pad2(d)}`;
        const evs = inMonth.filter((e) => e.record_date <= iso && (e.data.end_date || e.record_date) >= iso);
        const pins = pinned.filter((o) => o.from <= iso && o.to >= iso);
        const vis = visits.filter((v) => v.record_date === iso);
        return `<div class="cal-d ${iso === t ? "today" : ""} ${k % 7 >= 5 ? "we" : ""} ${pins.some((o) => o.holiday) ? "hol" : ""}" data-date="${iso}" tabindex="0" role="button" aria-label="إضافة على ${d} ${MONTHS_AR[m - 1]}">
          <span class="cal-n">${d}</span>${pins.map((o) => `<span class="cal-ev cal-pin ${o.holiday ? "hol" : ""} ${o.subject ? "subj" : ""}" data-pin="${o.id}" role="button" tabindex="0" title="${esc(o.details || o.title)}">${o.subject ? "⚗️" : "📌"} ${esc(o.title)}</span>`).join("")}${evs.map((e) => `<a class="cal-ev pill ${TYPE_CLS[e.data.type] ?? ""}" href="#/dates/${e.id}" title="${esc(e.data.type || "")}">${esc(e.title || e.data.type)}</a>`).join("")}${vis.map((v) => `<a class="cal-ev cal-visit" href="#/school-visits/${v.id}" title="زيارة مدرسة${v.data?.visit_type ? " — " + esc(v.data.visit_type) : ""}">🏫 ${esc(schoolById(v.school_id)?.title || "زيارة مدرسة")}</a>`).join("")}</div>`;
      }).join("")}</div>
    <p class="hint">🏫 زياراتك للمدارس تظهر تلقائياً باسم المدرسة في يوم الزيارة (اضغطي عليها لفتح الزيارة). 📌 التواريخ الثابتة من التقويم الدراسي و⚗️ تواريخ مادتك (الإنماء المهني والتدريب الميداني) تظهر تلقائياً ولا تُحذف، والعطل منها تُعلَّم تلقائياً في الخطة الشهرية. ولكل فعالية أضفتِها: اضغطي عليها لتعديلها أو حذفها.</p></div>`;
  $$(".cal-d[data-date]", main).forEach((c) => {
    const open = async (e) => {
      if (e.target.closest("a.cal-ev")) return;
      const pin = e.target.closest("[data-pin]");
      if (pin) { // تفاصيل التاريخ الثابت كاملة
        const o = pinned.find((x) => x.id === pin.dataset.pin);
        if (o) {
          const b = document.createElement("div");
          b.innerHTML = `<p style="font-size:1.05em;line-height:1.9">${esc(o.details || o.title)}</p><p class="hint">${fmtDate(o.from)}${o.to > o.from ? " — " + fmtDate(o.to) : ""}${o.subject ? " · مادة " + esc(o.subject) : ""}</p>`;
          if ((await modal({ title: o.title, body: b, actions: [{ label: "إغلاق", value: null }, { label: "إضافة فعالية على هذا اليوم", kind: "primary", value: "add" }] })) !== "add") return;
        }
      }
      const date = c.dataset.date;
      const body = document.createElement("div");
      body.innerHTML = `<div class="form" style="grid-template-columns:1fr">
        ${field({ label: "النوع", key: "type", type: "select", options: opts("date_types"), value: opts("date_types")[0] || "", custom: false })}
        ${field({ label: "العنوان", key: "title", placeholder: "مثال: اجتماع اللجنة الفنية المشتركة" })}
        ${field({ label: "إلى تاريخ (لأكثر من يوم)", key: "end_date", type: "date", value: "" })}
        ${field({ label: "المكان", key: "place" })}</div>`;
      const v = await modal({ title: `إضافة على ${fmtDate(date)}`, body, actions: [{ label: "إلغاء", value: null }, { label: "تفاصيل أكثر…", value: "more" },
        { label: "إضافة", kind: "primary", value: (b) => Object.fromEntries($$("[data-key]", b).map((x) => [x.dataset.key, x.value.trim()])) }] });
      if (v === "more") return go(`#/dates/new?date=${date}`);
      if (!v) return;
      if (!v.title) v.title = v.type;
      try {
        await api.create({ kind: "important_date", title: v.title, record_date: date, academic_year: academicYearOf(date), data: { type: v.type, end_date: v.end_date && v.end_date > date ? v.end_date : "", place: v.place } });
        toast("أُضيف"); calendar(main, { month });
      } catch (err) { toast(err.message, "error"); }
    };
    c.addEventListener("click", open);
    c.addEventListener("keydown", (e) => { if (e.key === "Enter") open(e); });
  });
}
