// صفحة القسم: تفتح من بطاقات الرئيسية، وتعرض صفحات القسم كبطاقات بنفس ثيم الواجهة
import { esc } from "../ui.js";
import { icon } from "../icons.js";
import { SECTIONS, MORE } from "../nav.js";

const NEWABLE = new Set(["school-visits", "teacher-visits", "exams", "events", "weekly", "monthly", "schools"]);

export default async function (main, { id }) {
  const s = [...SECTIONS, MORE].find((x) => x.id === id);
  if (!s || !s.items) { location.hash = "#/"; return; }
  main.innerHTML = `<div class="container hub">
    <div class="hub-head">${s.card ? `<img class="hub-img" src="assets/ui/card-${s.card}.jpg" alt="">` : ""}<div class="hub-badge">${icon(s.icon)}</div>
      <div><a class="hub-back" href="#/">${icon("back")} الرئيسية</a><h1>${esc(s.label)}</h1><div class="sub">${esc(s.desc || "")}</div></div></div>
    <div class="hub-grid">${s.items.map(([r, l, i, d]) => `<div class="hub-card">
      <a class="hub-main" href="#/${r}"><span class="hub-ic">${icon(i)}</span><span class="hub-t"><b>${esc(l)}</b>${d ? `<small>${esc(d)}</small>` : ""}</span></a>
      ${NEWABLE.has(r) ? `<a class="btn small hub-new" href="#/${r}/new">${icon("plus")} جديد</a>` : ""}</div>`).join("")}</div>
  </div>`;
}
