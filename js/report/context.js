// تجهيز "سياق" التقرير من السجلات المترابطة. هذا السياق هو ما يُحفظ كنسخة ثابتة عند الاعتماد.
import { api } from "../api.js";
import { state, G, schoolById, teacherById, opts, officialDates } from "../store.js";
import { addDays, academicYearOf, parseDate } from "../ui.js";
import { FIRST_SUPERVISOR } from "../templates.js";
import { linkedRowsFor, mergeLinked } from "../svlink.js";

export const termWord = (t, fem = false) => {
  const m = { "الأولى": fem ? "الأولى" : "الأول", "الثانية": fem ? "الثانية" : "الثاني", "الأول": fem ? "الأولى" : "الأول", "الثاني": fem ? "الثانية" : "الثاني" };
  return m[t] || t || "";
};
export const stageWord = (s) => ({ "ثانوي": "الثانوية", "متوسط": "المتوسطة", "ابتدائي": "الابتدائية" }[s] || s || "");

export function guideCtx() {
  const g = G();
  return { full_name: g.full_name || state.profile?.full_name || "", stage: g.stage || "", subject: g.subject || opts("subjects")[0] || "", job_title: g.job_title || "",
    first_supervisor: g.first_supervisor || FIRST_SUPERVISOR.name, region: g.region || "الأحمدي", directorate: g.directorate || "", signature: g.signature || null, stamp: g.stamp || null, head_logos: g.head_logos || {}, gender: g.gender || "" };
}
const pick = (r) => (r ? { id: r.id, title: r.title, data: r.data || {} } : null);
const recPart = (r) => ({ id: r.id, kind: r.kind, title: r.title, academic_year: r.academic_year, term: r.term, record_date: r.record_date, data: r.data || {} });

export async function recordContext(rec) {
  const ctx = { rec: recPart(rec), school: pick(schoolById(rec.school_id)), teacher: pick(teacherById(rec.teacher_id)), guide: guideCtx(), print: rec.data?.print || {}, cover: G().cover || {} };
  if (rec.kind === "monthly_achievements") ctx.stageWord = stageWord(G().stage);
  // تقرير موجّه آخر أرسله للمسؤول عن التجميع: يُطبع باسم صاحبه، بلا توقيعي أو ختمي
  if (state.profile && rec.owner_id && rec.owner_id !== state.profile.id) {
    ctx.guide = { ...ctx.guide, full_name: rec.data?.guide_name || "", signature: null, stamp: null };
    ctx.print = { ...ctx.print, showSignature: false, showStamp: false };
  }
  if (rec.kind === "school_visit") {
    // غير المعتمدة: تُطبع بآخر زيارات المعلمين لنفس المدرسة واليوم
    const rows0 = rec.status === "approved" ? rec.data.teacher_rows || [] : mergeLinked(rec.data.teacher_rows, await linkedRowsFor(rec.school_id, rec.record_date).catch(() => []));
    ctx.rec.data = { ...ctx.rec.data, teacher_rows: rows0.filter((r) => r.teacher || r.teacher_name || r.lesson || r.grade).map((r) => ({ ...r, teacher_name: teacherById(r.teacher)?.title || r.teacher_name || "" })) };
  }
  if (rec.kind === "department") {
    ctx.teachers = state.teachers.filter((t) => t.school_id === rec.school_id).map(pick);
    ctx.grades = opts("grades");
    ctx.stageWord = stageWord(rec.data?.stage || G().stage || "ثانوي");
  }
  return ctx;
}

/* ---------------- إحصائية زيارات المعلمين: كل زيارة تُحسب مرة واحدة فقط (معرّفها) ---------------- */
export async function visitStatsContext({ year, term, school = "", includeUnvisited = true }) {
  const visits = (await api.list({ kind: "teacher_visit", year })).filter((v) => (!term || v.term === term) && (!school || v.school_id === school) && v.teacher_id);
  const byTeacher = new Map();
  const seen = new Set();
  for (const v of visits.sort((a, b) => (a.record_date || "").localeCompare(b.record_date || ""))) {
    if (seen.has(v.id)) continue; seen.add(v.id);
    if (!byTeacher.has(v.teacher_id)) byTeacher.set(v.teacher_id, []);
    byTeacher.get(v.teacher_id).push({ id: v.id, date: v.record_date, cls: [v.data?.grade, v.data?.section].filter(Boolean).join("/") });
  }
  const teachers = state.teachers.filter((t) => (!school || t.school_id === school) && (includeUnvisited || byTeacher.has(t.id)));
  // سبب عدم الزيارة (إجازة دراسية، مجلس، وضع...) يُحفظ مع المعلم لكل عام وفترة
  const reasonOf = (t) => {
    const nv = t.data?.no_visit || {};
    if (term) return nv[`${year}|${term}`] || "";
    return [...new Set(Object.entries(nv).filter(([k, v]) => k.startsWith(year + "|") && v).map(([, v]) => v))].join("، ");
  };
  const rows = teachers.map((t) => ({ teacher_id: t.id, teacher: t.title, school: schoolById(t.school_id)?.title || "", visits: byTeacher.get(t.id) || [], reason: reasonOf(t) }))
    .sort((a, b) => a.school.localeCompare(b.school, "ar") || a.teacher.localeCompare(b.teacher, "ar"));
  // زيارات لمعلمين نُقلوا إلى سلة المحذوفات تبقى ظاهرة في المصدر للشفافية
  return { kind: "stats_visits", year, term, termWord: termWord(term), guide: guideCtx(), rows, total: seen.size };
}

/* ---------------- إحصائية متابعة الامتحان النظري / العملي ---------------- */
export async function examStatsContext({ year, term, examType, version }) {
  const list = (await api.list({ kind: "exam_followup", year })).filter((e) => e.data?.exam_type === examType && (!term || e.term === term));
  const bySchool = new Map();
  for (const e of list.sort((a, b) => (a.record_date || "").localeCompare(b.record_date || ""))) {
    const k = e.school_id || "none";
    if (!bySchool.has(k)) bySchool.set(k, []);
    bySchool.get(k).push({ id: e.id, grade: e.data?.grade || "", date: e.record_date });
  }
  // أكثر من 3 متابعات للمدرسة نفسها تنتقل إلى صف إضافي لنفس المدرسة (لا تُحذف ولا تُدمج)
  const rows = [];
  for (const [sid, exams] of bySchool) {
    for (let i = 0; i < exams.length; i += 3) rows.push({ school: schoolById(sid)?.title || "بدون مدرسة", exams: exams.slice(i, i + 3) });
  }
  rows.sort((a, b) => a.school.localeCompare(b.school, "ar"));
  const fem = version === "st-theory-2526";
  return { kind: "stats_exams", examType, version, year, term, termWord: termWord(term, fem), guide: guideCtx(), rows, total: list.length };
}

/* ---------------- الإنجازات الأسبوعية: صفوف تلقائية من زيارات الأسبوع ----------------
   صف لكل مدرسة في كل يوم؛ يجمع زيارة المدرسة وزيارات المعلمين فيها. src = معرّفات السجلات المصدر (لمنع التكرار). */
export async function weeklyAuto(ws) {
  const we = addDays(ws, 4);
  const [sv, tv] = await Promise.all([api.list({ kind: "school_visit" }), api.list({ kind: "teacher_visit" })]);
  const inWeek = (r) => r.record_date && r.record_date >= ws && r.record_date <= we;
  const map = new Map();
  const row = (date, school) => { const k = date + "|" + (school || ""); if (!map.has(k)) map.set(k, { key: k, date, place: schoolById(school)?.title || "", goal: [], summary: [], src: [] }); return map.get(k); };
  for (const v of sv.filter(inWeek)) {
    const r = row(v.record_date, v.school_id); r.src.push(v.id);
    const goals = [...(v.data.goals || []), v.data.goals_other].filter(Boolean);
    if (v.data.visit_type) r.goal.push(v.data.visit_type + (goals.length ? ": " + goals.join("، ") : ""));
    else if (goals.length) r.goal.push(goals.join("، "));
    const recs = [...(v.data.records || []), v.data.records_other].filter(Boolean);
    if (recs.length) r.summary.push("متابعة السجلات: " + recs.join("، "));
    (v.data.achieved || "").split("\n").map((x) => x.trim()).filter(Boolean).forEach((x) => r.summary.push(x));
    (v.data.recommendations || "").split("\n").map((x) => x.trim()).filter(Boolean).forEach((x) => r.summary.push("توصية: " + x));
  }
  for (const v of tv.filter(inWeek)) {
    const r = row(v.record_date, v.school_id); r.src.push(v.id);
    const t = teacherById(v.teacher_id)?.title || "";
    r.goal.push(`زيارة ${v.data.visitee === "head" ? "رئيس قسم" : "معلم"}: أ. ${t}`);
    r.summary.push(`زيارة أ. ${t}${v.data.grade ? " — الصف " + v.data.grade + (v.data.section ? "/" + v.data.section : "") : ""}${v.data.lesson ? " — درس: " + v.data.lesson : ""}`);
    (v.data.recommendations || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 3).forEach((x) => r.summary.push("توصية: " + x));
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || a.place.localeCompare(b.place, "ar"))
    .map((r) => ({ key: r.key, date: r.date, place: r.place, goal: r.goal.join("\n"), summary: r.summary.join("\n"), src: r.src, auto: true }));
}
// يدمج الصفوف التلقائية في الصفوف الحالية: يضيف الجديد فقط، ولا يمس ما عدّلته المستخدمة
export function mergeRows(cur = [], auto = []) {
  const have = new Set(cur.flatMap((r) => r.src || []));
  const add = auto.filter((a) => !(a.src || []).some((x) => have.has(x)));
  return { rows: [...cur, ...add].sort((a, b) => (a.date || "").localeCompare(b.date || "")), added: add.length };
}
export const weekLabel = (ws) => ["الأول", "الثاني", "الثالث", "الرابع", "الخامس"][Math.floor((parseDate(ws).getDate() - 1) / 7)] || "";

/* ---------------- الإنجازات الشهرية: اقتراحات تلقائية من سجلات الشهر ---------------- */
export async function monthlyAuto(month) {
  const inM = (r) => (r.record_date || "").startsWith(month);
  const [sv, tv, ev, dates, ex] = await Promise.all(["school_visit", "teacher_visit", "event_report", "important_date", "exam_followup"].map((k) => api.list({ kind: k })));
  const svm = sv.filter(inM), tvm = tv.filter(inM), evm = ev.filter(inM), exm = ex.filter(inM), dm = dates.filter(inM);
  const fmt = (r) => `${schoolById(r.school_id)?.title || ""} (${r.record_date.split("-").reverse().join("/")})`;
  const curriculum = svm.filter((v) => (v.data.records || []).includes("سير المنهج") || (v.data.goals || []).includes("متابعة السجلات الفنية")).map((v) => "متابعة سير المنهج: " + fmt(v));
  const budget = svm.filter((v) => (v.data.goals || []).includes("متابعة ميزانية")).map((v) => "متابعة ميزانية: " + fmt(v));
  const process = [];
  if (tvm.length) process.push(`زيارات صفية: ${tvm.length} زيارة لـ ${new Set(tvm.map((v) => v.teacher_id)).size} معلم`);
  if (svm.length) process.push(`زيارات المدارس: ${svm.length} زيارة لـ ${new Set(svm.map((v) => v.school_id)).size} مدرسة`);
  const evRow = (e) => ({ src: [e.id], event: e.data.event_name || e.data.pd_title || e.title, date: e.record_date, place: e.data.place || schoolById(e.school_id)?.title || "", target: e.data.target || "" });
  const delivered = evm.filter((e) => e.data.guide_role === "قدّمها الموجه").map(evRow);
  const supervised = evm.filter((e) => e.data.guide_role !== "قدّمها الموجه" && e.data.guide_role !== "اجتازها الموجه").map(evRow);
  const attended = [...evm.filter((e) => e.data.guide_role === "اجتازها الموجه").map(evRow),
    ...dm.filter((d) => d.data.type === "دورة").map((d) => ({ src: [d.id], event: d.title, date: d.record_date, place: d.data.place || "", target: d.data.target || "" }))];
  const meetings = dm.filter((d) => d.data.type === "اجتماع").map((d) => ({ src: [d.id], meeting: d.title, date: d.record_date, place: d.data.place || "", manager: d.data.manager || "", target: d.data.target || "" }));
  const exams = exm.sort((a, b) => a.record_date.localeCompare(b.record_date)).map((e) => `متابعة الامتحان ${e.data.exam_type === "practical" ? "العملي" : "النظري"}${e.data.grade ? " للصف " + e.data.grade : ""} بمدرسة ${fmt(e)}`);
  const photos = evm.filter((e) => e.data.photo).map((e) => ({ src: [e.id], event: e.data.event_name || e.title, date: e.record_date, place: e.data.place || schoolById(e.school_id)?.title || "", photo: e.data.photo }));
  return { text: { "books.1": curriculum, "quality.0": budget, "quality.1": process, exams }, tables: { delivered, supervised, attended, meetings, photos } };
}
// يضيف الأسطر التلقائية للنص دون تكرار سطر موجود
export function mergeText(cur = "", add = []) {
  const have = new Set(cur.split("\n").map((x) => x.trim()));
  const extra = add.filter((x) => !have.has(x.trim()));
  return { text: [cur.trim(), ...extra].filter(Boolean).join("\n"), added: extra.length };
}

/* ---------------- التجميع (للمسؤول عن التجميع): دمج تقارير الموجهين المرسلة ---------------- */
export async function compiledMonthlyContext(month) {
  const [list, owners] = await Promise.all([api.listSubmitted("monthly_achievements", "month", month), api.rpc("collector_owners").catch(() => [])]);
  const names = new Map((owners || []).map((o) => [o.id, o.full_name]));
  const nameOf = (r) => r.data.guide_name || names.get(r.owner_id) || "";
  list.sort((a, b) => nameOf(a).localeCompare(nameOf(b), "ar"));
  const data = { month, books: {}, quality: {}, committees: {} };
  const prefixLines = (n, t) => (t || "").split("\n").map((x) => x.trim()).filter(Boolean).map((x) => (list.length > 1 ? `أ. ${n}: ${x}` : x)).join("\n");
  for (const r of list) {
    const n = nameOf(r), d = r.data;
    for (const k of ["books", "quality"]) for (const [i, t] of Object.entries(d[k] || {})) if ((t || "").trim()) data[k][i] = [data[k][i], prefixLines(n, t)].filter(Boolean).join("\n");
    for (const [i, t] of Object.entries(d.committees || {})) if ((t || "").trim()) (data.committees[i] ||= []).push({ guide: n, text: t });
    for (const k of ["delivered", "supervised", "attended", "meetings", "photos"]) data[k] = [...(data[k] || []), ...(d[k] || []).map((x) => ({ ...x, guide: n }))];
    for (const k of ["opinions", "activities", "exams"]) if ((d[k] || "").trim()) data[k] = [data[k], prefixLines(n, d[k])].filter(Boolean).join("\n");
  }
  const g = guideCtx();
  return { kind: "monthly_achievements", compiled: true, coordinator: g.full_name, stageWord: stageWord(g.stage), guide: g, cover: G().cover || {}, print: {},
    rec: { kind: "monthly_achievements", title: "الإنجازات المجمعة", academic_year: academicYearOf(month + "-01"), data }, count: list.length, names: list.map(nameOf) };
}

/* ---------------- الخطة الشهرية: تُعبأ تلقائياً من التواريخ الهامة والزيارات ---------------- */
export async function monthlyDerived(month) {
  const [y, m] = month.split("-").map(Number);
  const endD = new Date(y, m, 0).getDate();
  const [dates, sv, tv] = await Promise.all([api.list({ kind: "important_date" }), api.list({ kind: "school_visit" }), api.list({ kind: "teacher_visit" })]);
  const out = {};
  for (let d = 1; d <= endD; d++) out[d] = { text: "", holiday: false, sources: [] };
  const inMonth = (iso) => iso && iso.startsWith(month);
  const add = (day, t, id) => { if (!out[day].text.split("\n").includes(t)) out[day].text = (out[day].text ? out[day].text + "\n" : "") + t; out[day].sources.push(id); };
  // التقويم الدراسي الثابت أولاً (العطل الرسمية وبدء/نهاية الاختبارات)
  for (const o of officialDates()) {
    for (let cur = o.from; cur <= o.to; cur = addDays(cur, 1)) {
      if (!inMonth(cur)) continue;
      const day = parseDate(cur).getDate();
      if (o.holiday) out[day].holiday = true;
      add(day, o.title, o.id);
    }
  }
  for (const dt of dates) {
    const from = dt.record_date, to = dt.data?.end_date || dt.record_date;
    if (!from) continue;
    for (let cur = from; cur <= to; cur = addDays(cur, 1)) {
      if (!inMonth(cur)) continue;
      const day = parseDate(cur).getDate();
      if (dt.data?.type === "إجازة") out[day].holiday = true;
      add(day, dt.title, dt.id);
    }
  }
  for (const v of sv) if (inMonth(v.record_date)) add(parseDate(v.record_date).getDate(), `${v.data.visit_type || "زيارة"} ${schoolById(v.school_id)?.title || ""}`.trim(), v.id);
  for (const v of tv) if (inMonth(v.record_date)) { const t = `زيارة ${schoolById(v.school_id)?.title || ""}`.trim(); const day = parseDate(v.record_date).getDate(); if (!out[day].text.includes(schoolById(v.school_id)?.title || "@@")) add(day, t, v.id); }
  return out;
}
