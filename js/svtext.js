// نص زيارة المدرسة يُكتب تلقائياً من الاختيارات (بدون ذكاء اصطناعي مدفوع): جمل مترابطة قابلة للتعديل
const joinAr = (a) => a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join("، و") + "، و" + a[a.length - 1];
const others = (v) => String(v || "").split(/[،,\n]+/).map((x) => x.trim()).filter(Boolean);

export function goalsText(d) {
  const g = [...(d.goals || []), ...others(d.goals_other)];
  if (!g.length) return "";
  const head = d.visit_type ? `هدفت ${d.visit_type.startsWith("زيارة") ? d.visit_type : "زيارة " + d.visit_type} إلى` : "هدفت الزيارة إلى";
  return `${head} ${joinAr(g)}، بما يسهم في متابعة سير العمل الفني في القسم وتطويره.`;
}

export function recordsText(d) {
  const r = [...(d.records || []), ...others(d.records_other)].map((x) => (/^سجل/.test(x) ? x : "سجل " + x));
  if (!r.length) return "";
  return `تمت متابعة ${r.length > 1 ? "السجلات التالية: " : ""}${joinAr(r)}، والاطلاع على مدى انتظام${r.length > 1 ? "ها واستيفائها" : "ه واستيفائه"} للمطلوب.`;
}
