// قالب «الشهادة الرسمية الذهبية»: يُرسم كعنصر SVG متجهي (نصوص حقيقية بخطوط مضمّنة، وزخارف وإطار متجهية)
// فيُطبع ويُحفظ PDF بدقة كاملة، والخطوط تُضمَّن داخل ملف PDF، ولا تُستعمل لقطة شاشة.
// أماكن العناصر ثابتة في كل الشهادات (بالمليمتر على صفحة A4 أفقية 297×210):
//   الشعاران أعلى اليمين واليسار — العنوان في المنتصف أعلى — السطران التعريفيان — «تتقدم …» — المسمى — الاسم داخل إطار — العبارة — توقيع الموجه الأول أسفل اليسار. لا يوجد تاريخ.
import { esc } from "../ui.js";
import { FORMS } from "../templates.js";
import { loadCertFonts } from "./builders4.js";

export const GOLD_FONTS = { title: ["Sijil Ruqaa", 700], name: ["Sijil Plex", 700], text: ["Sijil Sans", 500], strong: ["Sijil Sans", 700] };
const C = { ivory: "#fbf6ea", gold: "#b08a3c", gold2: "#d9b867", goldDark: "#8a6a2e", navy: "#14254a", ink: "#1d2333" };
const W = 297, H = 210, CX = W / 2, PT = 0.3528; // 1pt = 0.3528mm
// المساحات الثابتة
export const GOLD_BOX = {
  logoR: { x: 229, y: 15, w: 40, h: 32 }, logoL: { x: 28, y: 15, w: 40, h: 32 },
  title: { y: 33, maxW: 148, pt: 60 }, line1: { y: 58 }, line2: { y: 66.5 },
  giver: { y: 80 }, job: { y: 91 }, name: { y: 106, h: 19, minW: 120, maxW: 232, pt: 28 },
  phrase: { y: 126.5, lh: 9.6, maxLines: 3, maxW: 226 }, sign: { x: 72, y: 163 },
};
export const goldDefaults = () => ({ titleText: "شكر وتقدير", line1: "", line2: "", giver: "", jobTitle: "المعلمة الفاضلة", phrase: "لجهودها المتميزة وعطائها وإخلاصها في العمل", phrase2: "",
  gLogoR: "ministry", gLogoL: "directorate", gLogoR_img: "", gLogoL_img: "", firstSupName: "" });

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

export async function goldResources(d) {
  const { logoSrc } = await import("../store.js");
  const one = async (k, img) => { const src = k === "custom" ? img : k && FORMS.cert.logos[k] ? await logoSrc(FORMS.cert.logos[k][0]) : ""; const u = await toDataUrl(src); return u ? { src: u, size: await imgSize(u) } : null; };
  await loadCertFonts();
  return { R: await one(d.gLogoR, d.gLogoR_img), L: await one(d.gLogoL, d.gLogoL_img) };
}

// يبني الشهادة لاسم واحد. portrait: تُدار داخل صفحة طولية (الآيباد والآيفون)
export function goldSVG(d, name, res, { portrait = false, blank = false, cls = "" } = {}) {
  const B = GOLD_BOX, out = [];
  // الخلفية والإطار
  out.push(`<rect width="${W}" height="${H}" fill="${C.ivory}"/>`, rosette(),
    `<rect x="7" y="7" width="${W - 14}" height="${H - 14}" fill="none" stroke="${C.gold}" stroke-width=".8"/>`,
    `<rect x="9.6" y="9.6" width="${W - 19.2}" height="${H - 19.2}" fill="none" stroke="${C.gold}" stroke-width=".3"/>`, corners(9.6));
  // الشعاران: داخل مساحتين ثابتتين مع الحفاظ على النسبة
  for (const [k, box] of [["R", B.logoR], ["L", B.logoL]]) { const L = res?.[k]; if (!L?.src) continue;
    const [iw, ih] = L.size || [1, 1], s = Math.min(box.w / iw, box.h / ih), w = iw * s, h = ih * s;
    out.push(`<image href="${L.src}" x="${(box.x + (box.w - w) / 2).toFixed(2)}" y="${(box.y + (box.h - h) / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode:multiply"/>`); }
  // العنوان المزخرف: ذهبي متدرج بحد كحلي رفيع، يصغر تلقائياً ليبقى بين الشعارين
  const title = (d.titleText || "شكر وتقدير").trim(), tpt = fitPt(title, GOLD_FONTS.title, B.title.pt, B.title.maxW, 30);
  out.push(T(CX, B.title.y, title, GOLD_FONTS.title, tpt, "url(#cgG)", `stroke="${C.navy}" stroke-width=".18" paint-order="stroke" class="cg-title"`));
  const tw = Math.min(B.title.maxW, measure(title, GOLD_FONTS.title, tpt)), ly = B.title.y + 13.5;
  out.push(`<path d="M${CX - tw / 2 - 6} ${ly}H${CX - 4}M${CX + 4} ${ly}H${CX + tw / 2 + 6}" stroke="url(#cgL)" stroke-width=".45"/>`, diamond(CX, ly, 1.6), diamond(CX - tw / 2 - 7.5, ly, .8), diamond(CX + tw / 2 + 7.5, ly, .8));
  // السطران التعريفيان (فارغان افتراضياً)
  for (const [k, box] of [["line1", B.line1], ["line2", B.line2]]) { const t = String(d[k] || "").trim(); if (t) out.push(T(CX, box.y, t, GOLD_FONTS.strong, fitPt(t, GOLD_FONTS.strong, 15, 210, 10), C.navy)); }
  // الجهة المانحة
  const giver = String(d.giver || "").trim();
  out.push(giver && !blank ? T(CX, B.giver.y, "تتقدم " + giver, GOLD_FONTS.text, fitPt("تتقدم " + giver, GOLD_FONTS.text, 17, 236, 11), C.ink)
    : T(CX, B.giver.y, "تتقدم ……………………………………………", GOLD_FONTS.text, 17, C.ink));
  // المسمى الوظيفي
  const job = String(d.jobTitle || "").trim(); if (job) out.push(T(CX, B.job.y, job, GOLD_FONTS.strong, fitPt(job, GOLD_FONTS.strong, 18, 200, 12), C.navy));
  // الاسم داخل إطار زخرفي يتكيّف مع طوله
  const nm = blank ? "" : String(name || "").trim(), npt = nm ? fitPt(nm, GOLD_FONTS.name, B.name.pt, B.name.maxW - 26, 16) : B.name.pt;
  const fw = Math.max(B.name.minW, Math.min(B.name.maxW, (nm ? measure(nm, GOLD_FONTS.name, npt) : 90) + 28)), fx = CX - fw / 2, fy = B.name.y - B.name.h / 2;
  out.push(`<g fill="none" stroke="${C.gold}"><rect class="cg-frame" x="${fx}" y="${fy}" width="${fw}" height="${B.name.h}" rx="3" stroke-width=".5"/><rect x="${fx + 1.3}" y="${fy + 1.3}" width="${fw - 2.6}" height="${B.name.h - 2.6}" rx="2.2" stroke-width=".22"/></g>`,
    diamond(fx, B.name.y, 1.7), diamond(fx + fw, B.name.y, 1.7), diamond(CX, fy, 1.1), diamond(CX, fy + B.name.h, 1.1));
  out.push(nm ? T(CX, B.name.y + .4, nm, GOLD_FONTS.name, npt, C.navy, 'class="cg-name"') : `<path d="M${CX - 60} ${B.name.y + 4}H${CX + 60}" stroke="#777" stroke-width=".3" stroke-dasharray="1 1.6"/>`);
  // العبارة (سطر أو سطران) + سطر ثانٍ اختياري — داخل مساحة ثابتة لا تؤثر على التوقيع
  let ppt = 17, lines = [];
  const build = (p) => [...(d.phrase ? balanced(d.phrase, GOLD_FONTS.text, p, B.phrase.maxW) : []), ...(d.phrase2 ? balanced(d.phrase2, GOLD_FONTS.text, p, B.phrase.maxW) : [])];
  if (!blank) { lines = build(ppt); while (lines.length > B.phrase.maxLines && ppt > 12) { ppt -= .5; lines = build(ppt); } lines = lines.slice(0, B.phrase.maxLines); }
  const lh = B.phrase.lh * ppt / 17;
  if (lines.length) lines.forEach((ln, i) => out.push(T(CX, B.phrase.y + i * lh, ln, GOLD_FONTS.text, ppt, C.ink)));
  else for (const [i, w] of [[0, 200], [1, 150]]) out.push(`<path d="M${CX - w / 2} ${B.phrase.y + 3 + i * 10}H${CX + w / 2}" stroke="#777" stroke-width=".3" stroke-dasharray="1 1.6"/>`);
  // التوقيع: أسفل اليسار دائماً
  const S = B.sign, sup = blank ? "" : String(d.firstSupName || "").trim();
  out.push(T(S.x, S.y, "الموجه الأول للعلوم", GOLD_FONTS.strong, 15, C.goldDark));
  if (sup) out.push(T(S.x, S.y + 8, "أ/ " + sup, GOLD_FONTS.name, 13.5, C.navy));
  out.push(`<path d="M${S.x - 30} ${S.y + 26}H${S.x + 30}" stroke="${C.goldDark}" stroke-width=".3" stroke-dasharray="1 1.4"/>`, T(S.x, S.y + 30.5, "التوقيع", GOLD_FONTS.text, 9.5, "#8b7d63"));
  const defs = `<defs><linearGradient id="cgG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9cf86"/><stop offset=".5" stop-color="${C.gold}"/><stop offset="1" stop-color="#8a6526"/></linearGradient>
    <linearGradient id="cgL" gradientUnits="userSpaceOnUse" x1="${CX - 100}" y1="0" x2="${CX + 100}" y2="0"><stop offset="0" stop-color="${C.gold}" stop-opacity="0"/><stop offset=".5" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></linearGradient></defs>`;
  const body = defs + out.join("");
  const lbl = esc(nm || "شهادة");
  return portrait
    ? `<svg class="ce-img por ${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${H} ${W}" width="${H}mm" height="${W}mm" role="img" aria-label="${lbl}" data-name="${esc(nm)}"><g transform="translate(${H} 0) rotate(90)">${body}</g></svg>`
    : `<svg class="ce-img lan ${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" role="img" aria-label="${lbl}" data-name="${esc(nm)}">${body}</svg>`;
}
