// صياغة الواجهة حسب الموجّه/الموجّهة: نصوص الموقع مكتوبة بصيغة المؤنث، وعند اختيار «موجّه» في البيانات الرئيسية
// تُحوَّل كلمات الواجهة إلى المذكر (اختاري ← اختر، المعلمات ← المعلمين …). لا تُمس بيانات المستخدم:
// خانات الكتابة والقوائم المنسدلة والتقارير المطبوعة (.sheet) والرسومات (svg) مستثناة.
import { G } from "./store.js";

export const isMale = () => { const g = String(G().gender || ""); return !!g && !/ة/.test(g); };

const W = {
  // أفعال الأمر والمخاطبة
  "اختاري": "اختر", "اختاريه": "اختره", "اختاريها": "اخترها", "اكتبي": "اكتب", "اضغطي": "اضغط", "واضغطي": "واضغط", "أضيفي": "أضف", "أضيفيها": "أضفها", "أضيفيه": "أضفه",
  "افتحي": "افتح", "فافتحي": "فافتح", "افتحيه": "افتحه", "افتحيها": "افتحها", "لتفتحيها": "لتفتحها", "ارفعي": "ارفع", "وارفعي": "وارفع", "ارفعيها": "ارفعها", "ترفعي": "ترفع", "ترفعينه": "ترفعه",
  "تريدين": "تريد", "أرسلي": "أرسل", "أرسليه": "أرسله", "وأرسليه": "وأرسله", "لترسليه": "لترسله", "ألغي": "ألغِ", "احفظي": "احفظ", "احفظيه": "احفظه", "واحفظيه": "واحفظه", "احفظيها": "احفظها",
  "أكملي": "أكمل", "وقّعي": "وقّع", "سجّلي": "سجّل", "استخدمي": "استخدم", "تستخدميه": "تستخدمه", "انسخي": "انسخ", "وانسخي": "وانسخ", "وحددي": "وحدد", "حددي": "حدد", "حدّدي": "حدّد", "تحددي": "تحدد", "وتحددين": "وتحدد",
  "أعيدي": "أعد", "راجعي": "راجع", "راجعيها": "راجعها", "وتراجعين": "وتراجع", "جرّبي": "جرّب", "جربي": "جرب", "تأكدي": "تأكد", "والصقيها": "والصقها", "والصقيه": "والصقه", "الصقي": "الصق",
  "صغّريه": "صغّره", "وكبّريه": "وكبّره", "أنشئي": "أنشئ", "وأنشئي": "وأنشئ", "تعبّينه": "تعبّئه", "صوّري": "صوّر", "عدّلي": "عدّل", "عدّليه": "عدّله", "وعدّليه": "وعدّله", "تعدّليها": "تعدّلها", "تعدّلينه": "تعدّله",
  "حاولي": "حاول", "ثبّتي": "ثبّت", "تذكّريني": "تذكّرني", "تدخلين": "تدخل", "انتظري": "انتظر", "احذفي": "احذف", "واحذفيه": "واحذفه", "تحذفيها": "تحذفها", "واطبعيه": "واطبعه", "اطبعي": "اطبع",
  "نزّليها": "نزّلها", "نزّليه": "نزّله", "عبّئي": "عبّئ", "فعّلي": "فعّل", "غيّري": "غيّر", "تستطيعين": "تستطيع", "ستتمكنين": "ستتمكن", "اتركيه": "اتركه", "ابحثي": "ابحث", "تستعيديها": "تستعيدها",
  "اعتمدي": "اعتمد", "اسحبيه": "اسحبه", "تضيفي": "تضيف", "تواصلي": "تواصل", "وقّعيه": "وقّعه", "ادخلي": "ادخل", "سجلي": "سجل", "اقرئي": "اقرأ", "تابعي": "تابع", "شاركي": "شارك", "تحققي": "تحقق",
  "أنتِ": "أنت", "لكِ": "لك", "بكِ": "بك", "عليكِ": "عليك", "منكِ": "منك", "إليكِ": "إليك", "زلتِ": "زلت", "لستِ": "لست", "اخترتِ": "اخترت", "عدّلتِ": "عدّلت", "كتبتِ": "كتبت", "أحسنتِ": "أحسنت", "أخطأتِ": "أخطأت", "أضفتِ": "أضفت",
  "أضفتِه": "أضفته", "رفعتِ": "رفعت", "وقّعتِ": "وقّعت", "مسجّلة": "مسجّل",
  // الموجّه والمعلمون (الموجّه يشرف عادةً على مدارس البنين)
  "الموجهة": "الموجه", "الموجّهة": "الموجّه", "الفنية": "الفني", "موجّهة": "موجّه", "موجهة": "موجه",
  "المعلمات": "المعلمين", "والمعلمات": "والمعلمين", "للمعلمات": "للمعلمين", "معلمات": "معلمين", "معلماتها": "معلميها", "المعلمة": "المعلم", "للمعلمة": "للمعلم", "معلمة": "معلم",
  "زيارتهن": "زيارتهم", "رئيسة": "رئيس", "مديرة": "مدير", "الطالبات": "الطلاب", "تفاعل الطالبات": "تفاعل الطلاب",
};
// «الفنية» تُحوَّل فقط بعد «الموجهة» (لا «التربية الفنية» أو «اللجنة الفنية»)
const PHRASES = [[/(الموج[ّ]?هة)\s+(الفنية)/g, "الموجه الفني"], [/أ\.\s*\/?\s*حساب/g, (m) => m]];
const SINGLE = Object.fromEntries(Object.entries(W).filter(([k]) => k !== "الفنية" && !k.includes(" ")));
const AR = "\\u0621-\\u064A\\u0640\\u064B-\\u0652\\u0670";
const RE = new RegExp(`(^|[^${AR}])(${Object.keys(SINGLE).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?=$|[^${AR}])`, "g");
export const toMale = (t) => { if (!t || !/[؀-ۿ]/.test(t)) return t; let s = t; for (const [r, v] of PHRASES) s = s.replace(r, v); return s.replace(RE, (m, pre, w) => pre + SINGLE[w]); };

const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "OPTION", "SELECT", "INPUT", "CODE", "PRE"]);
// خيارات القوائم لا تُمس (بيانات)، إلا خيار «— اختاري —» و«+ إضافة …»
const hintOpt = (el) => el?.tagName === "OPTION" && ["", "__custom", "__add"].includes(el.getAttribute("value") ?? (el.textContent.startsWith("—") || el.textContent.startsWith("+") ? "" : "x"));
const skipEl = (el) => !el || (SKIP.has(el.tagName) && !hintOpt(el)) || !!el.closest?.(".sheet, svg, [contenteditable], .no-gender, .tk-text, .cal-ev, .item .t, td, .sticky-note");
const ATTRS = ["placeholder", "title", "aria-label"];
function fixNode(n) {
  if (n.nodeType === 3) { const p = n.parentElement; if (skipEl(p)) return; const v = toMale(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; return; }
  if (n.nodeType !== 1) return;
  if (n.tagName === "INPUT" || n.tagName === "TEXTAREA") { const v = n.getAttribute("placeholder"); if (v) { const x = toMale(v); if (x !== v) n.setAttribute("placeholder", x); } return; }
  if (skipEl(n)) return;
  for (const a of ATTRS) { const v = n.getAttribute?.(a); if (v) { const x = toMale(v); if (x !== v) n.setAttribute(a, x); } }
  const tw = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let c = tw.nextNode(); c; c = tw.nextNode()) {
    if (c.nodeType === 1) { if (c.tagName === "INPUT" || c.tagName === "TEXTAREA") { const v = c.getAttribute("placeholder"); if (v) { const x = toMale(v); if (x !== v) c.setAttribute("placeholder", x); } }
      else if (!skipEl(c)) for (const a of ATTRS) { const v = c.getAttribute(a); if (v) { const x = toMale(v); if (x !== v) c.setAttribute(a, x); } } continue; }
    const p = c.parentElement; if (skipEl(p)) continue; const v = toMale(c.nodeValue); if (v !== c.nodeValue) c.nodeValue = v;
  }
}
let obs = null;
export function startGenderUI() {
  if (obs) return;
  obs = new MutationObserver((ms) => { if (!isMale()) return; for (const m of ms) { if (m.type === "characterData") fixNode(m.target); else m.addedNodes.forEach(fixNode); } });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  if (isMale()) fixNode(document.body);
}
export const refreshGenderUI = () => { if (isMale()) fixNode(document.body); };
