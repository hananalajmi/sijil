// التقرير الأسبوعي للتوجيه الفني (اجتماع الموجهين الأسبوعي) — على هيئة النموذج المرفق
import { esc, dayName, MONTHS_AR, parseDate } from "../ui.js";
import { headLogos, logoRow } from "./builders.js";
// صور مخزنة داخل ملف مشترك يعدّله أكثر من شخص: تُقبل صور data:image فقط (حماية من حقن أكواد)
const safeImg = (u) => (/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(String(u || "")) ? u : "");

const lam = (subj) => { const s = String(subj || "").trim(); return s.startsWith("ال") ? "لل" + s.slice(2) : s ? "لـ" + s : ""; };
const dm = (iso) => { const d = parseDate(iso); return d ? `${d.getDate()}/${MONTHS_AR[d.getMonth()]}` : ""; };
const dmy = (iso) => { const d = parseDate(iso); return d ? `${d.getDate()} / ${MONTHS_AR[d.getMonth()]} /${d.getFullYear()}` : ""; };

export async function weeklyMeeting(ctx) {
  const d = ctx.rec.data || {}, subj = String(d.subject || "").trim();
  const yEnd = parseDate(d.period_to)?.getFullYear() || "";
  const period = d.period_from ? `${dm(d.period_from)} – ${dm(d.period_to || d.period_from)}/${yEnd}` : "";
  const header = `${logoRow(await headLogos(ctx, "weekly_meeting"), "wm-logos")}
    <div class="wm-title"><div class="wm-t1">التقرير الأسبوعي للتوجيه الفني <span class="wm-red">${esc(lam(subj))}</span></div>
      <div class="wm-t2">الفترة : ${esc(period)}</div></div>`;
  const absent = (() => { const g = {}; for (const a of d.absent || []) if (a?.name) (g[a.reason || ""] ||= []).push(a.name);
    return Object.entries(g).map(([r, ns]) => `(${r ? esc(r) + " : " : ""}${ns.map(esc).join(" – ")})`).join("  "); })();
  const items = (d.items || []).filter(Boolean);
  const blocks = [
    { html: `<p class="wm-lead">تم اجتماع موجهي وموجهات <span class="wm-red">${esc(subj.replace(/^ال/, "ال"))}</span> اجتماعهم الأسبوعي يوم ${esc(dayName(d.meeting_date) || "")} الموافق: ${esc(dmy(d.meeting_date))}</p>` },
    { html: `<p class="wm-line"><b>الحضور</b> : ${(d.attendees || []).map(esc).join(" – ")}</p>` },
    { html: `<p class="wm-line"><b>الغياب</b> : ${absent}</p>` },
    { html: `<p class="wm-line"><b>ونوقشت فيه البنود</b> :</p>` },
    ...items.map((t, i) => ({ html: `<p class="wm-item">${i + 1}– ${esc(t)}</p>` })),
  ];
  const footer = `<div class="wm-sigs"><div><div class="wm-st">مقرر التقرير الأسبوعي</div><div class="wm-sn">${d.reporter ? "أ. " + esc(d.reporter) : ""}</div>${safeImg(d.rep_stamp) || safeImg(d.rep_sig) ? `<div class="wm-mk">${safeImg(d.rep_stamp) ? `<img class="wm-stamp" src="${safeImg(d.rep_stamp)}" alt="">` : ""}${safeImg(d.rep_sig) ? `<img class="wm-sig" src="${safeImg(d.rep_sig)}" alt="">` : ""}</div>` : ""}</div>
    <div><div class="wm-st">الموجه الفني الأول للعلوم</div><div class="wm-sn">${d.first_name ? "أ. " + esc(d.first_name) : ""}</div></div></div>`;
  // التوقيعان حاشية سفلية ثابتة أسفل الصفحة
  return { orientation: "portrait", cls: "t-wm", header, identity: "", footer, blocks };
}

// تجميع الخطط الأسبوعية لمرحلة (للطباعة)
export async function weeklyPlansCompiled(ctx) {
  const { WORK_DAYS: WD, fmtDate } = await import("../ui.js");
  const { placeName, itemText } = await import("../views/wplan.js");
  const items = (arr) => (arr || []).filter((x) => placeName(x)).map((x) => esc(itemText(x)) + (x.note ? ` (${esc(x.note)})` : "")).join("<br>");
  const header = `${logoRow(await headLogos(ctx, "weekly_meeting"), "wm-logos")}<div class="wm-title"><div class="wm-t1">تجميع الخطط الأسبوعية — المرحلة ${esc(ctx.stage)}</div>
    <div class="wm-t2">البعدية: ${fmtDate(ctx.week)} – ${fmtDate(new Date(new Date(ctx.week).getTime() + 4 * 864e5).toISOString().slice(0, 10))} · القبلية: من ${fmtDate(ctx.next)}</div></div>`;
  const sum = `<table class="grid wp-sum"><tr><th>الموجه</th><th>البعدية</th><th>نسبة التطابق</th><th>القبلية</th></tr>${ctx.rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.cur ? "سُلّمت" + (r.cur.data.late ? " متأخرة" : "") : "لم تُسلّم"}</td><td>${r.match?.pct == null ? "—" : r.match.pct + "%"}</td><td>${r.next ? "سُلّمت" + (r.next.data.late ? " متأخرة" : "") : "لم تُسلّم"}</td></tr>`).join("")}</table>`;
  const blocks = [{ html: sum }];
  for (const r of ctx.rows.filter((x) => x.cur || x.next)) blocks.push({ html: `<div class="wp-g"><div class="wp-gh">${esc(r.name)}${r.match?.pct != null ? ` — التطابق ${r.match.pct}%` : ""}</div>
    <table class="grid wp-days"><tr><th>اليوم</th><th>المخطط (القبلية)</th><th>المنفذ (البعدية)</th><th>القبلية للأسبوع القادم</th></tr>${WD.map((d, k) => `<tr><td>${d}</td><td>${items(r.cur?.data.pre?.[k])}</td><td>${items(r.cur?.data.post?.[k])}</td><td>${items(r.next?.data.pre?.[k])}</td></tr>`).join("")}</table></div>` });
  return { orientation: "portrait", cls: "t-wm t-wp", header, identity: "", footer: "", blocks };
}

// ===== النموذجان الرسميان لتجميع الخطط (عرضي) — يُطبعان ويُصدَّران Word للتعديل =====
const STAGE_WORD = { "ثانوي": "الثانوية", "متوسط": "المتوسطة", "ابتدائي": "الابتدائية" };
async function wpHead(ctx, title, ws) {
  const { addDays } = await import("../ui.js");
  const d = (x) => { const [y, m, dd] = x.split("-"); return `${Number(dd)}-${Number(m)}-${Number(y)}`; };
  const H = await headLogos(ctx, "weekly_meeting");
  return `${logoRow({ ...H, c: `<div class="wp-title">${esc(title)}</div>` }, "wm-logos wp-logos")}
    <div class="wp-period">(من الأحد ${d(ws)} إلى الخميس ${d(addDays(ws, 4))})</div>`;
}
const wpFoot = (ctx) => `<div class="wp-foot"><span>الموجه الأول : أ / ${esc(ctx.first || "")}</span></div>`;
const cellTxt = async (arr) => { const { placeName, itemText } = await import("../views/wplan.js"); return (arr || []).filter((x) => placeName(x)).map((x) => esc(itemText(x))).join(" + "); };

// (أ) الخطة القبلية للأسبوع القادم: صف لكل موجه
export async function wpPreReport(ctx) {
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"], sw = STAGE_WORD[ctx.stage] || ctx.stage;
  const header = await wpHead(ctx, `الخطة القبلية للتوجيه الفني للعلوم للمرحلة ${sw}`, ctx.next);
  const rows = [];
  for (const r of ctx.rows) rows.push(r.next ? `<tr><th class="wp-n">${esc(r.name)}</th><td class="wp-t">القبلية</td>${(await Promise.all(days.map((_, k) => cellTxt(r.next?.data.pre?.[k])))).map((t) => `<td>${t}</td>`).join("")}</tr>`
    : `<tr><th class="wp-n">${esc(r.name)}</th><td class="wp-t">القبلية</td><td colspan="5" class="red">لا توجد خطة (لم تُسلَّم)</td></tr>`);
  return { orientation: "landscape", cls: "t-wp2", header, identity: "", footer: wpFoot(ctx), blocks: [{ table: { cls: "grid wp-tbl", thead: `<tr><th class="wp-n">اسم الموجه الفني</th><th class="wp-t">نوع الخطة</th>${days.map((d) => `<th>${d}</th>`).join("")}</tr>`, rows } }] };
}
// (ب) الخطة القبلية والبعدية لهذا الأسبوع مع نسبة الالتزام: صفان لكل موجه؛ «تم» إذا نُفّذ ما خُطط له في اليوم
export async function wpPrePostReport(ctx) {
  const { placeName } = await import("../views/wplan.js");
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"], sw = STAGE_WORD[ctx.stage] || ctx.stage;
  const header = await wpHead(ctx, `الخطة القبلية والبعدية للمرحلة ${sw} (${ctx.year || ""})`, ctx.week);
  const same = (a, b) => { const A = (a || []).map(placeName).filter(Boolean).sort().join("|"), B = (b || []).map(placeName).filter(Boolean).sort().join("|"); return !!A && A === B; };
  const rows = [];
  for (const r of ctx.rows) {
    if (!r.cur) { rows.push(`<tr class="wp-pre"><th class="wp-n" rowspan="2">${esc(r.name)}</th><td class="wp-t">القبلية</td><td colspan="5" rowspan="2" class="red">لا توجد خطة (لم تُسلَّم)</td><td class="wp-pct" rowspan="2"></td></tr><tr class="wp-post"><td class="wp-t red">البعدية</td></tr>`); continue; }
    const pre = r.cur?.data.pre || {}, post = r.cur?.data.post || {};
    const preT = await Promise.all(days.map((_, k) => cellTxt(pre[k]))), postT = await Promise.all(days.map(async (_, k) => (same(pre[k], post[k]) ? "تم" : await cellTxt(post[k]))));
    rows.push(`<tr class="wp-pre"><th class="wp-n" rowspan="2">${esc(r.name)}</th><td class="wp-t">القبلية</td>${preT.map((t) => `<td>${t}</td>`).join("")}<td class="wp-pct" rowspan="2">${r.match?.pct == null ? "" : r.match.pct + "%"}</td></tr>
      <tr class="wp-post"><td class="wp-t red">البعدية</td>${postT.map((t) => `<td class="red">${t}</td>`).join("")}</tr>`);
  }
  return { orientation: "landscape", cls: "t-wp2", header, identity: "", footer: wpFoot(ctx), blocks: [{ table: { cls: "grid wp-tbl", thead: `<tr><th class="wp-n">اسم الموجه الفني</th><th class="wp-t">نوع الخطة</th>${days.map((d) => `<th>${d}</th>`).join("")}<th class="wp-pct">نسبة الالتزام</th></tr>`, rows } }] };
}
