// تجميع الخطط الأسبوعية لمرحلة: المسؤول عن التجميع (لمرحلته) والمشرف يرون موجهي المرحلة في صفحة واحدة:
// البعدية لهذا الأسبوع ونسبة تطابقها مع القبلية، والقبلية للأسبوع القادم، ومن سلّم ومن لم يسلّم.
import { api } from "../api.js";
import { state, G, opts } from "../store.js";
import { esc, $, $$, today, fmtDate, weekStart, addDays, WORK_DAYS, academicYearOf } from "../ui.js";
import { KIND, matchOf, placeName, itemText } from "./wplan.js";

const fmtItems = (arr) => (arr || []).filter((x) => placeName(x)).map((x) => esc(itemText(x)) + (x.note ? ` <span class="hint">(${esc(x.note)})</span>` : "")).join("<br>") || '<span class="hint">—</span>';
const isAdmin = () => state.profile?.role === "admin";

// يجمع بيانات أسبوع ومرحلة (للصفحة وللطباعة)
export async function collectCtx(week, stage) {
  const cur = weekStart(week || today()), next = addDays(cur, 7);
  const [names, a, b] = await Promise.all([api.rpc("wp_stage_guides", { p_stage: stage }).catch(() => null),
    api.listSubmitted(KIND, "week_start", cur).catch(() => []), api.listSubmitted(KIND, "week_start", next).catch(() => [])]);
  const inStage = (r) => !stage || (r.data?.stage || "") === stage;
  const A = (a || []).filter(inStage), B = (b || []).filter(inStage);
  const people = new Map();
  for (const n of names || []) people.set(n.id, { id: n.id, name: n.full_name });
  for (const r of [...A, ...B]) if (!people.has(r.owner_id)) people.set(r.owner_id, { id: r.owner_id, name: r.data?.guide_name || "—" });
  const rows = [...people.values()].map((p) => { const c = A.find((r) => r.owner_id === p.id), n = B.find((r) => r.owner_id === p.id);
    return { ...p, name: c?.data?.guide_name || n?.data?.guide_name || p.name, cur: c || null, next: n || null, match: c ? matchOf(c.data.pre, c.data.post) : null }; })
    .sort((x, y) => x.name.localeCompare(y.name, "ar"));
  return { kind: "wp_collect", week: cur, next, stage, rows, year: academicYearOf(cur).replace("-", "-"), first: G().first_supervisor || "", guide: { full_name: G().full_name || "" } };
}

export default async function (main, { params }) {
  if (!(state.profile?.is_collector || isAdmin())) { main.innerHTML = `<div class="container"><div class="empty"><h2>هذه الصفحة للمسؤول عن تجميع الخطط</h2><p>يعيّنه المشرف من «الحسابات والصلاحيات».</p></div></div>`; return; }
  const stage = isAdmin() ? params.stage || G().stage || opts("stages")[0] : G().stage || "";
  if (!stage) { main.innerHTML = `<div class="container"><div class="empty"><h2>حدّد مرحلتك أولاً</h2><p>من البيانات الرئيسية ← المرحلة؛ تظهر لك خطط موجهي مرحلتك.</p></div></div>`; return; }
  const ctx = await collectCtx(params.week, stage);
  const sentN = ctx.rows.filter((r) => r.cur && r.next).length;
  main.innerHTML = `<div class="container"><div class="page-head"><div><a class="hub-back" href="#/wplan">خطتي الأسبوعية</a><h1>تجميع الخطط الأسبوعية — ${esc(stage)}</h1>
      <div class="sub">البعدية لأسبوع ${fmtDate(ctx.week)} ونسبة تطابقها، والقبلية لأسبوع ${fmtDate(ctx.next)}. سلّم ${sentN} من ${ctx.rows.length}.</div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap">${isAdmin() ? `<select id="wc-st" aria-label="المرحلة">${opts("stages").map((s) => `<option ${s === stage ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>` : ""}
        <input type="date" id="wc-wk" value="${ctx.week}" aria-label="الأسبوع"><a class="btn primary" href="#/print/wp-collect?view=prepost&week=${ctx.week}&stage=${encodeURIComponent(stage)}">القبلية والبعدية (هذا الأسبوع)</a>
        <a class="btn primary" href="#/print/wp-collect?view=pre&week=${ctx.week}&stage=${encodeURIComponent(stage)}">القبلية (الأسبوع القادم)</a>
        <a class="btn" href="#/print/wp-collect?week=${ctx.week}&stage=${encodeURIComponent(stage)}">التفاصيل</a></div></div>
    ${ctx.rows.length ? `<div class="tbl-wrap"><table class="data"><thead><tr><th>الموجه</th><th>البعدية (هذا الأسبوع)</th><th>نسبة التطابق</th><th>القبلية (القادم)</th><th></th></tr></thead><tbody>
      ${ctx.rows.map((r, i) => `<tr><td>${esc(r.name)}</td><td>${r.cur ? `<span class="pill ok">سُلّمت${r.cur.data.late ? " متأخرة" : ""}</span>` : '<span class="pill bad">لم تُسلّم</span>'}</td>
        <td>${r.match?.pct == null ? "—" : `<b>${r.match.pct}%</b>`}</td><td>${r.next ? `<span class="pill ok">سُلّمت${r.next.data.late ? " متأخرة" : ""}</span>` : '<span class="pill bad">لم تُسلّم</span>'}</td>
        <td><button class="btn small" data-x="${i}">التفاصيل</button></td></tr>
        <tr class="wc-det" data-d="${i}" hidden><td colspan="5"><table class="data"><thead><tr><th>اليوم</th><th>المخطط (القبلية)</th><th>المنفذ (البعدية)</th><th>القبلية للأسبوع القادم</th></tr></thead><tbody>
          ${WORK_DAYS.map((d, k) => `<tr><td>${d}</td><td>${fmtItems(r.cur?.data.pre?.[k])}</td><td>${fmtItems(r.cur?.data.post?.[k])}</td><td>${fmtItems(r.next?.data.pre?.[k])}</td></tr>`).join("")}</tbody></table></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty"><h2>لا يوجد موجهون في مرحلة ${esc(stage)} بعد</h2></div>`}</div>`;
  $("#wc-wk", main).onchange = (e) => { location.hash = `#/wplan-collect?week=${weekStart(e.target.value || today())}${isAdmin() ? "&stage=" + encodeURIComponent(stage) : ""}`; };
  const st = $("#wc-st", main); if (st) st.onchange = () => { location.hash = `#/wplan-collect?week=${ctx.week}&stage=${encodeURIComponent(st.value)}`; };
  $$("[data-x]", main).forEach((b) => (b.onclick = () => { const d = $(`[data-d='${b.dataset.x}']`, main); d.hidden = !d.hidden; }));
}
