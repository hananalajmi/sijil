// الإنجازات الأسبوعية («تقرير زيارات التوجيه الفني للعلوم») والإنجازات الشهرية («إنجازات التوجيه الفني للعلوم»)
// وفق ملفي Word المرفقين: غلاف، صفحة المحتوى، ثم الأقسام، والتوقيع الأخير للموجه الفني الأول.
import { esc, fmtDate, fmtDateSlash, dayName, MONTHS_AR, addDays } from "../ui.js";
import { WEEKLY_REPORT, MONTHLY_ACH, COVER_LINES, FIRST_SUPERVISOR } from "../templates.js";
import { val, nl, img, logo, sigRow, mySig, headLogos, logoRow } from "./builders.js";

const yearM = (y) => { const [a, b] = (y || "").split("-"); return a && b ? `${a}-${b}م` : ""; };
const monthName = (m) => (m ? MONTHS_AR[Number(m.split("-")[1]) - 1] : "");
const lines = (t) => nl(t).map((x) => `<div class="ln">${x}</div>`).join("");
const bullets = (t) => { const l = nl(t); return l.length ? `<ul class="ach-ul">${l.map((x) => `<li>${x}</li>`).join("")}</ul>` : `<ul class="ach-ul"><li>&nbsp;</li></ul>`; };
const coverLines = (ctx) => (ctx.cover?.lines?.length ? ctx.cover.lines : COVER_LINES);
const firstSup = (ctx) => ({ title: ctx.cover?.first_title || FIRST_SUPERVISOR.title, name: ctx.guide?.first_supervisor || FIRST_SUPERVISOR.name });
const H = (ord, title) => `<div class="ach-h"><span>${esc(ord)}: ${esc(title)} :</span></div>`;

function contentsPage(items) {
  return `<div class="ach-contents"><div class="ach-contents-t">المحتوى</div>
    <table class="ach-toc"><thead><tr><th>البند</th><th>الموضوع</th></tr></thead><tbody>
    ${items.map(([o, t], i) => `<tr class="${i % 2 ? "alt" : ""}"><td>${esc(o)}</td><td>${esc(t)}</td></tr>`).join("")}</tbody></table></div>`;
}
async function finalSigs(ctx, leftTitle) {
  const fs = firstSup(ctx);
  return sigRow([mySig(ctx, leftTitle), { title: fs.title, name: fs.name, prefix: "أ." }], "ach-sigs");
}
function running(ctx, title, period) {
  return `<div class="ach-run"><span>${esc(title)}</span><span>${val(ctx.guide?.full_name ? "الموجه الفني: أ. " + ctx.guide.full_name : "")}</span><span>${esc(period)}</span></div>`;
}

/* ============================== الإنجازات الأسبوعية ============================== */
export async function weeklyReport(ctx) {
  const d = ctx.rec.data || {};
  const ws = d.week_start, we = ws ? addDays(ws, 4) : "";
  const period = `الأسبوع ${d.week_label || ""} — ${monthName(d.month || ws)} (${fmtDateSlash(ws)} - ${fmtDateSlash(we)})`;
  const fs = firstSup(ctx);
  const cover = `<div class="ach-cover">
    ${logoRow(await headLogos(ctx, "weekly_report"), "ach-logos")}
    <div class="ach-lines">${coverLines(ctx).map((l) => `<div>${esc(l)}</div>`).join("")}</div>
    <div class="ach-year">العام الدراسي ${esc(yearM(ctx.rec.academic_year))}</div>
    <div class="ach-title">${esc(WEEKLY_REPORT.title)}</div>
    <table class="ach-wk"><tr><th>شهر</th><td>${esc(monthName(d.month || ws))}</td></tr><tr><th>الاسبوع</th><td>${val(d.week_label)}</td></tr>
      <tr><th>من</th><td>${fmtDateSlash(ws)}</td></tr><tr><th>إلى</th><td>${fmtDateSlash(we)}</td></tr></table>
    <div class="ach-year">${esc(yearM(ctx.rec.academic_year))}</div>
    <div class="ach-cover-sigs"><div><b>الموجه الفني</b><span>أ. ${val(ctx.guide?.full_name)}</span></div><div><b>${esc(fs.title)}</b><span>أ. ${val(fs.name)}</span></div></div>
  </div>`;
  const toc = contentsPage(WEEKLY_REPORT.contents.map((t, i) => [MONTHLY_ACH.ordinals[i].replace("اً", "ا"), t]));
  const rows = (d.rows || []).filter((r) => r.date || r.place || r.goal || r.summary);
  const blocks = [];
  blocks.push({ table: { before: H("أولاً", "زيارات الموجه الفني للعلوم"), cls: "grid ach-t", thead: `<tr><th class="c-n">م</th><th>التاريخ</th><th>اليوم</th><th>مكان الزيارة</th><th>الهدف من الزيارة</th></tr>`,
    rows: (rows.length ? rows : [{}]).map((r, i) => `<tr><td>${rows.length ? i + 1 : "&nbsp;"}</td><td>${fmtDateSlash(r.date)}</td><td>${val(dayName(r.date))}</td><td>${val(r.place)}</td><td class="tl">${nl(r.goal).join("<br>")}</td></tr>`) } });
  blocks.push({ html: H("ثانياً", "ملخص ما تم إنجازه في الزيارات") });
  for (const r of rows.length ? rows : [{}]) {
    blocks.push({ html: `<table class="grid ach-sum"><tr><th>اليوم والتاريخ:</th><th>مكان الزيارة:</th></tr><tr><td>${val(dayName(r.date))} ${fmtDateSlash(r.date)}</td><td>${val(r.place)}</td></tr>
      <tr><td colspan="2" class="tl"><b>ملخص الزيارة:</b>${lines(r.summary)}</td></tr></table>` });
  }
  blocks.push({ group: { cls: "ach-txt", head: H("ثالثاً", "مستوى المعلمين والمتعلمين"), items: nl(d.level).map((x) => `<div class="ln">${x}</div>`) } });
  const pns = [["الإيجابيات", d.positives], ["السلبيات", d.negatives], ["المقترحات", d.suggestions], ["الملاحظات", d.note]].filter(([, t]) => (t || "").trim());
  blocks.push({ group: { cls: "ach-txt", head: H("رابعاً", "الإيجابيات والسلبيات والمقترحات"), items: pns.flatMap(([k, t]) => [`<div class="ach-sub">${k}:</div>`, ...nl(t).map((x) => `<div class="ln">${x}</div>`)]) } });
  const sigs = await finalSigs(ctx, "الموجه الفني");
  if (ctx.print?.sigsEveryPage === false) blocks.push({ html: `<div class="ach-endsig">${sigs}</div>` });
  return { orientation: "portrait", cls: "t-ach", covers: [cover, toc], header: running(ctx, WEEKLY_REPORT.title, period), identity: "", footer: ctx.print?.sigsEveryPage === false ? "" : sigs, blocks };
}

/* ============================== الإنجازات الشهرية ============================== */
// ctx.guides: أسماء الموجهين (في التقرير المجمع)؛ كل صف يحمل اسم صاحبه في guide
export async function monthlyAchievements(ctx) {
  const d = ctx.rec.data || {};
  const compiled = !!ctx.compiled;
  const mName = monthName(d.month);
  const fs = firstSup(ctx);
  const dir = ctx.cover?.director || MONTHLY_ACH.director;
  const cover = `<div class="ach-cover">
    ${logoRow(await headLogos(ctx, "monthly_achievements"), "ach-logos")}
    <div class="ach-lines">${coverLines(ctx).map((l) => `<div>${esc(l)}</div>`).join("")}</div>
    <div class="ach-year">العام الدراسي ${esc(yearM(ctx.rec.academic_year))}</div>
    <div class="ach-title">${esc(MONTHLY_ACH.title)}</div>
    <div class="ach-red">${compiled ? "مقرر المرحلة" : "المرحلة"} ${val(ctx.stageWord) || "......"}<br>أ. ${val(compiled ? ctx.coordinator : ctx.guide?.full_name) || "........"}</div>
    <div class="ach-green">شهر ${esc(mName) || "...."}</div>
    <div class="ach-year">${esc(yearM(ctx.rec.academic_year))}</div>
    <div class="ach-cover-sigs green"><div><b>${esc(fs.title)}</b><span>أ. ${val(fs.name)}</span></div>
      ${dir && !ctx.cover?.hideDirector ? `<div><b>${val(dir.title)}</b><span>أ / ${val(dir.name)}</span></div>` : ""}</div>
  </div>`;
  const toc = contentsPage(MONTHLY_ACH.sections.map((s, i) => [MONTHLY_ACH.ordinals[i].replace("اً", "ا"), s.contentsTitle || s.title]));
  const blocks = [{ html: `<p class="ach-intro">فيما يلي نستعرض لكم ما تم إنجازه في مجال أعمال التوجيه الفني للعلوم عن شهر ${esc(mName)} للعام الدراسي ${esc((ctx.rec.academic_year || "").replace("-", "/"))} م</p>` }];
  const who = (r) => (r.guide || ctx.guide?.full_name || "");
  for (const [si, sec] of MONTHLY_ACH.sections.entries()) {
    const head = H(MONTHLY_ACH.ordinals[si], sec.title);
    let first = true;
    const withHead = (h) => { const x = first ? head + h : h; first = false; return x; };
    for (const part of sec.parts) {
      const data = d[part.key];
      if (part.type === "rows") {
        const rows = part.rows.map((label, i) => `<tr><td class="tl ach-val">${lines(data?.[i])}</td><td class="ach-lab">${esc(label)}</td></tr>`);
        blocks.push({ table: { before: withHead(""), cls: "grid ach-rows", thead: `<tr><th colspan="2" class="ach-th">${esc(part.head)}</th></tr>`, rows } });
      } else if (part.type === "table") {
        const list = (data || []).filter((r) => r.event || r.meeting || r.date || r.place);
        const isMeet = part.key === "meetings";
        const rows = (list.length ? list : [{}]).map((r) => isMeet
          ? `<tr><td>${val(r.meeting)}</td><td>${val(dayName(r.date))} ${fmtDateSlash(r.date)}</td><td>${val(r.place)}</td><td>${val(r.manager)}</td><td>${val(r.target)}</td></tr>`
          : `<tr><td>${list.length ? "أ. " + val(who(r)) : "أ."}</td><td>${val(r.event)}</td><td>${val(dayName(r.date))} ${fmtDateSlash(r.date)}</td><td>${val(r.place)}</td><td>${val(r.target)}</td></tr>`);
        blocks.push({ table: { before: withHead(""), cls: "grid ach-t", thead: `<tr><th colspan="5" class="ach-th">${esc(part.head)}</th></tr><tr>${part.cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`, rows } });
      } else if (part.type === "committees") {
        const rows = part.rows.map((label, i) => {
          const v = data?.[i];
          const entries = Array.isArray(v) ? v : v ? [{ guide: ctx.guide?.full_name, text: v }] : [];
          return `<tr><td class="ach-name">${entries.map((e) => val(e.guide)).filter(Boolean).join("<br>")}</td><td class="ach-lab">${esc(label)}</td><td class="tl">${entries.map((e) => lines(e.text)).join("")}</td></tr>`;
        });
        blocks.push({ table: { before: withHead(""), cls: "grid ach-com", thead: `<tr><th>اسم الموجه</th><th colspan="2" class="ach-th">${esc(part.head)}</th></tr>`, rows } });
      } else if (part.type === "bullets") {
        blocks.push({ html: withHead(part.head ? `<div class="ach-sub">${esc(part.head)}</div>` : "") + bullets(data) });
      } else if (part.type === "photos") {
        const ph = (data || []).filter((p) => p.photo || p.event);
        blocks.push({ html: withHead("") });
        for (let i = 0; i < Math.max(1, ph.length); i++) {
          const p = ph[i] || {};
          blocks.push({ html: `<div class="ach-photo"><table class="grid ach-ph-t"><tr><th>اسم الفعالية</th><td>${val(p.event)}</td></tr><tr><th>اليوم / التاريخ</th><td>${val(dayName(p.date))} ${fmtDateSlash(p.date)}</td></tr>
            <tr><th>مكان الفعالية</th><td>${val(p.place)}</td></tr><tr><th>اسم الموجه</th><td>${val(p.event || p.photo ? who(p) : "")}</td></tr></table>
            <div class="ach-ph-img">${p.photo ? await img(p.photo, "photo") : ""}</div></div>` });
        }
      }
    }
  }
  const sigs = await sigRow([{ ...mySig(ctx, compiled ? "الموجه الفني ( مقرر)" : "الموجه الفني", compiled ? ctx.coordinator : undefined), prefix: "أ." }, { title: fs.title, name: fs.name, prefix: "أ." }], "ach-sigs");
  if (ctx.print?.sigsEveryPage === false) blocks.push({ html: `<div class="ach-endsig">${sigs}</div>` });
  const period = `شهر ${mName} ${(d.month || "").split("-")[0] || ""}`;
  return { orientation: "portrait", cls: "t-ach", covers: [cover, toc], header: running(ctx, MONTHLY_ACH.title, period), identity: "", footer: ctx.print?.sigsEveryPage === false ? "" : sigs, blocks };
}
