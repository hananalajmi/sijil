// إضافة أسماء المعلمات بسرعة: لصق قائمة كما هي (من Excel أو واتساب أو Word) أو رفع ملف Excel / Word / CSV.
// يُلتقط ما يشبه الاسم من كل سطر (وتُحذف الأرقام والترقيم والأعمدة الأخرى)، ثم تؤكد الموجهة قبل الإضافة.
import { cleanName, looksLikeName } from "./pdfnames.js";

const PREFIX = /^[\s\d٠-٩.\-–—)(:*•·]+/; // ترقيم في أول السطر: 1- / ١) / • ...
// عناوين الأعمدة والمجاميع (لا تُعد أسماء إذا كُتبت وحدها في سطر)
const HEADER = /^(م|ر|الرقم|رقم|الاسم|اسم|اسم المعلم|اسم المعلمة|الاسم الثلاثي|المعلمات|المعلمين|الجنسية|الحصص|النصاب|المجموع|الإجمالي|العدد|المادة|القسم|ملاحظات)$/;
const TITLE = /^(أ|ا|الأستاذة|الاستاذة|الأستاذ|الاستاذ|المعلمة|المعلم|د)\s*[\/.:]?\s+/;

// من كل سطر: الخلية التي تشبه الاسم، أو السطر نفسه بعد تنظيفه
function pick(line, strict = false) {
  const cells = line.split(/\t|\||,|،|;|\s{3,}/).map((c) => cleanName(c.replace(PREFIX, "").replace(TITLE, ""))).filter(Boolean);
  const named = cells.filter((c) => looksLikeName(c));
  if (named.length) return named;
  const whole = cleanName(line.replace(/\d+/g, " ").replace(PREFIX, "").replace(TITLE, ""));
  // سطر بخلية واحدة (مثل «سارة») يُقبل إن لم يكن عنواناً أو مجموعاً
  if (strict) return looksLikeName(whole) ? [whole] : []; // من ملف: يُستبعد ما يشبه العناوين (ميزانية، قسم، ...)
  return cells.length <= 1 && whole && /^[ء-ي\s]+$/.test(whole) && whole.split(" ").length <= 6 && !HEADER.test(whole) ? [whole] : [];
}

export function namesFromText(text, { strict = false } = {}) {
  const seen = new Set(), out = [];
  for (const line of String(text || "").split(/\r?\n/)) for (const n of pick(line, strict)) if (!seen.has(n)) { seen.add(n); out.push(n); }
  return out;
}

/* ---------- قراءة ملف Excel (xlsx) دون مكتبات: الملف مضغوط (zip) وفيه نصوص الخلايا بصيغة XML ---------- */
async function unzip(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf), files = {};
  let e = buf.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("not zip");
  let p = v.getUint32(e + 16, true);
  const n = v.getUint16(e + 10, true);
  for (let i = 0; i < n; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if (!/^(xl\/(sharedStrings|worksheets\/sheet\d+)|word\/document)\.xml$/.test(name)) continue;
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
    const raw = u8.subarray(start, start + size);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    else continue;
    files[name] = new TextDecoder().decode(data);
  }
  return files;
}
const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d)).replace(/&amp;/g, "&");

export async function namesFromFile(file) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt") || /text\//.test(file.type)) return namesFromText(await file.text(), { strict: true });
  if (name.endsWith(".doc")) throw new Error("ملف Word قديم (doc). افتحيه في Word واحفظيه بصيغة docx، أو انسخي الأسماء والصقيها.");
  if (name.endsWith(".xls")) throw new Error("ملف Excel قديم (xls). افتحيه في Excel واحفظيه بصيغة xlsx، أو انسخي عمود الأسماء والصقيه.");
  let files;
  try { files = await unzip(await file.arrayBuffer()); } catch (_) { throw new Error("تعذّرت قراءة الملف. ارفعي ملف Excel (xlsx) أو Word (docx)، أو انسخي الأسماء والصقيها."); }
  // ملف Word: كل خلية جدول نص منفصل، وكل فقرة خارج الجداول سطر (مثل قائمة مرقمة)
  const doc = files["word/document.xml"];
  if (doc) {
    const wt = (x) => unxml((x.match(/<w:t[ >][^<]*<\/w:t>|<w:t>[^<]*<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, "")).join(""));
    const seen = new Set(), out = [];
    const take = (arr) => { for (const n of arr) if (!seen.has(n)) { seen.add(n); out.push(n); } };
    for (const tc of doc.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) || []) {
      const t = (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(wt).join(" ");
      const n = cleanName(t.replace(PREFIX, "").replace(TITLE, ""));
      if (looksLikeName(n)) take([n]);
    }
    const outside = doc.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, "");
    take(namesFromText((outside.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(wt).join("\n"), { strict: true }));
    return out;
  }
  // نصوص كل الخلايا (المشتركة والمكتوبة مباشرة)، سطر لكل خلية
  const texts = [];
  const sst = files["xl/sharedStrings.xml"] || "";
  for (const si of sst.match(/<si>[\s\S]*?<\/si>/g) || []) texts.push(unxml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, "")).join("")));
  for (const [k, xml] of Object.entries(files)) if (k.includes("worksheets")) for (const m of xml.match(/<is>[\s\S]*?<\/is>/g) || []) texts.push(unxml(m.replace(/<[^>]+>/g, "")));
  // في ملف Excel كل خلية منفصلة، فنأخذ ما يشبه الاسم فقط
  const seen = new Set(), out = [];
  for (const t of texts) { const n = cleanName(t.replace(PREFIX, "").replace(TITLE, "")); if (looksLikeName(n) && !seen.has(n)) { seen.add(n); out.push(n); } }
  return out;
}
