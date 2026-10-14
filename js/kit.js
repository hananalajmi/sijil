// مكوّنات مشتركة: حقول النماذج، صفحة السجل بشريط أدواته، القوائم، رفع الصور، لوحة التوقيع
import { api } from "./api.js";
import { state, opts, recordEditor, schoolById, teacherById, fileUrl, refreshPeople, onSaveState, offSaveState, addMyOption, setMyOptions } from "./store.js";
import { esc, $, $$, toast, modal, confirmBox, today, academicYearOf, fmtDate, shrinkImage, dayName } from "./ui.js";
import { recordContext } from "./report/context.js";

export const KIND_LABEL = {
  guide_data: "البيانات الأساسية", school: "مدرسة", teacher: "معلم", department: "بيانات القسم العلمي",
  teacher_visit: "زيارة معلم / رئيس قسم", school_visit: "زيارة الموجه للمدرسة", exam_followup: "متابعة امتحان",
  weekly_report: "الإنجازات الأسبوعية", monthly_achievements: "الإنجازات الشهرية (النموذج السابق)", shared_achievements: "الإنجازات الشهرية (مشترك)", group_sheet: "جدول مجموعة", form: "نموذج", weekly_plan: "خطة أسبوعية (قديم)", monthly_plan: "خطة شهرية", important_date: "تاريخ هام", event_report: "تقرير فعالية / تنمية مهنية",
  achievement: "إنجازات (قديم)", note: "تقرير معتمد",
};
export const KIND_ROUTE = {
  school: "schools", teacher: "schools", department: "schools", teacher_visit: "teacher-visits", school_visit: "school-visits",
  exam_followup: "exams", weekly_report: "weekly", monthly_achievements: "monthly-ach-old", shared_achievements: "monthly-ach", group_sheet: "group-sheet", form: "forms", monthly_plan: "monthly", important_date: "dates", event_report: "events", note: "print", guide_data: "guide",
};
export const PRINTABLE = new Set(["teacher_visit", "school_visit", "event_report", "weekly_report", "monthly_achievements", "monthly_plan", "shared_achievements", "form"]);

// النماذج التي لها نسخة فارغة (للطباعة أو الإرسال)
export const BLANKABLE = { teacher_visit: (r) => "blank-teacher_visit" + (r.data?.visitee === "head" ? "?head=1" : ""), school_visit: () => "blank-school_visit", event_report: () => "blank-event_report", form: () => "blank-takleef" };
export const go = (h) => { if (location.hash === h) window.dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = h; };

/* ---------------- الحقول ---------------- */
let fid = 0;
// كل قائمة منسدلة فيها «إضافة خيار جديد للقائمة»؛ الخيار المضاف يُحفظ للموجّه نفسه في القائمة المناسبة
const LIST_FOR_KEY = { period: "periods", place: "places", section: "sections", subject: "subjects", grade: "grades", term: "terms", stage: "stages",
  job_title: "job_titles", extra_task: "extra_tasks", visit_type: "school_visit_types", type: "date_types", target: "target_groups" };
export const listKeyFor = (key, remember) => remember || LIST_FOR_KEY[key] || `extra.${key}`;
export function field({ label, value = "", type = "text", key, required = false, wide = false, hint = "", options, custom = true, placeholder = "", readonly = false, rows, remember = "" }) {
  const id = "f" + ++fid + "-" + (key || "x");
  let ctl;
  if (type === "select") {
    const lk = listKeyFor(key, remember);
    const list = [...new Set([...(options || []), ...opts(lk)])];
    const has = value === "" || value == null || list.includes(value);
    ctl = `<select id="${id}" data-key="${key || ""}" data-remember="${esc(lk)}" ${readonly ? "disabled" : ""}><option value="">—</option>${list.map((o) => `<option ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("")}
      ${!has ? `<option selected>${esc(value)}</option>` : ""}${!readonly ? `<option value="__custom">+ إضافة خيار جديد للقائمة…</option>` : ""}</select>`;
  } else if (type === "textarea") {
    ctl = `<textarea id="${id}" data-key="${key || ""}" placeholder="${esc(placeholder)}" ${rows ? `rows="${rows}"` : ""} ${readonly ? "readonly" : ""}>${esc(value)}</textarea>`;
  } else {
    ctl = `<input id="${id}" data-key="${key || ""}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${type === "tel" ? 'dir="ltr" inputmode="tel"' : ""} ${readonly ? "readonly" : ""}>`;
  }
  return `<div class="f ${wide ? "wide" : ""}"><label for="${id}" class="${required ? "req" : ""}">${esc(label)}</label>${ctl}${hint ? `<div class="hint">${esc(hint)}</div>` : ""}</div>`;
}
// يطلب قيمة جديدة ويضيفها للقائمة المنسدلة (وللقائمة الشخصية المحفوظة)
export async function promptNewOption(sel, listKey) {
  const v = await modal({ title: "إضافة خيار جديد للقائمة", body: `<div class="f"><input id="cv" type="text"></div><p class="hint">يُحفظ في قائمتك ويظهر في المرات القادمة.</p>`,
    actions: [{ label: "إلغاء", value: null }, { label: "إضافة", kind: "primary", value: (b) => b.querySelector("#cv").value.trim() }] });
  if (!v) { sel.value = ""; return null; }
  let o = [...sel.options].find((x) => x.value === v);
  if (!o) { o = document.createElement("option"); o.value = v; o.textContent = v; const anchor = [...sel.options].find((x) => x.value.startsWith("__")); sel.insertBefore(o, anchor || null); }
  sel.value = v;
  if (listKey) addMyOption(listKey, v);
  return v;
}
// يضيف مدرسة جديدة من أي قائمة مدارس
export async function promptNewSchool(sel) {
  const name = await modal({ title: "إضافة مدرسة", body: `<div class="f"><label for="sn">اسم المدرسة</label><input id="sn" type="text"></div>`,
    actions: [{ label: "إلغاء", value: null }, { label: "إضافة", kind: "primary", value: (b) => b.querySelector("#sn").value.trim() }] });
  if (!name) { sel.value = ""; return null; }
  const s = await api.create({ kind: "school", title: name, data: {} });
  await refreshPeople();
  sel.innerHTML = schoolOptions(s.id, { allowAdd: true });
  return s.id;
}
export function bindFields(root, onChange) {
  $$("[data-key]", root).forEach((el) => {
    const key = el.dataset.key; if (!key) return;
    const ev = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(ev, async () => {
      if (el.tagName === "SELECT" && el.value === "__custom") { if (!(await promptNewOption(el, el.dataset.remember))) return onChange(key, "", el); }
      if (el.tagName === "SELECT" && el.value === "__newschool") { const id = await promptNewSchool(el); return onChange(key, id || "", el); }
      onChange(key, el.value, el);
    });
  });
}
export const schoolOptions = (sel, { allowAdd = false } = {}) => `<option value="">— اختاري المدرسة —</option>` + state.schools.map((s) => `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${esc(s.title)}</option>`).join("")
  + (allowAdd ? `<option value="__newschool">+ إضافة مدرسة جديدة…</option>` : "");
// أسماء المعلمات مرتبطة بالمدرسة: لا تظهر إلا معلمات المدرسة المختارة
export const teacherOptions = (sel, schoolId, { allowAdd = false } = {}) => (!schoolId && allowAdd ? `<option value="">— اختاري المدرسة أولاً —</option>` : `<option value="">— اختاري —</option>`)
  + state.teachers.filter((t) => (schoolId ? t.school_id === schoolId : !allowAdd) || t.id === sel)
  .map((t) => `<option value="${t.id}" ${t.id === sel ? "selected" : ""}>${esc(t.title)}</option>`).join("")
  + (allowAdd && schoolId ? `<option value="__new">+ إضافة معلمة جديدة لهذه المدرسة…</option>` : "");
// يضيف اسم معلمة لمدرسة ويعيد معرّفها
export async function addTeacherName(schoolId) {
  const name = await modal({ title: "إضافة معلمة", body: `<div class="f"><label for="tn">اسم المعلمة</label><input id="tn" type="text"></div>`,
    actions: [{ label: "إلغاء", value: null }, { label: "إضافة", kind: "primary", value: (b) => b.querySelector("#tn").value.trim() }] });
  if (!name) return null;
  const t = await api.create({ kind: "teacher", title: name, school_id: schoolId, data: {} });
  await refreshPeople();
  return t.id;
}

/* ---------------- مؤشر الحفظ ---------------- */
export function savePill() {
  const el = document.createElement("span"); el.className = "save-pill";
  const set = (s, msg) => {
    el.className = "save-pill " + s;
    el.textContent = { idle: "لا تغييرات", saving: "جارٍ الحفظ…", saved: "تم الحفظ", error: "تعذر الحفظ" + (msg ? ": " + msg : ""), offline: "لا يوجد اتصال — لم يتم الحفظ" }[s] || s;
  };
  set(state.saveState === "saving" ? "saving" : "idle");
  const f = (s, m) => { if (!el.isConnected) { offSaveState(f); return; } set(s, m); };
  onSaveState(f);
  return el;
}

/* ---------------- صفحة السجل: شريط الأدوات + الاعتماد + الحذف + التنقل ---------------- */
export async function recordPage(main, { rec, title, render, beforeApprove, newRec, merge = false }) {
  let listIds = navMemory[rec.kind] || [];
  try { listIds = JSON.parse(sessionStorage.getItem("nav." + rec.kind) || "null") || listIds; } catch (_) {}
  const idx = rec.id ? listIds.indexOf(rec.id) : -1;
  const route = KIND_ROUTE[rec.kind];
  const ed = recordEditor(rec, {
    onCreated: (r) => { history.replaceState(null, "", `#/${route}/${r.id}`); paintBar(); ed.afterCreate?.(r); },
    onSaved: (r, replaced) => { if (["school", "teacher"].includes(r.kind)) refreshPeople(); if (replaced) draw(); else paintBar(); ed.afterSave?.(r); },
    merge, onMerged: (r, stats) => { draw(); ed.afterMerge?.(r, stats); },
  });
  main.innerHTML = `<div class="container">
    <div class="recbar no-print"></div>
    <div class="page-head"><div><h1>${esc(title)}</h1><div class="sub" id="rec-sub"></div></div></div>
    <div id="approved"></div><div id="rec-body"></div></div>`;
  const bar = $(".recbar", main);

  function paintBar() {
    const r = ed.rec;
    const appr = r.status === "approved";
    bar.innerHTML = `
      <a class="btn icon-btn" href="#/" title="الصفحة الرئيسية" aria-label="الصفحة الرئيسية">⌂</a>
      <a class="btn icon-btn" href="#/${route}" title="رجوع إلى القائمة" aria-label="رجوع">→</a>
      <button class="btn icon-btn" id="prev" title="السجل السابق" aria-label="السابق" ${idx > 0 ? "" : "disabled"}>‹</button>
      <button class="btn icon-btn" id="next" title="السجل التالي" aria-label="التالي" ${idx >= 0 && idx < listIds.length - 1 ? "" : "disabled"}>›</button>
      <button class="btn" id="new">+ جديد</button>
      <span class="grow"></span>
      ${PRINTABLE.has(r.kind) ? `<button class="btn" id="print" title="يفتح المعاينة ثم نافذة الطباعة واختيار الطابعة">طباعة / PDF</button><button class="btn" id="preview">معاينة</button><button class="btn" id="word">Word</button>` : ""}
      ${PRINTABLE.has(r.kind) ? (appr ? `<button class="btn" id="unapprove">إلغاء الاعتماد</button>` : `<button class="btn primary" id="approve">اعتماد</button>`) : ""}
      <button class="btn danger" id="trash" ${r.id && !appr ? "" : "disabled"} title="${appr ? "التقرير المعتمد لا يُحذف" : ""}">حذف</button>
      ${BLANKABLE[r.kind] ? `<a class="btn ghost" href="#/print/${BLANKABLE[r.kind](r)}" title="النموذج فارغاً للطباعة أو لإرساله لمعلم آخر">نسخة فارغة</a>` : ""}
      <button class="btn ghost" id="log" ${r.id ? "" : "disabled"}>سجل العمليات</button>`;
    bar.appendChild(savePill());
    $("#prev", bar).onclick = () => go(`#/${route}/${listIds[idx - 1]}`);
    $("#next", bar).onclick = () => go(`#/${route}/${listIds[idx + 1]}`);
    $("#new", bar).onclick = () => go(`#/${route}/new`);
    // سجل جديد لم يُكتب فيه شيء (مثل الخطة الشهرية المعبأة تلقائياً): يُحفظ أولاً ثم يُطبع
    const ensureSaved = async () => { if (!ed.rec.id) ed.change(() => {}); await ed.save(); if (!ed.rec.id) { toast("تعذر حفظ السجل، حاولي مرة أخرى", "error"); return false; } return true; };
    $("#print", bar) && ($("#print", bar).onclick = async () => { if (await ensureSaved()) go(`#/print/${ed.rec.id}?auto=1`); });
    $("#preview", bar) && ($("#preview", bar).onclick = async () => { if (await ensureSaved()) go(`#/print/${ed.rec.id}`); });
    $("#word", bar) && ($("#word", bar).onclick = async () => { if (await ensureSaved()) go(`#/print/${ed.rec.id}?word=1`); });
    $("#approve", bar) && ($("#approve", bar).onclick = approve);
    $("#unapprove", bar) && ($("#unapprove", bar).onclick = unapprove);
    $("#trash", bar).onclick = trash;
    $("#log", bar).onclick = showLog;
    $("#rec-sub", main).textContent = r.id ? `آخر تعديل: ${new Date(r.updated_at).toLocaleString("ar-KW")}` : "سجل جديد — يُحفظ تلقائياً عند أول إدخال";
    $("#approved", main).innerHTML = appr ? `<div class="approved-banner"><b>تقرير معتمد</b><span class="grow">اعتُمد في ${new Date(r.approved_at).toLocaleString("ar-KW")}. النسخة المطبوعة ثابتة ولا تتغير بتعديل بيانات المدرسة أو المعلم.</span></div>` : "";
  }
  async function approve() {
    if (!ed.rec.id) ed.change(() => {});
    await ed.save();
    if (!ed.rec.id) return;
    const missing = beforeApprove ? beforeApprove(ed.rec) : [];
    if (missing.length) { await modal({ title: "حقول إلزامية ناقصة", body: `<p>أكملي قبل الاعتماد:</p><ul>${missing.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` }); return; }
    if (!(await confirmBox("اعتماد التقرير", "بعد الاعتماد تُحفظ نسخة ثابتة من التقرير، ولا يمكن تعديله أو حذفه إلا بإلغاء الاعتماد.", "اعتماد"))) return;
    try {
      const snapshot = await recordContext(ed.rec);
      ed.rec = await api.update(ed.rec.id, { status: "approved", snapshot }, ed.rec.version);
      toast("تم الاعتماد"); draw();
    } catch (e) { toast(e.message, "error"); }
  }
  async function unapprove() {
    if (!(await confirmBox("إلغاء الاعتماد", "سيعود التقرير مسودة قابلة للتعديل، وتُحذف نسخته الثابتة. يُسجَّل ذلك في سجل العمليات.", "إلغاء الاعتماد", true))) return;
    try { ed.rec = await api.update(ed.rec.id, { status: "draft" }, ed.rec.version); toast("أُلغي الاعتماد"); draw(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function trash() {
    if (!(await confirmBox("نقل إلى سلة المحذوفات", "يمكنك استعادته لاحقاً من سلة المحذوفات.", "نقل للمحذوفات", true))) return;
    try { await ed.save(); await api.update(ed.rec.id, { deleted_at: new Date().toISOString() }, ed.rec.version); if (["school", "teacher"].includes(ed.rec.kind)) await refreshPeople(); toast("نُقل إلى سلة المحذوفات"); await ed.afterTrash?.(ed.rec); go(`#/${route}`); }
    catch (e) { toast(e.message, "error"); }
  }
  async function showLog() {
    const rows = await api.audit(ed.rec.id).catch(() => []);
    // الملف المشترك: يظهر اسم من عدّل
    const shared = ed.rec.kind === "shared_achievements";
    const names = new Map(shared ? ((await api.rpc("shared_actor_names", { p_record: ed.rec.id }).catch(() => [])) || []).map((p) => [p.id, p.full_name]) : []);
    if (state.profile) names.set(state.profile.id, names.get(state.profile.id) || state.guide?.data?.full_name || state.profile.full_name);
    modal({ title: "سجل العمليات", wide: shared, body: rows.length ? `<table class="data"><tr><th>العملية</th>${shared ? "<th>بواسطة</th>" : ""}<th>الوقت</th></tr>${rows.map((a) => `<tr><td>${esc(a.action)}</td>${shared ? `<td>${esc(names.get(a.actor_id) || "—")}</td>` : ""}<td>${new Date(a.at).toLocaleString("ar-KW")}</td></tr>`).join("")}</table>` : "<p>لا توجد عمليات مسجلة بعد.</p>" });
  }
  async function draw() {
    paintBar();
    const body = $("#rec-body", main);
    // يحافظ على مكان الكتابة عند إعادة الرسم (مثلاً بعد دمج تعديلات زميلة)
    const a = document.activeElement, keep = a && body.contains(a) && a.dataset?.path ? { path: a.dataset.path, s: a.selectionStart, e: a.selectionEnd } : null;
    const y = window.scrollY;
    body.innerHTML = "";
    await render(body, ed, ed.rec.status === "approved");
    if (keep) { const el = body.querySelector(`[data-path="${CSS.escape(keep.path)}"]`); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(keep.s, keep.e); } catch (_) {} window.scrollTo(0, y); } }
    if (ed.rec.status === "approved") $$("input, select, textarea, .photo-slot, .sigpad", body).forEach((x) => { x.disabled = true; x.setAttribute?.("aria-disabled", "true"); x.style.pointerEvents = "none"; });
  }
  ed.redraw = draw;
  await draw();
  window.__currentEditor = ed;
  return ed;
}

/* ---------------- قائمة سجلات بنوع معين ---------------- */
// ترتيب السجلات للتنقل (السابق/التالي): في الذاكرة دائماً، وفي المتصفح إن سمح بذلك
const navMemory = {};
export function rememberNav(kind, ids) { navMemory[kind] = ids; try { sessionStorage.setItem("nav." + kind, JSON.stringify(ids)); } catch (_) {} }

export function statusPill(r) {
  if (r.status === "approved") return `<span class="pill ok">معتمد</span>`;
  return `<span class="pill">مسودة</span>`;
}

/* ---------------- صور التوثيق (عدد ثابت من الخانات) ---------------- */
export function photoSlots(container, ids = [], count, onChange, { recordId, category = "photo" } = {}) {
  const list = [...ids]; while (list.length < count) list.push(null);
  container.innerHTML = `<div class="photos">${list.map((_, i) => `<label class="photo-slot" data-i="${i}"><span>+ صورة ${i + 1}</span><input type="file" accept="image/*" aria-label="رفع صورة ${i + 1}"></label>`).join("")}</div>`;
  $$(".photo-slot", container).forEach(async (slot) => {
    const i = Number(slot.dataset.i);
    const paint = async () => {
      const id = list[i];
      if (!id) { slot.querySelector("span") && (slot.querySelector("span").hidden = false); slot.querySelector("img")?.remove(); slot.querySelector(".x")?.remove(); return; }
      const u = await fileUrl(id);
      slot.querySelector("span").hidden = true;
      let img = slot.querySelector("img"); if (!img) { img = document.createElement("img"); slot.prepend(img); }
      img.src = u || "";
      if (!slot.querySelector(".x")) {
        const x = document.createElement("button"); x.type = "button"; x.className = "btn small danger x"; x.textContent = "إزالة";
        x.onclick = (e) => { e.preventDefault(); list[i] = null; paint(); onChange([...list]); };
        slot.appendChild(x);
      }
    };
    slot.querySelector("input").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { slot.querySelector("span").textContent = "جارٍ الرفع…"; const up = await api.upload(await shrinkImage(f), { category, record_id: recordId || null, title: f.name });
        list[i] = up.id; await paint(); onChange([...list]); toast("رُفعت الصورة"); }
      catch (err) { toast("تعذر رفع الصورة: " + err.message, "error"); slot.querySelector("span").textContent = "+ صورة " + (i + 1); }
    };
    paint();
  });
}

/* ---------------- لوحة توقيع على الشاشة (للمعلمة أو أي شخص) ---------------- */
export async function signaturePad(title) {
  const body = document.createElement("div");
  body.innerHTML = `<p class="hint">وقّعي بالإصبع أو القلم داخل المربع.</p><canvas class="sigpad" width="840" height="300"></canvas>`;
  const c = body.querySelector("canvas"), g = c.getContext("2d");
  g.lineWidth = 4; g.lineCap = "round"; g.strokeStyle = "#0b1f4d";
  let drawing = false, any = false;
  const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)]; };
  c.addEventListener("pointerdown", (e) => { drawing = true; any = true; c.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(...pos(e)); });
  c.addEventListener("pointermove", (e) => { if (drawing) { g.lineTo(...pos(e)); g.stroke(); } });
  c.addEventListener("pointerup", () => (drawing = false));
  const ok = await modal({ title, body, actions: [{ label: "إلغاء", value: false }, { label: "مسح", value: "clear" }, { label: "حفظ التوقيع", value: true, kind: "primary" }] });
  if (ok === "clear") return signaturePad(title);
  if (!ok || !any) return null;
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  return new File([blob], "signature.png", { type: "image/png" });
}

export { esc, $, $$, today, academicYearOf, fmtDate, dayName, schoolById, teacherById, opts, state, api, toast, modal, confirmBox };
