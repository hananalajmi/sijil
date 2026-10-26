// التقرير الأسبوعي للتوجيه الفني (محضر اجتماع الموجهين الأسبوعي) — ملف مشترك: ملف واحد لكل أسبوع يعدّله الموجهون
// يُحفظ كسجل مشترك (نفس صلاحيات ملف الإنجازات المشترك) ويُميَّز بـ data.doc = "weekly_meeting".
// النص الثابت في النموذج (العنوان، «الفترة»، «تم اجتماع موجهي وموجهات…»، «الحضور»، «الغياب»، «ونوقشت فيه البنود») لا يُعدَّل؛ الباقي يُعبّأ.
import { api } from "../api.js";
import { state, G, opts } from "../store.js";
import { esc, $, $$, today, fmtDate, academicYearOf, weekStart, addDays, toast, modal } from "../ui.js";
import { field, bindFields, recordPage, go } from "../kit.js";
import { FIRST_SUPERVISOR } from "../templates.js";

export const DOC = "weekly_meeting";
const KIND = "shared_achievements";
export const isMeeting = (r) => r?.data?.doc === DOC;
const me = () => state.profile?.id || "";
const keyOf = (ws) => `wm:${ws}:${me()}`; // تقرير لكل مقرر في الأسبوع (لكل مادة/فريق تقريره)
// يعدّل التقرير: المقرر (صاحبه) والأعضاء الذين يختارهم والمشرف
export const canEditMeeting = (r) => !!r && (r.owner_id === me() || state.profile?.role === "admin" || (r.data?.members || []).includes(me()));
export const ABSENCE_REASONS = ["للتكليف", "إجازة", "مهمة رسمية", "دورة تدريبية", "عذر"];
const myName = () => G().full_name || state.profile?.full_name || "";

export function emptyMeeting(ws) {
  return { doc: DOC, month: keyOf(ws), week_start: ws, subject: G().subject || "الكيمياء", period_from: ws, period_to: addDays(ws, 4), meeting_date: addDays(ws, 4),
    attendees: [], absent: [], items: [], reporter: myName(), members: [], first_name: G().first_supervisor || FIRST_SUPERVISOR.name || "" };
}

let colCache = null;
const colleagues = async () => (colCache ||= (await api.rpc("list_colleagues").catch(() => [])) || []);

export default async function (main, { id, params }) {
  if (!id) return list(main);
  let rec;
  if (id === "new") {
    const ws = weekStart(params.week || today());
    const ex = (await api.list({ kind: KIND })).find((r) => isMeeting(r) && r.data.week_start === ws && r.owner_id === me());
    if (ex) { location.replace(`#/meeting/${ex.id}`); return; }
    try { rec = await api.create({ kind: KIND, title: `التقرير الأسبوعي ${fmtDate(ws)}`, record_date: ws, academic_year: academicYearOf(ws), data: emptyMeeting(ws) }); }
    catch (e) { const again = (await api.list({ kind: KIND })).find((r) => isMeeting(r) && r.data.week_start === ws && r.owner_id === me()); if (!again) throw e; rec = again; }
    history.replaceState(null, "", `#/meeting/${rec.id}`);
  } else rec = await api.get(id);
  if (!rec) { main.innerHTML = `<div class="container"><div class="empty">السجل غير موجود</div></div>`; return; }
  const cols = await colleagues();
  await recordPage(main, { rec, title: "التقرير الأسبوعي للتوجيه الفني (ملف مشترك)", merge: true, backHref: "#/meeting", render(body, ed) {
    // أسماء الحضور والغياب: المقرر + الأعضاء الذين اختارهم + أسماء أُضيفت يدوياً لهذا التقرير
    const names = [...new Set([ed.rec.data.reporter, ...(ed.rec.data.member_names || []), ...(ed.rec.data.extra_names || [])].map((x) => String(x || "").trim()).filter(Boolean))];
    const d = ed.rec.data, canEdit = canEditMeeting(ed.rec), isOwner = ed.rec.owner_id === me() || state.profile?.role === "admin";
    const nameSel = (idAttr, value, label) => `<select ${idAttr} aria-label="${esc(label)}"><option value="">— اختاري —</option>${[...new Set([...names, ...(value ? [value] : [])])].map((n) => `<option ${n === value ? "selected" : ""}>${esc(n)}</option>`).join("")}<option value="__add">+ إضافة اسم للقائمة…</option></select>`;
    const chips = (arr, k) => (arr || []).map((n, i) => `<span class="pill" style="display:inline-flex;gap:6px;align-items:center;margin:3px">${esc(n)} <button type="button" class="btn small ghost" data-del-${k}="${i}" aria-label="حذف ${esc(n)}" style="padding:0 6px">×</button></span>`).join("");
    body.innerHTML = `
      ${canEdit ? "" : `<div class="panel" style="border-color:#e0b54a;background:#fff8e1"><b>للاطلاع فقط.</b> يعدّل هذا التقرير مقرره (${esc(d.reporter || "")}) والأعضاء الذين يختارهم.</div>`}
      ${isOwner ? `<section class="panel"><h2>أعضاء التقرير (يشاركون في الكتابة)</h2><p class="hint" style="margin-top:0">أنتِ المقرر: اختاري من يشارك في كتابة هذا التقرير. المختارون يظهرون في قائمتي الحضور والغياب، والباقون يطّلعون على التقرير ويطبعونه فقط.</p>
        <div class="checks" id="mt-members">${cols.length ? cols.map((c) => `<label><input type="checkbox" value="${esc(c.id)}" ${(d.members || []).includes(c.id) ? "checked" : ""}> ${esc(c.full_name || "")}</label>`).join("") : '<span class="hint">لا يوجد موجهون آخرون مفعّلون بعد.</span>'}</div></section>` : ""}
      <section class="panel"><h2>بيانات التقرير</h2><div class="form">
        ${field({ label: "المادة (تظهر بالأحمر في العنوان)", key: "subject", value: d.subject })}
        ${field({ label: "الفترة: من", key: "period_from", type: "date", value: d.period_from })}
        ${field({ label: "إلى", key: "period_to", type: "date", value: d.period_to })}
        ${field({ label: "تاريخ الاجتماع", key: "meeting_date", type: "date", value: d.meeting_date, hint: "يُكتب اليوم تلقائياً (مثل: يوم الخميس الموافق …)" })}</div></section>
      <section class="panel"><h2>الحضور</h2><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">${nameSel('id="mt-att"', "", "إضافة حاضر")}<button class="btn small" type="button" id="mt-att-all">كل الأعضاء</button></div>
        <div id="mt-att-list" style="margin-top:8px">${chips(d.attendees, "att") || '<span class="hint">لم يُضف أحد بعد.</span>'}</div></section>
      <section class="panel"><h2>الغياب</h2><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">${nameSel('id="mt-abs"', "", "إضافة غائب")}
          <select id="mt-reason" aria-label="سبب الغياب">${ABSENCE_REASONS.map((r) => `<option>${esc(r)}</option>`).join("")}</select><button class="btn small" type="button" id="mt-abs-add">إضافة</button></div>
        <div id="mt-abs-list" style="margin-top:8px">${(d.absent || []).map((a, i) => `<span class="pill" style="display:inline-flex;gap:6px;align-items:center;margin:3px">${esc(a.name)} (${esc(a.reason || "")}) <button type="button" class="btn small ghost" data-del-abs="${i}" aria-label="حذف ${esc(a.name)}" style="padding:0 6px">×</button></span>`).join("") || '<span class="hint">لا يوجد غياب.</span>'}</div></section>
      <section class="panel"><h2>البنود التي نوقشت</h2>
        <div class="f"><label for="mt-items">كل بند في سطر (تُرقّم تلقائياً)</label><textarea id="mt-items" rows="9">${esc((d.items || []).join("\n"))}</textarea></div></section>
      <section class="panel"><h2>التوقيع</h2><div class="form">
        <div class="f"><label for="mt-rep">مقرر التقرير الأسبوعي (الموجه المسؤول عن التسليم)</label>${nameSel('id="mt-rep"', d.reporter, "مقرر التقرير")}</div>
        ${field({ label: "الموجه الفني الأول للعلوم", key: "first_name", value: d.first_name })}</div>
        <h3 style="margin:14px 0 6px">توقيع المقرر وختمه</h3>
        <div class="row" style="gap:12px;align-items:center;flex-wrap:wrap">
          <div class="mt-mk">${d.rep_stamp ? `<img src="${d.rep_stamp}" alt="ختم المقرر" style="max-height:60px;max-width:110px">` : '<span class="hint">لا يوجد ختم</span>'}</div>
          <div class="mt-mk">${d.rep_sig ? `<img src="${d.rep_sig}" alt="توقيع المقرر" style="max-height:50px;max-width:140px">` : '<span class="hint">لا يوجد توقيع</span>'}</div></div>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">
          <button class="btn small primary" type="button" id="mt-mine">استخدام توقيعي وختمي</button>
          <label class="btn small">رفع ختم<input type="file" accept="image/*" data-mt-up="rep_stamp" hidden></label>
          <label class="btn small">رفع توقيع<input type="file" accept="image/*" data-mt-up="rep_sig" hidden></label>
          <button class="btn small" type="button" id="mt-draw">✍️ يوقّع باليد</button>
          <button class="btn small ghost" type="button" id="mt-mkdel">حذف التوقيع والختم</button></div>
        <p class="hint">يظهران تحت اسم المقرر في الحاشية. «استخدام توقيعي وختمي» يأخذ صورتيك من البيانات الرئيسية ويكتب اسمك مقرراً.</p></section>`;
    $$("#mt-members input", body).forEach((c) => (c.onchange = () => { const ids = $$("#mt-members input:checked", body).map((x) => x.value);
      ed.change((x) => { x.data.members = ids; x.data.member_names = cols.filter((c2) => ids.includes(c2.id)).map((c2) => c2.full_name); }); toast(ids.length ? `الأعضاء: ${ids.length}` : "لا أعضاء — أنتِ فقط تكتبين"); ed.redraw(); }));
    if (!canEdit) { $$("input, select, textarea, button", body).forEach((x) => (x.disabled = true)); return; }
    bindFields(body, (k, v) => ed.change((x) => { x.data[k] = v; if (k === "period_from") { x.title = `التقرير الأسبوعي ${fmtDate(v)}`; } }));
    const addName = async () => { const v = await modal({ title: "إضافة اسم موجه", body: `<div class="f"><input id="mt-nn" type="text" aria-label="الاسم"></div>`, actions: [{ label: "إلغاء", value: null }, { label: "إضافة", kind: "primary", value: (b) => b.querySelector("#mt-nn").value.trim() }] });
      if (!v) return null; if (!names.includes(v)) { names.push(v); ed.change((x) => { x.data.extra_names = [...new Set([...(x.data.extra_names || []), v])]; }); } return v; };
    const pick = async (sel) => { let v = sel.value; if (v === "__add") v = await addName(); sel.value = ""; return v || ""; };
    $("#mt-att", body).onchange = async (e) => { const v = await pick(e.target); if (!v) return; ed.change((x) => { x.data.attendees = [...new Set([...(x.data.attendees || []), v])]; }); ed.redraw(); };
    $("#mt-att-all", body).onclick = () => { const abs = new Set((ed.rec.data.absent || []).map((a) => a.name)); ed.change((x) => { x.data.attendees = [...new Set([...(x.data.attendees || []), ...names.filter((n) => !abs.has(n))])]; }); ed.redraw(); };
    $("#mt-abs-add", body).onclick = async () => { const sel = $("#mt-abs", body); const v = sel.value === "__add" ? await addName() : sel.value; if (!v) return toast("اختاري الاسم أولاً");
      const reason = $("#mt-reason", body).value; ed.change((x) => { x.data.absent = [...(x.data.absent || []).filter((a) => a.name !== v), { name: v, reason }]; x.data.attendees = (x.data.attendees || []).filter((n) => n !== v); }); ed.redraw(); };
    $("#mt-abs", body).onchange = async (e) => { if (e.target.value === "__add") { const v = await addName(); e.target.value = ""; if (v) { e.target.add(new Option(v, v), e.target.options[e.target.options.length - 1]); e.target.value = v; } } };
    $$("[data-del-att]", body).forEach((b) => (b.onclick = () => { const i = Number(b.dataset.delAtt); ed.change((x) => { x.data.attendees = (x.data.attendees || []).filter((_, j) => j !== i); }); ed.redraw(); }));
    $$("[data-del-abs]", body).forEach((b) => (b.onclick = () => { const i = Number(b.dataset.delAbs); ed.change((x) => { x.data.absent = (x.data.absent || []).filter((_, j) => j !== i); }); ed.redraw(); }));
    $("#mt-items", body).addEventListener("input", (e) => ed.change((x) => { x.data.items = e.target.value.split("\n").map((s) => s.replace(/^\s*\d+\s*[-–.)]\s*/, "").trim()).filter(Boolean); }));
    // توقيع المقرر وختمه: يُحفظان داخل الملف المشترك (يراهما الجميع عند الطباعة)
    const toData = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onerror = rej;
      im.onload = () => { const k = Math.min(1, 700 / Math.max(im.width, im.height)), cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL("image/png")); };
      im.src = fr.result; }; fr.onerror = rej; fr.readAsDataURL(blob); });
    const setMk = (patch) => { ed.change((x) => Object.assign(x.data, patch)); ed.redraw(); };
    $("#mt-mine", body).onclick = async () => { const g = G(); if (!g.signature && !g.stamp) return toast("ارفعي توقيعك وختمك أولاً من البيانات الرئيسية", "error");
      try { const { fileUrl } = await import("../store.js"); const { trimImage } = await import("../report/builders.js");
        const one = async (id) => { if (!id) return ""; const u = await fileUrl(id); if (!u) return ""; const t = await trimImage(u); return await toData(await (await fetch(t)).blob()); };
        setMk({ rep_sig: await one(g.signature), rep_stamp: await one(g.stamp), reporter: myName() }); toast("أُضيف توقيعك وختمك"); }
      catch (err) { toast("تعذّر إضافة التوقيع: " + (err.message || ""), "error"); } };
    $$("[data-mt-up]", body).forEach((inp) => (inp.onchange = async () => { const k = inp.dataset.mtUp, f = inp.files[0]; inp.value = ""; if (!f) return;
      try { const { inkEditor } = await import("../inkclean.js"); const fc = await inkEditor(f, { modal, toast, title: k === "rep_stamp" ? "تنقية صورة الختم" : "تنقية صورة التوقيع" }); if (!fc) return; setMk({ [k]: await toData(fc) }); }
      catch (err) { toast(err.message || "تعذّر قراءة الصورة", "error"); } }));
    $("#mt-draw", body).onclick = async () => { const { drawSignature } = await import("../sigpad.js"); const f = await drawSignature({ modal, toast, title: "توقيع مقرر التقرير" }); if (f) setMk({ rep_sig: await toData(f) }); };
    $("#mt-mkdel", body).onclick = () => setMk({ rep_sig: "", rep_stamp: "" });
    $("#mt-rep", body).onchange = async (e) => { let v = e.target.value; if (v === "__add") { v = await addName(); if (v) { e.target.add(new Option(v, v), e.target.options[e.target.options.length - 1]); e.target.value = v; } else { e.target.value = ed.rec.data.reporter || ""; return; } }
      ed.change((x) => { x.data.reporter = v; }); };
  } });
}

async function list(main) {
  const rows = (await api.list({ kind: KIND })).filter(isMeeting).sort((a, b) => (b.data.week_start || "").localeCompare(a.data.week_start || ""));
  const cur = weekStart(today());
  main.innerHTML = `<div class="container"><div class="page-head"><div><h1>التقرير الأسبوعي للتوجيه الفني</h1>
      <div class="sub">ملف مشترك: من ينشئ تقرير الأسبوع يصير مقرره ويختار أعضاءه الذين يشاركون في كتابته، والباقون يطّلعون ويطبعون.</div></div>
      <div class="row"><input type="date" id="mt-wk" value="${cur}" aria-label="الأسبوع"><a class="btn primary" id="mt-new" href="#/meeting/new?week=${cur}">+ تقرير الأسبوع</a></div></div>
    ${rows.length ? `<div class="tbl-wrap"><table class="data"><thead><tr><th>الفترة</th><th>المادة</th><th>تاريخ الاجتماع</th><th>المقرر</th><th>البنود</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="click" data-id="${r.id}" tabindex="0"><td>${esc(fmtDate(r.data.period_from))} — ${esc(fmtDate(r.data.period_to))}</td><td>${esc(r.data.subject || "")}</td><td>${esc(fmtDate(r.data.meeting_date))}</td><td>${esc(r.data.reporter || "")}</td><td>${(r.data.items || []).length}</td><td>${r.owner_id === me() ? '<span class="pill ok">مقرره أنتِ</span>' : canEditMeeting(r) ? '<span class="pill">عضو</span>' : '<span class="pill">اطلاع</span>'}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty"><h2>لا توجد تقارير بعد</h2><p>اضغطي «+ تقرير الأسبوع» لإنشاء تقرير هذا الأسبوع.</p></div>`}</div>`;
  $("#mt-wk", main).onchange = (e) => { $("#mt-new", main).href = `#/meeting/new?week=${weekStart(e.target.value || today())}`; };
  $$("tr.click", main).forEach((tr) => { tr.onclick = () => go(`#/meeting/${tr.dataset.id}`); tr.onkeydown = (e) => e.key === "Enter" && tr.onclick(); });
}
