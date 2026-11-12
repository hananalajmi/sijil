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
    ...items.map((t, i) => ({ html: `<p class="wm-item">${esc(t)}</p>` })),
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
  const header = await wpHead(ctx, ctx.allStages ? `الخطة القبلية والبعدية لجميع المراحل (${ctx.year || ""})` : `الخطة القبلية والبعدية للمرحلة ${sw} (${ctx.year || ""})`, ctx.week);
  const nm = (r) => esc(r.name) + (ctx.allStages && r.stage ? `<div class="wf-st">${esc(stageLine(r))}</div>` : "");
  const same = (a, b) => { const A = (a || []).map(placeName).filter(Boolean).sort().join("|"), B = (b || []).map(placeName).filter(Boolean).sort().join("|"); return !!A && A === B; };
  const rows = [];
  for (const r of ctx.rows) {
    if (!r.cur) { rows.push(`<tr class="wp-pre"><th class="wp-n" rowspan="2">${nm(r)}</th><td class="wp-t">القبلية</td><td colspan="5" rowspan="2" class="red">لا توجد خطة (لم تُسلَّم)</td><td class="wp-pct" rowspan="2"></td></tr><tr class="wp-post"><td class="wp-t red">البعدية</td></tr>`); continue; }
    const pre = r.cur?.data.pre || {}, post = r.cur?.data.post || {};
    if (!r.cur.data.post_sent) { const preT0 = await Promise.all(days.map((_, k) => cellTxt(pre[k])));
      rows.push(`<tr class="wp-pre"><th class="wp-n" rowspan="2">${nm(r)}</th><td class="wp-t">القبلية</td>${preT0.map((t) => `<td>${t}</td>`).join("")}<td class="wp-pct" rowspan="2"></td></tr>
        <tr class="wp-post"><td class="wp-t red">البعدية</td><td colspan="5" class="red">لم تُسلَّم البعدية بعد</td></tr>`); continue; }
    const preT = await Promise.all(days.map((_, k) => cellTxt(pre[k]))), postT = await Promise.all(days.map((_, k) => cellTxt(post[k]))); // البعدية تُكتب كاملة دائماً (لا «تم»)
    rows.push(`<tr class="wp-pre"><th class="wp-n" rowspan="2">${nm(r)}</th><td class="wp-t">القبلية</td>${preT.map((t) => `<td>${t}</td>`).join("")}<td class="wp-pct" rowspan="2">${r.match?.pct == null ? "" : r.match.pct + "%"}</td></tr>
      <tr class="wp-post"><td class="wp-t red">البعدية</td>${postT.map((t) => `<td class="red">${t}</td>`).join("")}</tr>`);
  }
  return { orientation: "landscape", cls: "t-wp2", header, identity: "", footer: wpFoot(ctx), blocks: [{ table: { cls: "grid wp-tbl", thead: `<tr><th class="wp-n">اسم الموجه الفني</th><th class="wp-t">نوع الخطة</th>${days.map((d) => `<th>${d}</th>`).join("")}<th class="wp-pct">نسبة الالتزام</th></tr>`, rows } }] };
}

// ===== التجميع النهائي (كل المراحل): «الخطة القبلية للزيارات» و«ملخص تقرير الزيارات» — على هيئة النموذجين المرفقين =====
const dmyS = (iso) => { const [y, m, d] = String(iso || "").split("-"); return y ? `${Number(d)}/${Number(m)}/${y}` : ""; };
async function wfParts() {
  const { placeName, itemText, isSchoolItem } = await import("../views/wplan.js");
  const { ordinal } = await import("../views/wplanFinal.js");
  const { addDays } = await import("../ui.js");
  const txt = (x) => esc(itemText(x)) + (x.note && !String(itemText(x)).includes(x.note) ? ` (${esc(x.note)})` : "");
  // كل البنود في مربع يومها (زيارات، تكليف، مكتب…)، وعمود «أعمال أخرى» لما يختاره الموجه «أعمال أخرى» فقط
  const isOther = (x) => x?.place === "أعمال أخرى";
  const school = (arr) => (arr || []).filter((x) => placeName(x) && !isOther(x)).map(txt).join("<br>");
  const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const other = (dd) => DAYS.map((d, k) => { const o = (dd?.[k] || []).filter((x) => placeName(x) && isOther(x)).map(txt); return o.length ? `<div><b>${d}:</b> ${o.join(" + ")}</div>` : ""; }).join("");
  return { school, other, DAYS, ordinal, addDays };
}
// نموذجا الزيارات: الاسم الأول واسم العائلة فقط (الخطة القبلية والبعدية: الاسم كاملاً)
const firstLast = (n) => { const w = String(n || "").trim().split(/\s+/).filter(Boolean); return w.length > 2 ? `${w[0]} ${w[w.length - 1]}` : w.join(" "); };
const stageLine = (r) => (STAGE_WORD[r.stage] || r.stage || "") + (r.stage === "ثانوي" && r.subject ? ` - ال${String(r.subject).replace(/^ال/, "")}` : "");
const wfName = (r) => `${esc(r.cur?.data?.visit_name || r.next?.data?.visit_name || firstLast(r.name))}<div class="wf-st">${esc(stageLine(r))}</div>`;

export async function wpFinalPre(ctx) {
  const { school, other, DAYS, ordinal, addDays } = await wfParts();
  const ws = ctx.next, H = await headLogos(ctx, "wp_final");
  const header = `${logoRow({ ...H, c: `<div class="wf-title">الخطة القبلية للزيارات</div>` }, "wm-logos wf-logos")}
    <table class="grid wf-info"><tr><th>المنطقة التعليمية</th><td>${esc(ctx.region)}</td><th>الاسبوع</th><td>${esc(ordinal(ctx.weekNoNext) || "")}</td><th>من :</th><td>${dmyS(ws)}</td><th>إلى :</th><td>${dmyS(addDays(ws, 4))}</td></tr></table>`;
  const dh = DAYS.map((d, k) => { const [y, m, dd] = addDays(ws, k).split("-"); return `<th>${d}<div class="wf-d">${Number(dd)}/ ${Number(m)} /${y}م</div></th>`; }).join("");
  const thead = `<tr><th colspan="8" class="wf-band">زيارات الموجهين للمدارس ( زيارة إدارة المدرسة – زيارة القسم – زيارة الفصول )</th></tr>
    <tr><th colspan="2" class="wf-nh">مراقب التوجيه الفني</th>${dh}<th class="wf-o">أعمال أخرى</th></tr>`;
  const rows = [`<tr class="wf-obs"><td colspan="2">${esc(ctx.observer || "")}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`,
    `<tr class="wf-sub"><th class="wf-m">م</th><th>اسم الموجه الفني</th><td colspan="6"></td></tr>`];
  ctx.rows.forEach((r, i) => { const pre = r.next?.data?.pre;
    rows.push(r.next ? `<tr><td class="wf-m">${i + 1}</td><td class="wf-n">${wfName(r)}</td>${DAYS.map((_, k) => `<td>${school(pre?.[k])}</td>`).join("")}<td class="wf-o">${other(pre)}</td></tr>`
      : `<tr><td class="wf-m">${i + 1}</td><td class="wf-n">${wfName(r)}</td><td colspan="6" class="red">لا توجد خطة (لم تُسلَّم)</td></tr>`); });
  return { orientation: "landscape", cls: "t-wf", header, identity: "", footer: "", blocks: [{ table: { cls: "grid wf-tbl",
    colgroup: `<colgroup><col style="width:4%"><col style="width:14%"><col><col><col><col><col><col style="width:15%"></colgroup>`, thead, rows } }] };
}

export async function wpFinalPost(ctx) {
  const { school, other, DAYS, ordinal, addDays } = await wfParts();
  const ws = ctx.week, H = await headLogos(ctx, "wp_final");
  const header = `${logoRow({ ...H, c: `<div class="wf-title">ملخص تقرير الزيارات</div>` }, "wm-logos wf-logos")}
    <table class="grid wf-info"><tr><th>المنطقة التعليمية</th><td>${esc(ctx.region)}</td><th>الاسبوع</th><td>${esc(ordinal(ctx.weekNoCur) || "")}</td></tr>
      <tr><th>من</th><td>${dmyS(ws)}</td><th>إلى</th><td>${dmyS(addDays(ws, 4))}</td></tr></table>`;
  const thead = `<tr><th class="wf-m">م</th><th class="wf-n">الموجه الفني</th><th>الزيارات الميدانية للمدارس خلال الاسبوع</th><th class="wf-o">أعمال أخرى</th></tr>`;
  const rows = ctx.rows.map((r, i) => { const post = r.cur?.data?.post;
    return r.cur?.data?.post_sent ? `<tr><td class="wf-m">${i + 1}</td><td class="wf-n">${wfName(r)}</td><td class="wf-days">${DAYS.map((d, k) => `<div class="wf-day"><b>${d}:</b> ${school(post?.[k])}</div>`).join("")}</td><td class="wf-o">${other(post)}</td></tr>`
      : `<tr><td class="wf-m">${i + 1}</td><td class="wf-n">${wfName(r)}</td><td colspan="2" class="red">لا توجد خطة (لم تُسلَّم)</td></tr>`; });
  return { orientation: "portrait", cls: "t-wf", header, identity: "", footer: "", blocks: [{ table: { cls: "grid wf-tbl wf-post",
    colgroup: `<colgroup><col style="width:6%"><col style="width:22%"><col><col style="width:24%"></colgroup>`, thead, rows } }] };
}
