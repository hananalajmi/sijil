// تجهيز الخطة لنماذج Forms (مايكروسوفت): قبل فتح النموذج تظهر خطة كل يوم من «خطتي الأسبوعية» والتقويم والزيارات،
// تراجعها وتعدّلها ثم تنسخها يوماً يوماً إلى النموذج. (نموذج Forms لا يقبل التعبئة من موقع آخر، فالنسخ يدوي بضغطة)
import { api } from "../api.js";
import { esc, $, $$, today, fmtDate, weekStart, addDays, WORK_DAYS, toast } from "../ui.js";
import { recFor, visitsOf, itemText, placeName } from "./wplan.js";

const lines = (arr) => (arr || []).filter((x) => placeName(x) || x?.text).map((x) => itemText(x) + (x.note && !itemText(x).includes(x.note) ? ` (${x.note})` : ""));

export default async function (main, { params }) {
  const part = params.part === "pre" ? "pre" : "post", url = params.u || "";
  // البعدية: هذا الأسبوع؛ القبلية: الأسبوع القادم
  const base = weekStart(params.week || today()), ws = part === "pre" ? addDays(base, 7) : base;
  main.innerHTML = `<div class="container"><p class="hint">جارٍ تجهيز الخطة…</p></div>`;
  const rec = await recFor(ws, false);
  const fromPlan = Object.fromEntries(WORK_DAYS.map((_, i) => [i, lines(rec?.data?.[part]?.[i])]));
  // من التقويم والزيارات (للأيام الفارغة في البعدية)
  let extra = {};
  if (part === "post") {
    const v = await visitsOf(ws);
    const evs = (await api.list({ kind: "important_date" }).catch(() => [])).filter((e) => e.record_date);
    extra = Object.fromEntries(WORK_DAYS.map((_, i) => { const dt = addDays(ws, i);
      const ev = evs.filter((e) => e.record_date <= dt && (e.data?.end_date || e.record_date) >= dt).map((e) => e.title + (e.data?.place ? ` - ${e.data.place}` : ""));
      return [i, [...lines(v[i]), ...ev]]; }));
  }
  const dayText = (i) => [...new Set([...(fromPlan[i].length ? fromPlan[i] : extra[i] || [])])].join(" + ");
  main.innerHTML = `<div class="container"><div class="page-head"><div><a class="hub-back" href="#/hub/plans">الخطط</a>
      <h1>${part === "post" ? "الخطة البعدية" : "الخطة القبلية"} — قبل الإرسال في Forms</h1>
      <div class="sub">أسبوع ${fmtDate(ws)} – ${fmtDate(addDays(ws, 4))}. ${part === "post" ? "من بعديتك في «خطتي الأسبوعية»، والأيام الفارغة من التقويم والزيارات المسجلة." : "من قبليتك للأسبوع القادم في «خطتي الأسبوعية»."} راجعي وعدّلي، ثم انسخي كل يوم إلى خانته في النموذج.</div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><label class="row" style="gap:6px">الأسبوع <input type="date" id="pf-wk" value="${base}"></label>
        <button class="btn" id="pf-all">نسخ الكل</button>${url ? `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">فتح النموذج ↗</a>` : ""}</div></div>
    <section class="panel"><div class="form">${WORK_DAYS.map((d, i) => `<div class="f wide"><label for="pf-${i}">${d} ${fmtDate(addDays(ws, i))}</label>
      <div class="row" style="gap:8px;align-items:flex-start"><textarea id="pf-${i}" rows="2" style="flex:1">${esc(dayText(i))}</textarea><button class="btn small" data-cp="${i}">نسخ</button></div></div>`).join("")}</div>
      <p class="hint">${rec ? "" : "لا توجد خطة لهذا الأسبوع في «خطتي الأسبوعية»؛ عُبّئت الأيام من التقويم والزيارات. "}التعديل هنا للنسخ فقط ولا يغيّر خطتك المحفوظة.</p></section></div>`;
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast("نُسخ — الصقيه في النموذج"); } catch (_) { toast("تعذّر النسخ تلقائياً؛ حدّدي النص وانسخيه", "error"); } };
  $$("[data-cp]", main).forEach((b) => (b.onclick = () => copy($(`#pf-${b.dataset.cp}`, main).value)));
  $("#pf-all", main).onclick = () => copy(WORK_DAYS.map((d, i) => `${d}: ${$(`#pf-${i}`, main).value}`).join("\n"));
  $("#pf-wk", main).onchange = (e) => { location.hash = `#/plan-form?part=${part}&u=${encodeURIComponent(url)}&week=${weekStart(e.target.value || today())}`; };
}
