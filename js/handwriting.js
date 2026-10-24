// تحويل خط اليد إلى نص: يُرسل شكل الخطوط فقط (نقاط القلم، بلا صورة ولا أي بيانات أخرى) إلى خدمة Google المجانية
// للتعرف على الكتابة اليدوية (نفس خدمة لوحة الكتابة اليدوية في Google Input Tools) — لا تحتاج حساباً ولا مفتاحاً.
const URL_HW = "https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8";

export async function recognizeInk(ink, lang = "ar") {
  const t0 = Math.min(...ink.strokes.flat().map((p) => p.t || 0));
  const body = { options: "enable_pre_space", requests: [{ writing_guide: { writing_area_width: Math.round(ink.w), writing_area_height: Math.round(ink.h) },
    ink: ink.strokes.map((s) => [s.map((p) => Math.round(p.x)), s.map((p) => Math.round(p.y)), s.map((p) => Math.max(0, Math.round((p.t || 0) - t0)))]), language: lang, max_num_results: 6, max_completions: 0 }] };
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(URL_HW, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    const j = await r.json();
    if (j?.[0] !== "SUCCESS") throw new Error("تعذّر التعرف على الكتابة");
    const c = (j[1]?.[0]?.[1] || []).map((x) => String(x).trim()).filter(Boolean);
    if (!c.length) throw new Error("لم نتعرف على كلمات واضحة");
    return [...new Set(c)];
  } catch (e) { throw new Error(e.name === "AbortError" ? "انتهت المهلة — تأكدي من الاتصال بالإنترنت" : e.message || "تعذّر التعرف على الكتابة"); }
  finally { clearTimeout(tm); }
}
