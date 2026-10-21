// طبقة البيانات: تتصل بـ Supabase عبر واجهته القياسية (REST) دون مكتبات خارجية.
// وضع تجريبي محلي (?demo=1) للاختبار فقط: يحفظ في هذا المتصفح ولا يُستخدم للبيانات الحقيقية.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export class ApiError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status; }
}

const AR_ERRORS = [
  [/Invalid login credentials/i, "اسم المستخدم أو كلمة المرور غير صحيحة"],
  [/Email not confirmed/i, "لم يتم تأكيد البريد الإلكتروني بعد. افتحي رسالة التأكيد في بريدك"],
  [/User already registered/i, "هذا البريد مسجّل مسبقاً"],
  [/Password should be at least/i, "كلمة المرور قصيرة، استخدمي 8 أحرف على الأقل"],
  [/duplicate key.*username|Database error saving new user/i, "اسم المستخدم مستخدم من قبل أو غير صالح، اختاري اسماً آخر"],
  [/profiles_username_check/i, "اسم المستخدم يكون بالأحرف الإنجليزية والأرقام فقط (3 إلى 32)"],
  [/JWT expired/i, "انتهت الجلسة، سجّلي الدخول مرة أخرى"],
  [/row-level security/i, "ليست لديك صلاحية لهذه العملية"],
  [/Payload too large|exceeded the maximum/i, "حجم الملف أكبر من المسموح"],
  [/Failed to fetch|NetworkError|Load failed/i, "تعذر الاتصال بالإنترنت. لم يتم الحفظ"],
];
export function arabicError(e) {
  const m = (e && (e.message || e.msg || e.error_description || e.error)) || String(e);
  for (const [re, ar] of AR_ERRORS) if (re.test(m)) return ar;
  if (/[؀-ۿ]/.test(m)) return m;
  return "حدث خطأ غير متوقع: " + m;
}

const isDemo = new URLSearchParams(location.search).has("demo") || !SUPABASE_URL;

/* ------------------------------------------------------------------ */
/*  Supabase                                                           */
/* ------------------------------------------------------------------ */
function supabaseAdapter() {
  // الجلسة: «تذكّريني» تحفظها في هذا الجهاز فيفتح الموقع مباشرة دون كلمة مرور حتى تسجيل الخروج؛
  // بدونها تُحفظ لهذه النافذة فقط
  const KEY = "sijil.session";
  let session = null, remember = true;
  try { session = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {}
  if (!session) { try { session = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (session) remember = false; } catch (_) {} }
  const listeners = new Set();
  const setSession = (s) => {
    session = s;
    for (const st of [() => localStorage, () => sessionStorage]) { try { st().removeItem(KEY); } catch (_) {} }
    if (s) { try { (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s)); } catch (_) {} }
    listeners.forEach((f) => f(s));
  };

  async function raw(path, { method = "GET", body, headers = {}, auth = true, isBlob = false } = {}) {
    const h = { apikey: SUPABASE_ANON_KEY, ...headers };
    // بدون جلسة يكفي مفتاح apikey (يعمل مع المفاتيح القديمة anon والجديدة publishable)
    if (auth && session) h.Authorization = "Bearer " + session.access_token;
    if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) {
      h["Content-Type"] = h["Content-Type"] || "application/json";
      body = JSON.stringify(body);
    }
    let res;
    try { res = await fetch(SUPABASE_URL + path, { method, headers: h, body }); }
    catch (e) { throw new ApiError(arabicError(e), "network", 0); }
    if (res.status === 401 && auth && session && !path.startsWith("/auth/")) {
      if (await refresh()) return raw(path, { method, body: body && typeof body === "string" ? JSON.parse(body) : body, headers, auth, isBlob });
    }
    if (!res.ok) {
      let j = {}; try { j = await res.json(); } catch (_) {}
      throw new ApiError(arabicError(j.message ? j : { message: j.msg || j.error_description || j.error || res.statusText }), j.code || "http", res.status);
    }
    if (isBlob) return res.blob();
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  }

  // حفظ سجل ملف؛ إن لم يُحدَّث جدول الملفات بعد (عمود المادة غير موجود) يُحفظ بدونه
  async function insertFile(body) {
    try { return await rest("files", { method: "POST", headers: { Prefer: "return=representation" }, body }); }
    catch (e) {
      if (body.subject !== undefined && /subject/i.test(e.message || "")) { const { subject, ...rest2 } = body; return rest("files", { method: "POST", headers: { Prefer: "return=representation" }, body: rest2 }); }
      throw e;
    }
  }
  // تجديد الجلسة: عند انقطاع الإنترنت تبقى الجلسة كما هي (لا يُطلب الدخول من جديد)،
  // ولا تُلغى إلا إذا رفض الخادم التجديد (تسجيل خروج من جهاز آخر أو إيقاف الحساب)
  let refreshing = null;
  function refresh() {
    if (!session?.refresh_token) return Promise.resolve(false);
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const s = await raw("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: session.refresh_token }, auth: false });
        setSession({ ...s, expires_at: Date.now() / 1000 + s.expires_in });
        return true;
      } catch (e) { if (e.code !== "network" && e.status >= 400 && e.status < 500) setSession(null); return false; }
      finally { setTimeout(() => (refreshing = null), 0); }
    })();
    return refreshing;
  }
  // تجديد هادئ عند العودة إلى الموقع (مثلاً فتحه من الشاشة الرئيسية للجوال)
  const keepAlive = () => { if (session?.expires_at && session.expires_at - Date.now() / 1000 < 300) refresh(); };
  try { document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAlive(); }); setInterval(keepAlive, 4 * 60 * 1000); } catch (_) {}

  const rest = (q, opts) => raw("/rest/v1/" + q, opts);
  const enc = encodeURIComponent;

  return {
    demo: false,
    onAuth: (f) => listeners.add(f),
    get session() { return session; },
    async ready() {
      if (session && session.expires_at && session.expires_at - Date.now() / 1000 < 120) await refresh();
      return session;
    },
    async signIn(login, password, { stay = true } = {}) {
      remember = stay;
      let email = login.trim();
      if (!email.includes("@")) {
        email = await raw("/rest/v1/rpc/login_email", { method: "POST", body: { p_username: email }, auth: false });
        if (!email) throw new ApiError("اسم المستخدم غير موجود", "auth", 400);
      }
      const s = await raw("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password }, auth: false });
      setSession({ ...s, expires_at: Date.now() / 1000 + s.expires_in });
    },
    async signUp({ username, full_name, email, password }) {
      const r = await raw("/auth/v1/signup", { method: "POST", auth: false,
        body: { email, password, data: { username: username.toLowerCase(), full_name } } });
      if (r && r.access_token) setSession({ ...r, expires_at: Date.now() / 1000 + r.expires_in });
      return r;
    },
    // all=true: تسجيل الخروج من كل الأجهزة (يلغي الدخول التلقائي في الجوال وغيره)
    async signOut(all = false) {
      try { await raw("/auth/v1/logout" + (all ? "?scope=global" : ""), { method: "POST" }); } catch (_) {}
      setSession(null);
    },
    async changePassword(password) { await raw("/auth/v1/user", { method: "PUT", body: { password } }); },
    async resetPassword(email) { await raw("/auth/v1/recover", { method: "POST", body: { email }, auth: false }); },

    async me() {
      const uid = session?.user?.id; if (!uid) return null;
      const r = await rest(`profiles?id=eq.${uid}&select=*`);
      return r[0] || null;
    },
    async updateMe(patch) {
      const uid = session.user.id;
      await rest(`profiles?id=eq.${uid}`, { method: "PATCH", body: patch });
    },

    // ---- السجلات
    async list({ kind, kinds, year, includeDeleted = false, onlyDeleted = false, school, teacher, group, order = "record_date.desc.nullslast,created_at.desc", select = "*", extra = "" } = {}) {
      let q = `records?select=${select}&order=${order}`;
      if (group) q += `&group_id=eq.${group}`;
      if (kind) q += `&kind=eq.${kind}`;
      if (kinds) q += `&kind=in.(${kinds.join(",")})`;
      if (year) q += `&academic_year=eq.${enc(year)}`;
      if (school) q += `&school_id=eq.${school}`;
      if (teacher) q += `&teacher_id=eq.${teacher}`;
      if (onlyDeleted) q += `&deleted_at=not.is.null`;
      else if (!includeDeleted) q += `&deleted_at=is.null`;
      // الملف المشترك يظهر للجميع؛ وما عداه سجلاتي فقط
      const sharedOnly = ["shared_achievements", "group_sheet"].includes(kind) || (kinds && kinds.every((k) => ["shared_achievements", "group_sheet"].includes(k)));
      if (session?.user?.id && !extra.includes("owner_id") && !sharedOnly) q += `&owner_id=eq.${session.user.id}`;
      return rest(q + extra);
    },
    // التقارير التي أرسلها أصحابها للمسؤول عن التجميع (قاعدة البيانات تسمح له بقراءتها فقط)
    async listSubmitted(kind, field, value) {
      return rest(`records?select=*&kind=eq.${kind}&deleted_at=is.null&data->>submitted=eq.true&data->>${field}=eq.${enc(value)}`);
    },
    async get(id) { const r = await rest(`records?id=eq.${id}&select=*`); return r[0] || null; },
    async create(rec) {
      const r = await rest("records", { method: "POST", body: rec, headers: { Prefer: "return=representation" } });
      return r[0];
    },
    async update(id, patch, version) {
      const r = await rest(`records?id=eq.${id}&version=eq.${version}`, { method: "PATCH", body: patch, headers: { Prefer: "return=representation" } });
      if (!r.length) throw new ApiError("تم تعديل هذا السجل من جهاز أو نافذة أخرى", "conflict", 409);
      return r[0];
    },
    async remove(id) { await rest(`records?id=eq.${id}`, { method: "DELETE" }); },
    async audit(recordId) { return rest(`audit_log?record_id=eq.${recordId}&order=at.desc&limit=50`); },
    rpc: (name, args = {}) => raw("/rest/v1/rpc/" + name, { method: "POST", body: args }),

    // ---- القوائم المنسدلة
    async options() { return rest("option_lists?select=*"); },
    async saveOption(key, label, items) {
      await rest("option_lists?on_conflict=key", { method: "POST", body: { key, label, items }, headers: { Prefer: "resolution=merge-duplicates" } });
    },

    // ---- الملفات
    async upload(file, meta) {
      const uid = session.user.id;
      const ext = (file.name || "").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      const path = `${uid}/${meta.category}/${crypto.randomUUID()}.${ext}`;
      await raw(`/storage/v1/object/private/${path}`, { method: "POST", body: file, headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" } });
      const r = await insertFile({ category: meta.category, stage: meta.stage || null, subject: meta.subject || null, term: meta.term || null, subcategory: meta.subcategory || null, title: meta.title || file.name || "", storage_path: path, mime: file.type, size: file.size, record_id: meta.record_id || null, group_id: meta.group_id || null });
      return r[0];
    },
    // رابط من موقع خارجي: يُحفظ الرابط فقط (لا يُرفع ملف إلى التخزين)
    async addLink(meta) {
      const r = await insertFile({ category: meta.category, stage: meta.stage || null, subject: meta.subject || null, term: meta.term || null, subcategory: meta.subcategory || null, title: meta.title || meta.url, url: meta.url, mime: "text/uri-list", size: 0, record_id: meta.record_id || null });
      return r[0];
    },
    async files(filter = "") { return rest(`files?select=*&order=created_at.desc${filter}`); },
    async fileById(id) { const r = await rest(`files?id=eq.${id}&select=*`); return r[0] || null; },
    async updateFile(id, patch) { await rest(`files?id=eq.${id}`, { method: "PATCH", body: patch }); },
    async deleteFile(f) {
      if (f.storage_path) await raw(`/storage/v1/object/private/${f.storage_path}`, { method: "DELETE" });
      await rest(`files?id=eq.${f.id}`, { method: "DELETE" });
    },
    async fileBlob(path) { return raw(`/storage/v1/object/authenticated/private/${path}`, { isBlob: true }); },
    // رابط مؤقت (ساعة) يفتح الملف مباشرة من التخزين؛ مع اسم ملف يُنزَّل بدل أن يُفتح
    async signedUrl(path, downloadName = "") {
      const j = await raw(`/storage/v1/object/sign/private/${path}`, { method: "POST", body: { expiresIn: 3600 } });
      const s = j?.signedURL || j?.signedUrl;
      if (!s) throw new ApiError("تعذر تجهيز رابط الملف", "http", 0);
      let u = SUPABASE_URL + "/storage/v1" + (s.startsWith("/") ? s : "/" + s);
      if (downloadName) u += (u.includes("?") ? "&" : "?") + "download=" + encodeURIComponent(downloadName);
      return u;
    },
    async shares(fileId) { return rest(`file_shares?file_id=eq.${fileId}&select=*`); },
    async addShare(fileId, userId) { await rest("file_shares", { method: "POST", body: { file_id: fileId, user_id: userId } }); },
    async removeShare(fileId, userId) { await rest(`file_shares?file_id=eq.${fileId}&user_id=eq.${userId}`, { method: "DELETE" }); },

    // ---- المجموعات (قاعدة البيانات تُظهر لكل مستخدم مجموعاته فقط، وللمشرف كلها)
    async groups() { return rest("groups?select=*&order=name.asc"); },
    async createGroup(name) { const r = await rest("groups", { method: "POST", body: { name }, headers: { Prefer: "return=representation" } }); return r[0]; },
    async renameGroup(id, name) { await rest(`groups?id=eq.${id}`, { method: "PATCH", body: { name } }); },
    async deleteGroup(id) { await rest(`groups?id=eq.${id}`, { method: "DELETE" }); },
    async groupMembers(id) { return raw("/rest/v1/rpc/group_member_names", { method: "POST", body: { p_group: id } }); },
    async addMember(groupId, userId) { await rest("group_members", { method: "POST", body: { group_id: groupId, user_id: userId } }); },
    async removeMember(groupId, userId) { await rest(`group_members?group_id=eq.${groupId}&user_id=eq.${userId}`, { method: "DELETE" }); },
    // ---- أقسام التوجيه (لكل قسم مشرف وأعضاء وملف إنجازات)
    async sections() { try { return await rest("sections?select=*&order=created_at.asc"); } catch (e) { if (/sections|relation|schema cache|404/i.test(e.message || "")) return []; throw e; } },
    async createSection(body) { const r = await rest("sections", { method: "POST", body, headers: { Prefer: "return=representation" } }); return r[0]; },
    async updateSection(id, patch) { const r = await rest(`sections?id=eq.${id}`, { method: "PATCH", body: patch, headers: { Prefer: "return=representation" } }); if (!r.length) throw new ApiError("ليست لديك صلاحية تعديل هذا القسم", "forbidden", 403); return r[0]; },
    async deleteSection(id) { await rest(`sections?id=eq.${id}`, { method: "DELETE" }); },

    // ---- النماذج: صندوق ما أرسله المكلَّفون (لصاحبة النموذج فقط)، والتعبئة العامة برابط
    async formInbox(formId) { return rest(`form_inbox?form_id=eq.${formId}&select=*&order=created_at.asc`); },
    async clearInbox(ids) { if (ids.length) await rest(`form_inbox?id=in.(${ids.join(",")})`, { method: "DELETE" }); },
    async publicForm(token) { return raw("/rest/v1/rpc/form_public_get", { method: "POST", body: { p_token: token }, auth: false }); },
    async publicSubmit(token, name, civilId) { return raw("/rest/v1/rpc/form_public_submit", { method: "POST", body: { p_token: token, p_name: name, p_civil_id: civilId }, auth: false }); },
  };
}

/* ------------------------------------------------------------------ */
/*  وضع تجريبي محلي — يحاكي قواعد قاعدة البيانات لاختبار الواجهة        */
/* ------------------------------------------------------------------ */
function demoAdapter() {
  const KEY = "sijil.demo.v1";
  const uid = "00000000-0000-0000-0000-00000000demo";
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {}
  db = db || { records: [], files: [], options: [], audit: [], blobs: {}, profile: null };
  db.groups ||= []; db.members ||= []; db.inbox ||= []; db.sections ||= [];
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {} };
  const listeners = new Set();
  let session = db.profile ? { user: { id: uid } } : null;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const now = () => new Date().toISOString();
  const fail = (m, code = "db") => { throw new ApiError(m, code, 400); };
  const audit = (r, action) => db.audit.push({ id: db.audit.length + 1, owner_id: uid, actor_id: uid, record_id: r.id, kind: r.kind, action, at: now() });
  const delay = () => new Promise((r) => setTimeout(r, 30));

  function checkLinks(n) {
    if (n.school_id && !db.records.some((r) => r.id === n.school_id && r.kind === "school")) fail("المدرسة المختارة غير موجودة في سجلاتك");
    if (n.teacher_id && !db.records.some((r) => r.id === n.teacher_id && r.kind === "teacher")) fail("المعلم المختار غير موجود في سجلاتك");
  }
  return {
    demo: true,
    onAuth: (f) => listeners.add(f),
    get session() { return session; },
    async ready() { return session; },
    async signIn(login) {
      db.profile = db.profile || { id: uid, username: login || "demo", full_name: "حساب تجريبي", role: "admin", is_collector: true, approved: true };
      session = { user: { id: uid } }; persist(); listeners.forEach((f) => f(session));
    },
    async signUp(p) { db.profile = { id: uid, username: p.username, full_name: p.full_name, role: "admin", is_collector: true, approved: true }; session = { user: { id: uid } }; persist(); return { access_token: "demo" }; },
    async signOut() { session = null; listeners.forEach((f) => f(null)); },
    async changePassword() {}, async resetPassword() {},
    async me() { return clone(db.profile); },
    async updateMe(p) { Object.assign(db.profile, { full_name: p.full_name ?? db.profile.full_name }); persist(); },
    async list({ kind, kinds, year, includeDeleted = false, onlyDeleted = false, school, teacher, group } = {}) {
      await delay();
      let r = db.records.filter((x) => (!group || x.group_id === group) && (!kind || x.kind === kind) && (!kinds || kinds.includes(x.kind)) && (!year || x.academic_year === year)
        && (!school || x.school_id === school) && (!teacher || x.teacher_id === teacher)
        && (onlyDeleted ? !!x.deleted_at : includeDeleted || !x.deleted_at));
      r.sort((a, b) => (b.record_date || "").localeCompare(a.record_date || "") || b.created_at.localeCompare(a.created_at));
      return clone(r);
    },
    async listSubmitted(kind, field, value) {
      return clone(db.records.filter((x) => x.kind === kind && !x.deleted_at && x.data?.submitted && x.data?.[field] === value));
    },
    async get(id) { await delay(); const r = db.records.find((x) => x.id === id); return r ? clone(r) : null; },
    async create(rec) {
      await delay();
      const n = { id: rec.id || crypto.randomUUID(), owner_id: uid, kind: rec.kind, academic_year: rec.academic_year || null, term: rec.term || null,
        record_date: rec.record_date || null, school_id: rec.school_id || null, teacher_id: rec.teacher_id || null, title: rec.title || "",
        data: rec.data || {}, status: rec.status || "draft", snapshot: rec.snapshot || null, deleted_at: rec.deleted_at || null, group_id: rec.group_id || null,
        section_id: rec.section_id || null, version: 1, created_at: now(), updated_at: now(), approved_at: null };
      if (db.records.some((x) => x.id === n.id)) fail("duplicate key value");
      if ((n.kind === "group_sheet") !== !!n.group_id) fail("جدول المجموعة يجب أن يرتبط بمجموعة");
      if (n.status === "approved") { if (!n.snapshot) fail("لا يمكن اعتماد تقرير بدون نسخة ثابتة"); n.approved_at = now(); }
      else n.snapshot = null;
      checkLinks(n);
      db.records.push(n); audit(n, "إنشاء"); persist(); return clone(n);
    },
    async update(id, patch, version) {
      await delay();
      const o = db.records.find((x) => x.id === id);
      if (!o || o.version !== version) throw new ApiError("تم تعديل هذا السجل من جهاز أو نافذة أخرى", "conflict", 409);
      const n = { ...o, ...clone(patch) };
      if (n.group_id !== o.group_id) fail("لا يمكن نقل الجدول إلى مجموعة أخرى");
      if ((n.section_id || null) !== (o.section_id || null)) fail("لا يمكن نقل الملف إلى قسم آخر");
      const changed = (k) => JSON.stringify(n[k]) !== JSON.stringify(o[k]);
      let action = "تعديل";
      if (o.status === "approved") {
        if (n.status === "approved") {
          if (["data", "snapshot", "school_id", "teacher_id", "record_date", "title", "academic_year", "term"].some(changed))
            fail("هذا التقرير معتمد ولا يمكن تعديله. ألغِ الاعتماد أولاً إن احتجت التعديل");
          if (n.deleted_at && !o.deleted_at) fail("هذا التقرير معتمد ولا يمكن حذفه. ألغِ الاعتماد أولاً");
        } else {
          if (changed("data")) fail("ألغِ الاعتماد أولاً ثم عدّل البيانات في عملية منفصلة");
          n.snapshot = null; n.approved_at = null; action = "إلغاء اعتماد";
        }
      } else if (n.status === "approved") {
        if (!n.snapshot) fail("لا يمكن اعتماد تقرير بدون نسخة ثابتة");
        n.approved_at = now(); action = "اعتماد";
      } else n.snapshot = null;
      if (!o.deleted_at && n.deleted_at) action = "نقل إلى المحذوفات";
      if (o.deleted_at && !n.deleted_at) action = "استعادة";
      checkLinks(n);
      n.version = o.version + 1; n.updated_at = now();
      Object.assign(o, n); audit(o, action); persist(); return clone(o);
    },
    async remove(id) {
      const o = db.records.find((x) => x.id === id);
      if (o.status === "approved") fail("لا يمكن حذف تقرير معتمد");
      if (!o.deleted_at) fail("انقل السجل إلى سلة المحذوفات أولاً");
      db.records = db.records.filter((x) => x.id !== id);
      db.records.forEach((x) => { if (x.school_id === id) x.school_id = null; if (x.teacher_id === id) x.teacher_id = null; });
      audit(o, "حذف نهائي"); persist();
    },
    async audit(recordId) { return clone(db.audit.filter((a) => a.record_id === recordId).reverse()); },
    async rpc(name, args = {}) {
      if (name === "admin_list_users") return [clone(db.profile)];
      if (name === "admin_set_email") { const e = String(args.p_email || "").trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) fail("البريد الإلكتروني غير صحيح"); if (args.p_id === db.profile.id) { db.profile.email = e; persist(); } return null; }
      if (name === "list_colleagues") return [];
      if (name === "collector_owners") return [{ id: uid, full_name: db.profile.full_name }];
      return null;
    },
    async options() { return clone(db.options); },
    async saveOption(key, label, items) {
      const o = db.options.find((x) => x.key === key);
      if (o) Object.assign(o, { label, items }); else db.options.push({ key, label, items });
      persist();
    },
    async upload(file, meta) {
      const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
      const id = crypto.randomUUID();
      const f = { id, owner_id: uid, category: meta.category, stage: meta.stage || null, subject: meta.subject || null, term: meta.term || null, subcategory: meta.subcategory || null, title: meta.title || file.name || "",
        storage_path: `${uid}/${meta.category}/${id}`, mime: file.type, size: file.size, record_id: meta.record_id || null, group_id: meta.group_id || null, created_at: now() };
      db.blobs[f.storage_path] = dataUrl; db.files.unshift(f);
      try { persist(); } catch (e) { fail("مساحة المتصفح ممتلئة في الوضع التجريبي"); }
      return clone(f);
    },
    async addLink(meta) {
      if (!/^https?:\/\/\S+$/i.test(meta.url || "")) fail("الرابط غير صالح، يجب أن يبدأ بـ https://");
      const f = { id: crypto.randomUUID(), owner_id: uid, category: meta.category, stage: meta.stage || null, subject: meta.subject || null, term: meta.term || null, subcategory: meta.subcategory || null,
        title: meta.title || meta.url, url: meta.url, storage_path: null, mime: "text/uri-list", size: 0, record_id: meta.record_id || null, created_at: now() };
      db.files.unshift(f); persist(); return clone(f);
    },
    async files(filter = "") {
      let r = db.files;
      const m = (k) => (filter.match(new RegExp(k + "=eq\\.([^&]+)")) || [])[1];
      if (m("category")) r = r.filter((x) => x.category === decodeURIComponent(m("category")));
      if (m("record_id")) r = r.filter((x) => x.record_id === m("record_id"));
      if (m("stage")) r = r.filter((x) => x.stage === decodeURIComponent(m("stage")));
      if (m("term")) r = r.filter((x) => x.term === decodeURIComponent(m("term")));
      if (m("group_id")) r = r.filter((x) => x.group_id === m("group_id"));
      return clone(r);
    },
    async fileById(id) { const f = db.files.find((x) => x.id === id); return f ? clone(f) : null; },
    async updateFile(id, patch) { Object.assign(db.files.find((x) => x.id === id), patch); persist(); },
    async deleteFile(f) { db.files = db.files.filter((x) => x.id !== f.id); if (f.storage_path) delete db.blobs[f.storage_path]; persist(); },
    // تحويل البيانات المحفوظة إلى ملف دون fetch (بعض نوافذ المعاينة تمنع fetch لروابط data:)
    async fileBlob(path) {
      const d = db.blobs[path]; if (!d) fail("الملف غير موجود");
      const [head, b64] = d.split(",");
      const mime = (head.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
      const bin = atob(b64); const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    },
    async shares() { return []; }, async addShare() {}, async removeShare() {},
    // المجموعات (في الوضع التجريبي حساب واحد هو المشرف)
    async groups() { return clone([...db.groups].sort((a, b) => a.name.localeCompare(b.name, "ar"))); },
    async createGroup(name) { if (!String(name || "").trim()) fail("اكتبي اسم المجموعة"); const g = { id: crypto.randomUUID(), name: name.trim(), created_at: now() }; db.groups.push(g); persist(); return clone(g); },
    async renameGroup(id, name) { Object.assign(db.groups.find((g) => g.id === id), { name }); persist(); },
    async deleteGroup(id) {
      db.groups = db.groups.filter((g) => g.id !== id); db.members = db.members.filter((m) => m.group_id !== id);
      db.records = db.records.filter((r) => r.group_id !== id);
      db.files.filter((f) => f.group_id === id).forEach((f) => { if (f.storage_path) delete db.blobs[f.storage_path]; });
      db.files = db.files.filter((f) => f.group_id !== id); persist();
    },
    async groupMembers(id) { return db.members.filter((m) => m.group_id === id).map((m) => ({ id: m.user_id, username: db.profile.username, full_name: db.profile.full_name })); },
    async addMember(groupId, userId) { if (!db.members.some((m) => m.group_id === groupId && m.user_id === userId)) db.members.push({ group_id: groupId, user_id: userId }); persist(); },
    async removeMember(groupId, userId) { db.members = db.members.filter((m) => !(m.group_id === groupId && m.user_id === userId)); persist(); },
    async sections() { return clone(db.sections); },
    async createSection(body) { if (!String(body.name || "").trim()) fail("اكتبي اسم القسم"); const x = { id: crypto.randomUUID(), members: [], editors: [], supervisor_id: null, created_at: now(), ...body }; db.sections.push(x); persist(); return clone(x); },
    async updateSection(id, patch) { const x = db.sections.find((y) => y.id === id); if (!x) fail("القسم غير موجود"); Object.assign(x, clone(patch)); persist(); return clone(x); },
    async deleteSection(id) { if (db.records.some((r) => r.section_id === id)) fail("لا يمكن حذف قسم فيه ملفات"); db.sections = db.sections.filter((y) => y.id !== id); persist(); },
    // النماذج (في الوضع التجريبي: الرابط يعمل في هذا المتصفح فقط)
    async formInbox(formId) { return clone(db.inbox.filter((x) => x.form_id === formId)); },
    async clearInbox(ids) { db.inbox = db.inbox.filter((x) => !ids.includes(x.id)); persist(); },
    async publicForm(token) {
      const r = db.records.find((x) => x.kind === "form" && !x.deleted_at && (token || "").length >= 20 && x.data?.token === token && x.data?.open);
      return r ? { title: r.title, type: r.data.type, task: r.data.task || "", from: r.data.from || "", to: r.data.to || "", guide: db.profile?.full_name || "" } : null;
    },
    async publicSubmit(token, name, civilId) {
      const r = db.records.find((x) => x.kind === "form" && !x.deleted_at && x.data?.token === token && x.data?.open);
      if (!r) fail("الرابط غير صالح أو أُغلق");
      const n = String(name || "").trim().replace(/\s+/g, " "), c = String(civilId || "").trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
      if (n.length < 3) fail("اكتب الاسم كاملاً");
      if (!/^[0-9]{12}$/.test(c)) fail("الرقم المدني يجب أن يكون 12 رقماً");
      const ex = db.inbox.find((x) => x.form_id === r.id && x.civil_id === c);
      if (ex) ex.name = n; else db.inbox.push({ id: crypto.randomUUID(), form_id: r.id, name: n, civil_id: c, created_at: now() });
      persist(); return "ok";
    },
  };
}

export const api = isDemo ? demoAdapter() : supabaseAdapter();
export const DEMO = isDemo;
