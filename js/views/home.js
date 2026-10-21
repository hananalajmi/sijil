// الواجهة الرئيسية: الأقسام + التنبيهات
import { api } from "../api.js";
import { state, G, pendingDrafts, logoSrc, setGuideData } from "../store.js";
import { esc, $, $$, today, weekStart, fmtDate, addDays, modal, toast } from "../ui.js";
import { installCard } from "../pwa.js";
import { icon } from "../icons.js";
import { editLinkList } from "../links.js";
import { SECTIONS } from "../nav.js";

export default async function (main) {
  const year = state.year;
  const [visits, svisits, plans, drafts] = await Promise.all([
    api.list({ kind: "teacher_visit", year }), api.list({ kind: "school_visit", year }), api.list({ kind: "weekly_report" }),
    api.list({ kinds: ["teacher_visit", "school_visit", "event_report"], year }),
  ]);
  const g = G();
  const alerts = [];
  if (!state.guide || !g.full_name || !g.stage) alerts.push(["bad", "أكملي البيانات الرئيسية (الاسم، المرحلة، التخصص) لتظهر في التقارير", "#/guide"]);
  if (!state.schools.length) alerts.push(["", "لم تُضف أي مدرسة بعد", "#/schools/new"]);
  const local = pendingDrafts();
  if (local.length) alerts.push(["bad", `${local.length} تعديل لم يُحفظ في الخادم (مشكلة اتصال سابقة). افتحي السجل المعني لإعادة الحفظ`, "#/search"]);
  const waiting = drafts.filter((r) => r.status !== "approved");
  if (waiting.length) alerts.push(["", `${waiting.length} تقرير بانتظار الاعتماد في العام ${year}`, "#/search?status=draft"]);
  // الإنجازات الأسبوعية: تنبيه إن لم يُكتب تقرير الأسبوع الماضي، والإنجازات الشهرية للشهر الماضي
  const lastWs = addDays(weekStart(today()), -7);
  const [visitsLastWeek, monthly] = await Promise.all([
    api.list({ kinds: ["school_visit", "teacher_visit"] }).then((l) => l.filter((v) => v.record_date >= lastWs && v.record_date <= addDays(lastWs, 4)).length),
    api.list({ kind: "shared_achievements" })]);
  if (visitsLastWeek && !plans.some((p) => p.data.week_start === lastWs)) alerts.push(["", `لم يُكتب تقرير الإنجازات الأسبوعية للأسبوع الماضي (من ${fmtDate(lastWs)})، وفيه ${visitsLastWeek} زيارة`, `#/weekly/new?week=${lastWs}`]);
  const d0 = new Date(); const lastMonth = new Date(d0.getFullYear(), d0.getMonth() - 1, 1); const lm = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
  if (d0.getDate() <= 10 && !monthly.some((m) => m.data.month === lm)) alerts.push(["", "لم يُنشأ ملف الإنجازات الشهرية المشترك للشهر الماضي بعد", `#/monthly-ach/new?month=${lm}`]);
  const missingTeacher = visits.filter((v) => !v.teacher_id || !v.school_id || !v.term);
  if (d0.getDay() === 3) alerts.push(["", "اليوم الأربعاء: موعد عمل الخطط الأسبوعية (القبلية والبعدية)", "#/hub/plans"]);
  if (missingTeacher.length) alerts.push(["bad", `${missingTeacher.length} زيارة معلم ينقصها حقل إلزامي (المعلم أو المدرسة أو الفصل)`, "#/teacher-visits"]);

  const visited = new Set(visits.map((v) => v.teacher_id));
  // أرقام صغيرة على البطاقات
  const counts = { visits: visits.length + svisits.length, data: state.schools.length ? `${state.schools.length} مدرسة · ${state.teachers.length} معلمة` : "" };
  const SUBJECTS = ["علوم", "كيمياء", "فيزياء", "أحياء", "جيولوجيا", "مسارات"];
  const card = (s) => `<a class="hcard c-${s.id}" href="${s.route ? "#/" + s.route : "#/hub/" + s.id}">
      <div class="hc-media"><div class="hc-img">${s.id === "curr"
        ? `<div class="hc-curr"><img src="assets/ui/card-curr.jpg" alt="">${SUBJECTS.map((t, i) => `<span style="top:${[21.9, 35.1, 48.1, 60.9, 73.6, 86.2][i]}%">${t}</span>`).join("")}</div>`
        : `<img src="assets/ui/card-${s.card}.jpg" alt="">`}</div>
      <div class="hc-badge">${icon(s.icon)}</div></div>
      <div class="hc-body"><h2>${esc(s.label)}</h2><span class="hc-line" aria-hidden="true"></span><p>${esc(s.desc)}</p>${counts[s.id] ? `<span class="hc-count">${typeof counts[s.id] === "number" ? counts[s.id] + " زيارة هذا العام" : esc(counts[s.id])}</span>` : ""}</div></a>`;
  const quick = [["#/teacher-visits/new", "زيارة معلم جديدة", "user"], ["#/school-visits/new", "زيارة مدرسة", "school"], ["#/weekly/new", "الإنجازات الأسبوعية", "layers"], ["#/events/new", "تقرير فعالية", "star"], ["#/dates", "التقويم الدراسي", "calendar"]];
  const emblem = await logoSrc("emblem");
  main.innerHTML = `<div class="container home">
    <section class="hero">
      <div class="hero-sky" style="background-image:url(assets/ui/banner-skyline.jpg)" aria-hidden="true"></div>
      <div class="hero-deco" aria-hidden="true"></div>
      <div class="hero-min"><img src="${esc(emblem)}" alt="شعار وزارة التربية"><div><b>وزارة التربية</b><span>دولة الكويت</span><small>Ministry of Education</small></div></div>
      <div class="hero-txt"><h1>مرحباً بك</h1><div class="hero-sub">في منصة سجلات الموجه الفني</div><div class="hero-tag">معاً .. نحو تطوير مستدام للميدان التربوي</div></div>
    </section>
    <div class="hcards">${SECTIONS.map(card).join("")}</div>
    <div class="home-lower">
      <section class="panel"><h2 class="ph">${icon("bell")} تنبيهات</h2>${alerts.length ? `<div class="alerts">${alerts.map(([k, t, h]) => `<div class="alert ${k}"><span>${esc(t)}</span><a class="btn small" href="${h}">فتح</a></div>`).join("")}</div>` : `<p class="hint">لا توجد تنبيهات. ${esc(g.full_name ? "أحسنتِ يا أ. " + g.full_name.split(" ")[0] : "")}</p>`}</section>
      <section class="panel"><h2 class="ph">${icon("plus")} إجراءات سريعة</h2><div class="quick">${quick.map(([h, t, i]) => `<a class="qa" href="${h}">${icon(i)}<span>${t}</span></a>`).join("")}</div>
        <p class="hint" style="margin-top:10px">${state.teachers.filter((t) => visited.has(t.id)).length} من ${state.teachers.length} معلمة تمت زيارتهن في العام ${esc(year)}.</p></section>
      <section class="panel" id="mylinks"></section>
    </div>
  </div>`;
  paintLinks($("#mylinks", main));
  const ic = installCard(); if (ic) { ic.style.marginBottom = "16px"; $(".hero", main).after(ic); }
}

// روابطي: قائمة روابط شخصية لسهولة الوصول (مجلدات الدرايف، النماذج، المواقع…) — تُحفظ لحسابك فقط
const myLinks = () => (Array.isArray(G().my_links) ? G().my_links : []);
async function editLink(box, i) {
  const next = await editLinkList(myLinks(), i); if (!next) return;
  await setGuideData("my_links", next); paintLinks(box);
}
function paintLinks(box) {
  if (!box) return;
  const L = myLinks();
  box.innerHTML = `<h2 class="ph">${icon("share")} روابطي</h2>
    ${L.length ? `<div class="mylinks">${L.map((l, i) => `<div class="row" style="gap:8px;align-items:center;margin-bottom:6px"><a class="btn" style="flex:1;justify-content:flex-start;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a>
      <button class="btn small ghost" data-ed="${i}" aria-label="تعديل ${esc(l.title)}">تعديل</button></div>`).join("")}</div>` : `<p class="hint">أضيفي روابطك المهمة (مثل مجلدك في الدرايف) لتفتحيها بضغطة.</p>`}
    <div class="row" style="margin-top:8px"><button class="btn small" id="ml-add">+ إضافة رابط</button></div>
    <p class="hint" style="margin-top:8px">لرفع تقرير: احفظيه PDF من «طباعة / حفظ PDF»، ثم افتحي الرابط وارفعي الملف من تطبيق الدرايف.</p>`;
  $("#ml-add", box).onclick = () => editLink(box, null);
  $$("[data-ed]", box).forEach((b) => (b.onclick = () => editLink(box, Number(b.dataset.ed))));
}
