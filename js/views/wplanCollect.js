// تجميع الخطط الأسبوعية لمرحلة: المسؤول عن التجميع (لمرحلته) والمشرف يرون موجهي المرحلة في صفحة واحدة:
// البعدية لهذا الأسبوع ونسبة تطابقها مع القبلية، والقبلية للأسبوع القادم، ومن سلّم ومن لم يسلّم.
import { api } from "../api.js";
import { state, G, opts } from "../store.js";
import { esc, $, $$, today, fmtDate, weekStart, addDays, WORK_DAYS, academicYearOf, modal, toast } from "../ui.js";
import { KIND, matchOf, placeName, itemText, fullNameOf, subjectOf, guideOrder, withPost } from "./wplan.js";

const fmtItems = (arr) => (arr || []).filter((x) => placeName(x)).map((x) => esc(itemText(x)) + (x.note ? ` <span class="hint">(${esc(x.note)})</span>` : "")).join("<br>") || '<span class="hint">—</span>';
const isAdmin = () => false; // المشرف لا يرى خطط الموجهين؛ التجميع للمسؤول عن كل مرحلة فقط

// يجمع بيانات أسبوع ومرحلة (للصفحة وللطباعة)
export async function collectCtx(week, stage) {
  const cur = weekStart(week || today()), next = addDays(cur, 7);
  const [names, a, b] = await Promise.all([api.rpc("wp_stage_guides", { p_stage: stage }).catch(() => null),
    api.listSubmitted(KIND, "week_start", cur).catch(() => []), api.listSubmitted(KIND, "week_start", next).catch(() => [])]);
  const inStage = (r) => !stage || (r.data?.stage || "") === stage;
  const A = (a || []).filter(inStage).map(withPost), B = (b || []).filter(inStage).map(withPost);
  const people = new Map();
  for (const n of names || []) people.set(n.id, { id: n.id, name: n.full_name });
  for (const r of [...A, ...B]) if (!people.has(r.owner_id)) people.set(r.owner_id, { id: r.owner_id, name: r.data?.guide_name || "—" });
  const rows = [...people.values()].map((p) => { const c = A.find((r) => r.owner_id === p.id), n = B.find((r) => r.owner_id === p.id);
    return { ...p, name: fullNameOf(c?.data?.guide_name || n?.data?.guide_name || p.name, stage), cur: c || null, next: n || null, match: c?.data.post_sent ? matchOf(c.data.pre, c.data.post) : null }; })
    .map((r) => ({ ...r, stage, subject: subjectOf(r.name, r.cur || r.next) })).sort(guideOrder([stage]));
  return { kind: "wp_collect", week: cur, next, stage, rows, year: academicYearOf(cur).replace("-", "-"), first: G().first_supervisor || "", guide: { full_name: G().full_name || "" } };
}

export default async function (main, { params }) {
  if (!state.profile?.is_collector) { main.innerHTML = `<div class="container"><div class="empty"><h2>هذه الصفحة للمسؤول عن تجميع الخطط</h2><p>يعيّنه المشرف من «الحسابات والصلاحيات».</p></div></div>`; return; }
  const stage = isAdmin() ? params.stage || G().stage || opts("stages")[0] : G().stage || "";
  if (!stage) { main.innerHTML = `<div class="container"><div class="empty"><h2>حدّد مرحلتك أولاً</h2><p>من البيانات الرئيسية ← المرحلة؛ تظهر لك خطط موجهي مرحلتك.</p></div></div>`; return; }
  const ctx = await collectCtx(params.week, stage);
  const sentN = ctx.rows.filter((r) => r.cur?.data.post_sent && r.next).length;
  main.innerHTML = `<div class="container"><div class="page-head"><div><a class="hub-back" href="#/wplan">خطتي الأسبوعية</a><h1>تجميع الخطط الأسبوعية — ${esc(stage)}</h1>
      <div class="sub">البعدية لأسبوع ${fmtDate(ctx.week)} ونسبة تطابقها، والقبلية لأسبوع ${fmtDate(ctx.next)}. سلّم ${sentN} من ${ctx.rows.length}.</div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap">${isAdmin() ? `<select id="wc-st" aria-label="المرحلة">${opts("stages").map((s) => `<option ${s === stage ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>` : ""}
        <input type="date" id="wc-wk" value="${ctx.week}" aria-label="الأسبوع"><a class="btn primary" href="#/print/wp-collect?view=prepost&week=${ctx.week}&stage=${encodeURIComponent(stage)}">القبلية والبعدية (هذا الأسبوع)</a>
        <a class="btn primary" href="#/print/wp-collect?view=pre&week=${ctx.week}&stage=${encodeURIComponent(stage)}">القبلية (الأسبوع القادم)</a>
        <a class="btn" href="#/print/wp-collect?week=${ctx.week}&stage=${encodeURIComponent(stage)}">التفاصيل</a></div></div>
    ${ctx.rows.length ? `<div class="tbl-wrap"><table class="data"><thead><tr><th>الموجه</th><th>البعدية (هذا الأسبوع)</th><th>نسبة التطابق</th><th>القبلية (القادم)</th><th></th></tr></thead><tbody>
      ${ctx.rows.map((r, i) => `<tr><td>${esc(r.name)}</td><td>${r.cur?.data.post_sent ? `<span class="pill ok">سُلّمت${r.cur.data.late ? " متأخرة" : ""}</span>` : '<span class="pill bad">لم تُسلّم</span>'}</td>
        <td>${r.match?.pct == null ? "—" : `<b>${r.match.pct}%</b>`}</td><td>${r.next ? `<span class="pill ok">سُلّمت${r.next.data.late ? " متأخرة" : ""}</span>` : '<span class="pill bad">لم تُسلّم</span>'}</td>
        <td><button class="btn small" data-x="${i}">التفاصيل</button>${r.cur || r.next ? ` <button class="btn small" data-ed="${i}">تعديل</button>` : ""}</td></tr>
        <tr class="wc-det" data-d="${i}" hidden><td colspan="5"><table class="data"><thead><tr><th>اليوم</th><th>المخطط (القبلية)</th><th>المنفذ (البعدية)</th><th>القبلية للأسبوع القادم</th></tr></thead><tbody>
          ${WORK_DAYS.map((d, k) => `<tr><td>${d}</td><td>${fmtItems(r.cur?.data.pre?.[k])}</td><td>${fmtItems(r.cur?.data.post?.[k])}</td><td>${fmtItems(r.next?.data.pre?.[k])}</td></tr>`).join("")}</tbody></table></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty"><h2>لا يوجد موجهون في مرحلة ${esc(stage)} بعد</h2></div>`}</div>`;
  $("#wc-wk", main).onchange = (e) => { location.hash = `#/wplan-collect?week=${weekStart(e.target.value || today())}${isAdmin() ? "&stage=" + encodeURIComponent(stage) : ""}`; };
  const st = $("#wc-st", main); if (st) st.onchange = () => { location.hash = `#/wplan-collect?week=${ctx.week}&stage=${encodeURIComponent(st.value)}`; };
  $$("[data-x]", main).forEach((b) => (b.onclick = () => { const d = $(`[data-d='${b.dataset.x}']`, main); d.hidden = !d.hidden; }));
  $$("[data-ed]", main).forEach((b) => (b.onclick = async () => { if (await editPlan(ctx.rows[Number(b.dataset.ed)])) location.reload(); }));
}

// التعديل النهائي للمسؤول: كل يوم مربع نص، وكل سطر بند
const OTHER_RE = /^(ال)?مكتب|^تكليف|^اجتماع|^ورشة|^دورة|^إجازة|^اجازة|^أعمال أخرى/;
function linesToItems(text, old) {
  return String(text || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const keep = (old || []).find((x) => itemText(x) === l); if (keep) return keep;
    if (/^أعمال أخرى/.test(l)) return { place: "أعمال أخرى", place_name: "أعمال أخرى", text: l.replace(/^أعمال أخرى\s*[:：-]?\s*/, "") || l, other: true };
    return OTHER_RE.test(l) ? { place: l, place_name: l, text: l, other: true } : { place: l, place_name: l, text: l, school: true };
  });
}
async function editPlan(r) {
  const parts = [["cur", "post", "البعدية (هذا الأسبوع)"], ["cur", "pre", "القبلية (هذا الأسبوع)"], ["next", "pre", "القبلية (الأسبوع القادم)"]].filter(([k]) => r[k]);
  const val = (k, part, i) => (r[k].data[part]?.[i] || []).filter((x) => placeName(x)).map((x) => itemText(x)).join("\n");
  const box = document.createElement("div");
  box.innerHTML = `<p class="hint" style="margin-top:0">تعديلك نهائي ويظهر في النماذج المطبوعة. كل سطر بند (مثال: «زيارة توجيهية لثانوية …»، «تكليف - …»، «مكتب التوجيه»).</p>
    ${parts.map(([k, part, label], pi) => `<h3 style="margin:12px 0 6px">${label}</h3><div class="form">${WORK_DAYS.map((d, i) => `<div class="f"><label for="pe-${pi}-${i}">${d}</label><textarea id="pe-${pi}-${i}" rows="2">${esc(val(k, part, i))}</textarea></div>`).join("")}</div>`).join("")}`;
  const ok = await modal({ title: `تعديل خطة ${r.name}`, body: box, wide: true, actions: [{ label: "إلغاء", value: null }, { label: "حفظ التعديل", kind: "primary", value: true }] });
  if (!ok) return false;
  try {
    for (const k of ["cur", "next"]) {
      if (!r[k]) continue;
      const { live_pre, live_post, post_sent, ...shown } = r[k].data, next = { ...shown, pre: live_pre || {}, post: live_post || {} };
      parts.forEach(([kk, part], pi) => { if (kk !== k) return; const v = Object.fromEntries(WORK_DAYS.map((_, i) => [i, linesToItems(box.querySelector(`#pe-${pi}-${i}`).value, shown[part]?.[i])]));
        next[part] = v; next[part === "post" ? "sent_post" : "sent_pre"] = v; if (part === "post") { next.post_started = true; next.post_sent_at ||= new Date().toISOString(); } });
      next.edited_by = G().full_name || state.profile?.full_name || ""; next.edited_at = new Date().toISOString();
      await api.update(r[k].id, { data: next }, r[k].version);
    }
    toast("حُفظ التعديل"); return true;
  } catch (e) { toast(/permission|policy|42501|row-level/i.test(e.message) ? "التعديل يحتاج تشغيل ملف update_2026_11_03b.sql في Supabase" : "تعذّر الحفظ: " + e.message, "error"); return false; }
}
