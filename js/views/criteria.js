// بطاقة قياس المعايير الفنية للمواد الأساسية: درجة كل بند قائمة منسدلة لا تتجاوز درجته التفصيلية،
// والمجموع يُحسب تلقائياً، والتوصيات تُختار من قائمة منسدلة (مع إمكانية كتابة توصية أخرى).
import { state, opts, schoolById } from "../store.js";
import { esc, $, $$, today, fmtDate } from "../ui.js";
import { field, bindFields, recordPage, go, schoolOptions } from "../kit.js";
import { FORMS } from "../templates.js";
import { criteriaKey, criteriaMax, criteriaTotal } from "../report/builders4.js";
import { printOptionsPanel, bindPrintOptions } from "./teacherVisit.js";

const T = FORMS.criteria;
// خيارات الدرجة: من 0 إلى الدرجة التفصيلية بخطوة نصف درجة
const steps = (m) => { const a = []; for (let x = 0; x <= m + 1e-9; x += 0.5) a.push(String(Math.round(x * 10) / 10)); return a; };

export function newCriteria() {
  return { kind: "form", title: T.label, record_date: today(), academic_year: state.year,
    data: { type: "criteria", date: today(), subject: T.subject, scores: {}, recs_guide: [], recs_guide_note: "", recs_first: [], recs_first_note: "" } };
}

export async function criteriaEditor(main, rec) {
  return recordPage(main, { backHref: "#/forms?sec=criteria", newHref: "#/forms/new?type=criteria", rec, title: T.label,
    beforeApprove: (r) => [!r.school_id && "المدرسة", criteriaTotal(r.data.scores) == null && "الدرجات"].filter(Boolean),
    render(body, ed) {
      const r = ed.rec, d = r.data;
      const years = [...new Set([state.year, r.academic_year].filter(Boolean))];
      const rowsHtml = T.groups.map((g, gi) => `<tr class="cr-gh"><th colspan="3">${esc(g.t)} <small class="hint" data-gsum="${gi}"></small></th></tr>` + g.items.map(([t, m], ii) => {
        const k = criteriaKey(gi, ii), cur = d.scores?.[k] ?? "";
        return `<tr><td>${esc(t)}</td><td class="num">${m}</td><td><select data-score="${k}" data-max="${m}" aria-label="درجة: ${esc(t)}"><option value="">—</option>${steps(m).map((s) => `<option ${String(cur) === s ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`;
      }).join("")).join("");
      const recBox = (key, title) => `<div class="cr-recbox" data-rk="${key}"><h3>${esc(title)}</h3><ul class="cr-reclist"></ul>
          <div class="row"><select data-addrec aria-label="إضافة توصية"><option value="">+ إضافة توصية من القائمة…</option>${opts("criteria_recs").map((o) => `<option>${esc(o)}</option>`).join("")}</select></div>
          ${field({ label: "توصيات أخرى (اختياري)", key: key + "_note", type: "textarea", rows: 2, value: d[key + "_note"] || "", wide: true })}</div>`;
      body.innerHTML = `
      <section class="panel"><h2>البيانات</h2><div class="form" id="crb">
        <div class="f"><label for="cr-school" class="req">اسم المدرسة</label><select id="cr-school">${schoolOptions(r.school_id)}</select></div>
        ${field({ label: "التاريخ", key: "date", type: "date", value: d.date || r.record_date, required: true })}
        ${field({ label: "العام الدراسي", key: "academic_year", type: "select", options: years, value: r.academic_year, custom: false })}
        ${field({ label: "المادة", key: "subject", type: "select", options: [T.subject, ...opts("subjects")], value: d.subject || T.subject })}
      </div></section>
      <section class="panel"><div class="page-head" style="margin-bottom:6px"><h2>الدرجات</h2><div class="cr-total" id="crt"></div></div>
        <p class="hint" style="margin-top:0">اختاري درجة كل بند؛ القائمة لا تتجاوز الدرجة التفصيلية للبند، والمجموع يُحسب تلقائياً.</p>
        <div class="tbl-wrap"><table class="data cr-edit"><thead><tr><th>بنود المعيار</th><th class="num">الدرجة التفصيلية</th><th>الدرجة</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></section>
      <section class="panel"><h2>التوصيات</h2><div class="cr-recs-grid">${recBox("recs_guide", "توصيات الموجه الفني")}${recBox("recs_first", "توصيات الموجه الأول")}</div>
        <p class="hint">قائمة التوصيات تُعدَّل من «الحسابات والصلاحيات ← القوائم المنسدلة ← توصيات بطاقة قياس المعايير الفنية».</p></section>
      ${printOptionsPanel(ed)}`;

      const paintTotal = () => {
        const sc = ed.rec.data.scores || {}, t = criteriaTotal(sc);
        $("#crt", body).innerHTML = `المجموع: <b>${t == null ? "—" : t}</b> من ${criteriaMax()}`;
        T.groups.forEach((g, gi) => { let s = 0, mx = 0, any = false; g.items.forEach(([, m], ii) => { mx += m; const v = sc[criteriaKey(gi, ii)]; if (v !== "" && v != null) { any = true; s += Number(v); } }); $(`[data-gsum="${gi}"]`, body).textContent = any ? `(${s} من ${mx})` : `(من ${mx})`; });
      };
      $$("select[data-score]", body).forEach((sel) => (sel.onchange = () => {
        const k = sel.dataset.score, m = Number(sel.dataset.max), v = sel.value === "" ? "" : Math.min(Number(sel.value), m);
        ed.change((x) => { x.data.scores = { ...(x.data.scores || {}), [k]: v }; });
        paintTotal();
      }));
      paintTotal();

      const paintRecs = (box) => {
        const k = box.dataset.rk, list = ed.rec.data[k] || [];
        $(".cr-reclist", box).innerHTML = list.length ? list.map((x, i) => `<li><span>${esc(x)}</span><button class="btn small ghost" data-rm="${i}" aria-label="حذف التوصية">✕</button></li>`).join("") : `<li class="hint">لا توجد توصيات مختارة.</li>`;
        $$("[data-rm]", box).forEach((b) => (b.onclick = () => { ed.change((x) => { x.data[k] = (x.data[k] || []).filter((_, j) => j !== Number(b.dataset.rm)); }, { immediate: true }); paintRecs(box); }));
      };
      $$(".cr-recbox", body).forEach((box) => {
        paintRecs(box);
        $("[data-addrec]", box).onchange = (e) => {
          const v = e.target.value; e.target.value = ""; if (!v) return;
          const k = box.dataset.rk;
          if ((ed.rec.data[k] || []).includes(v)) return;
          ed.change((x) => { x.data[k] = [...(x.data[k] || []), v]; }, { immediate: true }); paintRecs(box);
        };
      });

      $("#cr-school", body).onchange = (e) => ed.change((x) => { x.school_id = e.target.value || null; x.title = [T.label, schoolById(x.school_id)?.title].filter(Boolean).join(" — "); });
      bindFields(body, (k, v) => ed.change((x) => {
        if (k === "academic_year") x.academic_year = v || state.year;
        else { x.data[k] = v; if (k === "date") x.record_date = v || null; }
      }));
      bindPrintOptions(body, ed);
    } });
}
export const criteriaSummary = (r) => [schoolById(r.school_id)?.title, criteriaTotal(r.data?.scores) != null ? `${criteriaTotal(r.data.scores)} من ${criteriaMax()}` : ""].filter(Boolean).join(" — ");
export { go, fmtDate };
