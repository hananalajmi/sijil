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
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) || /[?&]ios=1\b/.test(location.search);
  // الشهادة تُرسم صورةً واحدة بدقة الطباعة: ما يظهر في المعاينة هو ما يُطبع بالضبط، بلا تداخل على أي جهاز.
  // في الآيباد والآيفون (طباعة طولية فقط) تُرسم الصورة مُدارة داخل صفحة طولية.
  try {
    const R = await certRenderer({ d, blank, design, fT, fB, fN, title: blank ? (FORMS.cert.types[d.ctype] || FORMS.cert.types.thanks).title : certTitle(d),
      intro: blank ? "يتقدم التوجيه الفني للعلوم بخالص الشكر والتقدير إلى" : certIntro(d), lines, signers, keys, date: !blank && d.showDate ? `تحريراً في: ${fmtDateSlash(date)}${hijri(date) ? "  الموافق: " + hijri(date) : ""}` : "",
      sigImg: blank ? null : (ctx.print?.showSignature && ctx.guide?.signature ? ctx.guide.signature : null), stampImg: blank ? null : (ctx.print?.showStamp && ctx.guide?.stamp ? ctx.guide.stamp : null), nameColor: d.nameColor || D.nameColor });
    const blocks = [];
    for (let i = 0; i < list.length; i++) {
      const n = list[i], label = n ? `${d.recipient ? d.recipient + (d.prefix ? " / " + d.prefix : "") + " " : d.prefix ? d.prefix + " " : ""}${n}` : "";
      const src = R(label, IOS);
      if (i) blocks.push({ pageBreak: true });
      blocks.push({ html: `<img class="ce-img ${IOS ? "por" : "lan"}" src="${src}" alt="${esc(label || "شهادة")}">` });
    }
    return { orientation: IOS ? "portrait" : "landscape", cls: "t-ce t-ce-img", header: "", identity: "", footer: "", blocks };
  } catch (e) { console.warn("certificate canvas fallback", e); }
  const blocks = []; list.forEach((n, i) => { if (i) blocks.push({ pageBreak: true }); blocks.push({ html: page(n) }); });
  return { orientation: "landscape", cls: "t-ce", header: "", identity: "", footer: "", blocks };
}

// رسم الشهادة على لوحة (canvas) بدقة 200 نقطة/بوصة
const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const im = new Image(); if (!/^(data:|blob:)/.test(src) && /^https?:/.test(src)) im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
async function certRenderer(o) {
  const MM = 200 / 25.4, W = Math.round(297 * MM), H = Math.round(210 * MM);
  const { fileUrl, logoSrc } = await import("../store.js");
  const svg = WAVES_SVG.replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" `);
  const bg = await loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  const L = {}; for (const k of o.keys) L[k] = await loadImg(await logoSrc(k === "seal" ? "emblem" : FORMS.cert.logos[k][0]));
  const sig = o.sigImg ? await loadImg(await fileUrl(o.sigImg)) : null, stamp = o.stampImg ? await loadImg(await fileUrl(o.stampImg)) : null;
  const d = o.d, sT = (d.sizeTitle || 100) / 100, sB = (d.sizeBody || 100) / 100, PT = 0.3528 * MM;
  const font = (w, pt, fam) => `${w} ${pt * PT}px "${fam}", "Noto Kufi Arabic", "IBM Plex Sans Arabic", sans-serif`;
  const wrap = (c, text, maxW) => { const words = String(text).split(/\s+/).filter(Boolean), out = []; let cur = "";
    for (const w of words) { const t = cur ? cur + " " + w : w; if (c.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); return out; };
  const drawLogo = (c, im, k, x, y, h, alignRight) => {
    if (k === "seal") { const r = 21 * MM, cx = alignRight ? x - r : x + r, cy = y + r;
      const g = c.createRadialGradient(cx - r * .3, cy - r * .3, r * .1, cx, cy, r); g.addColorStop(0, "#fbeab0"); g.addColorStop(.6, "#d9b062"); g.addColorStop(1, "#a87b2a");
      c.save(); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = "#b8892f"; c.fill(); c.beginPath(); c.arc(cx, cy, r * .9, 0, Math.PI * 2); c.fillStyle = g; c.fill(); c.restore();
      if (im) { const ih = r * .95, iw = ih * im.width / im.height; c.drawImage(im, cx - iw / 2, cy - ih * .62, iw, ih); }
      c.fillStyle = "#3d2c0b"; c.textAlign = "center"; c.font = font(700, 7.5, o.fB); c.fillText("وزارة التربية", cx, cy + r * .55); return; }
    if (!im) return; const w = Math.min(60 * MM, h * im.width / im.height), hh = w * im.height / im.width; c.drawImage(im, alignRight ? x - w : x, y, w, hh); };
  const paint = (c, label) => {
    c.fillStyle = "#fff"; c.fillRect(0, 0, W, H); if (bg) c.drawImage(bg, 0, 0, W, H);
    const [k1, k2, ...km] = o.keys;
    if (k1) drawLogo(c, L[k1], k1, W - 20 * MM, 10 * MM, 30 * MM, true);
    if (k2) drawLogo(c, L[k2], k2, 24 * MM, 30 * MM, 21 * MM, false);
    km.forEach((k, i) => drawLogo(c, L[k], k, W / 2 - 15 * MM + (i - (km.length - 1) / 2) * 34 * MM, 4 * MM, 16 * MM, false));
    c.direction = "rtl"; c.textAlign = "center"; c.textBaseline = "middle";
    let y = 18 * MM; const cx = W / 2;
    const block = (text, w, pt, fam, lh, color, maxW, before = 0) => { y += before * MM; c.font = font(w, pt, fam); c.fillStyle = color;
      for (const ln of wrap(c, text, maxW * MM)) { const h = pt * PT * lh; c.fillText(ln, cx, y + h / 2); y += h; } };
    block(o.title, 400, 40 * sT, o.fT, 1.3, "#14254a", 230);
    block(o.intro, 400, 20 * sB, o.fB, 1.9, "#1b1b1b", 175, 5);
    if (label) block(label, 700, 28 * sB, o.fN, 1.35, o.nameColor, 229, 3);
    else { y += 6 * MM; c.save(); c.setLineDash([2, 6]); c.strokeStyle = "#555"; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 75 * MM, y + 6 * MM); c.lineTo(cx + 75 * MM, y + 6 * MM); c.stroke(); c.restore(); y += 10 * MM; }
    // زخرفة ذهبية تحت الاسم
    y += 1.5 * MM; const oy = y + 2 * MM;
    const gl = c.createLinearGradient(cx - 96 * MM, 0, cx - 4 * MM, 0); gl.addColorStop(0, "rgba(201,162,79,0)"); gl.addColorStop(1, "#c9a24f");
    const gr = c.createLinearGradient(cx + 96 * MM, 0, cx + 4 * MM, 0); gr.addColorStop(0, "rgba(201,162,79,0)"); gr.addColorStop(1, "#c9a24f");
    c.fillStyle = gl; c.fillRect(cx - 96 * MM, oy - .35 * MM, 92 * MM, .7 * MM); c.fillStyle = gr; c.fillRect(cx + 4 * MM, oy - .35 * MM, 92 * MM, .7 * MM);
    c.save(); c.translate(cx, oy); c.rotate(Math.PI / 4); c.fillStyle = "#c9a24f"; c.fillRect(-1.6 * MM, -1.6 * MM, 3.2 * MM, 3.2 * MM); c.restore();
    y = oy + 4 * MM;
    if (o.lines.length) for (const ln of o.lines) block(ln, 400, 19 * sB, o.fB, 2.2, "#1b1b1b", 229, .3);
    else for (const w of [190, 150]) { y += 12 * MM; c.save(); c.setLineDash([2, 6]); c.strokeStyle = "#555"; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - w / 2 * MM, y); c.lineTo(cx + w / 2 * MM, y); c.stroke(); c.restore(); }
    if (o.date) block(o.date, 400, 13 * sB, o.fB, 1.6, "#333", 229, 2);
    // التوقيعات أسفل اليسار
    o.signers.forEach((s, i) => { const x0 = 22 * MM + i * 85 * MM, w = 75 * MM, sx = x0 + w / 2; let sy = H - 21 * MM - (s.me && (sig || stamp) ? 16 * MM : 0);
      c.textAlign = "center"; c.fillStyle = "#8a6a2e"; c.font = font(700, 15 * sB, o.fB);
      const lines = [s.title || "", s.name ? "أ/ " + s.name : ""].filter(Boolean); const lh = 15 * sB * PT * 1.5;
      lines.forEach((t, j) => c.fillText(t, sx, sy - (lines.length - j) * lh + lh / 2));
      if (s.me) { let ix = sx - 20 * MM; for (const im of [sig, stamp]) if (im) { const h = 14 * MM, w2 = Math.min(30 * MM, h * im.width / im.height); c.drawImage(im, ix, sy + 1 * MM, w2, h); ix += w2 + 4 * MM; } }
      c.fillStyle = "#8a6a2e"; c.fillRect(x0, H - 21 * MM + 1 * MM, w, .35 * MM); });
  };
  return (label, portrait) => {
    const cv = document.createElement("canvas"); cv.width = portrait ? H : W; cv.height = portrait ? W : H; const c = cv.getContext("2d");
    if (portrait) { c.translate(H, 0); c.rotate(Math.PI / 2); }
    paint(c, label); const url = cv.toDataURL("image/png"); cv.width = cv.height = 0; return url;
  };
}
