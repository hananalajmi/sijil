// الخطة الأسبوعية: كل أربعاء يكتب الموجّه «البعدية» لهذا الأسبوع (ما نُفّذ فعلاً — تُعبأ من زياراته) و«القبلية» للأسبوع القادم،
// ويحسب الموقع نسبة التطابق بين ما خُطط وما نُفّذ. تُرسل للمسؤول عن التجميع في المرحلة، وله صفحة تجمع موجهي مرحلته.
// كل خطة سجل weekly_plan لأسبوع واحد: data.pre (القبلية لذلك الأسبوع) و data.post (البعدية لنفس الأسبوع).
import { api } from "../api.js";
import { state, G, opts, schoolById } from "../store.js";
import { esc, $, $$, today, fmtDate, weekStart, addDays, academicYearOf, toast, debounce, WORK_DAYS } from "../ui.js";

export const KIND = "weekly_plan";
export const PLACES = ["مكتب التوجيه", "اجتماع", "ورشة / إنماء مهني", "دورة تدريبية", "إجازة", "أخرى"];
export const ACTS = () => [...new Set([...opts("school_visit_types"), "زيارة معلم", "متابعة السجلات", "متابعة امتحانات", "حضور اجتماع", "حضور ورشة", "عمل مكتبي"])];
const myName = () => G().full_name || state.profile?.full_name || "";
const days = (ws) => [0, 1, 2, 3, 4].map((i) => addDays(ws, i));
export const placeName = (it) => it?.place_name || schoolById(it?.place)?.title || it?.place || "";
const emptyDays = () => ({ 0: [], 1: [], 2: [], 3: [], 4: [] });

// نسبة التطابق: لكل يوم، ما خُطط له (بالمكان) هل نُفّذ في اليوم نفسه
export function matchOf(pre, post) {
  let planned = 0, done = 0; const missed = [], extra = [];
  for (let i = 0; i < 5; i++) {
    const P = (pre?.[i] || []).map(placeName).filter(Boolean), D = (post?.[i] || []).map(placeName).filter(Boolean);
    planned += P.length;
    P.forEach((p) => (D.includes(p) ? done++ : missed.push([i, p])));
    D.forEach((d) => { if (!P.includes(d)) extra.push([i, d]); });
  }
  return { planned, done, pct: planned ? Math.round((done / planned) * 100) : null, missed, extra };
}

async function recFor(ws, create) {
  const all = await api.list({ kind: KIND }).catch(() => []);
  let r = all.find((x) => x.data?.week_start === ws && (!state.profile || x.owner_id === state.profile.id || !x.owner_id));
  if (!r && create) r = await api.create({ kind: KIND, title: `الخطة الأسبوعية ${fmtDate(ws)}`, record_date: ws, academic_year: academicYearOf(ws), data: { week_start: ws, pre: emptyDays(), post: emptyDays() } });
  return r || null;
}
// البعدية من الزيارات المسجلة في الأسبوع (زيارة المدرسة وزيارة المعلم)
async function visitsOf(ws) {
  const end = addDays(ws, 4);
  const vs = await api.list({ kinds: ["school_visit", "teacher_visit"] }).catch(() => []);
  const out = emptyDays();
  for (const v of vs) {
    if (!v.record_date || v.record_date < ws || v.record_date > end || !v.school_id) continue;
    const i = Math.round((new Date(v.record_date) - new Date(ws)) / 864e5); if (i < 0 || i > 4) continue;
    const act = v.kind === "school_visit" ? v.data?.visit_type || "زيارة مدرسة" : "زيارة معلم";
    if (!out[i].some((x) => x.place === v.school_id)) out[i].push({ place: v.school_id, act, note: "", auto: true });
  }
  return out;
}

export default async function (main, { params }) {
  // الأسبوع الحالي (البعدية) والقادم (القبلية)
  const cur = weekStart(params.week || today()), next = addDays(cur, 7);
  main.innerHTML = `<div class="container"><div class="page-head"><div><a class="hub-back" href="#/hub/plans">الخطط</a><h1>خطتي الأسبوعية</h1>
      <div class="sub">كل أربعاء: البعدية لهذا الأسبوع (ما نُفّذ) والقبلية للأسبوع القادم، ثم «إرسال للمسؤول».</div></div>
      <div class="row"><label class="row" style="gap:6px">الأسبوع <input type="date" id="wp-wk" value="${cur}"></label>${state.profile?.is_collector || state.profile?.role === "admin" ? `<a class="btn" href="#/wplan-collect">تجميع خطط المرحلة</a>` : ""}</div></div>
    <div id="wp-body"><p class="hint">جارٍ التحميل…</p></div></div>`;
  $("#wp-wk", main).onchange = (e) => { location.hash = `#/wplan?week=${weekStart(e.target.value || today())}`; };
  // القفل: الأربعاء 8 مساءً (بتوقيت الكويت) لهذا الأسبوع — تُقفل البعدية الحالية والقبلية للأسبوع القادم معاً
  const lockAt = new Date(`${addDays(cur, 3)}T20:00:00+03:00`), locked = Date.now() > lockAt.getTime();
  const [rCur, rNext, auto] = await Promise.all([recFor(cur, true), recFor(next, true), visitsOf(cur)]);
  // تعبئة البعدية من الزيارات للأيام الفارغة
  rCur.data.post ||= emptyDays(); rNext.data.pre ||= emptyDays(); rCur.data.pre ||= emptyDays();
  let filled = 0; if (!locked) for (let i = 0; i < 5; i++) if (!(rCur.data.post[i] || []).length && auto[i].length) { rCur.data.post[i] = auto[i]; filled++; }
  const recs = { cur: rCur, next: rNext };
  const saveNow = async (k) => { const r = recs[k]; const stamp = { stage: G().stage || "", guide_name: myName(), subject: G().subject || "" };
    try { recs[k] = await api.update(r.id, { data: { ...r.data, ...stamp } }, r.version); } catch (e) { toast("تعذّر الحفظ: " + e.message, "error"); } };
  const save = { cur: debounce(() => saveNow("cur"), 700), next: debounce(() => saveNow("next"), 700) };
  if (filled) saveNow("cur");

  const placeOpts = (v) => `<option value="">— المكان —</option><optgroup label="المدارس">${state.schools.map((s) => `<option value="${s.id}" ${s.id === v ? "selected" : ""}>${esc(s.title)}</option>`).join("")}</optgroup>
    <optgroup label="أخرى">${PLACES.map((p) => `<option ${p === v ? "selected" : ""}>${esc(p)}</option>`).join("")}</optgroup>`;
  const actOpts = (v) => `<option value="">— النشاط —</option>${[...new Set([...ACTS(), ...(v ? [v] : [])])].map((a) => `<option ${a === v ? "selected" : ""}>${esc(a)}</option>`).join("")}`;
  const dayRows = (k, part, ws) => days(ws).map((dt, i) => `<div class="wp-day" data-k="${k}" data-part="${part}" data-i="${i}">
      <div class="wp-dh"><b>${WORK_DAYS[i]}</b> <span class="hint">${fmtDate(dt)}</span></div>
      <div class="wp-items">${(recs[k].data[part][i] || []).map((it, j) => `<div class="wp-it" data-j="${j}">
          <select data-f="place" aria-label="المكان">${placeOpts(it.place)}</select><select data-f="act" aria-label="النشاط">${actOpts(it.act)}</select>
          <input data-f="note" value="${esc(it.note || "")}" placeholder="ملاحظة" aria-label="ملاحظة"><button class="btn small ghost" data-del aria-label="حذف">✕</button></div>`).join("")}</div>
      <button class="btn small" data-add>+ إضافة</button></div>`).join("");
  const paint = () => {
    const m = matchOf(recs.cur.data.pre, recs.cur.data.post), sent = (r) => (r.data.submitted ? `<span class="pill ok">أُرسلت ${r.data.sent_at ? fmtDate(r.data.sent_at.slice(0, 10)) : ""}</span>` : '<span class="pill">لم تُرسل</span>');
    $("#wp-body", main).innerHTML = `
      <div class="panel" style="${locked ? "border-color:#e0b54a;background:#fff8e1" : ""}">${locked ? `🔒 <b>الخطة مقفلة</b> — انتهى موعد التعديل (الأربعاء ${fmtDate(addDays(cur, 3))} الساعة 8 مساءً).${recs.cur.data.submitted ? "" : " يمكنك إرسالها متأخرة فقط دون تعديل."}` : `⏰ آخر موعد للتعديل والإرسال: الأربعاء ${fmtDate(addDays(cur, 3))} الساعة 8 مساءً، وبعدها تُقفل الخطة.`}</div>
      <section class="panel"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><h2 style="margin:0">البعدية — هذا الأسبوع (${fmtDate(cur)} – ${fmtDate(addDays(cur, 4))})</h2>${sent(recs.cur)}</div>
        <p class="hint">تُعبأ تلقائياً من زياراتك المسجلة، وعدّل أو أضف ما نُفّذ فعلاً. <button class="btn small ghost" id="wp-refill">تحديث من الزيارات</button></p>
        <div class="wp-match">${m.pct === null ? "لا توجد خطة قبلية لهذا الأسبوع للمقارنة." : `<b>نسبة التطابق مع القبلية: ${m.pct}%</b> (${m.done} من ${m.planned})${m.missed.length ? `<br><span class="hint">لم يُنفّذ: ${m.missed.map(([i, p]) => `${WORK_DAYS[i]}: ${esc(p)}`).join("، ")}</span>` : ""}${m.extra.length ? `<br><span class="hint">إضافي غير مخطط: ${m.extra.map(([i, p]) => `${WORK_DAYS[i]}: ${esc(p)}`).join("، ")}</span>` : ""}`}</div>
        ${dayRows("cur", "post", cur)}</section>
      <section class="panel"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><h2 style="margin:0">القبلية — الأسبوع القادم (${fmtDate(next)} – ${fmtDate(addDays(next, 4))})</h2>${sent(recs.next)}</div>
        ${dayRows("next", "pre", next)}</section>
      <div class="row" style="gap:8px;margin:12px 0"><button class="btn primary" id="wp-send">إرسال للمسؤول (البعدية والقبلية)</button><span class="hint">يمكنك التعديل وإعادة الإرسال حتى الأربعاء 8 مساءً.</span></div>`;
    bind();
    if (locked) { $$(".wp-day select, .wp-day input, .wp-day button, #wp-refill", main).forEach((x) => (x.disabled = true)); const sb = $("#wp-send", main); if (recs.cur.data.submitted && recs.next.data.submitted) sb.disabled = true; else sb.textContent = "إرسال (متأخر)"; }
  };
  const bind = () => {
    $$(".wp-day", main).forEach((dEl) => {
      const k = dEl.dataset.k, part = dEl.dataset.part, i = Number(dEl.dataset.i), list = () => (recs[k].data[part][i] ||= []);
      dEl.querySelector("[data-add]").onclick = () => { list().push({ place: "", act: "", note: "" }); save[k](); paint(); };
      $$(".wp-it", dEl).forEach((row) => { const j = Number(row.dataset.j);
        row.querySelector("[data-del]").onclick = () => { list().splice(j, 1); save[k](); paint(); };
        $$("[data-f]", row).forEach((inp) => (inp[inp.tagName === "INPUT" ? "oninput" : "onchange"] = () => {
          const it = list()[j]; it[inp.dataset.f] = inp.value; if (inp.dataset.f === "place") it.place_name = schoolById(inp.value)?.title || inp.value; delete it.auto; save[k]();
          if (inp.dataset.f === "place" && k === "cur") paint(); })); });
    });
    $("#wp-refill", main).onclick = async () => { const a = await visitsOf(cur); for (let i = 0; i < 5; i++) for (const it of a[i]) if (!(recs.cur.data.post[i] ||= []).some((x) => x.place === it.place)) recs.cur.data.post[i].push(it); await saveNow("cur"); paint(); toast("أُضيفت الزيارات"); };
    $("#wp-send", main).onclick = async () => {
      if (!G().stage) return toast("حدّد مرحلتك في البيانات الرئيسية أولاً (ليصل للمسؤول عن مرحلتك)", "error");
      const at = new Date().toISOString();
      for (const k of ["cur", "next"]) { if (recs[k].data.submitted && locked) continue; recs[k].data.submitted = true; recs[k].data.sent_at = at; if (locked) recs[k].data.late = true; await saveNow(k); }
      toast("أُرسلت الخطة للمسؤول عن التجميع"); paint();
    };
  };
  paint();
}
