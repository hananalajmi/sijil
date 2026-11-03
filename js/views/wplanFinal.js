// التجميع النهائي للخطط الأسبوعية (كل المراحل) — للمسؤول عن التجميع النهائي فقط (يعيّنه المشرف)
// يُعبأ تلقائياً من خطط الموجهين المرسلة: «الخطة القبلية للزيارات» للأسبوع القادم، و«ملخص تقرير الزيارات» (البعدية) لهذا الأسبوع.
import { api } from "../api.js";
import { state, G, opts, setGuideData } from "../store.js";
import { esc, $, $$, today, fmtDate, weekStart, addDays, toast } from "../ui.js";
import { KIND, isFinalCollector, matchOf, fullNameOf, subjectOf, guideOrder } from "./wplan.js";
import { academicYearOf } from "../ui.js";

export const STAGE_ORDER = ["ابتدائي", "متوسط", "ثانوي"];
const ORD = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const UNITS = ["", "الحادي", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع"];
const TENS = { 2: "العشرون", 3: "الثلاثون", 4: "الأربعون", 5: "الخمسون" };
export function ordinal(n) {
  if (n <= 0) return "";
  if (n <= 10) return ORD[n];
  if (n < 20) return `${UNITS[n - 10]} عشر`;
  const t = Math.floor(n / 10), u = n % 10;
  return u ? `${UNITS[u]} و${TENS[t] || ""}` : TENS[t] || String(n);
}
// رقم الأسبوع الدراسي: من أحد الأسبوع الأول (القوائم المنسدلة ← بداية الأسبوع الأول)
export function weekNo(ws) {
  const w1 = String(opts("wp_week1")[0] || "").trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(w1)) return 0;
  return Math.floor((new Date(ws + "T12:00:00") - new Date(weekStart(w1) + "T12:00:00")) / (7 * 864e5)) + 1;
}

export async function finalCtx(week) {
  const cur = weekStart(week || today()), next = addDays(cur, 7);
  const [names, a, b] = await Promise.all([api.rpc("wp_all_guides").catch(() => null), api.listSubmitted(KIND, "week_start", cur).catch(() => []), api.listSubmitted(KIND, "week_start", next).catch(() => [])]);
  const people = new Map();
  for (const n of names || []) people.set(n.id, { id: n.id, name: n.full_name, stage: n.stage || "" });
  for (const r of [...(a || []), ...(b || [])]) if (!people.has(r.owner_id)) people.set(r.owner_id, { id: r.owner_id, name: r.data?.guide_name || "—", stage: r.data?.stage || "" });
  const so = (s) => { const i = STAGE_ORDER.indexOf(s); return i < 0 ? 9 : i; };
  const rows = [...people.values()].map((p) => { const c = (a || []).find((r) => r.owner_id === p.id), n = (b || []).find((r) => r.owner_id === p.id);
    return { ...p, name: fullNameOf(c?.data?.guide_name || n?.data?.guide_name || p.name, p.stage || c?.data?.stage || n?.data?.stage || ""), stage: p.stage || c?.data?.stage || n?.data?.stage || "", cur: c || null, next: n || null, match: c ? matchOf(c.data.pre, c.data.post) : null }; })
    .map((r) => ({ ...r, subject: subjectOf(r.name, r.cur || r.next) })).sort(guideOrder(STAGE_ORDER));
  const region = String(G().region || "الأحمدي").replace(/^منطقة\s*/, "").replace(/\s*التعليمية$/, "");
  return { kind: "wp_final", week: cur, next, rows, region, observer: G().wp_observer || "", allStages: true, year: academicYearOf(cur), first: G().first_supervisor || "", weekNoCur: weekNo(cur), weekNoNext: weekNo(next) };
}

export default async function (main, { params }) {
  if (!isFinalCollector()) { main.innerHTML = `<div class="container"><div class="empty"><h2>هذه الصفحة للمسؤول عن التجميع النهائي</h2><p>يعيّنه المشرف من «الحسابات والصلاحيات».</p></div></div>`; return; }
  const ctx = await finalCtx(params.week);
  const st = (r) => (r ? `<span class="pill ok">سُلّمت${r.data.late ? " متأخرة" : ""}</span>` : '<span class="pill bad">لم تُسلّم</span>');
  const q = `week=${ctx.week}`;
  main.innerHTML = `<div class="container"><div class="page-head"><div><a class="hub-back" href="#/wplan">خطتي الأسبوعية</a><h1>التجميع النهائي للخطط — كل المراحل</h1>
      <div class="sub">«ملخص تقرير الزيارات» من البعدية لأسبوع ${fmtDate(ctx.week)}${ctx.weekNoCur ? ` (الأسبوع ${ordinal(ctx.weekNoCur)})` : ""}، و«الخطة القبلية للزيارات» لأسبوع ${fmtDate(ctx.next)}${ctx.weekNoNext ? ` (الأسبوع ${ordinal(ctx.weekNoNext)})` : ""}.</div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><input type="date" id="wf-wk" value="${ctx.week}" aria-label="الأسبوع">
        <a class="btn primary" href="#/print/wp-final?view=pre&${q}">الخطة القبلية للزيارات (الأسبوع القادم)</a>
        <a class="btn primary" href="#/print/wp-final?view=post&${q}">ملخص تقرير الزيارات (هذا الأسبوع)</a>
        <a class="btn primary" href="#/print/wp-final?view=prepost&${q}">القبلية والبعدية مع نسبة الالتزام (هذا الأسبوع)</a></div></div>
    <section class="panel"><div class="form"><div class="f"><label for="wf-obs">مراقب التوجيه الفني (يظهر في الخطة القبلية)</label><input id="wf-obs" value="${esc(ctx.observer)}"></div></div>
      <p class="hint" style="margin:6px 0 0">${ctx.weekNoCur ? "" : "حدّد «بداية الأسبوع الأول» من القوائم المنسدلة ليظهر رقم الأسبوع. "}النموذجان يُطبعان PDF أو يُصدَّران Word للتعديل.</p></section>
    ${ctx.rows.length ? STAGE_ORDER.concat([""]).map((s) => { const rs = ctx.rows.filter((r) => (STAGE_ORDER.includes(r.stage) ? r.stage : "") === s); if (!rs.length) return "";
      return `<h2 style="margin:16px 0 8px">${esc(s || "بدون مرحلة")} <span class="hint">(سلّم ${rs.filter((r) => r.cur && r.next).length} من ${rs.length})</span></h2>
        <div class="tbl-wrap"><table class="data"><thead><tr><th>الموجه</th><th>البعدية (هذا الأسبوع)</th><th>القبلية (القادم)</th></tr></thead><tbody>
        ${rs.map((r) => `<tr><td>${esc(r.name)}</td><td>${st(r.cur)}</td><td>${st(r.next)}</td></tr>`).join("")}</tbody></table></div>`; }).join("")
      : `<div class="empty"><h2>لا يوجد موجهون حددوا مرحلتهم بعد</h2></div>`}</div>`;
  $("#wf-wk", main).onchange = (e) => { location.hash = `#/wplan-final?week=${weekStart(e.target.value || today())}`; };
  $("#wf-obs", main).onchange = (e) => { setGuideData("wp_observer", e.target.value.trim()); toast("حُفظ"); };
}
