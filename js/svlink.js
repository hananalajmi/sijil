// ربط زيارة المعلم بزيارة الموجه للمدرسة:
// كل زيارة معلم تُسجَّل تلقائياً في زيارة المدرسة لنفس المدرسة ونفس اليوم (وتُنشأ زيارة المدرسة إن لم توجد)،
// ثم تكمل الموجهة باقي البنود (نوع الزيارة، الأهداف، السجلات، ما تم إنجازه، التوصيات).
import { api } from "./api.js";
import { state, teacherById, schoolById } from "./store.js";
import { fmtDate, academicYearOf } from "./ui.js";
import { SCHOOL_VISIT } from "./templates.js";

const PERIOD_ORDER = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة"];
const pRank = (p) => { const i = PERIOD_ORDER.indexOf(p); return i < 0 ? 99 : i; };

// صف زيارة المدرسة من زيارة معلم
export const rowFromVisit = (v) => ({ tv: v.id, teacher: v.teacher_id || "", teacher_name: teacherById(v.teacher_id)?.title || "", grade: v.data?.grade || "", section: v.data?.section || "", period: v.data?.period || "", lesson: v.data?.lesson || "" });

// زيارات المعلمين في نفس المدرسة ونفس اليوم، مرتبة حسب الحصة
export async function linkedRowsFor(schoolId, date, visits) {
  if (!schoolId || !date) return [];
  const list = visits || (await api.list({ kind: "teacher_visit", school: schoolId }));
  return list.filter((v) => !v.deleted_at && v.school_id === schoolId && v.record_date === date)
    .sort((a, b) => pRank(a.data?.period) - pRank(b.data?.period) || (a.created_at || "").localeCompare(b.created_at || ""))
    .map(rowFromVisit);
}

const filled = (r) => ["teacher", "teacher_name", "grade", "section", "period", "lesson"].some((k) => r[k]);
// الصفوف المرتبطة (محدّثة دائماً من زيارات المعلمين) + الصفوف التي أضافتها الموجهة يدوياً
export function mergeLinked(rows = [], linked = []) {
  const manual = rows.filter((r) => !r.tv && filled(r))
    // صف يدوي لنفس المعلمة ونفس الحصة أصبح له زيارة معلم: تُعتمد زيارة المعلم بدل التكرار
    .filter((r) => !linked.some((l) => l.teacher && l.teacher === r.teacher && (!r.period || !l.period || r.period === l.period)));
  return [...linked, ...manual];
}
export const sameRows = (a = [], b = []) => JSON.stringify(a.filter(filled)) === JSON.stringify(b.filter(filled));

// يحدّث (أو ينشئ) زيارة المدرسة لهذه المدرسة وهذا اليوم. يعيد {sv, created, approved}
export async function syncSchoolVisit(schoolId, date, { create = true, term = "" } = {}) {
  if (!schoolId || !date) return {};
  const [svs, tvs] = await Promise.all([api.list({ kind: "school_visit", school: schoolId }), api.list({ kind: "teacher_visit", school: schoolId })]);
  const sv = svs.filter((s) => s.record_date === date).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))[0];
  const linked = await linkedRowsFor(schoolId, date, tvs);
  if (!sv) {
    if (!create || !linked.length) return {};
    const created = await api.create({ kind: "school_visit", school_id: schoolId, record_date: date, academic_year: academicYearOf(date), term: term || null,
      title: [schoolById(schoolId)?.title, fmtDate(date)].filter(Boolean).join(" — "),
      data: { visit_type: "", goals: ["زيارة معلم"], records: [], teacher_rows: linked, template: SCHOOL_VISIT.version, auto_created: true } });
    return { sv: created, created: true };
  }
  if (sv.status === "approved") return { sv, approved: true };
  const rows = mergeLinked(sv.data?.teacher_rows, linked);
  if (sameRows(rows, sv.data?.teacher_rows)) return { sv };
  // أول زيارة معلم تُربط بزيارة مدرسة قائمة: يُعلَّم هدف «زيارة معلم» (ويمكن إلغاؤه يدوياً بعدها)
  let goals = sv.data?.goals || [];
  const hadLinked = (sv.data?.teacher_rows || []).some((r) => r.tv);
  if (linked.length && !hadLinked && !goals.includes("زيارة معلم")) goals = SCHOOL_VISIT.goals.filter((g) => g === "زيارة معلم" || goals.includes(g));
  const upd = await api.update(sv.id, { data: { ...sv.data, goals, teacher_rows: rows.length ? rows : [{}] } }, sv.version);
  return { sv: upd };
}

// يُستدعى بعد حفظ زيارة معلم أو حذفها: يحدّث زيارة المدرسة القديمة (إن تغيّر اليوم أو المدرسة) والجديدة
export function teacherVisitLinker(initial) {
  const keyOf = (rec) => (rec.school_id && rec.record_date ? `${rec.school_id}|${rec.record_date}` : "");
  const sigOf = (rec) => JSON.stringify([keyOf(rec), rec.teacher_id, rec.data?.grade, rec.data?.section, rec.data?.period, rec.data?.lesson]);
  // زيارة محفوظة سابقاً: نبدأ من حالتها الحالية حتى يُحدَّث اليوم القديم إن تغيّر التاريخ
  let last = initial?.id ? { key: keyOf(initial), sig: sigOf(initial) } : null;
  return async function (rec, { removed = false } = {}) {
    const key = keyOf(rec);
    const sig = removed ? "removed" : sigOf(rec);
    if (last && last.sig === sig) return null;
    const prevKey = last?.key; last = { key, sig };
    try {
      if (prevKey && prevKey !== key) { const [s, d] = prevKey.split("|"); await syncSchoolVisit(s, d, { create: false }); await syncWeekly(d, { create: false }); }
      if (!key) return null;
      const res = await syncSchoolVisit(rec.school_id, rec.record_date, { create: !removed && !!rec.teacher_id, term: rec.term });
      // ثم الإنجازات الأسبوعية لهذا الأسبوع
      await syncWeekly(rec.record_date, { create: !removed && !!rec.teacher_id }).catch((e) => console.warn("weekly link", e));
      return res;
    } catch (e) { console.warn("svlink", e); return null; }
  };
}

// زيارة المدرسة المرتبطة بزيارة معلم (لعرض رابط لها)
export async function schoolVisitFor(rec) {
  if (!rec.school_id || !rec.record_date) return null;
  return (await api.list({ kind: "school_visit", school: rec.school_id })).filter((s) => s.record_date === rec.record_date)
    .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))[0] || null;
}
export { state };

/* ---------------- ربط الزيارات بالإنجازات الأسبوعية ----------------
   كل زيارة مدرسة (ومعها زيارات المعلمين) تُسجَّل تلقائياً في تقرير الإنجازات الأسبوعية لأسبوعها (ويُنشأ إن لم يوجد).
   الصفوف التي لم تعدّليها تتحدث من الزيارات؛ والصفوف التي عدّلتِها أو أضفتِها يدوياً لا تُمس. */
import { weeklyAuto, weekLabel } from "./report/context.js";
import { weekStart, addDays } from "./ui.js";
import { WEEKLY_REPORT } from "./templates.js";
import { G } from "./store.js";

const keyOfRow = (r, auto) => r.key || auto.find((a) => (r.src || []).some((x) => (a.src || []).includes(x)))?.key || null;
export function mergeWeekly(cur = [], auto = []) {
  const byKey = new Map(auto.map((a) => [a.key, a]));
  const used = new Set(), out = [];
  for (const r of cur) {
    if (!r.auto) { out.push(r); continue; }                // صف يدوي
    const k = keyOfRow(r, auto);
    if (r.edited) { out.push(k ? { ...r, key: k, src: byKey.get(k)?.src || r.src } : r); if (k) used.add(k); continue; } // عدّلتِه: يبقى كما هو
    if (k && byKey.has(k) && !used.has(k)) { out.push(byKey.get(k)); used.add(k); } // يتحدث من الزيارات
    // وإلا: حُذفت زياراته فيُحذف
  }
  for (const a of auto) if (!used.has(a.key)) out.push(a);
  return out.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function weeklyFor(date) {
  if (!date) return null;
  const ws = weekStart(date);
  return (await api.list({ kind: "weekly_report" })).find((w) => w.data?.week_start === ws) || null;
}
// يحدّث (أو ينشئ) تقرير الإنجازات الأسبوعية للأسبوع الذي فيه هذا التاريخ
export async function syncWeekly(date, { create = true } = {}) {
  if (!date) return {};
  const ws = weekStart(date);
  if (date > addDays(ws, 4)) return {}; // الجمعة والسبت خارج أسبوع العمل
  const [auto, wr] = await Promise.all([weeklyAuto(ws), weeklyFor(date)]);
  if (!wr) {
    if (!create || !auto.length) return {};
    const created = await api.create({ kind: "weekly_report", title: `تقرير زيارات ${fmtDate(ws)}`, record_date: ws, academic_year: academicYearOf(ws),
      data: { template: WEEKLY_REPORT.version, week_start: ws, month: ws.slice(0, 7), week_label: weekLabel(ws), rows: auto, submitted: false, guide_name: G().full_name || "" } });
    return { wr: created, created: true };
  }
  if (wr.status === "approved") return { wr, approved: true };
  const rows = mergeWeekly(wr.data?.rows || [], auto);
  if (sameJSON(rows, wr.data?.rows || [])) return { wr };
  return { wr: await api.update(wr.id, { data: { ...wr.data, rows } }, wr.version) };
}
// بعد حفظ زيارة مدرسة أو حذفها: يحدّث أسبوعها (والأسبوع القديم إن تغيّر التاريخ)
export function schoolVisitLinker(initial) {
  let last = initial?.id ? JSON.stringify([initial.record_date, initial.school_id, initial.data]) : null;
  let lastDate = initial?.record_date || null;
  return async function (rec, { removed = false } = {}) {
    const sig = removed ? "removed" : JSON.stringify([rec.record_date, rec.school_id, rec.data]);
    if (sig === last) return null;
    const prev = lastDate; last = sig; lastDate = rec.record_date;
    try {
      if (prev && rec.record_date && weekStart(prev) !== weekStart(rec.record_date)) await syncWeekly(prev, { create: false });
      return await syncWeekly(rec.record_date, { create: !removed && !!rec.school_id });
    } catch (e) { console.warn("weekly link", e); return null; }
  };
}
