// استخراج أسماء المعلمين من ملف PDF (ميزانية المدرسة) — يعمل مع ملفات PDF النصية فقط (الصادرة من Word/Excel)
// يقرأ النص، يقسمه إلى خلايا، ثم يقترح ما يشبه الأسماء لتؤكده المستخدمة قبل الإضافة.

export const NOT_NAME = /(ميزاني|مدرس|ثانوي|متوسط|ابتدائ|الإدار|وزار|التربي|التعليم|منطق|العدد|المجموع|الفصل|الفصول|الصف|الحصص|حصة|الطلاب|طالب|الماد|التخصص|كيمياء|فيزياء|أحياء|احياء|علوم|جيولوجيا|رئيس|القسم|معلم أول|ملاحظ|الجنسي|الخبر|النصاب|المساند|المسمى|الوظيف|كويتي|غير كويتي|مصري|أردني|سوري|التوقيع|المدير|اسم|العام|الدراسي|التوجيه|الفني|بيانات|عاشر|عشر|المرحلة|الإجمالي|المطلوب|الموجود|العجز|الزيادة|اللازم)/;
const ARABIC_ONLY = /^[ء-ي٠-٩ٰ-ۓ\s.ـ]+$/;

let lib;
async function pdfjs() {
  if (lib) return lib;
  lib = await import("./vendor/pdfjs/pdf.min.mjs");
  lib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
  return lib;
}

export function cleanName(s) {
  return s.replace(/[ـ]/g, "").replace(/^(أ|ا)\s*[\/.]\s*/, "").replace(/\s+/g, " ").trim();
}
export function looksLikeName(s) {
  const t = cleanName(s);
  if (!t || !ARABIC_ONLY.test(t)) return false;
  const words = t.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 6) return false;
  if (words.some((w) => w.length < 2 && w !== "و")) return false;
  return !NOT_NAME.test(t);
}

// يعيد قائمة الأسماء المقترحة (بدون تكرار) أو يرمي خطأ مفهوماً
export async function namesFromPdf(file) {
  const { getDocument } = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await getDocument({ data, isEvalSupported: false }).promise;
  const cells = [];
  let chars = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // 1) تجميع العناصر في أسطر حسب الارتفاع، ثم في خلايا حسب المسافة الأفقية
    const lines = new Map();
    for (const it of tc.items) {
      const str = (it.str || "").trim(); if (!str) continue;
      chars += str.length;
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y).push({ x: it.transform[4], w: it.width || 0, h: Math.abs(it.height || it.transform[3] || 10), s: str });
    }
    const pageCells = [];
    for (const [y, items] of lines) {
      items.sort((a, b) => b.x - a.x); // من اليمين لليسار
      let cell = [items[0]];
      const flush = () => pageCells.push({ y, x1: Math.min(...cell.map((c) => c.x)), x2: Math.max(...cell.map((c) => c.x + c.w)), h: Math.max(...cell.map((c) => c.h)), s: cell.map((c) => c.s).join(" ") });
      for (let i = 1; i < items.length; i++) {
        const prev = cell[cell.length - 1], cur = items[i];
        if (prev.x - (cur.x + cur.w) > 12) { flush(); cell = [cur]; } else cell.push(cur);
      }
      flush();
    }
    // 2) دمج الاسم الملتف على سطرين داخل الخلية نفسها (نفس العمود، والسطر التالي مباشرة)
    pageCells.sort((a, b) => b.y - a.y);
    const perLine = new Map(); pageCells.forEach((c) => perLine.set(c.y, (perLine.get(c.y) || 0) + 1));
    const used = new Set();
    for (let i = 0; i < pageCells.length; i++) {
      if (used.has(i)) continue;
      let c = { ...pageCells[i] };
      for (let j = i + 1; j < pageCells.length; j++) {
        const n = pageCells[j];
        if (used.has(j)) continue;
        const dy = c.y - n.y;
        if (dy > c.h * 1.45) break;
        const overlap = Math.min(c.x2, n.x2) - Math.max(c.x1, n.x1);
        // السطر الملتف يكون وحيداً في سطره (لا خلايا أخرى بجانبه)، بخلاف بداية صف جديد في الجدول
        if (dy > 0 && overlap > 0 && perLine.get(n.y) === 1 && ARABIC_ONLY.test(c.s) && ARABIC_ONLY.test(n.s) && !NOT_NAME.test(n.s)) { c = { ...c, y: n.y, s: c.s + " " + n.s, x1: Math.min(c.x1, n.x1), x2: Math.max(c.x2, n.x2) }; used.add(j); }
      }
      cells.push(c.s);
    }
  }
  if (chars < 10) throw new Error("هذا الملف مصوَّر (بالكاميرا أو CamScanner) فهو صورة وليس نصاً، ولا يمكن قراءة الأسماء منه. استخدمي ملف PDF المحفوظ من Excel أو Word، أو أضيفي الأسماء يدوياً.");
  const seen = new Set(), out = [];
  for (const c of cells) {
    const n = cleanName(c);
    if (looksLikeName(n) && !seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

// نص الملف كاملاً (سطراً سطراً) — لاستخراج اسم المدرسة من ملف الميزانية
export async function textFromPdf(file, maxPages = 3) {
  const { getDocument } = await pdfjs();
  const doc = await getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const out = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const tc = await (await doc.getPage(p)).getTextContent(), lines = new Map();
    for (const it of tc.items) { const s = (it.str || "").trim(); if (!s) continue; const y = Math.round(it.transform[5] / 3) * 3; if (!lines.has(y)) lines.set(y, []); lines.get(y).push([it.transform[4], s]); }
    [...lines.entries()].sort((a, b) => b[0] - a[0]).forEach(([, its]) => out.push(its.sort((a, b) => b[0] - a[0]).map((x) => x[1]).join(" ")));
  }
  return out.join("\n");
}
// اسم المدرسة من نص الميزانية: أول «ثانوية/متوسطة/ابتدائية/مدرسة …» (ليس عنواناً عاماً)
export function schoolNameFromText(text) {
  const lines = String(text || "").split(/\n+/).map((l) => l.replace(/[ـ]/g, "").replace(/\s+/g, " ").trim()).filter(Boolean);
  for (const l of lines) {
    const m = l.match(/(?:^|[\s:(])((?:مدرسة|ثانوية|متوسطة|ابتدائية|روضة)\s+[^\d:،,()\/|«»"]{2,45})/);
    if (!m) continue;
    let n = m[1].replace(/\s+(العام|للعام|الدراسي|ميزانية|الميزانية|الفصل|منطقة|التابعة|بمنطقة).*$/, "").trim();
    if (/ميزاني|الإدار|وزار|منطق/.test(n) || n.split(" ").length < 2) continue;
    return n.split(" ").slice(0, 7).join(" ");
  }
  return "";
}

// ---- الأرقام المدنية من ملف الميزانية: كل صف فيه اسم المعلمة ورقمها المدني (12 رقماً)
const normAr = (s) => String(s || "").replace(/[ـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
const digits = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
// يعيد Map: الاسم (كما في القائمة) ← الرقم المدني
export async function civilIdsFromBudget(file, names) {
  const isPdf = /\.pdf$/i.test(file.name || "") || file.type === "application/pdf";
  let rows;
  if (isPdf) rows = (await textFromPdf(file, 30)).split("\n");
  else { const { rowsFromFile } = await import("./namesImport.js"); rows = await rowsFromFile(file); }
  const R = rows.map((r) => {
    // أرقام مدنية في الصف (تُجمع الأرقام المفصولة بمسافات داخل الخلية)
    const d = digits(r), ids = [...d.replace(/(\d)\s+(?=\d)/g, "$1").matchAll(/(?<!\d)\d{12}(?!\d)/g)].map((m) => m[0]);
    return { t: normAr(r.replace(/\d+/g, " ")), ids };
  }).filter((x) => x.ids.length);
  const out = new Map();
  for (const n of names) {
    const k = normAr(n); if (!k) continue;
    const words = k.split(" "), short = words.slice(0, 3).join(" ");
    const hit = R.find((r) => r.t.includes(k)) || (words.length > 3 ? R.find((r) => r.t.includes(short)) : null);
    if (hit) out.set(n, hit.ids[0]);
  }
  return out;
}

// قراءة ملف ميزانية مرفوع (بدون حفظه): اسم المدرسة، والمعلمات بأرقامهن المدنية، ورئيس القسم
export async function budgetPeople(file) {
  const isPdf = /\.pdf$/i.test(file.name || "") || file.type === "application/pdf";
  let names, text, rows;
  // بعض ملفات PDF تُخرج «لا» المركبة مقلوبة (األولى ← الأولى)
  const lam = (x) => String(x).replace(/األ/g, "الأ").replace(/اإل/g, "الإ").replace(/اآل/g, "الآ");
  if (isPdf) { [names, text] = await Promise.all([namesFromPdf(file), textFromPdf(file, 30)]); names = names.map(lam); text = lam(text); rows = text.split("\n"); }
  else { const m = await import("./namesImport.js"); [names, text, rows] = await Promise.all([m.namesFromFile(file), m.textFromFile(file), m.rowsFromFile(file)]); }
  const R = rows.map((r) => { const d = digits(r).replace(/(\d)\s+(?=\d)/g, "$1"); return { t: normAr(r.replace(/[0-9٠-٩۰-۹]+/g, " ")), id: (d.match(/(?<!\d)\d{12}(?!\d)/) || [])[0] || "", raw: r }; });
  const people = names.filter((n) => !/^(ال)?(رقم|الرقم|اسم|الاسم|المسمى|مسمى|الوظيف|الجنسي|ملاحظ)/.test(n.trim())).map((n) => {
    const k = normAr(n), short = k.split(" ").slice(0, 3).join(" ");
    const hit = R.find((r) => r.t.includes(k) && r.id) || R.find((r) => r.t.includes(k)) || R.find((r) => r.t.includes(short) && r.id);
    return { name: n, civil_id: hit?.id || "", head: !!hit && /رئيس/.test(hit.raw) };
  });
  return { school: schoolNameFromText(text), people };
}
