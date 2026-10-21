// إنشاء ملف PDF من صفحات المعاينة مباشرة (للرفع إلى الدرايف): كل صفحة تُرسم بمحرك المتصفح نفسه
// (نفس الخطوط والاتجاه والتنسيق) كصورة عالية الدقة، ثم تُجمع في ملف PDF بمقاس A4 الحقيقي.
// لا مكتبات خارجية: الخطوط والصور تُضمَّن داخل الصفحة قبل رسمها.
import { CERT_FONT_FILES } from "./builders4.js";

const toDataUrl = async (url) => {
  if (!url || url.startsWith("data:")) return url;
  try { const b = await (await fetch(url)).blob(); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.onerror = () => r(url); f.readAsDataURL(b); }); }
  catch (_) { return url; }
};

// CSS الموقع (الملفات المحلية + المتغيرات) — قواعد الطباعة لا تلزم لأن الرسم بوضع الشاشة
function siteCss() {
  let out = "";
  for (const ss of document.styleSheets) {
    let rules; try { rules = ss.cssRules; } catch (_) { continue; }
    for (const r of rules) { if (r.type === CSSRule.FONT_FACE_RULE) continue; out += r.cssText + "\n"; }
  }
  return out;
}

// الخطوط المستعملة في الصفحات فقط، مضمّنة كبيانات داخل الصورة
const fontCache = new Map();
async function fontCss(root) {
  const used = new Set();
  root.querySelectorAll("*").forEach((el) => { const f = (el.getAttribute?.("font-family") || getComputedStyle(el).fontFamily || "").split(",")[0]; if (f) used.add(f.replace(/["']/g, "").trim()); });
  const faces = [];
  // خطوط الموقع المحلية (الشهادات وغيرها)
  const { TEXT_FONTS } = await import("./certGolden.js").catch(() => ({ TEXT_FONTS: {} }));
  const local = [...CERT_FONT_FILES.map(([fam, url, w]) => [fam, url, w]), ...Object.values(TEXT_FONTS).flatMap(([fam, , files]) => (files || []).map(([url, w]) => [fam, url, w]))];
  for (const [fam, url, w] of local) if (used.has(fam)) faces.push({ fam, url: new URL(url, document.baseURI).href, w, fmt: "woff" });
  // خطوط Google المحمّلة في الصفحة (مثل خط واجهة الموقع أو خط الطباعة المختار)
  for (const l of document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com"]')) {
    try { const css = await (await fetch(l.href)).text();
      for (const m of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
        const fam = (m[1].match(/font-family:\s*['"]?([^;'"]+)/) || [])[1], url = (m[1].match(/url\(([^)]+)\)/) || [])[1];
        const w = (m[1].match(/font-weight:\s*([^;]+)/) || [])[1] || "400", ur = (m[1].match(/unicode-range:\s*([^;]+)/) || [])[1];
        if (fam && url && used.has(fam.trim()) && (!ur || /U\+06|U\+FE|U\+FB|U\+0-|U\+0000|U\+20/.test(ur))) faces.push({ fam: fam.trim(), url, w: w.trim(), fmt: "woff2", ur });
      } } catch (_) {}
  }
  let css = "";
  for (const f of faces) {
    if (!fontCache.has(f.url)) fontCache.set(f.url, toDataUrl(f.url));
    css += `@font-face{font-family:"${f.fam}";font-weight:${f.w};src:url(${await fontCache.get(f.url)}) format("${f.fmt}");${f.ur ? `unicode-range:${f.ur};` : ""}}\n`;
  }
  return css;
}

// نسخة من الصفحة بصور مضمّنة
async function inlineClone(sheet) {
  const c = sheet.cloneNode(true);
  c.style.margin = "0"; c.style.transform = "none"; c.style.zoom = "";
  await Promise.all([...c.querySelectorAll("img")].map(async (im) => { im.setAttribute("src", await toDataUrl(im.getAttribute("src"))); im.removeAttribute("srcset"); }));
  await Promise.all([...c.querySelectorAll("image")].map(async (im) => { const h = im.getAttribute("href") || im.getAttribute("xlink:href"); if (h) im.setAttribute("href", await toDataUrl(new URL(h, document.baseURI).href)); }));
  return c;
}

// رسم صفحة واحدة: SVG بداخله HTML (foreignObject) ← لوحة ← JPEG
async function renderSheet(sheet, css, scale) {
  const r = sheet.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
  const clone = await inlineClone(sheet);
  const html = new XMLSerializer().serializeToString(clone);
  const dir = document.documentElement.getAttribute("dir") || "rtl";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" dir="${dir}" lang="ar" style="width:${w}px;height:${h}px;background:#fff;overflow:hidden"><style>${css.replace(/<\/style/gi, "<\\/style")}</style><div class="sheets" style="display:block;padding:0;margin:0;gap:0;background:none;width:${w}px">${html}</div></div></foreignObject></svg>`;
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("تعذر رسم الصفحة")); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
  if (img.decode) await img.decode().catch(() => {});
  await new Promise((r2) => setTimeout(r2, 60));
  const cv = document.createElement("canvas"); cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
  const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
  let data; try { data = cv.toDataURL("image/jpeg", 0.9); } catch (_) { const e = new Error("هذا المتصفح لا يسمح بإنشاء PDF مباشرة. احفظيه من «طباعة / حفظ PDF» ثم ارفعيه للدرايف"); e.tainted = true; throw e; }
  const out = { jpeg: Uint8Array.from(atob(data.split(",")[1]), (ch) => ch.charCodeAt(0)), w: cv.width, h: cv.height, land: w > h };
  cv.width = cv.height = 0; return out;
}

// كاتب PDF بسيط: صورة JPEG واحدة تملأ كل صفحة A4
function buildPdf(pages) {
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const push = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n`); for (const b of [].concat(body)) push(b); push("\nendobj\n"); };
  const N = pages.length, kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${N} >>`);
  pages.forEach((p, i) => {
    const pg = 3 + i * 3, im = pg + 1, ct = pg + 2, W = p.land ? 841.89 : 595.28, H = p.land ? 595.28 : 841.89;
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    obj(im, [`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, "\nendstream"]);
    const s = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    obj(ct, `<< /Length ${s.length} >>\nstream\n${s}\nendstream`);
  });
  const total = 3 + N * 3, xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) push(String(offs[n]).padStart(10, "0") + " 00000 n \n");
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: "application/pdf" });
}

// container: عنصر المعاينة الذي فيه الصفحات (.sheet)
export async function sheetsToPdf(container, { scale = 2.6, onProgress } = {}) {
  const sheets = [...container.querySelectorAll(".sheet")];
  if (!sheets.length) throw new Error("لا توجد صفحات");
  if (document.fonts?.ready) await document.fonts.ready;
  const css = siteCss() + (await fontCss(container));
  const pages = [];
  for (let i = 0; i < sheets.length; i++) {
    onProgress?.(i + 1, sheets.length);
    pages.push(await renderSheet(sheets[i], css, scale));
  }
  return buildPdf(pages);
}
