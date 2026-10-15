// النماذج الرسمية للتوقيع — «تكليف بمهمة خارج مقر العمل» (نموذج رقم 4، صفحة 14 من القرار 41/2006)
// يُطبع مُعبّأً من بيانات النموذج، أو فارغاً (blank) للتعبئة باليد.
import { esc, fmtDateSlash } from "../ui.js";
import { FORMS, FIRST_SUPERVISOR } from "../templates.js";
import { logo } from "./builders.js";

const dots = (w = 38) => `<span class="dots" style="min-width:${w}mm"></span>`;
const v = (x, w) => (x ? `<b class="fm-v">${esc(x)}</b>` : dots(w));

export async function formTakleef(ctx) {
  const T = FORMS.takleef, d = ctx.rec.data || {}, blank = !!d.blank;
  const region = ctx.guide?.region || "الأحمدي";
  const people = blank ? [] : (d.people || []).filter((p) => (p.name || "").trim() || (p.civil_id || "").trim());
  const head = `<div class="fm-head">
      <div class="fm-org">${await logo("emblem", "fm-emblem")}<div>${T.header.map(esc).join("<br>")}<br>الإدارة العامة لمنطقة ${esc(region)} التعليمية</div></div>
      <div class="fm-no"><span>${esc(T.formNo)}</span><span>${esc(T.pageNo)}</span></div></div>
    <h1 class="fm-title">${esc(T.label)}</h1>
    <div class="fm-line"><b>التاريخ :</b> ${blank ? dots(45) : v(fmtDateSlash(d.date || ctx.rec.record_date), 45)}</div>
    <div class="fm-line"><b>الموافق :</b> ${blank ? dots(45) : v(d.hijri, 45)}</div>
    <div class="fm-line"><b>السيد المحترم / ${blank ? esc(T.addressee) : esc(d.addressee || T.addressee)}</b> ${esc(T.addresseeNote)}</div>
    <div class="fm-line"><b>بعد التحية ،،،</b></div>
    <div class="fm-line fm-para">تقرر تكليف السيد / السادة التالية أسماؤهم بأداء مهمة خارج مقر العمل وذلك للقيام بـ
      ${!blank && d.task ? `<b class="fm-v">${esc(d.task).replace(/\n/g, "<br>")}</b>` : `<span class="fm-blank-lines">${dots(120)}${dots(170)}${dots(170)}</span>`}</div>
    <div class="fm-line">خلال المدة ${blank ? dots(40) : v(fmtDateSlash(d.from), 40)} &nbsp; حتى ${blank ? dots(40) : v(fmtDateSlash(d.to || d.from), 40)}</div>
    <div class="fm-line"><b>وهم:</b></div>`;
  const rows = people.map((p, i) => `<tr><td class="c-n">${i + 1}</td><td class="fm-name">${esc(p.name)}</td><td class="fm-cid" dir="ltr">${esc(p.civil_id)}</td></tr>`);
  for (let i = rows.length; i < T.minLines; i++) rows.push(`<tr><td class="c-n">${i + 1}</td><td class="fm-name">&nbsp;</td><td class="fm-cid"></td></tr>`);
  const tail = `<div class="fm-line fm-after">رجاء العلم حيث يتعذر عليهم الحضور الى مقر العمل للتوقيع عند ( ${!blank && d.sign_at ? `<b class="fm-v">${esc(d.sign_at)}</b>` : dots(40)} )</div>
    <div class="fm-sign"><div><b>${esc(T.manager)} في منطقة ${esc(region)} التعليمية</b>${FIRST_SUPERVISOR.name ? `<div><b>أ. ${esc(FIRST_SUPERVISOR.name)}</b></div>` : ""}<div class="fm-sign-space"></div></div></div>`;
  return { orientation: "portrait", cls: "t-fm", header: "", identity: "", footer: "",
    blocks: [{ html: head }, { table: { cls: "fm-people", colgroup: `<colgroup><col style="width:12mm"><col><col style="width:52mm"></colgroup>`, thead: `<tr><th class="c-n">م</th><th>الاسم</th><th>الرقم المدني</th></tr>`, rows } }, { html: tail }] };
}
