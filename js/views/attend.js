// كشف المكلفين بالحضور (كتاب + كشف أسماء) — ملف مشترك لموجهي التخصص نفسه فقط
//   • الكتاب: سجل attend_list (data.role = "list") يعدّله منشئه: المرسل إليه والموضوع (قوائم منسدلة يضيفها المشرف)، التاريخ، المكان.
//   • كل موجّه يضيف معلميه من مدارسه في سجله الخاص (data.role = "rows")، والكشف المطبوع يجمع الكل.
//   • الرقم المدني والمسمى يُكتبان يدوياً أول مرة ويُحفظان مع المعلم في «المدارس والمعلمات» للمرات القادمة.
import { api } from "../api.js";
import { state, G, opts, schoolById, teacherById, refreshPeople } from "../store.js";
import { esc, $, $$, today, fmtDate, academicYearOf, yearLabel, toast, modal, debounce, KEEP } from "../ui.js";
import { field, bindFields, recordPage, go, schoolOptions } from "../kit.js";
import { attendAllowed } from "../nav.js";
import { FIRST_SUPERVISOR } from "../templates.js";

export const KIND = "attend_list";
const me = () => state.profile?.id || "";
const isList = (r) => r?.data?.role === "list";
const isRows = (r) => r?.data?.role === "rows";
const myName = () => G().full_name || state.profile?.full_name || "";
// نص الكتاب الافتراضي (يُعدَّل من صفحة الكشف)
export const attendBody = (region, topic) => `بالإشارة للموضوع أعلاه ، وبناء على مصلحة العمل يسر التوجيه الفني للعلوم بمنطقة ${String(region || "الأحمدي").replace(/^منطقة\s*/, "").replace(/\s*التعليمية$/, "")} التعليمية ${String(topic || "").trim()}`;
export const ATTEND_REQUEST = "يرجى الايعاز لجهة الاختصاص لتسهيل اعفاء المكلفين بالحضور .";
export const civilOk = (v) => /^\d{12}$/.test(String(v || "").trim());
const digits = (v) => String(v || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, "").slice(0, 12);
const rid = () => Math.random().toString(36).slice(2, 10);

// كل أسماء الكشف من كل الموجهين (بترتيب إضافة الموجهين)
export async function attendRows(listId) {
  const recs = (await api.list({ kind: KIND, order: "created_at.asc" })).filter((r) => isRows(r) && r.data.list_id === listId);
  return recs.flatMap((r) => (r.data.rows || []).map((x) => ({ ...x, guide: r.data.guide_name || "", owner: r.owner_id })));
}

const notAllowed = (main) => { main.innerHTML = `<div class="container"><div class="empty"><h2>كشف المكلفين بالحضور</h2>
  <p>هذه الصفحة لموجهي: ${esc(opts("attend_subjects").join("، "))}.</p><p>إذا كان هذا تخصصك، اختره من <a href="#/guide">البيانات الرئيسية ← التخصص</a>.</p></div></div>`; };

export default async function (main, { id }) {
  if (!attendAllowed()) return notAllowed(main);
  if (!id) return list(main);
  let rec;
  if (id === "new") {
    const d = today();
    rec = await api.create({ kind: KIND, title: "كشف المكلفين بالحضور", record_date: d, academic_year: academicYearOf(d),
      data: { role: "list", subject: String(G().subject || "").trim(), region: G().region || "الأحمدي", to: opts("attend_recipients")[0] || "", topic: opts("attend_topics")[0] || "",
        topic_extra: `للعام الدراسي ${yearLabel(academicYearOf(d)).replace("-", "- ")}`, date: d, place: "", body: attendBody(G().region, opts("attend_topics")[0]), request: ATTEND_REQUEST, first_name: G().first_supervisor || FIRST_SUPERVISOR.name || "", creator: myName() } });
    history.replaceState(null, "", `#/attend/${rec.id}`);
  } else rec = await api.get(id);
  if (!rec || !isList(rec)) { main.innerHTML = `<div class="container"><div class="empty">الكشف غير موجود</div></div>`; return; }

  // سجل أسمائي في هذا الكشف (يُنشأ عند أول إضافة)
  let mine = (await api.list({ kind: KIND })).find((r) => isRows(r) && r.data.list_id === rec.id && r.owner_id === me()) || null;
  let saving = Promise.resolve();
  const saveMine = (rows) => (saving = saving.then(async () => {
    try {
      if (!mine) mine = await api.create({ kind: KIND, title: "أسماء " + myName(), academic_year: rec.academic_year, data: { role: "rows", subject: rec.data.subject, list_id: rec.id, guide_name: myName(), rows } });
      else mine = await api.update(mine.id, { data: { ...mine.data, rows, guide_name: myName() } }, mine.version);
    } catch (e) {
      if (e.status === 409 && mine) { mine = await api.get(mine.id); mine = await api.update(mine.id, { data: { ...mine.data, rows } }, mine.version); }
      else { toast("تعذّر الحفظ: " + (e.message || ""), "error"); throw e; }
    }
  }));
  // يحفظ الرقم المدني والمسمى مع المعلم (في بياناتي) للمرات القادمة
  const rememberTeacher = async (tid, civil, job) => {
    const t = teacherById(tid); if (!t) return;
    if ((t.data?.civil_id || "") === civil && (t.data?.job || "") === job) return;
    try { await api.update(t.id, { data: { ...(t.data || {}), civil_id: civil, job } }, t.version); await refreshPeople(); } catch (_) { /* غير مهم: يُكتب مرة أخرى لاحقاً */ }
  };

  await recordPage(main, { rec, title: "كشف المكلفين بالحضور (ملف مشترك)", merge: true, backHref: "#/attend", newHref: "#/attend/new", async render(body, ed) {
    const d = ed.rec.data, isOwner = ed.rec.owner_id === me();
    const all = await attendRows(ed.rec.id);
    const myRows = () => mine?.data?.rows || [];
    const jobs = opts("teacher_titles");
    const jobSel = (v, attr) => `<select ${attr} aria-label="المسمى الوظيفي"><option value="">—</option>${[...new Set([...jobs, ...(v ? [v] : [])])].map((j) => `<option ${j === v ? "selected" : ""}>${esc(j)}</option>`).join("")}</select>`;
    body.innerHTML = `
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <button class="btn primary" type="button" id="at-preview">معاينة وطباعة / PDF</button><button class="btn" type="button" id="at-word">تصدير Word</button>
        <span class="hint" style="align-self:center">الكشف يجمع أسماء كل الموجهين (${all.length} اسم).</span></div>
      <section class="panel"><h2>بيانات الكتاب</h2>
        ${isOwner ? "" : `<p class="hint" style="margin-top:0">يعدّل بيانات الكتاب منشئه (${esc(d.creator || "")}). أنت تضيف معلميك بالأسفل.</p>`}
        <div class="form" id="at-head">
          ${field({ label: "المرسل إليه", key: "to", type: "select", value: d.to, remember: "attend_recipients", wide: true })}
          ${field({ label: "الموضوع", key: "topic", type: "select", value: d.topic, remember: "attend_topics", wide: true })}
          ${field({ label: "تكملة الموضوع (الصف والعام الدراسي)", key: "topic_extra", value: d.topic_extra, wide: true, hint: "مثال: للصف العاشر للعام الدراسي 2026 - 2027" })}
          ${field({ label: "نص الكتاب", key: "body", type: "textarea", rows: 3, value: d.body ?? attendBody(d.region, d.topic), wide: true })}
          ${field({ label: "سطر الطلب", key: "request", value: d.request ?? ATTEND_REQUEST, wide: true })}
          ${field({ label: "التاريخ", key: "date", type: "date", value: d.date, hint: "اليوم يُكتب تلقائياً" })}
          ${field({ label: "المكان", key: "place", value: d.place, placeholder: "مثال: ثانوية …" })}
          ${field({ label: "الموجه الفني الأول للعلوم", key: "first_name", value: d.first_name })}
        </div></section>
      <section class="panel"><h2>معلميّ في الكشف (${myRows().length})</h2>
        <p class="hint" style="margin-top:0">اختر المدرسة، ثم حدّد المعلمين واضغط «إضافة المختارين». الرقم المدني 12 رقماً يُكتب يدوياً، ويُحفظ مع المعلم للمرات القادمة. كل الخانات قابلة للتعديل بعد الإضافة.</p>
        <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><select id="at-school" aria-label="المدرسة">${schoolOptions("")}</select><button class="btn small" type="button" id="at-manual">+ اسم يدوياً</button></div>
        <div id="at-tlist" style="margin-top:8px"></div>
        <div class="tbl-wrap" style="margin-top:10px">${myRows().length ? `<table class="data"><thead><tr><th>#</th><th>الاسم</th><th>الرقم المدني</th><th>المسمى الوظيفي</th><th>جهة العمل</th><th>ملاحظات</th><th></th></tr></thead><tbody>
          ${myRows().map((r, i) => `<tr data-r="${esc(r.id)}"><td>${i + 1}</td><td><input data-f="name" value="${esc(r.name || "")}" aria-label="الاسم" style="width:12em"></td>
            <td><input class="at-civil ${civilOk(r.civil) ? "" : "bad"}" data-f="civil" value="${esc(r.civil || "")}" inputmode="numeric" dir="ltr" maxlength="12" aria-label="الرقم المدني" style="width:9.5em"></td>
            <td>${jobSel(r.job || "", 'data-f="job"')}</td><td><input data-f="school" value="${esc(r.school || "")}" aria-label="جهة العمل" style="width:10em"></td>
            <td><input data-f="note" value="${esc(r.note || "")}" aria-label="ملاحظات" style="width:8em"></td>
            <td><button class="btn small ghost" type="button" data-del style="color:var(--bad)">حذف</button></td></tr>`).join("")}</tbody></table>` : '<p class="hint">لم تضف أحداً بعد.</p>'}</div></section>
      <section class="panel"><h2>الكشف كامل (${all.length})</h2>
        ${all.length ? `<div class="tbl-wrap"><table class="data"><thead><tr><th>م</th><th>الاسم</th><th>الرقم المدني</th><th>المسمى الوظيفي</th><th>جهة العمل</th><th>أضافه</th></tr></thead><tbody>
          ${all.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td dir="ltr" style="text-align:right">${esc(r.civil || "")}${civilOk(r.civil) ? "" : ' <span class="pill bad">ناقص</span>'}</td><td>${esc(r.job || "")}</td><td>${esc(r.school || "")}</td><td>${esc(r.guide)}</td></tr>`).join("")}</tbody></table></div>`
          : '<p class="hint">لا توجد أسماء بعد.</p>'}</section>`;

    $("#at-manual", body).onclick = async () => { await saveMine([...rowsFromTable(), { id: rid(), name: "", civil: "", job: jobs[0] || "", school: "", note: "" }]); ed.redraw(); };
    $("#at-preview", body).onclick = () => ed.openPrint("");
    $("#at-word", body).onclick = () => ed.openPrint("?word=1");
    if (isOwner) bindFields($("#at-head", body), (k, v) => ed.change((x) => { const oldAuto = attendBody(x.data.region, x.data.topic); x.data[k] = v;
      if (k === "topic" && (!x.data.body || x.data.body === oldAuto)) { x.data.body = attendBody(x.data.region, v); const ta = $("textarea[data-key=body]", body); if (ta) ta.value = x.data.body; }
      if (k === "date") { x.record_date = v || null; } }));
    else $$("#at-head input, #at-head select", body).forEach((x) => (x.disabled = true));

    // اختيار المدرسة ← معلموها
    const added = new Set(myRows().map((r) => r.teacher_id).filter(Boolean));
    $("#at-school", body).onchange = (e) => {
      const sid = e.target.value, box = $("#at-tlist", body);
      if (!sid) { box.innerHTML = ""; return; }
      const ts = state.teachers.filter((t) => t.school_id === sid);
      box.innerHTML = ts.length ? `<div class="checks">${ts.map((t) => `<label><input type="checkbox" value="${t.id}" ${added.has(t.id) ? "disabled" : ""}> ${esc(t.title)}${added.has(t.id) ? ' <span class="hint">(مضاف)</span>' : ""}</label>`).join("")}</div>
          <div class="row" style="gap:8px;margin-top:8px"><button class="btn small" type="button" id="at-allt">تحديد الكل</button><button class="btn primary small" type="button" id="at-add">إضافة المختارين</button></div>`
        : `<p class="hint">لا يوجد معلمون مسجلون لهذه المدرسة. أضفهم من <a href="#/schools/${sid}">المدارس والمعلمات</a>.</p>`;
      const allBtn = $("#at-allt", box); if (allBtn) allBtn.onclick = () => $$("input[type=checkbox]:not(:disabled)", box).forEach((c) => (c.checked = true));
      const addBtn = $("#at-add", box); if (addBtn) addBtn.onclick = () => addTeachers(sid, $$("input:checked", box).map((c) => c.value));
    };

    async function addTeachers(sid, ids) {
      if (!ids.length) return toast("حدّد معلماً واحداً على الأقل");
      const school = schoolById(sid)?.title || "";
      const ts = ids.map((tid) => teacherById(tid)).filter(Boolean);
      const box = document.createElement("div");
      box.innerHTML = `<p class="hint" style="margin-top:0">${esc(school)} — اكتب الرقم المدني (12 رقماً) والمسمى لكل معلم.</p>
        <div class="tbl-wrap"><table class="data"><thead><tr><th>الاسم</th><th>الرقم المدني</th><th>المسمى</th></tr></thead><tbody>
        ${ts.map((t) => `<tr data-t="${t.id}"><td>${esc(t.title)}</td><td><input class="at-civil" data-c inputmode="numeric" dir="ltr" maxlength="12" value="${esc(t.data?.civil_id || "")}" aria-label="الرقم المدني ${esc(t.title)}" style="width:9.5em"></td>
          <td>${jobSel(t.data?.job || jobs[0] || "", "data-j")}</td></tr>`).join("")}</tbody></table></div><p class="hint" id="at-err" style="color:var(--bad)"></p>`;
      $$("[data-c]", box).forEach((i) => (i.oninput = () => { i.value = digits(i.value); i.classList.toggle("bad", !civilOk(i.value)); }));
      const read = (b) => { const out = $$("tr[data-t]", b).map((tr) => ({ tid: tr.dataset.t, civil: digits($("[data-c]", tr).value), job: $("[data-j]", tr).value }));
        const bad = out.filter((o) => !civilOk(o.civil)); if (bad.length) { $("#at-err", b).textContent = `الرقم المدني يجب أن يكون 12 رقماً (${bad.length} ناقص). صحّحه أو اضغط «إضافة رغم ذلك».`; } return out; };
      const v = await modal({ title: "إضافة إلى الكشف", body: box, actions: [{ label: "إلغاء", value: null }, { label: "إضافة رغم ذلك", value: (b) => ({ force: true, rows: read(b) }) },
        { label: "إضافة", kind: "primary", value: (b) => { const rows = read(b); return rows.every((o) => civilOk(o.civil)) ? { rows } : KEEP; } }] });
      if (!v) return;
      const rows = [...myRows()];
      for (const o of v.rows) { const t = teacherById(o.tid); if (!t || rows.some((r) => r.teacher_id === o.tid)) continue;
        rows.push({ id: rid(), teacher_id: o.tid, name: t.title, civil: o.civil, job: o.job, school, note: "" }); }
      await saveMine(rows);
      await Promise.all(v.rows.map((o) => rememberTeacher(o.tid, o.civil, o.job)));
      toast(`أُضيف ${v.rows.length} إلى الكشف`); ed.redraw();
    }

    // تعديل وحذف أسمائي
    const persist = debounce(() => saveMine(rowsFromTable()), 700);
    const rowsFromTable = () => myRows().map((r) => { const tr = body.querySelector(`tr[data-r="${CSS.escape(r.id)}"]`); if (!tr) return r;
      return { ...r, name: $("[data-f=name]", tr).value.trim(), civil: digits($("[data-f=civil]", tr).value), job: $("[data-f=job]", tr).value, school: $("[data-f=school]", tr).value.trim(), note: $("[data-f=note]", tr).value.trim() }; });
    $$("tr[data-r]", body).forEach((tr) => {
      const r = myRows().find((x) => x.id === tr.dataset.r);
      $$("[data-f]", tr).forEach((inp) => inp.addEventListener(inp.tagName === "SELECT" ? "change" : "input", () => {
        if (inp.dataset.f === "civil") { inp.value = digits(inp.value); inp.classList.toggle("bad", !civilOk(inp.value)); }
        persist();
      }));
      // عند الانتهاء من الخانة: يُحفظ الرقم المدني والمسمى مع المعلم للمرات القادمة
      $$("[data-f=civil], [data-f=job]", tr).forEach((inp) => inp.addEventListener("change", () => { const row = rowsFromTable().find((x) => x.id === r?.id);
        if (r?.teacher_id && row && civilOk(row.civil)) rememberTeacher(r.teacher_id, row.civil, row.job); }));
      $("[data-del]", tr).onclick = async () => { persist.cancel(); await saveMine(rowsFromTable().filter((x) => x.id !== tr.dataset.r)); ed.redraw(); };
    });
  } });
}

async function list(main) {
  const recs = await api.list({ kind: KIND });
  const lists = recs.filter(isList).sort((a, b) => (b.data.date || "").localeCompare(a.data.date || ""));
  const count = (id) => recs.filter((r) => isRows(r) && r.data.list_id === id).reduce((n, r) => n + (r.data.rows || []).length, 0);
  main.innerHTML = `<div class="container"><div class="page-head"><div><h1>كشف المكلفين بالحضور</h1>
      <div class="sub">ملف مشترك لموجهي ${esc(String(G().subject || ""))}: منشئ الكشف يكتب بيانات الكتاب، وكل موجّه يضيف معلميه من مدارسه.</div></div>
      <div class="row"><a class="btn primary" href="#/attend/new">+ كشف جديد</a></div></div>
    ${lists.length ? `<div class="tbl-wrap"><table class="data"><thead><tr><th>التاريخ</th><th>الموضوع</th><th>المكان</th><th>عدد الأسماء</th><th>أنشأه</th></tr></thead><tbody>
      ${lists.map((r) => `<tr class="click" data-id="${r.id}" tabindex="0"><td>${esc(fmtDate(r.data.date))}</td><td>${esc(r.data.topic || "")}</td><td>${esc(r.data.place || "")}</td><td>${count(r.id)}</td><td>${r.owner_id === me() ? '<span class="pill ok">أنت</span>' : esc(r.data.creator || "")}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty"><h2>لا توجد كشوف بعد</h2><p>اضغط «+ كشف جديد» لإنشاء كتاب وكشف أسماء، ثم يضيف كل موجّه معلميه.</p></div>`}</div>`;
  $$("tr.click", main).forEach((tr) => { tr.onclick = () => go(`#/attend/${tr.dataset.id}`); tr.onkeydown = (e) => e.key === "Enter" && tr.onclick(); });
}
