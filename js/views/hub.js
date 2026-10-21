// صفحة القسم: تفتح من بطاقات الرئيسية، وتعرض صفحات القسم كبطاقات بنفس ثيم الواجهة
import { esc, $, $$ } from "../ui.js";
import { G, setGuideData } from "../store.js";
import { editLinkList } from "../links.js";
import { icon } from "../icons.js";
import { SECTIONS, MORE, isExternal } from "../nav.js";

const NEWABLE = new Set(["school-visits", "teacher-visits", "exams", "events", "weekly", "monthly", "schools"]);

const secLinks = (id) => { const m = G().sec_links; return Array.isArray(m?.[id]) ? m[id] : []; };

export default async function (main, { id }) {
  const s = [...SECTIONS, MORE].find((x) => x.id === id);
  if (!s || !s.items) { location.hash = "#/"; return; }
  main.innerHTML = `<div class="container hub">
    <div class="hub-head">${s.card ? `<img class="hub-img" src="assets/ui/card-${s.card}.jpg" alt="">` : ""}<div class="hub-badge">${icon(s.icon)}</div>
      <div><a class="hub-back" href="#/">${icon("back")} الرئيسية</a><h1>${esc(s.label)}</h1><div class="sub">${esc(s.desc || "")}</div></div></div>
    <div class="hub-grid">${s.items.map(([r, l, i, d]) => `<div class="hub-card">
      <a class="hub-main" ${isExternal(r) ? `href="${esc(r)}" target="_blank" rel="noopener noreferrer"` : `href="#/${r}"`}><span class="hub-ic">${icon(i)}</span><span class="hub-t"><b>${esc(l)}${isExternal(r) ? ' <span aria-hidden="true">↗</span>' : ""}</b>${d ? `<small>${esc(d)}</small>` : ""}</span></a>
      ${NEWABLE.has(r) ? `<a class="btn small hub-new" href="#/${r}/new">${icon("plus")} جديد</a>` : ""}</div>`).join("")}<span id="hub-mine" style="display:contents"></span></div>
  </div>`;
  // روابطي داخل القسم: بطاقات إضافية يضيفها الموجّه لنفسه
  const box = $("#hub-mine", main);
  const paint = () => {
    box.innerHTML = secLinks(id).map((l, i) => `<div class="hub-card my-link">
      <a class="hub-main" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span class="hub-ic">${icon("share")}</span><span class="hub-t"><b>${esc(l.title)} <span aria-hidden="true">↗</span></b><small>رابط أضفتِه</small></span></a>
      <button class="btn small ghost hub-new" data-ed="${i}" aria-label="تعديل ${esc(l.title)}">تعديل</button></div>`).join("") +
      `<div class="hub-card"><button class="hub-main" id="hub-add" style="background:none;border:0;cursor:pointer;text-align:start;font:inherit;color:inherit;width:100%"><span class="hub-ic">${icon("plus")}</span><span class="hub-t"><b>إضافة رابط</b><small>رابط خاص بك يظهر هنا</small></span></button></div>`;
    $("#hub-add", box).onclick = () => edit(null);
    $$("[data-ed]", box).forEach((b) => (b.onclick = () => edit(Number(b.dataset.ed))));
  };
  const edit = async (i) => {
    const next = await editLinkList(secLinks(id), i); if (!next) return;
    await setGuideData("sec_links", { ...(G().sec_links || {}), [id]: next }); paint();
  };
  paint();
}
