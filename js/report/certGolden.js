// قالب «الشهادة الرسمية الذهبية»: يُرسم كعنصر SVG متجهي (نصوص حقيقية بخطوط مضمّنة، وزخارف وإطار متجهية)
// فيُطبع ويُحفظ PDF بدقة كاملة، والخطوط تُضمَّن داخل ملف PDF، ولا تُستعمل لقطة شاشة.
// أماكن العناصر ثابتة في كل الشهادات (بالمليمتر على صفحة A4 أفقية 297×210):
//   الشعاران أعلى اليمين واليسار — العنوان في المنتصف أعلى — السطران التعريفيان — «تتقدم …» — المسمى — الاسم داخل إطار — العبارة — توقيع الموجه الأول أسفل اليسار. لا يوجد تاريخ.
import { esc } from "../ui.js";
import { FORMS } from "../templates.js";
import { loadCertFonts } from "./builders4.js";
import { TITLE_ART, BG_FREE } from "./certArt.js";

// الخلفيات: الإطار الذهبي المتجهي (افتراضي) + الخلفيات المرفقة. لكل خلفية أماكن ثابتة للشعارين والعنوان والتوقيع
// تناسب زخارفها، والنصوص تُقيَّد تلقائياً بالمساحة البيضاء فيها (BG_FREE) فلا تدخل على الزخارف.
export const GOLD_BGS = {
  frame: { label: "الإطار الذهبي والزخارف", logoR: { x: 229, y: 15, w: 40, h: 32 }, logoL: { x: 28, y: 15, w: 40, h: 32 }, title: { cx: 148.5, y: 32, h: 34 }, sign: { x: 72, y: 163 }, dy: 0, titleColor: "gold", divider: true },
  ribbons: { label: "أشرطة ذهبية على رخام داكن", img: "assets/cert-bg/ribbons.jpg", logoR: { x: 222, y: 29, w: 50, h: 50 }, logoL: { x: 33, y: 11, w: 44, h: 26 }, title: { cx: 143, y: 30, h: 46 }, sign: { x: 95, y: 158 }, dy: 4, titleColor: "black", defLogoR: "gold_seal", nameColor: "#8a6a2e" },
  leaves: { label: "أوراق ذهبية وسوداء", img: "assets/cert-bg/leaves.jpg", logoR: { x: 207, y: 20, w: 38, h: 28 }, logoL: { x: 52, y: 20, w: 38, h: 28 }, title: { cx: 148.5, y: 36, h: 34 }, sign: { x: 75, y: 158 }, dy: 4, titleColor: "gold" },
  diag: { label: "أشرطة كحلية وذهبية مائلة", img: "assets/cert-bg/diag.jpg", logoR: { x: 207, y: 24, w: 38, h: 28 }, logoL: { x: 52, y: 24, w: 38, h: 28 }, title: { cx: 148.5, y: 37, h: 32 }, sign: { x: 95, y: 158 }, dy: 4, titleColor: "navy" },
  waves2: { label: "أمواج كحلية وذهبية", img: "assets/cert-bg/waves2.jpg", logoR: { x: 226, y: 24, w: 40, h: 30 }, logoL: { x: 31, y: 24, w: 40, h: 30 }, title: { cx: 148.5, y: 36, h: 34 }, sign: { x: 72, y: 158 }, dy: 4, titleColor: "navy" },
  goldframe: { label: "إطار ذهبي بشرائط سوداء", img: "assets/cert-bg/goldframe.jpg", logoR: { x: 212, y: 22, w: 38, h: 30 }, logoL: { x: 47, y: 22, w: 38, h: 30 }, title: { cx: 148.5, y: 37, h: 32 }, sign: { x: 82, y: 158 }, dy: 4, titleColor: "gold" },
  silk: { label: "كحلي وذهبي على حرير", img: "assets/cert-bg/silk.jpg", logoR: { x: 226, y: 26, w: 40, h: 30 }, logoL: { x: 31, y: 26, w: 40, h: 30 }, title: { cx: 148.5, y: 38, h: 32 }, sign: { x: 88, y: 158 }, dy: 4, titleColor: "navy" },
};
export const TITLE_COLORS = { auto: "حسب الخلفية", gold: "ذهبي", black: "أسود", navy: "كحلي" };
// الختام يتبع المسمى (لها ← له) والضمائر تُصاغ من النص المؤنث
const genderClosing = (t, job) => (/ة(\s|$)/.test(String(job || "").split("/")[0].trim()) || !t ? t : t.replace(/حضرت/g, "حضر").replace(/([؀-ۿ]{2,})ها(?=[\s،.,:؛!؟]|$)/g, "$1ه"));
const isShukr = (t) => String(t || "").replace(/[\sـ]/g, "") === "شكروتقدير";

// خطوط قابلة للاختيار للاسم والنص (كلها مضمّنة في الموقع)
// كل الخطوط العربية المجانية من Google Fonts (تُحمَّل عند اختيارها فقط)
import { ALL_FONTS } from "./certFonts.js";
export const TEXT_FONTS = ALL_FONTS;
const FONT_ALIAS = { notosans: "notosansarabic", plex: "ibmplexsansarabic", kufi: "notokufiarabic", messiri: "elmessiri", naskh: "notonaskharabic", markazi: "markazitext", ruqaa: "arefruqaa" };
const fkey = (k) => (TEXT_FONTS[k] ? k : TEXT_FONTS[FONT_ALIAS[k]] ? FONT_ALIAS[k] : "notosansarabic");
const fontJobs = {};
export const loadTextFont = (k0) => { const k = fkey(k0), e = TEXT_FONTS[k]; if (!e?.[2]) return Promise.resolve(); if (fontJobs[k]) return fontJobs[k];
  return (fontJobs[k] = Promise.all(e[2].map(async ([url, weight]) => { try { const f = new FontFace(e[0], `url("${new URL(url, document.baseURI).href}") format("woff")`, { weight }); await f.load(); document.fonts.add(f); } catch (_) { delete fontJobs[k]; } }))); };
const fontOf = (k, w) => { const f = TEXT_FONTS[fkey(k)][0]; return [f, f === "Sijil Ruqaa" ? 700 : f === "Sijil Plex" ? (w >= 600 ? 700 : 400) : w]; };
// تنسيق كل عبارة على حدة: الخط والحجم (بالنقطة) واللون
export const STYLE_PARTS = { lines: ["السطران التعريفيان", 700], intro: ["العبارة فوق الاسم", 500], name: ["المسمى والاسم", 700], body: ["العبارة تحت الاسم", 500], closing: ["الختام", 500], sign: ["التوقيع", 700] };
export const STYLE_SIZES = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 44, 48];
export function styleOf(d) { // مع التوافق مع الإعدادات السابقة (خط الاسم/خط النص/حجم الخط)
  const K = (Number(d.sizeK) || 100) / 100, tf = d.textFont || "notosansarabic", tc = d.textColor || "#1d2333";
  const def = { lines: { font: tf, size: 17, color: "#14254a" }, intro: { font: tf, size: Math.round(21 * K), color: tc }, name: { font: d.nameFont || "ibmplexsansarabic", size: Math.round(34 * K), color: d.nameColor || "" },
    body: { font: tf, size: Math.round(21 * K), color: tc }, closing: { font: tf, size: Math.round(21 * K), color: tc }, sign: { font: "notosansarabic", size: 17, color: "#8a6a2e" } };
  const st = d.st || {}; return Object.fromEntries(Object.keys(def).map((k) => [k, { ...def[k], ...(st[k] || {}) }]));
}
export const SIGN_TITLES_DEFAULT = "الموجه الأول للعلوم";
export const GOLD_FONTS = { title: ["Sijil Ruqaa", 700], name: ["Sijil Plex", 700], text: ["Sijil Sans", 500], strong: ["Sijil Sans", 700] };
const C = { ivory: "#fbf6ea", gold: "#b08a3c", gold2: "#d9b867", goldDark: "#8a6a2e", navy: "#14254a", ink: "#1d2333" };
const W = 297, H = 210, CX = W / 2, PT = 0.3528; // 1pt = 0.3528mm
// المساحات الثابتة
export const GOLD_BOX = {
  logoR: { x: 229, y: 15, w: 40, h: 32 }, logoL: { x: 28, y: 15, w: 40, h: 32 },
  title: { y: 33, maxW: 148, pt: 60 }, line1: { y: 58 }, line2: { y: 66.5 },
  intro: { y: 80, lh: 9.4 }, name: { y: 101, pt: 26 }, phrase: { y: 121, lh: 9.4, maxW: 232 }, sign: { x: 72, y: 163 },
};
export const goldDefaults = () => ({ bg: "frame", titleArt: "art", titleColor: "auto", titleText: "شكر وتقدير", line1: "", line2: "",
  intro: "يتقدم التوجيه الفني للعلوم بمنطقة الأحمدي التعليمية بخالص الشكر والتقدير إلى", jobTitle: "المعلمة", phrase: "لجهودها المتميزة وعطائها وإخلاصها في العمل", body: "لجهودها المتميزة وعطائها وإخلاصها في العمل", closing: "مع تمنياتنا لكم بمزيد من التقدم والازدهار",
  nameFont: "plex", nameColor: "", textFont: "notosans", textColor: "#1d2333", sizeK: 100,
  gLogoR: "ministry", gLogoL: "directorate", gLogoR_img: "", gLogoL_img: "", firstSupName: "", signTitle: "الموجه الأول للعلوم",
  gSig: false, gStamp: false, gStamp2: false, gStamp2_img: "", gSig2_img: "",
  sign2On: false, sign2Title: "الموجه الفني", sign2Name: "", signSide: "left", gShowDate: true, gDate: "" });

// قياس النص بنفس الخط المستعمل في الرسم
let mctx = null;
const measure = (text, [fam, w], pt) => { mctx ||= document.createElement("canvas").getContext("2d"); mctx.direction = "rtl"; mctx.font = `${w} ${pt * PT}px "${fam}"`; return mctx.measureText(text).width; };
const wrap = (text, font, pt, maxW) => { const out = []; let cur = "";
  for (const w of String(text).split(/\s+/).filter(Boolean)) { const t = cur ? cur + " " + w : w; if (measure(t, font, pt) > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out; };
// تقسيم متوازن لنفس عدد الأسطر
const balanced = (text, font, pt, maxW) => { const base = wrap(text, font, pt, maxW); if (base.length < 2) return base;
  let lo = maxW / base.length, hi = maxW; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (wrap(text, font, pt, m).length > base.length) lo = m; else hi = m; } return wrap(text, font, pt, hi); };
const fitPt = (text, font, pt, maxW, min) => { let p = pt; while (p > min && measure(text, font, p) > maxW) p -= .5; return p; };

const T = (x, y, text, [fam, w], pt, fill, extra = "") => `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" direction="rtl" unicode-bidi="embed" xml:lang="ar"
  font-family="${fam}" font-weight="${w}" font-size="${(pt * PT).toFixed(3)}" fill="${fill}" ${extra}>${esc(text)}</text>`;

// زخرفة الزاوية (نباتية وهندسية خفيفة): نجمة ثمانية وأغصان، مرسومة لزاوية أعلى اليسار ثم تُعكس
const CORNER = `<g fill="none" stroke="${C.gold}" stroke-linecap="round">
  <path d="M0 21 V0 H21" stroke-width=".45"/><path d="M2.6 15 V2.6 H15" stroke-width=".25"/>
  <g transform="translate(6.2 6.2)"><rect x="-3" y="-3" width="6" height="6" stroke-width=".35"/><rect x="-3" y="-3" width="6" height="6" transform="rotate(45)" stroke-width=".35"/><circle r="1" fill="${C.gold}" stroke="none"/></g>
  <path d="M10.5 6.2 C14 4.6 17.5 5 20.5 7.4" stroke-width=".35"/><path d="M6.2 10.5 C4.6 14 5 17.5 7.4 20.5" stroke-width=".35"/>
  <path d="M14.2 5.2 C15.4 3.4 17.4 2.9 18.6 3.4 C17.6 4.6 16 5.4 14.2 5.2Z" fill="${C.gold}" fill-opacity=".85" stroke="none"/>
  <path d="M5.2 14.2 C3.4 15.4 2.9 17.4 3.4 18.6 C4.6 17.6 5.4 16 5.2 14.2Z" fill="${C.gold}" fill-opacity=".85" stroke="none"/>
  <path d="M17.6 6.6 C19.2 7.2 20.6 8.6 20.9 10.2 C19.4 9.8 18.2 8.4 17.6 6.6Z" fill="${C.gold}" fill-opacity=".6" stroke="none"/>
  <path d="M6.6 17.6 C7.2 19.2 8.6 20.6 10.2 20.9 C9.8 19.4 8.4 18.2 6.6 17.6Z" fill="${C.gold}" fill-opacity=".6" stroke="none"/>
  <circle cx="22.6" cy="0" r=".7" fill="${C.gold}" stroke="none"/><circle cx="0" cy="22.6" r=".7" fill="${C.gold}" stroke="none"/></g>`;
const corners = (inset) => [[inset, inset, 1, 1], [W - inset, inset, -1, 1], [inset, H - inset, 1, -1], [W - inset, H - inset, -1, -1]]
  .map(([x, y, sx, sy]) => `<g transform="translate(${x} ${y}) scale(${sx} ${sy})">${CORNER}</g>`).join("");
// وردة هندسية خفيفة جداً في الخلفية
const rosette = () => { let p = ""; for (let i = 0; i < 12; i++) p += `<ellipse cx="0" cy="-17" rx="5.5" ry="17" transform="rotate(${i * 30})"/>`;
  return `<g transform="translate(${CX} 116)" fill="none" stroke="${C.gold}" stroke-width=".3" opacity=".09">${p}<circle r="34"/><circle r="38"/></g>`; };
const diamond = (x, y, s, fill = C.gold) => `<path d="M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z" fill="${fill}"/>`;

// تحويل أي صورة إلى data URL حتى تُضمَّن داخل SVG وتظهر في الطباعة فوراً
const toDataUrl = async (src) => { if (!src) return ""; if (/^data:/.test(src)) return src;
  try { const b = await (await fetch(src)).blob(); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.onerror = () => r(""); f.readAsDataURL(b); }); } catch (_) { return ""; } };
const imgSize = (src) => new Promise((res) => { if (!src) return res(null); const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res(null); im.src = src; });

// marks: معرّفات ملفات توقيع الموجّه وختمه (من البيانات الرئيسية) عند اختيار إظهارهما
export async function goldResources(d, marks = {}) {
  const { logoSrc } = await import("../store.js");
  const one = async (k, img) => { const src = k === "custom" ? img : k && FORMS.cert.logos[k] ? await logoSrc(FORMS.cert.logos[k][0]) : ""; const u = await toDataUrl(src); return u ? { src: u, size: await imgSize(u) } : null; };
  await loadCertFonts(); await Promise.all(Object.values(styleOf(d)).map((x) => loadTextFont(x.font)));
  const P = GOLD_BGS[d.bg] || GOLD_BGS.frame;
  if (P.img) await new Promise((r) => { const im = new Image(); im.onload = im.onerror = r; im.src = P.img; }); // في الذاكرة قبل المعاينة والطباعة
  const mark = async (fileId) => { if (!fileId) return null; try { const { img } = await import("./builders.js"); const h = await img(fileId, "sig-img"); const u = await toDataUrl((h.match(/src="([^"]+)"/) || [])[1]); return u ? { src: u, size: await imgSize(u) } : null; } catch (_) { return null; } };
  const img2 = async (u) => { const x = u ? await toDataUrl(u) : ""; return x ? { src: x, size: await imgSize(x) } : null; };
  return { R: await one(d.gLogoR, d.gLogoR_img), L: await one(d.gLogoL, d.gLogoL_img),
    sig: d.gSig ? await mark(marks.sig) : null, stamp: d.gStamp ? await mark(marks.stamp) : null, stamp2: d.sign2On ? await img2(d.gStamp2_img) : null, sig2: d.sign2On ? await img2(d.gSig2_img) : null };
}

// يبني الشهادة لاسم واحد. portrait: تُدار داخل صفحة طولية (الآيباد والآيفون)
export function goldSVG(d, name, res, { portrait = false, blank = false, cls = "", me = "" } = {}) {
  const P = GOLD_BGS[d.bg] || GOLD_BGS.frame, dy = P.dy || 0, out = [];
  const B = { ...GOLD_BOX, logoR: P.logoR, logoL: P.logoL, sign: P.sign };
  // بدون السطرين التعريفيين يرتفع باقي الكلام ليملأ المساحة (الشعاران والعنوان والتوقيع ثابتة)
  // المساحة المتاحة للسطر حول المنتصف: داخل المنطقة البيضاء للخلفية وبعيداً عن التوقيع
  const free = BG_FREE[d.bg] || null;
  const room = (y, h = 8) => { let l = 0, r = W;
    if (free) for (let yy = Math.max(0, Math.floor((y - h / 2) / 2)); yy <= Math.min(free[0].length - 1, Math.floor((y + h / 2) / 2)); yy++) { l = Math.max(l, free[0][yy]); r = Math.min(r, free[1][yy]); }
    return Math.max(80, 2 * Math.min(CX - l, r - CX) - 26); }; // هامش 13 مم على الأقل من زخارف الخلفية
  // الخلفية
  if (P.img) out.push(`<image href="${P.img}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>`);
  else out.push(`<rect width="${W}" height="${H}" fill="${C.ivory}"/>`, rosette(),
    `<rect x="7" y="7" width="${W - 14}" height="${H - 14}" fill="none" stroke="${C.gold}" stroke-width=".8"/>`,
    `<rect x="9.6" y="9.6" width="${W - 19.2}" height="${H - 19.2}" fill="none" stroke="${C.gold}" stroke-width=".3"/>`, corners(9.6));
  // الشعاران: داخل مساحتين ثابتتين مع الحفاظ على النسبة
  for (const [k, box] of [["R", B.logoR], ["L", B.logoL]]) { const L = res?.[k]; if (!L?.src) continue;
    const [iw, ih] = L.size || [1, 1], s = Math.min(box.w / iw, box.h / ih), w = iw * s, h = ih * s;
    out.push(`<image class="cg-logo" href="${L.src}" x="${(box.x + (box.w - w) / 2).toFixed(2)}" y="${(box.y + (box.h - h) / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode:multiply"/>`); }
  // العنوان: «شكر وتقدير» بالخط الديواني المرسوم (مسار متجهي)، أو أي عنوان آخر بخط الرقعة. يبقى بين الشعارين
  const title = (d.titleText || "شكر وتقدير").trim(), TB = P.title;
  const tMax = 2 * Math.min(TB.cx - (B.logoL.x + B.logoL.w), B.logoR.x - TB.cx) - 8;
  const col = { gold: "url(#cgG)", black: "#111", navy: C.navy }[d.titleColor && d.titleColor !== "auto" ? d.titleColor : P.titleColor] || "url(#cgG)";
  let tw;
  if (d.titleArt !== "font" && isShukr(title)) {
    let h = TB.h, w = h * TITLE_ART.w / TITLE_ART.h; if (w > tMax) { w = tMax; h = w * TITLE_ART.h / TITLE_ART.w; } tw = w;
    out.push(`<g class="cg-title" transform="translate(${(TB.cx - w / 2).toFixed(2)} ${(TB.y - h / 2).toFixed(2)}) scale(${(w / TITLE_ART.w).toFixed(5)})"><path d="${TITLE_ART.d}" fill="${col}" fill-rule="evenodd"/></g>`);
  } else {
    const tpt = fitPt(title, GOLD_FONTS.title, Math.min(60, TB.h * 2), tMax, 26); tw = Math.min(tMax, measure(title, GOLD_FONTS.title, tpt));
    out.push(T(TB.cx, TB.y, title, GOLD_FONTS.title, tpt, col, `${col.startsWith("url") ? `stroke="${C.navy}" stroke-width=".18" paint-order="stroke"` : ""} class="cg-title"`));
  }
  if (P.divider) { const ly = TB.y + TB.h / 2 + 1;
    out.push(`<path d="M${CX - tw / 2 - 6} ${ly}H${CX - 4}M${CX + 4} ${ly}H${CX + tw / 2 + 6}" stroke="url(#cgL)" stroke-width=".45"/>`, diamond(CX, ly, 1.6), diamond(CX - tw / 2 - 7.5, ly, .8), diamond(CX + tw / 2 + 7.5, ly, .8)); }
  // المحتوى: السطران التعريفيان ← العبارة فوق الاسم ← المسمى والاسم ← العبارة تحت الاسم والختام
  // أحجام متناسقة مع A4 (تُضبط من «حجم الخط»)، ويتوسط الكلام المساحة بين العنوان والتوقيع؛ يصغر بنسبة واحدة إن زاد
  const SS = styleOf(d), FN = (k) => fontOf(SS[k].font, STYLE_PARTS[k][1]);
  const job = String(d.jobTitle || "").trim(), nm = blank ? "" : String(name || "").trim();
  const intro = String(d.intro ?? (d.giver ? "تتقدم " + d.giver : "")).trim();
  const bodySrc = blank ? [] : String(d.body ?? d.phrase ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const closing = blank ? "" : genderClosing(String(d.closing || "").trim(), d.jobTitle);
  const ncol = SS.name.color || P.nameColor || C.navy;
  const top = TB.y + TB.h / 2 + (P.divider ? 5 : 3), bottom = B.sign.y - 19, K = (Number(d.sizeK) || 100) / 100;
  const layout = (f) => { const it = [], wAt = (y, h) => room(y, h);
    const add = (text, k, cls, gapB) => { const pt = SS[k].size * f; it.push({ text, font: FN(k), pt, col: k === "name" ? ncol : SS[k].color, cls, h: pt * PT * 1.62, gapB }); };
    for (const k of ["line1", "line2"]) { const t = String(d[k] || "").trim(); if (t) add(t, "lines", "cg-line", 1); }
    if (it.length) it[it.length - 1].gapB = 5;
    if (intro) balanced(intro, FN("intro"), SS.intro.size * f, wAt(top + 15, 20)).forEach((ln) => add(ln, "intro", "cg-intro", 0));
    if (it.length) it[it.length - 1].gapB = 6;
    it.push({ name: true, h: SS.name.size * f * PT * 1.45, pt: SS.name.size * f, gapB: 9 });
    if (bodySrc.length) bodySrc.forEach((x) => balanced(x, FN("body"), SS.body.size * f, wAt((top + bottom) / 2 + 20, 40)).forEach((ln) => add(ln, "body", "cg-body", 0)));
    else if (!closing) it.push({ dots: true, h: 22, gapB: 0 });
    if (closing) { if (it.length) it[it.length - 1].gapB = 1.5; balanced(closing, FN("closing"), SS.closing.size * f, wAt(bottom - 10, 12)).forEach((ln) => add(ln, "closing", "cg-closing", 0)); }
    it[it.length - 1].gapB = 0; return it; };
  const total = (it) => it.reduce((a, x) => a + x.h + x.gapB, 0);
  let f = 1, items = layout(f); while (total(items) > bottom - top && f > .55) { f -= .03; items = layout(f); }
  // المساحة الزائدة: تُوسَّع الفراغات بين المجموعات قليلاً ثم يتوسط الكلام
  const extra = Math.max(0, bottom - top - total(items)), groups = items.filter((x) => x.gapB >= 5), add1 = groups.length ? Math.min(7, extra * .45 / groups.length) : 0;
  groups.forEach((x) => (x.gapB += add1));
  let y = top + Math.max(0, (bottom - top - total(items)) / 2);
  for (const x of items) {
    const cy = y + x.h / 2;
    if (x.name) {
      const t = (job ? job + " " : "") + nm, nmax = Math.min(250, room(cy, x.h));
      if (nm) out.push(T(CX, cy, t, FN("name"), fitPt(t, FN("name"), x.pt, nmax, 12), ncol, 'class="cg-name"'));
      else { if (job) out.push(T(CX + 50, cy, job, FN("name"), x.pt * .8, ncol)); out.push(`<path d="M${CX - 85} ${cy + 5}H${CX + 28}" stroke="#777" stroke-width=".3" stroke-dasharray="1 1.6"/>`); }
      const oy = y + x.h + 2.5; out.push(`<path d="M${CX - 70} ${oy}H${CX - 3.5}M${CX + 3.5} ${oy}H${CX + 70}" stroke="url(#cgL)" stroke-width=".45"/>`, diamond(CX, oy, 1.5));
    } else if (x.dots) { for (const [i, w] of [[0, 200], [1, 150]]) out.push(`<path d="M${CX - w / 2} ${y + 6 + i * 11}H${CX + w / 2}" stroke="#777" stroke-width=".3" stroke-dasharray="1 1.6"/>`); }
    else out.push(T(CX, cy, x.text, x.font, fitPt(x.text, x.font, x.pt, room(cy, x.h), 10), x.col, x.cls ? `class="${x.cls}"` : ""));
    y += x.h + x.gapB;
  }
  // خانات التوقيع: لكل شخص جهة (يمين أو يسار، يختارها المستخدم) وتحت بعض: المسمى ← الاسم ← (التوقيع + الختم) ← التاريخ
  const sY = B.sign.y - 10, SL = { x: B.sign.x, y: sY }, SR = { x: W - B.sign.x, y: sY }, sF = FN("sign"), sP = SS.sign.size;
  const two = !!d.sign2On, A = d.signSide === "right" ? SR : SL, Bp = A === SL ? SR : SL;
  const norm = (x) => String(x || "").replace(/\s+/g, " ").trim();
  const isMe = (title, person) => (me && norm(person) && norm(person) === norm(me)) || (/الموجه(ة)?\s+الفني(ة)?/.test(title || "") && !/الأول|الأولى/.test(title || ""));
  const tA = d.signTitle ?? SIGN_TITLES_DEFAULT, meA = isMe(tA, d.firstSupName), meB = two && isMe(d.sign2Title, d.sign2Name);
  const mine = meB && (!meA || (me && norm(d.sign2Name) === norm(me))) ? "B" : "A"; // خانة توقيعي وختمي
  const put = (L, box, cls) => { if (!L?.src) return null; const [iw, ih] = L.size || [1, 1], s = Math.min(box.w / iw, box.h / ih), w = iw * s, h = ih * s;
    const y = box.y + (box.h - h) / 2;
    out.push(`<image class="${cls}" href="${L.src}" x="${(box.x + (box.w - w) / 2).toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode:multiply"/>`); return y + h; };
  const dateTxt = (() => { if (blank || d.gShowDate === false) return ""; const iso = d.gDate || new Date().toISOString().slice(0, 10), [yy, mm, dd] = iso.split("-"); return yy && mm && dd ? `التاريخ: ${Number(dd)}/${Number(mm)}/${yy}` : ""; })();
  // marks: صورتا الختم والتوقيع لصاحب الخانة (لي: ختمي وتوقيعي، وللآخر: ختمه وتوقيعه المرفوعان)
  const signAt = (S, title, person, cls, isMine, marks = {}) => {
    const sT = String(title || "").trim(), sup = blank ? "" : String(person || "").trim();
    if (sT) out.push(T(S.x, S.y, sT, sF, fitPt(sT, sF, sP, 76, 10), SS.sign.color, `class="cg-sign ${cls}"`));
    let y = S.y + 3;
    if (sup) { out.push(T(S.x, S.y + sP * PT * 1.55, "أ/ " + sup, sF, fitPt("أ/ " + sup, sF, sP * .92, 76, 10), C.navy, `class="cg-sup ${cls}"`)); y = S.y + sP * PT * 1.55 + 3; }
    // تحت الاسم في سطر واحد: التوقيع (يميناً) + الختم (يساراً)، وإن وُجد أحدهما فقط يتوسط
    const hasS = !blank && marks.sig?.src, hasT = !blank && marks.stamp?.src, both = hasS && hasT;
    const sg = hasS ? put(marks.sig, both ? { x: S.x + 0.5, y: y + 1.5, w: 30, h: 14 } : { x: S.x - 17, y: y + 1, w: 34, h: 15 }, isMine ? "cg-sigimg" : "cg-sig2img") : null;
    const st = hasT ? put(marks.stamp, both ? { x: S.x - 27.5, y: y, w: 26, h: 17 } : { x: S.x - 13, y: y, w: 26, h: 17 }, isMine ? "cg-stampimg" : "cg-stamp2") : null;
    const sgTop = y + 1;
    let after;
    if (sg || st) after = Math.max(sg || 0, st || 0) + 4.2;
    else { const ly = Math.max(sgTop + 10, S.y + 22); out.push(`<path d="M${S.x - 30} ${ly}H${S.x + 30}" stroke="${C.goldDark}" stroke-width=".3" stroke-dasharray="1 1.4"/>`, T(S.x, ly + 4.5, "التوقيع", GOLD_FONTS.text, 9.5, "#8b7d63")); after = ly + 9.5; }
    if (isMine && dateTxt) out.push(T(S.x, Math.min(after, H - 13), dateTxt, sF, Math.max(10, sP * .7), C.navy, `class="cg-date ${cls}"`));
    return { st };
  };
  const myM = { stamp: res?.stamp, sig: res?.sig }, oM = { stamp: res?.stamp2, sig: res?.sig2 };
  signAt(A, tA, d.firstSupName, "s1", mine === "A", mine === "A" ? myM : two ? oM : {});
  if (two) signAt(Bp, d.sign2Title, d.sign2Name, "s2", mine === "B", mine === "B" ? myM : oM);
  const defs = `<defs><linearGradient id="cgG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9cf86"/><stop offset=".5" stop-color="${C.gold}"/><stop offset="1" stop-color="#8a6526"/></linearGradient>
    <linearGradient id="cgL" gradientUnits="userSpaceOnUse" x1="${CX - 100}" y1="0" x2="${CX + 100}" y2="0"><stop offset="0" stop-color="${C.gold}" stop-opacity="0"/><stop offset=".5" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></linearGradient></defs>`;
  const body = defs + out.join("");
  const lbl = esc(nm || "شهادة");
  return portrait
    ? `<svg class="ce-img por ${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${H} ${W}" width="${H}mm" height="${W}mm" role="img" aria-label="${lbl}" data-name="${esc(nm)}"><g transform="translate(${H} 0) rotate(90)">${body}</g></svg>`
    : `<svg class="ce-img lan ${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" role="img" aria-label="${lbl}" data-name="${esc(nm)}">${body}</svg>`;
}
