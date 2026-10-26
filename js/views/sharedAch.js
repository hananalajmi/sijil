// الإنجازات الشهرية المشتركة — «إنجازات التوجيه الفني للعلوم» (ملف واحد لكل شهر يعدّله كل الموجهين)
// كل بند وكل صف قابل للتعديل من أي موجه؛ تُدمج التعديلات المتزامنة تلقائياً، ويُسجَّل من عدّل في سجل العمليات.
import { api } from "../api.js";
import { state, G, fileUrl, canFillShared, inSection, canFillSection, isSectionSup } from "../store.js";
import { sectionMembersModal } from "./sections.js";
import { esc, $, $$, today, fmtDate, academicYearOf, MONTHS_AR, toast, modal, shrinkImage, confirmBox } from "../ui.js";
import { recordPage, go } from "../kit.js";
import { SHARED_ACH, FIRST_SUPERVISOR } from "../templates.js";
import { monthlyAuto } from "../report/context.js";

const KIND = "shared_achievements";
const mLabel = (m) => { const [y, n] = (m || "").split("-"); return n ? `${MONTHS_AR[Number(n) - 1]} ${y}` : ""; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())).slice(0, 13);
const myName = () => G().full_name || state.profile?.full_name || "";
const BULLET_KEYS = SHARED_ACH.sections.flatMap((s) => s.parts.filter((p) => p.type === "bullets").map((p) => p.key));
const TABLE_PARTS = SHARED_ACH.sections.flatMap((s) => s.parts.filter((p) => p.type === "table"));

// نص الملف الأصلي بمعرّفات جديدة (البنود أ، ب، ج، د فارغة)
const seedFor = (key) => (SHARED_ACH.seed[key] || []).map((x) => ({ id: uid(), ...structuredClone(x), ...(TABLE_PARTS.find((p) => p.key === key)?.photos ? { photos: [] } : {}) }));
export function emptySharedData(month) {
  const d = { template: SHARED_ACH.version, month, stage: SHARED_ACH.stage, observer_name: G().first_supervisor || FIRST_SUPERVISOR.name, photo_size: "m" };
  BULLET_KEYS.forEach((k) => (d[k] = seedFor(k)));
  TABLE_PARTS.forEach((p) => (d[p.key] = seedFor(p.key)));
  return d;
}

export default async function (main, { id, params }) {
  if (!id) return list(main);
  let rec;
  if (id === "new") {
    const month = params.month || today().slice(0, 7);
    const secs = await api.sections().catch(() => []);
    const sec = params.section ? secs.find((x) => x.id === params.section) : null;
    if (params.section && !sec) { main.innerHTML = `<div class="container"><div class="empty">القسم غير موجود</div></div>`; return; }
    const ex = (await api.list({ kind: KIND })).find((r) => r.data?.month === month && (r.section_id || null) === (sec?.id || null));
    if (ex) { location.replace(`#/monthly-ach/${ex.id}`); return; }
    if (sec ? !canFillSection(sec) : !canFillShared()) { main.innerHTML = `<div class="container"><div class="empty"><h2>لا يوجد ملف لهذا الشهر بعد</h2><p>إنشاء ملف الإنجازات المشترك وتعبئته لمن يحددهم المشرف فقط.</p><p><a href="#/monthly-ach">العودة للقائمة</a></p></div></div>`; return; }
    try {
      const data = emptySharedData(month); if (sec) { data.section_name = sec.name; if (sec.stage) data.stage = sec.stage; }
      rec = await api.create({ kind: KIND, title: `إنجازات ${mLabel(month)}${sec ? " — " + sec.name : ""}`, record_date: month + "-01", academic_year: academicYearOf(month + "-01"), data, ...(sec ? { section_id: sec.id } : {}) });
    } catch (e) { // أنشأته زميلة في اللحظة نفسها
      const again = (await api.list({ kind: KIND })).find((r) => r.data?.month === month && (r.section_id || null) === (sec?.id || null));
      if (again) { location.replace(`#/monthly-ach/${again.id}`); return; }
      throw e;
    }
    history.replaceState(null, "", `#/monthly-ach/${rec.id}`);
  } else rec = await api.get(id);
  if (rec?.data?.doc === "weekly_meeting") { location.replace(`#/meeting/${rec.id}`); return; } // التقرير الأسبوعي له صفحته
  if (!rec) { main.innerHTML = `<div class="container"><div class="empty">الملف غير موجود</div></div>`; return; }

  const recSec = rec.section_id ? (await api.sections().catch(() => [])).find((x) => x.id === rec.section_id) : null;
  const canFill = rec.section_id ? canFillSection(recSec) : canFillShared();
  const colleagues = [myName(), ...((await api.rpc("list_colleagues").catch(() => [])) || []).map((p) => p.full_name)].filter(Boolean);

  const ed = await recordPage(main, { rec, title: "الإنجازات الشهرية — إنجازات التوجيه الفني للعلوم", merge: true, render(body, ed, approved) {
    const d = ed.rec.data;
    // تغيير قيمة داخل صف/بند معرّف بمعرّفه (لا بموضعه، لأن الدمج قد يغيّر الترتيب)
    const setIn = (key, rid, field, value, opt) => ed.change((x) => { const r = (x.data[key] ||= []).find((y) => y.id === rid); if (r) r[field] = value; }, opt);
    const bulletEditor = (part) => `<div class="sa-bul" data-bkey="${part.key}">${(d[part.key] || []).map((b) => `
        <div class="sa-b" data-id="${b.id}"><textarea data-path="${part.key}.${b.id}.text" data-f="text" rows="2" placeholder="نص البند">${esc(b.text || "")}</textarea>
          <input data-path="${part.key}.${b.id}.names" data-f="names" list="sa-names" value="${esc(b.names || "")}" placeholder="الأسماء (تُطبع بالأحمر) — اختياري">
          <button class="btn small ghost" data-del aria-label="حذف البند">✕</button></div>`).join("")}
      </div><button class="btn small" data-addb="${part.key}">+ بند</button>`;
    const cellInput = (part, r, [c, label]) => {
      const path = `${part.key}.${r.id}.${c}`;
      if (c === "date") return `<td class="sa-date"><input type="date" data-path="${path}" data-f="date" value="${esc(r.date || "")}" aria-label="${esc(label)}">
        <input type="date" data-path="${part.key}.${r.id}.date_to" data-f="date_to" value="${esc(r.date_to || "")}" aria-label="إلى تاريخ" title="إلى تاريخ (لأكثر من يوم)"></td>`;
      return `<td><textarea rows="2" data-path="${path}" data-f="${c}" ${c === "guide" ? 'list="sa-names"' : ""} aria-label="${esc(label)}">${esc(r[c] || "")}</textarea></td>`;
    };
    const photoBox = (part, r) => `<td class="sa-ph-cell"><div class="sa-ph" data-key="${part.key}" data-id="${r.id}">
        ${(r.photos || []).map((pid) => `<div class="sa-th" data-pid="${pid}"><img alt=""><button type="button" class="sa-x" aria-label="إزالة الصورة">✕</button></div>`).join("")}
        ${(r.photos || []).length < SHARED_ACH.maxPhotos ? `<label class="sa-add" title="إضافة صورة (حتى ${SHARED_ACH.maxPhotos})">＋ صورة<input type="file" accept="image/*" multiple hidden></label>` : ""}</div></td>`;
    const tableEditor = (part) => `<div class="tbl-wrap"><table class="data sa-t" data-tkey="${part.key}"><thead><tr><th class="c-n">م</th>${part.cols.map(([, l]) => `<th>${esc(l)}</th>`).join("")}${part.photos ? "<th>الصور</th>" : ""}<th></th></tr></thead><tbody>
      ${(d[part.key] || []).map((r, i) => `<tr data-id="${r.id}"><td>${i + 1}</td>${part.cols.map((c) => cellInput(part, r, c)).join("")}${part.photos ? photoBox(part, r) : ""}<td><button class="btn small ghost" data-del aria-label="حذف الصف">✕</button></td></tr>`).join("")
        || `<tr><td colspan="${part.cols.length + (part.photos ? 3 : 2)}" class="hint">لا توجد صفوف بعد.</td></tr>`}</tbody></table></div>
      <button class="btn small" data-addr="${part.key}">+ صف</button>`;

    body.innerHTML = `
      <section class="panel sa-top"><div class="row" style="flex-wrap:wrap;gap:10px;align-items:center">
        <span class="pill acc">${recSec ? "ملف قسم: " + esc(recSec.name) : "ملف مشترك بين الموجهين"}</span>${canFill ? "" : '<span class="pill">للاطلاع فقط</span>'}<b>شهر ${esc(mLabel(d.month))}</b>
        <span class="hint">أي تعديل يظهر للجميع، وتُدمج التعديلات المتزامنة تلقائياً. سجل العمليات يبيّن من عدّل ومتى.</span></div>
        <div class="form" style="margin-top:12px">
          <div class="f"><label for="sa-stage">المرحلة</label><input id="sa-stage" data-path="stage" value="${esc(d.stage || "")}"></div>
          <div class="f"><label for="sa-obs">مراقب التوجيه الفني للعلوم (الغلاف والتوقيع الأخير)</label><input id="sa-obs" data-path="observer_name" value="${esc(d.observer_name || "")}"></div>
        </div>
        <div class="form" style="margin-top:4px"><div class="f"><label for="sa-ps">حجم الصورة في الطباعة (كل صورة بالحجم نفسه)</label><select id="sa-ps">${Object.entries(SHARED_ACH.photoSizes).map(([k, v]) => `<option value="${k}" ${(d.photo_size || "m") === k ? "selected" : ""}>${v.label}</option>`).join("")}</select></div></div>
        <div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="btn primary" id="mine">إضافة إنجازاتي من سجلاتي لهذا الشهر</button><button class="btn" id="seed">استرجاع نص الملف الأصلي</button>
          <span class="hint">يضيف فعالياتك ودوراتك واجتماعاتك ومتابعات الامتحانات من سجلاتك (مع صورها) باسمك، دون تكرار ما أُضيف سابقاً.</span></div></section>
      ${SHARED_ACH.sections.map((sec, si) => `<section class="panel"><h2>${SHARED_ACH.ordinals[si]}: ${esc(sec.title)}</h2>
        ${sec.parts.map((p) => p.type === "bullets"
          ? `${p.sub ? `<h3 class="sa-sub">${esc(p.sub)}</h3>` : ""}${bulletEditor(p)}`
          : `<h3 class="sa-sub">${esc(p.head)}${p.note ? ` <small class="sa-note">${esc(p.note)}</small>` : ""}</h3>${tableEditor(p)}`).join('<div class="sa-gap"></div>')}</section>`).join("")}
      <datalist id="sa-names">${[...new Set(colleagues)].map((n) => `<option value="${esc(n)}">`).join("")}</datalist>`;

    if (!canFill) { // غير محدد من المشرف: يقرأ الملف ولا يعدّله
      $(".sa-top", body).insertAdjacentHTML("afterbegin", `<div class="alert" style="margin-bottom:10px"><span>تعبئة هذا الملف لمن يحددهم ${recSec ? "مشرف القسم" : "المشرف"}. يمكنك الاطلاع والطباعة فقط.</span></div>`);
      $$("input, select, textarea", body).forEach((x) => { x.disabled = true; });
      $$("[data-addb], [data-addr], [data-del], .sa-x, .sa-add, #mine, #seed", body).forEach((x) => x.remove());
      const hideBar = () => document.querySelectorAll("#approve, #unapprove, #trash").forEach((x) => { x.hidden = true; x.style.display = "none"; });
      hideBar(); setTimeout(hideBar, 0); setTimeout(hideBar, 300);
      return;
    }
    if (approved) return;
    // الحقول العامة
    $$("[data-path='stage'], [data-path='observer_name']", body).forEach((el) => el.addEventListener("input", () => ed.change((x) => (x.data[el.dataset.path] = el.value))));
    // البنود
    $$(".sa-bul", body).forEach((box) => {
      const key = box.dataset.bkey;
      $$(".sa-b", box).forEach((row) => {
        const rid = row.dataset.id;
        $$("[data-f]", row).forEach((el) => el.addEventListener("input", () => setIn(key, rid, el.dataset.f, el.value)));
        row.querySelector("[data-del]").onclick = async () => {
          if ((row.querySelector("textarea").value || "").trim() && !(await confirmBox("حذف البند", "سيُحذف البند من الملف المشترك لكل الموجهين.", "حذف", true))) return;
          ed.change((x) => (x.data[key] = (x.data[key] || []).filter((y) => y.id !== rid)), { immediate: true }); ed.redraw();
        };
      });
    });
    $$("[data-addb]", body).forEach((b) => (b.onclick = () => {
      const key = b.dataset.addb, nid = uid();
      ed.change((x) => (x.data[key] = [...(x.data[key] || []), { id: nid, text: "", names: "" }]), { immediate: true });
      ed.redraw().then(() => body.querySelector(`[data-path="${key}.${nid}.text"]`)?.focus());
    }));
    // الجداول
    $$("[data-tkey]", body).forEach((tbl) => {
      const key = tbl.dataset.tkey;
      $$("tbody tr[data-id]", tbl).forEach((tr) => {
        const rid = tr.dataset.id;
        $$("[data-f]", tr).forEach((el) => el.addEventListener(el.type === "date" ? "change" : "input", () => setIn(key, rid, el.dataset.f, el.value)));
        tr.querySelector("[data-del]").onclick = async () => {
          if (!(await confirmBox("حذف الصف", "سيُحذف الصف من الملف المشترك لكل الموجهين.", "حذف", true))) return;
          ed.change((x) => (x.data[key] = (x.data[key] || []).filter((y) => y.id !== rid)), { immediate: true }); ed.redraw();
        };
      });
    });
    $$("[data-addr]", body).forEach((b) => (b.onclick = () => {
      const key = b.dataset.addr, part = TABLE_PARTS.find((p) => p.key === key), nid = uid();
      const row = { id: nid }; part.cols.forEach(([c]) => (row[c] = c === "guide" ? myName() : "")); if (part.photos) row.photos = [];
      ed.change((x) => (x.data[key] = [...(x.data[key] || []), row]), { immediate: true });
      ed.redraw().then(() => body.querySelector(`[data-path="${key}.${nid}.${part.cols[0][0]}"]`)?.focus());
    }));
    // مربع الصور: حجم ثابت، حتى 4 صور تُرتَّب داخله
    $$(".sa-ph", body).forEach((box) => {
      const key = box.dataset.key, rid = box.dataset.id;
      $$(".sa-th", box).forEach(async (th) => {
        th.querySelector("img").src = (await fileUrl(th.dataset.pid)) || "";
        th.querySelector(".sa-x").onclick = () => { ed.change((x) => { const r = x.data[key].find((y) => y.id === rid); if (r) r.photos = (r.photos || []).filter((p) => p !== th.dataset.pid); }, { immediate: true }); ed.redraw(); };
      });
      const inp = box.querySelector("input[type=file]");
      if (inp) inp.onchange = async (e) => {
        const cur = (ed.rec.data[key].find((y) => y.id === rid)?.photos || []).length;
        const files = [...e.target.files].slice(0, SHARED_ACH.maxPhotos - cur);
        if (e.target.files.length > files.length) toast(`الحد ${SHARED_ACH.maxPhotos} صور لكل صف`, "error");
        const ids = [];
        for (const f of files) {
          try { const up = await api.upload(await shrinkImage(f, 1400), { category: "shared_doc", record_id: ed.rec.id, title: f.name }); ids.push(up.id); }
          catch (err) { toast("تعذر رفع الصورة: " + err.message, "error"); }
        }
        if (ids.length) { ed.change((x) => { const r = x.data[key].find((y) => y.id === rid); if (r) r.photos = [...(r.photos || []), ...ids].slice(0, SHARED_ACH.maxPhotos); }, { immediate: true }); await ed.save(); ed.redraw(); toast("أُدرجت الصور"); }
      };
    });
    $("#mine", body).onclick = () => addMine(ed);
    $("#sa-ps", body).onchange = (e) => ed.change((x) => (x.data.photo_size = e.target.value), { immediate: true });
    // يملأ الأقسام الفارغة فقط بنص الملف الأصلي (لا يمس أي قسم فيه كتابة)
    $("#seed", body).onclick = async () => {
      const keys = [...BULLET_KEYS, ...TABLE_PARTS.map((p) => p.key)].filter((k) => (SHARED_ACH.seed[k] || []).length);
      const empty = keys.filter((k) => !(ed.rec.data[k] || []).some((r) => Object.entries(r).some(([f, v]) => !["id", "photos", "src"].includes(f) && String(v || "").trim())));
      if (!empty.length) { toast("كل الأقسام فيها كتابة؛ لم يتغير شيء"); return; }
      if (!(await confirmBox("استرجاع نص الملف الأصلي", `سيُملأ ${empty.length} قسم فارغ بنص الملف الأصلي. الأقسام التي فيها كتابة لا تتغير.`, "استرجاع"))) return;
      ed.change((x) => { for (const k of empty) x.data[k] = seedFor(k); }, { immediate: true }); ed.redraw(); toast("استُرجع النص");
    };
  } });

  ed.afterMerge = (r, stats) => { if (stats.conflicts) toast("عدّلت زميلة الحقل نفسه في الوقت نفسه؛ حُفظت قيمتك. راجعي سجل العمليات إن لزم.", "error"); };
  // جلب تعديلات الزميلات كل 20 ثانية ما دامت الصفحة مفتوحة
  const timer = setInterval(async () => {
    if (window.__currentEditor !== ed) return clearInterval(timer);
    if (document.visibilityState !== "visible") return;
    try { await ed.pull(); } catch (_) {}
  }, 20000);
}

// يضيف إنجازات الموجهة من سجلاتها للشهر (باسمها) دون تكرار؛ وتُنسخ صور الفعاليات لتصبح مرئية للجميع
async function addMine(ed) {
  const month = ed.rec.data.month, me = myName();
  if (!me) { toast("اكتبي اسمك في «البيانات الرئيسية» أولاً ليظهر في الملف", "error"); return; }
  toast("جارٍ جمع إنجازاتك…");
  const auto = await monthlyAuto(month);
  const evs = new Map((await api.list({ kind: "event_report" })).map((e) => [e.id, e]));
  const have = (key) => new Set((ed.rec.data[key] || []).flatMap((r) => r.src || []));
  const copyPhotos = async (srcId) => {
    const e = evs.get(srcId); const ids = (e?.data?.photos?.length ? e.data.photos : e?.data?.photo ? [e.data.photo] : []).filter(Boolean).slice(0, SHARED_ACH.maxPhotos);
    const out = [];
    for (const pid of ids) {
      try { const f = await api.fileById(pid); const blob = await api.fileBlob(f.storage_path);
        const up = await api.upload(new File([blob], f.title || "photo.jpg", { type: f.mime || blob.type }), { category: "shared_doc", record_id: ed.rec.id, title: f.title }); out.push(up.id); } catch (_) {}
    }
    return out;
  };
  const rows = { delivered: [], attended: [], office_meetings: [] };
  for (const r of auto.tables.delivered || []) if (!have("delivered").has(r.src[0])) rows.delivered.push({ id: uid(), src: r.src, event: r.event, date: r.date, guide: me, target: r.target, place: r.place, photos: await copyPhotos(r.src[0]) });
  for (const r of [...(auto.tables.attended || []), ...(auto.tables.supervised || [])]) if (!have("attended").has(r.src[0])) rows.attended.push({ id: uid(), src: r.src, event: r.event, date: r.date, place: r.place, guide: me, photos: await copyPhotos(r.src[0]) });
  for (const r of auto.tables.meetings || []) if (!have("office_meetings").has(r.src[0])) rows.office_meetings.push({ id: uid(), src: r.src, meeting: r.meeting, date: r.date, place: r.place, target: r.target, manager: r.manager, photos: [] });
  const haveText = (key) => new Set((ed.rec.data[key] || []).map((b) => (b.text || "").trim()));
  const bul = { exams: (auto.text.exams || []).filter((t) => !haveText("exams").has(t)), books: (auto.text["books.1"] || []).filter((t) => !haveText("books").has(t)) };
  const n = Object.values(rows).reduce((a, l) => a + l.length, 0) + bul.exams.length + bul.books.length;
  if (!n) { toast("لا يوجد جديد من سجلاتك لهذا الشهر"); return; }
  ed.change((x) => {
    for (const [k, l] of Object.entries(rows)) x.data[k] = [...(x.data[k] || []), ...l];
    for (const [k, l] of Object.entries(bul)) x.data[k] = [...(x.data[k] || []), ...l.map((t) => ({ id: uid(), text: t, names: me }))];
  }, { immediate: true });
  await ed.save(); ed.redraw();
  toast(`أُضيف ${n} من إنجازاتك`);
}

/* ---------------- قائمة الأشهر (لكل قسم ملفه) ---------------- */
async function list(main) {
  const [allRecs0, secsAll] = await Promise.all([api.list({ kind: KIND }), api.sections().catch(() => [])]);
  const allRecs = allRecs0.filter((r) => r.data?.doc !== "weekly_meeting");
  const secs = secsAll.filter(inSection);
  let pref = ""; try { pref = localStorage.getItem("sijil.sa.section") || ""; } catch (_) {}
  const cur = today().slice(0, 7);
  const paint = (sid) => {
    try { localStorage.setItem("sijil.sa.section", sid); } catch (_) {}
    const sec = secs.find((x) => x.id === sid) || null;
    const fill = sec ? canFillSection(sec) : canFillShared();
    const all = allRecs.filter((r) => (r.section_id || "") === (sec?.id || "")).sort((a, b) => (b.data?.month || "").localeCompare(a.data?.month || ""));
    const supBtn = sec && (isSectionSup(sec) || state.profile?.role === "admin") ? `<button class="btn" id="sec-m">أعضاء القسم ومن يعبّي</button>` : "";
    main.innerHTML = `<div class="container"><div class="page-head"><div><h1>الإنجازات الشهرية</h1><div class="sub">ملف «إنجازات التوجيه الفني للعلوم» مشترك: ملف واحد لكل شهر ${fill ? (sec ? "لقسم " + esc(sec.name) + "، تعبّينه مع المحددين من القسم" : "تعبّينه مع زميلاتك وزملائك المحددين") : `— تعبئته لمن يحددهم ${sec ? "مشرف القسم" : "المشرف"}، ويمكنك الاطلاع عليه وطباعته`}</div></div>
      <div class="row">${secs.length ? `<select id="sec" aria-label="القسم"><option value="">عام — كل الموجهين</option>${secs.map((x) => `<option value="${x.id}" ${x.id === sid ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : ""}
        <input type="month" id="m" value="${cur}" aria-label="الشهر"><button class="btn primary" id="open">${fill ? "فتح / إنشاء ملف الشهر" : "فتح ملف الشهر"}</button>${supBtn}</div></div>
    ${all.length ? `<div class="list">${all.map((r) => `<a class="item" href="#/monthly-ach/${r.id}"><span class="t">${esc(mLabel(r.data?.month))}${sec ? ` <small class="hint">${esc(sec.name)}</small>` : ""}</span>
      <span class="m">آخر تعديل ${esc(new Date(r.updated_at).toLocaleString("ar-KW"))}</span><span class="s">${r.status === "approved" ? '<span class="pill ok">معتمد</span>' : '<span class="pill">مسودة</span>'}</span></a>`).join("")}</div>`
      : `<div class="empty">لا توجد ملفات بعد. اختاري الشهر ثم «فتح / إنشاء ملف الشهر».</div>`}</div>`;
    const sel = $("#sec", main); if (sel) sel.onchange = () => paint(sel.value);
    const sm = $("#sec-m", main); if (sm) sm.onclick = async () => { if (await sectionMembersModal(sec)) { const fresh = (await api.sections()).find((x) => x.id === sec.id); if (fresh) Object.assign(sec, fresh); paint(sec.id); } };
    $("#open", main).onclick = () => { const m = $("#m", main).value; if (!m) return; const ex = all.find((r) => r.data?.month === m); go(ex ? `#/monthly-ach/${ex.id}` : `#/monthly-ach/new?month=${m}${sec ? "&section=" + sec.id : ""}`); };
  };
  const mine = secs.filter((x) => isSectionSup(x) || (x.members || []).includes(state.profile?.id));
  paint(secs.some((x) => x.id === pref) ? pref : (mine[0]?.id || ""));
}
