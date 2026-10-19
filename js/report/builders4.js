// النماذج الرسمية للتوقيع — «تكليف بمهمة خارج مقر العمل» (نموذج رقم 4، صفحة 14 من القرار 41/2006)
// يُطبع مُعبّأً من بيانات النموذج، أو فارغاً (blank) للتعبئة باليد.
import { esc, fmtDateSlash } from "../ui.js";
import { FORMS, FIRST_SUPERVISOR } from "../templates.js";
import { logo, sigSlotHtml } from "./builders.js";

const dots = (w = 38) => `<span class="dots" style="min-width:${w}mm"></span>`;
const v = (x, w) => (x ? `<b class="fm-v">${esc(x)}</b>` : dots(w));

export async function formTakleef(ctx) {
  const T = FORMS.takleef, d = ctx.rec.data || {}, blank = !!d.blank;
  const region = ctx.guide?.region || "الأحمدي";
  const people = blank ? [] : (d.people || []).filter((p) => (p.name || "").trim() || (p.civil_id || "").trim());
  const head = `<div class="fm-head">
      <div class="fm-org">${await logo("emblem", "fm-emblem")}<div>${T.header.map(esc).join("<br>")}<br>الإدارة العامة لمنطقة ${esc(region)} التعليمية</div></div>
      <div class="fm-no"><span>${esc(T.formNo)}</span><span>${esc(T.pageNo)}</span></div></div>
    <h1 class="fm-title">${esc(T.label)}</h1>
    <div class="fm-line"><b>التاريخ :</b> ${blank ? dots(45) : v(fmtDateSlash(d.date || ctx.rec.record_date), 45)}</div>
    <div class="fm-line"><b>الموافق :</b> ${blank ? dots(45) : v(d.hijri, 45)}</div>
    <div class="fm-line"><b>السيد المحترم / ${blank ? esc(T.addressee) : esc(d.addressee || T.addressee)}</b> ${esc(T.addresseeNote)}</div>
    <div class="fm-line"><b>بعد التحية ،،،</b></div>
    <div class="fm-line fm-para">تقرر تكليف السيد / السادة التالية أسماؤهم بأداء مهمة خارج مقر العمل وذلك للقيام بـ
      ${!blank && d.task ? `<b class="fm-v">${esc(d.task).replace(/\n/g, "<br>")}</b>` : `<span class="fm-blank-lines">${dots(120)}${dots(170)}${dots(170)}</span>`}</div>
    <div class="fm-line">خلال المدة ${blank ? dots(40) : v(fmtDateSlash(d.from), 40)} &nbsp; حتى ${blank ? dots(40) : v(fmtDateSlash(d.to || d.from), 40)}</div>
    <div class="fm-line"><b>وهم:</b></div>`;
  const rows = people.map((p, i) => `<tr><td class="c-n">${i + 1}</td><td class="fm-name">${esc(p.name)}</td><td class="fm-cid" dir="ltr">${esc(p.civil_id)}</td></tr>`);
  for (let i = rows.length; i < T.minLines; i++) rows.push(`<tr><td class="c-n">${i + 1}</td><td class="fm-name">&nbsp;</td><td class="fm-cid"></td></tr>`);
  const tail = `<div class="fm-line fm-after">رجاء العلم حيث يتعذر عليهم الحضور الى مقر العمل للتوقيع عند ( ${!blank && d.sign_at ? `<b class="fm-v">${esc(d.sign_at)}</b>` : dots(40)} )</div>
    <div class="fm-sign"><div><b>${esc(T.manager)} في منطقة ${esc(region)} التعليمية</b>${FIRST_SUPERVISOR.name ? `<div><b>أ. ${esc(FIRST_SUPERVISOR.name)}</b></div>` : ""}<div class="fm-sign-space"></div></div></div>`;
  return { orientation: "portrait", cls: "t-fm", header: "", identity: "", footer: "",
    blocks: [{ html: head }, { table: { cls: "fm-people", colgroup: `<colgroup><col style="width:12mm"><col><col style="width:52mm"></colgroup>`, thead: `<tr><th class="c-n">م</th><th>الاسم</th><th>الرقم المدني</th></tr>`, rows } }, { html: tail }] };
}

// ---------------- بطاقة قياس المعايير الفنية للمواد الأساسية ----------------
export const criteriaKey = (gi, ii) => `c${gi}_${ii}`;
export const criteriaMax = () => FORMS.criteria.groups.reduce((a, g) => a + g.items.reduce((b, [, m]) => b + m, 0), 0);
export function criteriaTotal(scores = {}) {
  let t = 0, any = false;
  FORMS.criteria.groups.forEach((g, gi) => g.items.forEach(([, m], ii) => { const v = scores[criteriaKey(gi, ii)]; if (v !== "" && v != null && !isNaN(v)) { any = true; t += Math.min(Number(v), m); } }));
  return any ? t : null;
}
const num = (x) => (x == null || x === "" ? "" : String(x));
export async function criteriaCard(ctx) {
  const T = FORMS.criteria, d = ctx.rec.data || {}, blank = !!d.blank;
  const region = ctx.guide?.region || "الأحمدي";
  const sc = blank ? {} : d.scores || {};
  const total = blank ? null : criteriaTotal(sc);
  const head = `<div class="cr-head">
      <div class="cr-org">${await logo("emblem", "cr-emblem")}<div><b>وزارة التربية</b><br><b>منطقة ${esc(region)} التعليمية</b></div></div>
      <h1 class="cr-title">${esc(T.label)}</h1>
      <div class="cr-date"><b>التاريخ :</b> ${blank ? dots(30) : v(fmtDateSlash(d.date || ctx.rec.record_date), 30)}</div></div>
    <div class="cr-id"><div><b>اسم المدرسة :</b> ${blank ? dots(70) : v(ctx.school?.title, 70)}</div><div><b>العام الدراسي :</b> ${v((ctx.rec.academic_year || "").replace("-", "/"), 25)}</div></div>
    <div class="cr-id"><div><b>المادة :</b> ${blank ? v(T.subject, 40) : v(d.subject || T.subject, 40)}</div></div>`;
  const rows = [];
  T.groups.forEach((g, gi) => g.items.forEach(([t, m], ii) => {
    rows.push(`<tr>${ii === 0 ? `<td class="cr-g" rowspan="${g.items.length}">${esc(g.t)}</td>` : ""}<td class="cr-i">${esc(t)}</td><td class="cr-m">${m}</td><td class="cr-s">${esc(num(sc[criteriaKey(gi, ii)]))}</td></tr>`);
  }));
  rows.push(`<tr class="cr-tot"><td colspan="2">الدرجة النهائية</td><td class="cr-m">${criteriaMax()}</td><td class="cr-s">${total == null ? "" : esc(String(total))}</td></tr>`);
  const recs = (list, note) => { const all = [...(list || []), ...String(note || "").split(/\n+/)].map((x) => String(x).trim()).filter(Boolean);
    return all.length ? `<ol class="cr-recs">${all.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : `<div class="cr-recs-empty">${dots(150)}${dots(150)}</div>`; };
  const guideSig = blank ? "" : await sigSlotHtml(ctx);
  const tail = `<div class="cr-box"><div class="cr-box-h">توصيات الموجه الفني :</div>${blank ? recs() : recs(d.recs_guide, d.recs_guide_note)}</div>
    <div class="cr-sign"><div><b>اسم الموجه الفني :</b> ${blank ? dots(60) : v(ctx.guide?.full_name, 60)}</div><div><b>التوقيع :</b> ${guideSig || dots(45)}</div></div>
    <div class="cr-box"><div class="cr-box-h">توصيات الموجه الأول :</div>${blank ? recs() : recs(d.recs_first, d.recs_first_note)}</div>
    <div class="cr-sign"><div><b>اسم الموجه الفني الأول :</b> ${v(ctx.guide?.first_supervisor, 60)}</div><div><b>التوقيع :</b> ${dots(45)}</div></div>`;
  return { orientation: "portrait", cls: "t-cr", header: "", identity: "", footer: "",
    blocks: [{ html: head }, { table: { cls: "grid cr-table", colgroup: `<colgroup><col style="width:32mm"><col><col style="width:23mm"><col style="width:18mm"></colgroup>`,
      thead: `<tr><th>المعيار</th><th>بنود المعيار</th><th>الدرجة التفصيلية</th><th>الدرجة</th></tr>`, rows, keepTogether: true } }, { html: tail }] };
}

// ---------------- الشهادات الجاهزة ----------------
// شهادة A4 أفقية لكل اسم، بتصميم الخلفية والخطوط المختارة. بدون أسماء تُطبع شهادة واحدة بسطر فارغ.
const certFontsLoaded = new Set();
async function loadCertFonts(fams) {
  const need = fams.filter((f) => f && !certFontsLoaded.has(f));
  if (need.length) {
    const href = "https://fonts.googleapis.com/css2?" + need.map((f) => "family=" + f.replace(/ /g, "+") + ":wght@400;700").join("&") + "&display=swap";
    await new Promise((res) => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.onload = l.onerror = res; document.head.appendChild(l); setTimeout(res, 4000); });
    need.forEach((f) => certFontsLoaded.add(f));
  }
  try { await Promise.race([Promise.all(fams.map((f) => document.fonts.load(`700 40px "${f}"`, "شهادة شكر"))), new Promise((r) => setTimeout(r, 4000))]); } catch (_) {}
}
const RIBBONS_SVG = `<svg class="ce-bg" viewBox="0 0 297 210" preserveAspectRatio="none" aria-hidden="true"><defs>
  <linearGradient id="ceg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a5a1c"/><stop offset=".25" stop-color="#f6e3a1"/><stop offset=".5" stop-color="#b8892f"/><stop offset=".75" stop-color="#fff1c2"/><stop offset="1" stop-color="#8f6a24"/></linearGradient>
  <linearGradient id="ceg2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f6a24"/><stop offset=".3" stop-color="#fbeab0"/><stop offset=".6" stop-color="#a87b2a"/><stop offset="1" stop-color="#f3dc96"/></linearGradient>
  <clipPath id="cecl"><path d="M0 0H36C20 55 25 130 54 210H0Z"/></clipPath><clipPath id="cecr"><path d="M297 0H260C276 60 270 150 246 210H297Z"/></clipPath><filter id="cem" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="4" seed="7"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .6  0 0 0 0 .66  0 0 0 1.4 -.55"/></filter></defs>
  <path d="M0 0H36C20 55 25 130 54 210H0Z" fill="#262e36"/><g clip-path="url(#cecl)"><rect width="70" height="210" filter="url(#cem)" opacity=".38"/></g>
  <path d="M297 0H260C276 60 270 150 246 210H297Z" fill="#262e36"/><g clip-path="url(#cecr)"><rect x="230" width="67" height="210" filter="url(#cem)" opacity=".38"/></g>
  <path d="M36 -2C18 55 24 132 56 212" stroke="url(#ceg1)" stroke-width="7" fill="none"/><path d="M27 -2C10 60 16 135 44 212" stroke="url(#ceg2)" stroke-width="2.2" fill="none"/>
  <path d="M-4 128C26 140 46 162 62 212" stroke="url(#ceg1)" stroke-width="8" fill="none"/><path d="M-4 156C18 166 32 186 40 212" stroke="url(#ceg2)" stroke-width="3" fill="none"/>
  <path d="M260 -2C278 60 271 150 244 212" stroke="url(#ceg2)" stroke-width="7" fill="none"/><path d="M270 -2C288 66 282 150 258 212" stroke="url(#ceg1)" stroke-width="2.2" fill="none"/>
  <path d="M301 28C278 38 264 22 256 -2" stroke="url(#ceg1)" stroke-width="7" fill="none"/></svg>`;
const WAVES_SVG = `<svg class="ce-bg" viewBox="0 0 297 210" preserveAspectRatio="none" aria-hidden="true"><defs>
  <linearGradient id="cew" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#14254a"/><stop offset="1" stop-color="#2c4a7c"/></linearGradient></defs>
  <path d="M0 0H140C112 4 70 6 34 22C18 29 7 37 0 46Z" fill="#cfd5d8"/><path d="M0 0H118C92 4 54 8 26 20C14 25 6 31 0 37Z" fill="url(#cew)"/>
  <path d="M0 40C9 31 22 24 38 18C68 7 104 3 140 1" stroke="#f2c55c" stroke-width="1.3" fill="none"/>
  <path d="M297 150C262 168 214 182 160 186C120 189 84 194 52 210H297Z" fill="#cfd5d8"/><path d="M297 160C270 176 230 190 186 196C140 201 98 203 64 210H297Z" fill="#a9b3b9"/>
  <path d="M297 178C262 192 214 199 170 201C130 203 96 205 70 210H297Z" fill="url(#cew)"/><path d="M0 210C40 196 96 192 150 191C210 190 254 182 297 168" stroke="#f2c55c" stroke-width="1.6" fill="none"/>
  <path d="M0 210C30 200 64 197 98 198" stroke="#f2c55c" stroke-width="1" fill="none"/></svg>`;
export async function certificate(ctx) {
  const { certLines, certIntro, certNames, certTitle, CERT_FONTS, DESIGN_DEFAULTS } = await import("../views/cert.js");
  const d = ctx.rec.data || {}, blank = !!d.blank, design = FORMS.cert.designs[d.design] ? d.design : "waves", D = DESIGN_DEFAULTS[design] || DESIGN_DEFAULTS.navy;
  const fam = (k, def) => (CERT_FONTS[k || def] || CERT_FONTS.amiri)[0];
  const fT = fam(d.fTitle, D.fTitle), fB = fam(d.fBody, D.fBody), fN = fam(d.fName, D.fName);
  await loadCertFonts([...new Set([fT, fB, fN])]);
  const names = blank ? [] : certNames(d);
  const hijri = (iso) => { try { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso + "T12:00:00")); } catch (_) { return ""; } };
  const date = d.date || ctx.rec.record_date;
  // الشعارات المختارة: الأول يميناً والثاني يساراً والبقية في الوسط
  const L = d.logos || { ministry: true, directorate: true }, keys = Object.keys(FORMS.cert.logos).filter((k) => L[k]);
  const logoHtml = async (k) => k === "seal" ? `<div class="ce-seal"><div class="ce-seal-in">${await logo("emblem", "ce-seal-img")}<b>وزارة التربية</b><small>Ministry of Education</small></div></div>` : await logo(FORMS.cert.logos[k][0], "ce-logo");
  const right = keys[0] ? await logoHtml(keys[0]) : "", left = keys[1] ? await logoHtml(keys[1]) : "";
  const mid = (await Promise.all(keys.slice(2).map(logoHtml))).join("");
  const sigImgs = blank ? "" : await sigSlotHtml(ctx);
  const signers = blank ? [] : (d.signers || []).filter((s) => s.on && (s.title || s.name));
  const sigs = signers.length ? `<div class="ce-sigs n${signers.length}">${signers.map((s) => `<div class="ce-sig"><div class="ce-sig-t">${esc(s.title || "")}</div>
      <div class="ce-sig-n">${s.name ? "أ/ " + esc(s.name) : ""}</div><div class="ce-sig-m">${s.me ? sigImgs : ""}</div></div>`).join("")}</div>` : `<div class="ce-sigs"></div>`;
  const lines = blank ? [] : certLines(d);
  const style = `--fT:'${fT}';--fB:'${fB}';--fN:'${fN}';--nc:${esc(d.nameColor || D.nameColor)};--sT:${(d.sizeTitle || 100) / 100};--sB:${(d.sizeBody || 100) / 100}`;
  const bg = design === "waves" ? WAVES_SVG : "";
  const page = (name) => `<div class="ce ce-${esc(design)}" style="${style}">${bg}<div class="ce-frame">${design === "navy" || design === "green" || design === "classic" ? '<i class="ce-c tl"></i><i class="ce-c tr"></i><i class="ce-c bl"></i><i class="ce-c br"></i>' : ""}
      <div class="ce-logo-r">${right}</div><div class="ce-logo-l">${left}</div>
      ${mid ? `<div class="ce-logo-m">${mid}</div>` : ""}
      <h1 class="ce-title">${esc(blank ? (FORMS.cert.types[d.ctype] || FORMS.cert.types.thanks).title : certTitle(d))}</h1>
      ${design === "ribbons" ? "" : '<div class="ce-orn"><span></span><b>✦</b><span></span></div>'}
      <p class="ce-intro">${esc(blank ? "يتقدم التوجيه الفني للعلوم بخالص الشكر والتقدير إلى" : certIntro(d))}</p>
      <div class="ce-name">${name ? `${d.recipient ? esc(d.recipient) + (d.prefix ? " / " + esc(d.prefix) : "") + " " : d.prefix ? esc(d.prefix) + " " : ""}${esc(name)}` : '<span class="dots" style="min-width:150mm"></span>'}</div>
      ${design === "waves" ? '<div class="ce-orn2"><span></span><b>❖</b><span></span></div>' : ""}
      <div class="ce-body">${lines.length ? lines.map((x) => `<p>${esc(x)}</p>`).join("") : '<p><span class="dots" style="min-width:190mm"></span></p><p><span class="dots" style="min-width:150mm"></span></p>'}</div>
      ${!blank && d.showDate ? `<div class="ce-date">تحريراً في: ${esc(fmtDateSlash(date))}${hijri(date) ? ` &nbsp;الموافق: ${esc(hijri(date))}` : ""}</div>` : ""}
      ${sigs}</div></div>`;
  const list = names.length ? names : [""];
  // الآيباد والآيفون يطبعان طولياً فقط: تُبنى الشهادة مُدارة داخل صفحة طولية (بدل تدوير الصفحة كاملة عند الطباعة)
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) || /[?&]ios=1\b/.test(location.search);
  const wrap = (h) => (IOS ? `<div class="ce-rot">${h}</div>` : h);
  const blocks = []; list.forEach((n, i) => { if (i) blocks.push({ pageBreak: true }); blocks.push({ html: wrap(page(n)) }); });
  return { orientation: IOS ? "portrait" : "landscape", cls: "t-ce" + (IOS ? " ce-ios" : ""), header: "", identity: "", footer: "", blocks };
}
