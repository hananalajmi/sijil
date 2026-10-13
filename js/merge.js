// دمج ثلاثي للملف المشترك: base = آخر نسخة عرفتُها، mine = تعديلاتي، theirs = النسخة الأحدث في الخادم.
// يحتفظ بتعديلات كل الموجهين؛ وإن عدّل اثنان الحقل نفسه بقيم مختلفة تُعتمد قيمتي (الأحدث) ويُحسب تعارضاً.
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const isRowList = (a) => Array.isArray(a) && a.every((r) => isObj(r) && r.id);

export function merge3(base, mine, theirs, stats = { conflicts: 0 }) {
  if (eq(mine, theirs)) return theirs;
  if (eq(mine, base)) return theirs;     // لم أعدّل: نأخذ الأحدث
  if (eq(theirs, base)) return mine;     // لم يعدّل غيري: نأخذ تعديلي
  if (isObj(mine) && isObj(theirs)) {
    const b = isObj(base) ? base : {};
    const out = {};
    for (const k of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      const inM = k in mine, inT = k in theirs, inB = k in b;
      if (inM && inT) out[k] = merge3(b[k], mine[k], theirs[k], stats);
      else if (inM) { if (!inB || !eq(mine[k], b[k])) out[k] = mine[k]; }       // أضفتُه، أو حذفه غيري ولم أعدّله
      else if (inT) { if (!inB || !eq(theirs[k], b[k])) out[k] = theirs[k]; }
    }
    return out;
  }
  // قوائم الصفوف والبنود (لكل صف معرّف): تُدمج صفاً صفاً
  if (isRowList(mine) && isRowList(theirs) && (base == null || isRowList(base))) {
    const B = new Map((base || []).map((r) => [r.id, r])), M = new Map(mine.map((r) => [r.id, r])), T = new Map(theirs.map((r) => [r.id, r]));
    const out = [];
    const take = (id) => {
      const b = B.get(id), m = M.get(id), t = T.get(id);
      if (m && t) return merge3(b, m, t, stats);
      if (m && !t) return b && eq(m, b) ? null : m;   // حذفه غيري: يبقى محذوفاً ما لم أعدّله
      if (t && !m) return b && eq(t, b) ? null : t;   // حذفتُه: يبقى محذوفاً ما لم يعدّله غيري
      return null;
    };
    // ترتيب الأحدث، ثم ما أضفتُه أنا في موضعه النسبي
    const order = theirs.map((r) => r.id);
    mine.forEach((r, i) => {
      if (order.includes(r.id)) return;
      const prev = mine.slice(0, i).reverse().find((x) => order.includes(x.id));
      order.splice(prev ? order.indexOf(prev.id) + 1 : 0, 0, r.id);
    });
    for (const id of order) { const r = take(id); if (r) out.push(r); }
    return out;
  }
  stats.conflicts++;
  return mine;
}
