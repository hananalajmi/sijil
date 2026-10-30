// الحالة المشتركة: الحساب، البيانات الأساسية للموجّه، القوائم، والمدارس والمعلمون
import { api, ApiError } from "./api.js";
import { DEFAULT_OPTIONS, LOGOS, SHARED_ACH, FIRST_SUPERVISOR } from "./templates.js";
import { merge3 } from "./merge.js";
import { academicYearOf, debounce, toast, modal, esc } from "./ui.js";

export const state = {
  profile: null,
  guide: null,          // سجل البيانات الأساسية (kind=guide_data)
  options: {},          // key -> {label, items}
  schools: [], teachers: [],
  year: academicYearOf(),
  saveState: "idle",    // idle | saving | saved | error | offline
  pendingCount: 0,
};

export const G = () => state.guide?.data || {};

export async function loadOptions() {
  const rows = await api.options().catch(() => []);
  const o = {};
  for (const [k, v] of Object.entries(DEFAULT_OPTIONS)) o[k] = { label: v.label, items: [...v.items], isDefault: true };
  for (const r of rows) o[r.key] = { label: r.label || o[r.key]?.label || r.key, items: Array.isArray(r.items) ? r.items : [] };
  state.options = o;
  // بيانات خاصة محفوظة في قاعدة البيانات لا في الكود (private_seed.sql): أسماء الزملاء وبيانات الإنجازات الافتراضية
  const seed = o.shared_ach_seed?.items?.[0];
  if (seed && typeof seed === "object") SHARED_ACH.seed = seed;
  const fs = o.first_supervisor?.items?.[0];
  if (typeof fs === "string" && fs.trim()) FIRST_SUPERVISOR.name = fs.trim();
}
// القائمة الشخصية للموجّه (إن عدّلها) تتقدم على القائمة العامة
export const opts = (key) => state.guide?.data?.my_options?.[key] || state.options[key]?.items || [];

// حفظ قيمة واحدة في البيانات الرئيسية للموجّه (مثل روابطي)
export function setGuideData(key, val) {
  const next = (g) => ({ ...(g?.data || {}), [key]: val });
  guideSaving = guideSaving.then(async () => { const g = state.guide; const data = next(g);
    state.guide = g?.id ? await api.update(g.id, { data }, g.version) : await api.create({ kind: "guide_data", title: "البيانات الرئيسية", academic_year: academicYearOf(), data }); })
    .catch((e) => { toast("تعذر الحفظ: " + e.message, "error"); });
  if (state.guide) state.guide = { ...state.guide, data: next(state.guide) }; else state.guide = { data: next(null) };
  return guideSaving;
}
// شعارات رأس النماذج: تُحفظ مع البيانات الرئيسية للموجّه لكل نوع نموذج
export function setHeadLogos(kind, val) {
  const next = (g) => ({ ...(g?.data || {}), head_logos: { ...(g?.data?.head_logos || {}), [kind]: val } });
  guideSaving = guideSaving.then(async () => { const g = state.guide; const data = next(g);
    state.guide = g ? await api.update(g.id, { data }, g.version) : await api.create({ kind: "guide_data", title: "البيانات الرئيسية", academic_year: academicYearOf(), data }); })
    .catch((e) => { toast("تعذر حفظ الشعارات: " + e.message, "error"); });
  if (state.guide) state.guide = { ...state.guide, data: next(state.guide) };
  return guideSaving;
}
// تعديل قائمة شخصية: يُحفظ مع البيانات الرئيسية للموجّه (لا يؤثر على غيره)
let guideSaving = Promise.resolve();
export function setMyOptions(key, items) {
  guideSaving = guideSaving.then(async () => {
    const g = state.guide;
    const data = { ...(g?.data || {}), my_options: { ...(g?.data?.my_options || {}), [key]: items } };
    state.guide = g ? await api.update(g.id, { data }, g.version) : await api.create({ kind: "guide_data", title: "البيانات الرئيسية", academic_year: academicYearOf(), data });
  }).catch((e) => { toast("تعذر حفظ القائمة: " + e.message, "error"); });
  if (state.guide) state.guide = { ...state.guide, data: { ...state.guide.data, my_options: { ...(state.guide.data.my_options || {}), [key]: items } } };
  return guideSaving;
}
export const addMyOption = (key, value) => { const cur = opts(key); if (value && !cur.includes(value)) return setMyOptions(key, [...cur, value]); return Promise.resolve(); };

export async function loadBase() {
  state.profile = await api.me();
  if (!state.profile) return;
  await loadOptions();
  const [g] = await api.list({ kind: "guide_data" });
  state.guide = g || null;
  await refreshPeople();
  try { const y = localStorage.getItem("sijil.year"); if (y) state.year = y; } catch (_) {}
}
export async function refreshPeople() {
  const [s, t] = await Promise.all([api.list({ kind: "school", order: "title.asc" }), api.list({ kind: "teacher", order: "title.asc" })]);
  state.schools = s.sort((a, b) => a.title.localeCompare(b.title, "ar"));
  state.teachers = t.sort((a, b) => a.title.localeCompare(b.title, "ar"));
}
// من يعبّي ملف الإنجازات الشهرية المشترك: يحدده المشرف (القائمة فارغة = كل الموجهين)
export const sharedEditors = () => (state.options?.shared_ach_editors?.items || []).filter((x) => typeof x === "string");
export const canFillShared = () => state.profile?.role === "admin" || !sharedEditors().length || sharedEditors().includes(state.profile?.id);
// أقسام التوجيه: مشرف القسم وأعضاؤه ومن يعبّي ملفه
export const SECTION_DEFAULTS = [["ابتدائي", "ابتدائي", ""], ["متوسط", "متوسط", ""], ["ثانوي — كيمياء", "ثانوي", "كيمياء"], ["ثانوي — فيزياء", "ثانوي", "فيزياء"], ["ثانوي — أحياء", "ثانوي", "أحياء"], ["ثانوي — جيولوجيا", "ثانوي", "جيولوجيا"], ["المحضرات", "", ""]];
export const isSectionSup = (s) => !!s && s.supervisor_id === state.profile?.id;
export const inSection = (s) => !!s && (state.profile?.role === "admin" || isSectionSup(s) || (s.members || []).includes(state.profile?.id));
export const canFillSection = (s) => !!s && (state.profile?.role === "admin" || isSectionSup(s) || ((s.members || []).includes(state.profile?.id) && (!(s.editors || []).length || s.editors.includes(state.profile?.id))));
export const schoolById = (id) => state.schools.find((s) => s.id === id);
export const teacherById = (id) => state.teachers.find((t) => t.id === id);
export function setYear(y) { state.year = y; try { localStorage.setItem("sijil.year", y); } catch (_) {} }

/* ---------------- الصور والملفات المخزنة: روابط مؤقتة داخل المتصفح ---------------- */
const urlCache = new Map();
export async function fileUrl(fileId) {
  if (!fileId) return null;
  if (urlCache.has(fileId)) return urlCache.get(fileId);
  const p = (async () => {
    const f = await api.fileById(fileId);
    if (!f) return null;
    const blob = await api.fileBlob(f.storage_path);
    return URL.createObjectURL(blob);
  })().catch(() => null);
  urlCache.set(fileId, p);
  return p;
}
// شعار: مخصص من الإعدادات أو الافتراضي من القوالب الرسمية
export async function logoSrc(key) {
  // صورة مستبدلة لهذا الشعار، أو للشعار الأصلي إن كان هذا نسخة مكررة منه، وإلا الصورة الافتراضية
  for (const k of [key, LOGOS[key]?.alias]) { const custom = k && G().logos?.[k]; if (custom) { const u = await fileUrl(custom); if (u) return u; } }
  return LOGOS[key]?.src || "";
}

/* ---------------- مؤشر حالة الحفظ ---------------- */
const saveListeners = new Set();
export const onSaveState = (f) => saveListeners.add(f);
export const offSaveState = (f) => saveListeners.delete(f);
function setSave(s, msg) { state.saveState = s; saveListeners.forEach((f) => f(s, msg)); }

/* ---------------- محرّر سجل بحفظ تلقائي وكشف التعارض ----------------
   الاستخدام: const ed = recordEditor(rec, {onSaved}); ed.change(mutator) */
const PENDING = "sijil.pending.";
// merge=true (الملف المشترك): عند التعارض تُدمج تعديلاتي مع تعديلات الآخرين تلقائياً بدل السؤال
export function recordEditor(initial, { onSaved, onCreated, validate, merge = false, onMerged } = {}) {
  let rec = structuredClone(initial);
  let base = structuredClone(initial.data || {}); // آخر نسخة من الخادم عرفتُها
  let saving = null, dirty = false;
  const keepLocal = () => { try { localStorage.setItem(PENDING + (rec.id || "new-" + rec.kind), JSON.stringify({ at: Date.now(), rec })); } catch (_) {} };
  const clearLocal = () => { try { localStorage.removeItem(PENDING + (rec.id || "new-" + rec.kind)); localStorage.removeItem(PENDING + "new-" + rec.kind); } catch (_) {} };

  async function save() {
    if (!dirty) return rec;
    if (saving) { await saving; if (!dirty) return rec; }
    if (rec.status === "approved") { dirty = false; return rec; }
    dirty = false;
    setSave("saving");
    const fields = ["kind", "academic_year", "term", "record_date", "school_id", "teacher_id", "title", "data"];
    const body = {}; fields.forEach((f) => (body[f] = rec[f] ?? null));
    body.data = rec.data || {};
    saving = (async () => {
      try {
        let saved;
        if (!rec.id) { saved = await api.create(body); clearLocal(); rec = { ...rec, ...saved }; onCreated && onCreated(rec); }
        else { saved = await api.update(rec.id, body, rec.version); rec = { ...rec, ...saved }; }
        if (!dirty) base = structuredClone(rec.data || {});
        clearLocal();
        setSave(dirty ? "saving" : "saved");
        onSaved && onSaved(rec);
      } catch (e) {
        dirty = true; keepLocal();
        if (e instanceof ApiError && e.code === "conflict") { if (merge) { await mergeTheirs(); return; } await resolveConflict(); return; }
        setSave(e.code === "network" ? "offline" : "error", e.message);
        toast("لم يتم الحفظ: " + e.message, "error");
      } finally { saving = null; }
    })();
    await saving;
    return rec;
  }
  const later = debounce(save, 900);

  // يدمج النسخة الأحدث من الخادم مع تعديلاتي، ثم يحفظ (إن كان عندي تعديلات)
  async function mergeTheirs({ andSave = true } = {}) {
    const theirs = await api.get(rec.id);
    if (!theirs) { setSave("error", "حُذف الملف"); return; }
    const stats = { conflicts: 0 };
    const merged = merge3(base, rec.data || {}, theirs.data || {}, stats);
    const hadMine = dirty;
    rec = { ...theirs, data: merged };
    base = structuredClone(theirs.data || {});
    onMerged && onMerged(rec, stats);
    if (theirs.status === "approved") { dirty = false; clearLocal(); setSave("saved"); return; }
    // يُحفظ بعد انتهاء عملية الحفظ الجارية (لا ننتظر أنفسنا)
    if (hadMine && andSave) { dirty = true; setTimeout(() => save(), 0); return; }
    dirty = false; setSave("saved");
  }

  async function resolveConflict() {
    setSave("error", "تعارض");
    const theirs = await api.get(rec.id);
    const choice = await modal({
      title: "تعارض في الحفظ",
      body: `<p>عُدّل هذا السجل من جهاز أو نافذة أخرى بعد أن فتحتِه هنا (${esc(new Date(theirs?.updated_at).toLocaleString("ar-KW"))}).</p>
             <p>لن يُكتب فوق أي نسخة دون اختيارك:</p>`,
      actions: [
        { label: "حفظ نسختي كسجل جديد", value: "copy" },
        { label: "اعتماد النسخة الأحدث وترك تعديلاتي", value: "theirs" },
        { label: "حفظ نسختي فوق الأحدث", value: "mine", kind: "primary" },
      ],
    });
    if (choice === "theirs" && theirs) { rec = theirs; dirty = false; clearLocal(); setSave("saved"); onSaved && onSaved(rec, true); return; }
    if (choice === "copy") { const copy = { ...rec, id: undefined, version: undefined, title: rec.title + " (نسخة)" }; rec = copy; dirty = true; setTimeout(() => save(), 0); return; }
    if (choice === "mine" && theirs) { rec.version = theirs.version; dirty = true; setTimeout(() => save(), 0); return; }
    setSave("error", "لم يُحسم التعارض بعد");
  }

  return {
    get rec() { return rec; },
    set rec(v) { rec = v; },
    change(mut, { immediate = false } = {}) {
      if (rec.status === "approved") { toast("التقرير معتمد ولا يمكن تعديله. ألغي الاعتماد أولاً", "error"); return; }
      mut(rec); dirty = true; keepLocal(); setSave("saving");
      immediate ? later.flush() : later();
    },
    save: () => { later.cancel(); return save(); },
    get dirty() { return dirty; },
    // جلب تعديلات الآخرين على الملف المشترك (يُستدعى دورياً)؛ يعيد true إن تغيّر شيء
    async pull() {
      if (!merge || !rec.id || saving) return false;
      const cur = await api.get(rec.id).catch(() => null);
      if (!cur || cur.version === rec.version) return false;
      if (dirty) { later.cancel(); await save(); return true; }
      await mergeTheirs({ andSave: false }); return true;
    },
  };
}

export function pendingDraft(key) {
  try { const v = JSON.parse(localStorage.getItem(PENDING + key) || "null"); return v; } catch (_) { return null; }
}
export function pendingDrafts() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(PENDING)) out.push(JSON.parse(localStorage.getItem(k))); } } catch (_) {}
  return out;
}

window.addEventListener("online", () => setSave(state.saveState === "offline" ? "error" : state.saveState, "عاد الاتصال، أعيدي الحفظ"));
window.addEventListener("offline", () => setSave("offline", "لا يوجد اتصال"));

// التواريخ الثابتة من التقويم الدراسي (مشتركة لكل الموجهين، لا تُحذف من الرزنامة)
export function officialDates() {
  const items = state.options.official_dates?.items?.length ? state.options.official_dates.items : DEFAULT_OPTIONS.official_dates.items;
  // تواريخ مادة معيّنة تظهر لموجهي المادة (أو لمن لم يحدد مادته بعد)
  const norm = (t) => String(t || "").replace(/^ال/, "").replace(/\s+/g, "").trim();
  const mine = norm(G().subject);
  return items.map((l, i) => { const [from, to, title, h, subj, details] = String(l).split("|").map((x) => (x || "").trim());
    if (subj && mine && !mine.includes(norm(subj)) && !norm(subj).includes(mine)) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(from) && title ? { id: "official-" + i, from, to: /^\d{4}-\d{2}-\d{2}$/.test(to) && to > from ? to : from, title, holiday: /عطلة/.test(h || ""), subject: subj || "", details: details || "" } : null; }).filter(Boolean);
}

// الفصل الدراسي بصيغة المذكر (الأول/الثاني)؛ السجلات القديمة المحفوظة «الأولى/الثانية» تُعامل كنفس الفصل
export const termMasc = (t) => ({ "الأولى": "الأول", "الثانية": "الثاني" }[String(t || "").trim()] || String(t || "").trim());
export const termOpts = () => [...new Set(opts("terms").map(termMasc).filter(Boolean))];
export const sameTerm = (a, b) => termMasc(a) === termMasc(b);

// اسم المادة للعرض والطباعة بـ«ال» (كيمياء ← الكيمياء)، كما كان يُكتب سابقاً
export const subjectAl = (x) => { const t = String(x || "").trim(); return !t || t.startsWith("ال") ? t : "ال" + t; };
