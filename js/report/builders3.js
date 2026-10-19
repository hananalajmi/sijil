// الإنجازات الشهرية المشتركة — طباعة على هيئة ملف «إنجازات التوجيه الفني للعلوم» (أفقي):
// غلاف، صفحة المحتوى، «المرحلة الثانوية»، الأقسام السبعة، ثم «الموجه الفني الأول». الصور في مربع ثابت الحجم داخل كل صف.
import { esc, fmtDateSlash, dayName, MONTHS_AR } from "../ui.js";
import { SHARED_ACH, FIRST_SUPERVISOR } from "../templates.js";
import { val, img, logo, headLogos, logoRow } from "./builders.js";

const monthName = (m) => (m ? MONTHS_AR[Number(m.split("-")[1]) - 1] : "");
const yearTxt = (y) => { const [a, b] = (y || "").split("-"); return a && b ? `${a}- ${b}` : y || ""; };
const dateTxt = (r) => {
  if (!r.date) return "";
  const one = (d) => `${esc(dayName(d))}<br>${fmtDateSlash(d)}`;
  return r.date_to && r.date_to > r.date ? `${one(r.date)}<br>إلى<br>${one(r.date_to)}` : one(r.date);
};
const filledRow = (part, r) => part.cols.some(([c]) => (r[c] || "").toString().trim()) || (r.photos || []).length;
const nlbr = (t) => esc(t || "").replace(/\n/g, "<br>");

// خانة الصور: كل صورة بالحجم المختار نفسه، تحت بعضها
async function photoBox(ids = []) {
  const list = ids.filter(Boolean).slice(0, SHARED_ACH.maxPhotos);
  if (!list.length) return `<div class="sa-pstack none"></div>`;
  const imgs = [];
  for (const id of list) imgs.push(`<div class="sa-pcell">${await img(id, "sa-pimg")}</div>`);
  return `<div class="sa-pstack">${imgs.join("")}</div>`;
}

export async function sharedAchievements(ctx) {
  const d = ctx.rec.data || {};
  const mName = monthName(d.month);
  const observer = d.observer_name || ctx.guide?.first_supervisor || FIRST_SUPERVISOR.name;
  const cover = `<div class="sa-cover">
    ${logoRow(await headLogos(ctx, "shared_achievements"), "sa-logos")}
    <div class="sa-title"><div>${esc(SHARED_ACH.title)}</div><div>${esc(SHARED_ACH.region)}</div><div>للعام الدراسي ${esc(yearTxt(ctx.rec.academic_year))}</div></div>
    <div class="sa-month">شهر <span>${esc(mName)}</span></div>
    <div class="sa-obs"><div>${esc(SHARED_ACH.observer)}</div><div>أ. ${val(observer)}</div></div>
  </div>`;
  const toc = `<div class="sa-contents"><div class="sa-contents-t">المحتوى</div>
    <table class="sa-toc"><thead><tr><th>البند</th><th>الموضوع</th></tr></thead><tbody>
    ${SHARED_ACH.sections.map((s, i) => `<tr class="${i % 2 ? "" : "alt"}"><td>${esc(SHARED_ACH.tocOrdinals[i])}</td><td>${esc(s.title)}</td></tr>`).join("")}</tbody></table></div>`;

  const size = SHARED_ACH.photoSizes[d.photo_size] || SHARED_ACH.photoSizes.m;
  const blocks = [];
  for (const [si, sec] of SHARED_ACH.sections.entries()) {
    const head = `${si === 0 ? `<div class="sa-stage">${val(d.stage || SHARED_ACH.stage)}</div>` : ""}<div class="sa-h"><span>${esc(SHARED_ACH.ordinals[si])}: ${esc(sec.title)}:</span></div>`;
    let first = true;
    const withHead = (h) => { const x = first ? head + h : h; first = false; return x; };
    const parts = [];
    for (const part of sec.parts) {
      if (part.type === "bullets") {
        const items = (d[part.key] || []).filter((b) => (b.text || "").trim() || (b.names || "").trim())
          .map((b) => `<div class="sa-li"><span class="sa-dash">-</span><span>${nlbr(b.text)}${(b.names || "").trim() ? ` <span class="sa-red">( ${esc(b.names.trim())} )</span>` : ""}</span></div>`);
        const sub = part.sub ? `<div class="sa-sub">- ${esc(part.sub)}</div>` : "";
        parts.push({ group: { cls: "sa-bul", head: `<div class="sa-gh">${withHead("")}${sub}</div>`, items: items.length ? items : [`<div class="sa-li"><span class="sa-dash">-</span><span>&nbsp;</span></div>`] } });
      } else if (part.type === "table") {
        const rows0 = (d[part.key] || []).filter((r) => filledRow(part, r));
        const rows = [];
        for (const [i, r] of (rows0.length ? rows0 : [{}]).entries()) {
          const cells = part.cols.map(([c]) => `<td class="${c === "date" ? "c-date" : c === "task" ? "tl" : ""}">${c === "date" ? dateTxt(r) : nlbr(r[c])}</td>`).join("");
          rows.push(`<tr><td class="c-n">${rows0.length ? i + 1 : 1}</td>${cells}${part.photos ? `<td class="c-ph">${await photoBox(r.photos)}</td>` : ""}</tr>`);
        }
        const title = `<div class="sa-sub2">${esc(part.head)}</div>${part.note ? `<div class="sa-note">${esc(part.note)}</div>` : ""}`;
        // عرض الأعمدة: م ثابت، التاريخ ثابت، الصور بحجم الصورة المختار، والباقي يتوزع
        const colgroup = `<colgroup><col style="width:9mm">${part.cols.map(([c]) => `<col${c === "date" ? ' style="width:31mm"' : c === "guide" && part.key === "tasks" ? ' style="width:45mm"' : ""}>`).join("")}${part.photos ? `<col style="width:${size.w + 4}mm">` : ""}</colgroup>`;
        parts.push({ table: { before: withHead(title), cls: `grid sa-t ${part.photos ? "with-ph" : ""} sa-${part.key}`, colgroup,
          thead: `<tr><th class="c-n">م</th>${part.cols.map(([c, l]) => `<th class="${c === "date" ? "c-date" : ""}">${esc(l)}</th>`).join("")}${part.photos ? '<th class="c-ph">الصور</th>' : ""}</tr>`, rows } });
      }
    }
    // البند كاملاً لا يُقسم بين صفحتين
    blocks.push({ keep: parts });
  }
  blocks.push({ html: `<div class="sa-end">الموجه الفني الأول أ. ${val(observer)}</div>` });
  return { orientation: "landscape", cls: "t-sa", style: `--pw:${size.w}mm;--ph:${size.h}mm`, covers: [cover, toc], header: "", identity: "", footer: "", blocks };
}
