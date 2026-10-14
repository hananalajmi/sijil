// بناء التقارير المطبوعة من البيانات وفق القوالب الرسمية المرفقة.
// كل دالة تستقبل "سياق" قابلاً للحفظ (يُحفظ كما هو كنسخة ثابتة عند الاعتماد) وتعيد تقريراً للمحرك.
import { esc, fmtDate, dayName, yearLabel, WORK_DAYS, DAYS, MONTHS_EN, parseDate, addDays } from "../ui.js";
import { TEACHER_VISIT, SCHOOL_VISIT, STATS } from "../templates.js";
import { fileUrl, logoSrc } from "../store.js";

export const val = (v) => esc(v ?? "");
export const nl = (s) => esc(s || "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
export async function img(fileId, cls = "") { const u = await fileUrl(fileId); return u ? `<img class="${cls}" src="${u}" alt="">` : ""; }
export async function logo(key, cls = "") { const u = await logoSrc(key); return u ? `<img class="logo ${cls}" src="${u}" alt="">` : ""; }

// خانات التوقيع: الاسم + صورة التوقيع والختم (عند اختيار المستخدم) + التاريخ الاختياري
async function sigSlot(s) {
  const sig = s.sigFile ? await img(s.sigFile, "sig-img") : "";
  const stamp = s.stampFile ? await img(s.stampFile, "stamp-img") : "";
  return `<div class="sig">
    <div class="sig-title">${val(s.title)}</div>
    ${s.noName ? "" : `<div class="sig-name">${s.prefix ?? "أ /"} ${val(s.name) || '<span class="dots"></span>'}</div>`}
    <div class="sig-marks">${sig}${stamp}</div>
    ${s.date ? `<div class="sig-date">${val(s.date)}</div>` : ""}
  </div>`;
}
export const sigRow = async (slots, cls = "") => `<div class="sigs ${cls}">${(await Promise.all(slots.map(sigSlot))).join("")}</div>`;
// توقيع الموجّه: الصورة والختم يظهران فقط إذا اختار المستخدم ذلك لهذا التقرير
export const mySig = (ctx, title, name) => ({
  title, name: name ?? ctx.guide?.full_name,
  sigFile: ctx.print?.showSignature ? ctx.guide?.signature : null,
  stampFile: ctx.print?.showStamp ? ctx.guide?.stamp : null,
  date: ctx.print?.showDate ? fmtDate(ctx.print?.date) : "",
});

/* ============================== زيارة المعلم ============================== */
export async function teacherVisit(ctx) {
  const d = ctx.rec.data || {};
  const isHead = d.visitee === "head";
  const header = `<div class="tv-head">
      <div class="tv-logo-r">${await logo("ministry_small")}</div>
      <h1 class="tv-title">${isHead ? "زيارة الموجه الفني لرئيس القسم" : "زيارة الموجه الفني للمعلم"}</h1>
      <div class="tv-logo-l">${await logo("directorate")}</div>
    </div>`;
  const identity = `<div class="tv-meta">
      <div class="tv-school"><b>المدرسة:</b> <span class="fill">${val(ctx.school?.title)}</span></div>
      <div class="tv-year"><div><b>العام الدراسي:</b> ${val(yearLabel(ctx.rec.academic_year)).replace(" -", "-")}</div><div><b>الفصل الدراسي:</b> ${val(ctx.rec.term)}</div></div>
    </div>
    <table class="grid tv-id"><thead><tr><th>${isHead ? "اسم رئيس القسم" : "اسم المعلم"}</th><th>الصف</th><th>الحصة</th><th>المكان</th><th>اليوم</th><th>التاريخ</th><th>عنوان الدرس</th></tr></thead>
    <tbody><tr><td>${val(ctx.teacher?.title)}</td><td>${val(d.grade)}${d.section ? " / " + val(d.section) : ""}</td><td>${val(d.period)}</td><td>${val(d.place)}</td>
    <td>${val(dayName(ctx.rec.record_date))}</td><td>${val(fmtDate(ctx.rec.record_date))}</td><td>${val(d.lesson)}</td></tr></tbody></table>`;

  const blocks = [];
  // يظهر فقط ما اختاره المستخدم أو كتبه، بلا عناوين البنود التفصيلية، وبترتيب القالب
  for (const key of TEACHER_VISIT.printOrder) {
    const sec = TEACHER_VISIT.sections.find((s) => s.key === key);
    let items = sec.items.map((_, i) => (d.items?.[key]?.[i] || "").trim()).filter(Boolean).map((v) => `<div class="ln">${esc(v)}</div>`);
    if (d.blank) items = Array.from({ length: 4 }, () => `<div class="ln blank-ln">&nbsp;</div>`); // نسخة فارغة: أسطر للكتابة باليد
    blocks.push({ group: { cls: "pv-sec", head: `<div class="sec-head">${esc(sec.printTitle)}</div>`, items } });
  }
  const recs = d.blank ? Array.from({ length: 4 }, () => `<div class="ln blank-ln">&nbsp;</div>`) : nl(d.recommendations).map((v) => `<div class="ln">${v}</div>`);
  if (recs.length) blocks.push({ group: { cls: "pv-recs", head: `<div class="recs-head">التوصيات:</div>`, items: recs } });
  const photos = (d.photos || []).filter(Boolean);
  if (photos.length) blocks.push({ html: `<div class="photo-row n${photos.length}">${(await Promise.all(photos.map((p) => img(p, "photo")))).join("")}</div>` });

  const footer = await sigRow([
    { title: isHead ? "توقيع رئيس القسم" : "توقيع معلم الفصل", noName: true, sigFile: d.teacher_signature },
    { title: "توقيع رئيس القسم", noName: true, sigFile: isHead ? null : d.head_signature },
    { ...mySig(ctx, "توقيع الموجه الفني"), noName: true },
  ], "tv-sigs");
  return { orientation: "portrait", frame: true, cls: "t-tv", header, identity, blocks, footer };
}

/* ============================== زيارة الموجه للمدرسة ============================== */
export async function schoolVisit(ctx) {
  const d = ctx.rec.data || {};
  const header = `<div class="sv-head">
    <div>${await logo("ministry")}</div>
    <h1 class="sv-title">زيارةُ المُوجهِ الفَنّي</h1>
    <div class="sv-logos-l">${await logo("directorate")}${await logo("new_kuwait")}</div></div>`;
  const term = ctx.rec.term;
  const identity = `<table class="grid sv-id">
      <thead><tr><th class="w-school">المدرسة</th><th>اليوم</th><th>التاريخ</th><th>الفترة الدراسية</th></tr></thead>
      <tbody><tr><td>${val(ctx.school?.title)}</td><td>${val(dayName(ctx.rec.record_date))}</td><td>${val(fmtDate(ctx.rec.record_date))}</td>
      <td>${term ? val(term) : "الأولى / الثانية"}</td></tr></tbody></table>
    <table class="grid sv-id2"><tr><th>الموجه الفني</th><td>${val(ctx.guide?.full_name)}</td><th>نوع الزيارة</th><td>${val(d.visit_type)}</td></tr></table>`;
  const box = (title, list, chosen, other) => `<div class="sv-box"><div class="sv-box-h">${title}</div><div class="sv-checks">
      ${list.map((g) => `<div class="ck"><span class="cb">${chosen?.includes(g) ? "☑" : "☐"}</span>${esc(g)}</div>`).join("")}
      <div class="ck"><span class="cb">${other ? "☑" : "☐"}</span>أخرى ${other ? `<span class="other">${esc(other)}</span>` : '<span class="dots"></span>'}</div>
    </div></div>`;
  const rows = (d.teacher_rows || []).filter((r) => r.teacher || r.grade || r.section || r.period || r.lesson);
  const done = nl(d.achieved);
  const visitLines = [
    ...rows.map((r) => `<div class="ln sv-tr"><span>${val(r.teacher_name)}</span><span>${val(r.grade)}</span><span>${val(r.section)}</span><span>${val(r.period)}</span><span>${val(r.lesson)}</span></div>`),
    ...done.map((v) => `<div class="ln">${v}</div>`),
  ];
  const minLines = 22;
  // تملأ الأسطر المنقطة المساحة المتبقية من المربع كما في النموذج الورقي، دون إضافة صفحات
  const left = `<div class="sv-main"><div class="sv-main-h">• زيارة معلم + ما تم إنجازه :</div>
      <div class="ln sv-tr sv-cols"><span>اسم المعلم</span><span>الصف</span><span>الفصل</span><span>الحصة</span><span>عنوان الدرس</span></div>
      ${visitLines.join("")}<div class="sv-fill"></div></div>`;
  const right = `<div class="sv-side">${box("الهدف من الزيارة", SCHOOL_VISIT.goals, d.goals, d.goals_other)}${box("السجلات التي تمت متابعتها", SCHOOL_VISIT.records, d.records, d.records_other)}</div>`;
  const blocks = [];
  if (visitLines.length <= minLines) blocks.push({ html: `<div class="sv-cols2">${right}${left}</div>` });
  else {
    blocks.push({ html: `<div class="sv-cols2 side-only">${right}</div>` });
    blocks.push({ group: { cls: "sv-main", head: `<div class="sv-main-h">• زيارة معلم + ما تم إنجازه :</div><div class="ln sv-tr sv-cols"><span>اسم المعلم</span><span>الصف</span><span>الفصل</span><span>الحصة</span><span>عنوان الدرس</span></div>`, items: visitLines } });
  }
  const recs = d.blank ? Array.from({ length: 4 }, () => `<div class="ln blank-ln">&nbsp;</div>`) : nl(d.recommendations).map((v) => `<div class="ln">${v}</div>`);
  const recFill = Array.from({ length: Math.max(0, 4 - recs.length) }, () => `<div class="ln"></div>`);
  blocks.push({ group: { cls: "sv-recs", head: `<div class="sv-main-h">• ما يستجد من أعمال / التوصيات :</div>`, items: [...recs, ...recFill] } });
  const photos = (d.photos || []).filter(Boolean);
  if (photos.length) blocks.push({ html: `<div class="photo-row n${photos.length}">${(await Promise.all(photos.map((p) => img(p, "photo")))).join("")}</div>` });
  const footer = await sigRow([
    { title: "رئيس القسم", name: d.head_name },
    mySig(ctx, "الموجه الفني"),
    { title: "مدير المدرسة", name: d.principal_name },
  ], "sv-sigs");
  return { orientation: "portrait", frame: false, cls: "t-sv", header, identity, blocks, footer };
}

/* ============================== الإحصائيات ============================== */
async function statsFrame(ctx, title) {
  const header = `<div class="st-strip">${await logo("stats_strip", "strip")}</div>`;
  const identity = `<div class="st-titles"><div class="st-t1">${esc(title)}</div><div class="st-t1">للعام الدراسي${esc(yearLabel(ctx.year))} م</div>
      <div class="st-stars">*******************************</div>
      <div class="st-l"><b>المرحلة :</b> ${val(ctx.guide?.stage) || "................."}</div>
      <div class="st-l"><b>اسم الموجه الفني :</b> <span class="st-red">${val(ctx.guide?.full_name) || "..................."}</span> <span class="gap"></span><b>التخصص:</b> <span class="st-red">${val(ctx.guide?.subject) || "..............."}</span></div></div>`;
  const footer = `<div class="st-foot">الموجه الفني الأول للعلوم : أ. ${val(ctx.guide?.first_supervisor)}</div>`;
  return { header, identity, footer };
}
export async function statsVisits(ctx) {
  const f = await statsFrame(ctx, STATS.visits.title(ctx.termWord));
  const thead = `<tr><th rowspan="2" class="c-n">م</th><th rowspan="2">المدرسة</th><th rowspan="2">اسم المعلم</th><th colspan="2">الزيارة الأولى</th><th colspan="2">الزيارة الثانية</th><th colspan="2">الزيارة الثالثة</th></tr>
    <tr><th>اليوم والتاريخ</th><th>الفصل</th><th>اليوم والتاريخ</th><th>الفصل</th><th>اليوم والتاريخ</th><th>الفصل</th></tr>`;
  // معلم بلا زيارة لسبب (إجازة دراسية، مجلس، وضع...): يُكتب السبب في الخانات الفارغة
  const rows = ctx.rows.map((r, i) => {
    const n = Math.min(r.visits.length, 3);
    const done = r.visits.slice(0, 3).map((v) => `<td>${val(dayName(v.date))} ${val(fmtDate(v.date))}</td><td>${val(v.cls)}</td>`).join("");
    const rest = n < 3 ? (r.reason ? `<td colspan="${2 * (3 - n)}" class="st-why">${val(r.reason)}</td>` : "<td></td><td></td>".repeat(3 - n)) : "";
    return `<tr><td>${i + 1}</td><td>${val(r.school)}</td><td>${val(r.teacher)}</td>${done}${rest}</tr>`;
  });
  if (!rows.length) rows.push(`<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`);
  const colgroup = `<colgroup><col style="width:9mm"><col style="width:16%"><col style="width:18%">${'<col style="width:13%"><col>'.repeat(3)}</colgroup>`;
  return { orientation: "landscape", cls: "t-st", ...f, blocks: [{ table: { cls: "grid st-table", colgroup, thead, rows } }] };
}
export async function statsExams(ctx) {
  const v = STATS[ctx.examType].versions.find((x) => x.id === ctx.version) || STATS[ctx.examType].versions[0];
  const f = await statsFrame(ctx, v.title(ctx.termWord));
  const thead = `<tr><th class="c-n">م</th><th>المدرسة</th><th>امتحان الصف</th><th>اليوم والتاريخ</th><th>امتحان الصف</th><th>اليوم والتاريخ</th><th>امتحان الصف</th><th>اليوم والتاريخ</th></tr>`;
  const rows = ctx.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${val(r.school)}</td>${[0, 1, 2].map((k) => {
    const e = r.exams[k]; return e ? `<td>${val(e.grade)}</td><td>${val(dayName(e.date))} ${val(fmtDate(e.date))}</td>` : "<td></td><td></td>"; }).join("")}</tr>`);
  if (!rows.length) rows.push(`<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`);
  const colgroup = `<colgroup><col style="width:9mm"><col style="width:22%">${'<col style="width:9%"><col>'.repeat(3)}</colgroup>`;
  return { orientation: "landscape", cls: "t-st", ...f, blocks: [{ table: { cls: "grid st-table", colgroup, thead, rows } }] };
}

/* ============================== الخطة الشهرية ============================== */
export async function monthlyPlan(ctx) {
  const [y, m] = ctx.month.split("-").map(Number);
  const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate();
  const cells = []; for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  let body = "";
  for (let i = 0; i < cells.length; i += 7) {
    body += "<tr>" + cells.slice(i, i + 7).map((d, k) => {
      if (!d) return `<td class="${k >= 5 ? "we" : ""}"></td>`;
      const c = ctx.days[d] || {};
      return `<td class="${k >= 5 ? "we" : ""}"><div class="mp-n">${d}</div><div class="mp-t ${c.holiday ? "hol" : ""}">${esc(c.text || "").replace(/\n/g, "<br>")}</div></td>`;
    }).join("") + "</tr>";
  }
  const html = `<div class="mp-title">${MONTHS_EN[m - 1]} ${y}</div>
    <table class="mp-table"><colgroup>${DAYS.map((_, k) => `<col class="${k >= 5 ? "we" : ""}">`).join("")}</colgroup>
    <thead><tr>${DAYS.map((d) => `<th>${d}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
  return { orientation: "portrait", cls: "t-mp", header: "", identity: "", footer: "", blocks: [{ html }] };
}

/* ============================== تقرير الفعالية / التنمية المهنية ============================== */
export async function eventReport(ctx) {
  const d = ctx.rec.data || {};
  const place = d.place || ctx.school?.title || "";
  const header = `<div class="ev-head"><div class="ev-r">${await logo("ministry_event")}<div class="ev-org">الإدارة العامة لمنطقة ${val(ctx.guide?.region || "الأحمدي")}<br>التعليمية</div></div>
    <div class="ev-c">${await logo("directorate_event")}</div><div class="ev-l">${await logo("general_science")}</div></div>`;
  const rows = [["عنوان التنمية المهنية", d.pd_title], ["الجهة المنفذة", d.organizer], ["اليوم", dayName(ctx.rec.record_date)], ["التاريخ", fmtDate(ctx.rec.record_date)], ["المكان", place]];
  const photos = (d.photos?.length ? d.photos : d.photo ? [d.photo] : []).filter(Boolean);
  const blocks = [
    { html: `<div class="ev-name">${val(d.event_name) || "اسم الفعالية"}</div>` },
    { html: `<table class="ev-table">${rows.map(([k, v], i) => `<tr class="${i % 2 ? "alt" : ""}"><th>${k}</th><td>${val(v)}</td></tr>`).join("")}</table>` },
    { group: { cls: "ev-box", head: `<div class="ev-box-h">نبذة مختصرة عن التنمية المهنية</div>`, items: nl(d.summary).map((v) => `<div class="ev-p">${v}</div>`) } },
  ];
  // الصور: مربع واحد بالعنوان، والصور بنفس الحجم بإطار بسيط؛ كل صفين من الصور كتلة لا تنقسم
  const imgs = await Promise.all(photos.map((p) => img(p, "photo")));
  if (!imgs.length) blocks.push({ html: `<div class="ev-box ev-photo"><div class="ev-box-h">صورة معبرة</div><div class="ev-img"></div></div>` });
  else {
    const per = 2, rowsHtml = [];
    for (let i = 0; i < imgs.length; i += per) rowsHtml.push(`<div class="ev-ph-row">${imgs.slice(i, i + per).map((x) => `<div class="ev-ph">${x}</div>`).join("")}</div>`);
    // كل صف صور كتلة مستقلة لا تنقسم؛ العنوان ملتصق بالصف الأول
    rowsHtml.forEach((row, i) => blocks.push({ html: `<div class="ev-box ev-photos ${i ? "cont" : ""}">${i ? "" : `<div class="ev-box-h">${imgs.length > 1 ? "صور معبرة" : "صورة معبرة"}</div>`}<div class="grp-items">${row}</div></div>` }));
  }
  const footer = await sigRow([{ ...mySig(ctx, "الموجهة الفنية:"), prefix: "أ." }], "ev-sigs one");
  return { orientation: "portrait", cls: "t-ev", header, identity: "", footer, blocks };
}

/* ============================== بيانات الأقسام العلمية ============================== */
export async function departments(ctx) {
  const d = ctx.rec.data || {}, s = d.info || {};
  const grades = ctx.grades;
  const header = `<div class="st-strip">${await logo("departments_strip", "strip")}</div>
    <div class="dp-title">بيانات الأقسام العلمية لمدارس منطقة ${val(ctx.guide?.region || "الأحمدي")} التعليمية للمرحلة ${val(ctx.stageWord)}<br>${esc((ctx.rec.academic_year || "").replace("-", " / "))} م</div>`;
  const info = `<table class="grid dp-info"><tr><td><b>اسم المدرسة :</b> ${val(ctx.school?.title)}</td><td><b>اسم المدير :</b> ${val(s.principal)}</td><td><b>النقال :</b> ${val(s.principal_mobile)}</td></tr>
    <tr><td colspan="2"><b>اسم المدير المساعد (الفني ):</b> ${val(s.assistant_tech)}</td><td><b>اسم المدير المساعد ( الإداري):</b> ${val(s.assistant_admin)}</td></tr>
    <tr><td colspan="2"><b>هاتف المدرسة:</b> ${val(s.phone)}</td><td><b>فاكس :</b> ${val(s.fax)}</td></tr></table>`;
  const b = d.budget || {};
  const sum = (row) => { const v = grades.map((g) => Number(b[row]?.[g]) || 0); return v.some(Boolean) ? v.reduce((a, c) => a + c, 0) : ""; };
  const budget = `<div class="dp-h">ميزانية المدرسة ( تخصص علوم )</div><table class="grid dp-budget"><tr><th>ميزانية الفصول</th>${grades.map((g) => `<th>${esc(g)}</th>`).join("")}<th>المجموع</th><th>ملاحظات</th></tr>
    ${[["classes", "عدد الفصول"], ["periods", "عدد الحصص"], ["students", "عدد الطلاب"]].map(([k, l]) => `<tr><th>${l}</th>${grades.map((g) => `<td>${val(b[k]?.[g])}</td>`).join("")}<td>${sum(k)}</td><td>${val(b[k]?.notes)}</td></tr>`).join("")}</table>`;
  const st = d.staffing || {};
  const existing = ctx.teachers.length;
  const growth = st.needed !== "" && st.needed != null ? existing - Number(st.needed) : "";
  const staffing = `<div class="dp-h">بيانات المعلمين</div><table class="grid dp-staff"><tr><th rowspan="2">وجود رئيس قسم</th><th colspan="3">للمعلمين</th></tr>
    <tr><th>العدد اللازم</th><th>العدد الموجود</th><th>النمو (- أو +)</th></tr><tr><td>${val(st.has_head)}</td><td>${val(st.needed)}</td><td>${existing}</td><td>${growth === "" ? "" : (growth > 0 ? "+" : "") + growth}</td></tr></table>`;
  const tHead = `<tr><th rowspan="2" class="c-n">م</th><th rowspan="2">اسم المعلم</th><th rowspan="2">الجنسية</th><th rowspan="2">المسمى الوظيفي</th><th colspan="2">الخبرة</th><th rowspan="2">التخصص</th><th rowspan="2">المساند</th><th rowspan="2">النصاب</th><th rowspan="2">ملاحظات</th></tr><tr><th>خ</th><th>د</th></tr>`;
  const tRows = ctx.teachers.map((t, i) => `<tr><td>${i + 1}</td><td>${val(t.title)}</td><td>${val(t.data.nationality)}</td><td>${val(t.data.job_title)}</td><td>${val(t.data.exp_kh)}</td><td>${val(t.data.exp_d)}</td><td>${val(t.data.specialization)}</td><td>${val(t.data.support)}</td><td>${val(d.loads?.[t.id] ?? t.data.load)}</td><td>${val(t.data.notes)}</td></tr>`);
  if (!tRows.length) tRows.push(`<tr><td>1</td>${"<td></td>".repeat(9)}</tr>`);
  const preps = (d.preparers || []).filter((p) => p.name);
  const prepTable = `<table class="grid dp-prep"><tr><th>اسم المحضر</th><th>الجنسية</th><th>سنوات الخبرة</th><th>ملاحظات</th></tr>${(preps.length ? preps : [{}]).map((p) => `<tr><td>${val(p.name)}&nbsp;</td><td>${val(p.nationality)}</td><td>${val(p.exp)}</td><td>${val(p.notes)}</td></tr>`).join("")}</table>`;
  const n = d.notes || {};
  const notes = `<div class="dp-h">ملاحظات هامة</div><table class="grid dp-notes"><tr><th>المتوفر</th><th>ملاحظات</th></tr>
    ${[["books", "توافر الكتب"], ["labs_count", "عدد المختبرات"], ["labs_state", "حالة المختبرات"], ["maintenance", "حالة المدرسة ( صيانة )"]].map(([k, l]) => `<tr><th>${l}</th><td>${val(n[k])}</td></tr>`).join("")}</table>`;
  const footer = await sigRow([
    { title: "رئيس القسم", name: s.head }, { title: "مدير المدرسة", name: s.principal },
    mySig(ctx, "الموجه الفني"), { title: "الموجه الفني الأول للعلوم", name: ctx.guide?.first_supervisor, prefix: "أ." },
  ], "dp-sigs");
  return { orientation: "portrait", cls: "t-dp", header, identity: "", footer, blocks: [
    { html: info }, { html: budget }, { html: staffing }, { table: { cls: "grid dp-teachers", thead: tHead, rows: tRows } }, { html: prepTable }, { html: notes }] };
}

import { weeklyReport, monthlyAchievements } from "./builders2.js";
import { sharedAchievements } from "./builders3.js";
export const BUILDERS = { form: (...a) => import("./builders4.js").then((m) => m.formTakleef(...a)), teacher_visit: teacherVisit, school_visit: schoolVisit, stats_visits: statsVisits, stats_exams: statsExams,
  monthly_plan: monthlyPlan, event_report: eventReport, department: departments, weekly_report: weeklyReport, monthly_achievements: monthlyAchievements, shared_achievements: sharedAchievements };
