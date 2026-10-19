// الشهادات الجاهزة: قالب موحّد (شكر وتقدير، تميّز، مشاركة، حضور)، اسم واحد أو أسماء كثيرة (شهادة لكل اسم)،
// النص يُكتب تلقائياً من النوع والمناسبة ويمكن تعديله، والتوقيعات اختيارية.
import { state, G, schoolById } from "../store.js";
import { esc, $, $$, today, fmtDate } from "../ui.js";
import { field, bindFields, recordPage, schoolOptions } from "../kit.js";
import { FORMS, FIRST_SUPERVISOR } from "../templates.js";
import { printOptionsPanel, bindPrintOptions } from "./teacherVisit.js";

const C = FORMS.cert;
export const certIssuer = () => `التوجيه الفني للعلوم بمنطقة ${G().region || "الأحمدي"} التعليمية`;
// النص الافتراضي من النوع والجنس والمناسبة
export function certBody(d) {
  const t = C.types[d.ctype] || C.types.thanks, occ = (d.occasion || "").trim();
  return t[d.gender === "m" ? "m" : "f"].replace("{في}", occ ? "في " + occ : "في الميدان التربوي").replace("{occ}", occ || "…………").replace(/\s+،/g, "،");
}
export const certIntro = (d) => (C.types[d.ctype] || C.types.thanks).intro.replace("{الجهة}", d.issuer || certIssuer());
export const certNames = (d) => String(d.names || "").split(/\n+/).map((x) => x.trim()).filter(Boolean);

export function newCert() {
  const g = G();
  const d = { type: "cert", ctype: "thanks", gender: "f", prefix: "الأستاذة", names: "", occasion: "", issuer: certIssuer(), date: today(), design: "navy",
    signers: [{ on: true, title: `الموجه الفني${g.subject ? " لل" + g.subject.replace(/^ال/, "") : ""}`, name: g.full_name || state.profile?.full_name || "", me: true },
      { on: true, title: "الموجه الفني الأول", name: g.first_supervisor || FIRST_SUPERVISOR.name || "" },
      { on: false, title: "مدير المدرسة", name: "" }] };
  d.body = certBody(d);
  return { kind: "form", title: C.types.thanks.title, record_date: today(), academic_year: state.year, data: d };
}

export async function certEditor(main, rec) {
  return recordPage(main, { rec, title: "شهادة",
    beforeApprove: (r) => [!certNames(r.data).length && "الأسماء"].filter(Boolean),
    render(body, ed) {
      const d = ed.rec.data;
      const opt = (o, v, l) => `<option value="${esc(o)}" ${o === v ? "selected" : ""}>${esc(l ?? o)}</option>`;
      const signRows = (d.signers || []).map((s, i) => `<tr><td><input type="checkbox" data-si="${i}" data-sf="on" ${s.on ? "checked" : ""} aria-label="إظهار التوقيع ${i + 1}"></td>
        <td><input data-si="${i}" data-sf="title" value="${esc(s.title)}" aria-label="الصفة"></td><td><input data-si="${i}" data-sf="name" value="${esc(s.name)}" aria-label="الاسم"></td></tr>`).join("");
      body.innerHTML = `
      <section class="panel"><h2>نوع الشهادة</h2><div class="form">
        <div class="f"><label for="ct-type">النوع</label><select id="ct-type">${Object.entries(C.types).map(([k, t]) => opt(k, d.ctype, t.title)).join("")}</select></div>
        <div class="f"><label for="ct-g">الشهادة إلى</label><select id="ct-g">${opt("f", d.gender, "معلمة / موجهة (مؤنث)")}${opt("m", d.gender, "معلم / موجه (مذكر)")}</select></div>
        <div class="f"><label for="ct-design">التصميم</label><select id="ct-design">${Object.entries(C.designs).map(([k, l]) => opt(k, d.design, l)).join("")}</select></div>
        ${field({ label: "التاريخ", key: "date", type: "date", value: d.date || ed.rec.record_date })}
      </div></section>
      <section class="panel"><h2>الأسماء</h2>
        <div class="form">
          <div class="f"><label for="ct-prefix">اللقب قبل الاسم</label><select id="ct-prefix"></select></div>
          <div class="f"><label for="ct-sch">إضافة معلمات مدرسة (اختياري)</label><select id="ct-sch">${schoolOptions("")}</select></div>
        </div>
        <div class="f" style="margin-top:8px"><label for="ct-names">اسم في كل سطر — تُطبع شهادة لكل اسم</label><textarea id="ct-names" rows="6" placeholder="مثال:&#10;سارة أحمد&#10;نورة خالد">${esc(d.names || "")}</textarea></div>
        <p class="hint" id="ct-count"></p></section>
      <section class="panel"><h2>نص الشهادة</h2><div class="form" style="grid-template-columns:1fr">
        ${field({ label: "المناسبة (اختياري)", key: "occasion", value: d.occasion || "", placeholder: "مثال: ورشة عمل الاتزان الكيميائي / المسابقة العلمية / العام الدراسي 2026-2027" })}
        ${field({ label: "الجهة المانحة", key: "issuer", value: d.issuer || certIssuer() })}
        ${field({ label: "النص (يُكتب تلقائياً من النوع والمناسبة، ويمكنك تعديله)", key: "body", type: "textarea", rows: 3, value: d.body || certBody(d) })}
        <button type="button" class="btn small ghost" id="ct-regen" style="justify-self:start">↻ إعادة كتابة النص من الاختيارات</button>
      </div></section>
      <section class="panel"><h2>التوقيعات</h2><div class="tbl-wrap"><table class="data"><thead><tr><th>إظهار</th><th>الصفة</th><th>الاسم</th></tr></thead><tbody>${signRows}</tbody></table></div>
        <p class="hint">توقيعك وختمك يظهران على أول توقيع حسب «خيارات الطباعة» بالأسفل.</p></section>
      ${printOptionsPanel(ed)}`;

      const paintPrefix = () => { const g = ed.rec.data.gender === "m" ? "m" : "f"; const cur = ed.rec.data.prefix ?? C.prefixes[g][0];
        $("#ct-prefix", body).innerHTML = [...new Set([...C.prefixes[g], cur])].map((p) => opt(p, cur, p || "بدون لقب")).join(""); };
      const paintCount = () => { const n = certNames(ed.rec.data).length; $("#ct-count", body).textContent = n ? `سيُطبع ${n} ${n === 1 ? "شهادة" : n === 2 ? "شهادتان" : n <= 10 ? "شهادات" : "شهادة"} (شهادة لكل اسم).` : "بدون أسماء تُطبع شهادة واحدة بسطر فارغ للكتابة باليد."; };
      const regen = (force = false) => { if (!force && ed.rec.data.body_manual) return; const t = certBody(ed.rec.data);
        ed.change((x) => { x.data.body = t; if (force) x.data.body_manual = false; }); const ta = $("[data-key='body']", body); if (ta) ta.value = t; };
      paintPrefix(); paintCount();
      $("#ct-type", body).onchange = (e) => { ed.change((x) => { x.data.ctype = e.target.value; x.title = (C.types[e.target.value] || C.types.thanks).title; }); regen(); };
      $("#ct-g", body).onchange = (e) => { ed.change((x) => { x.data.gender = e.target.value; const P = C.prefixes[e.target.value === "m" ? "m" : "f"]; if (!P.includes(x.data.prefix)) x.data.prefix = P[0]; }); paintPrefix(); regen(); };
      $("#ct-design", body).onchange = (e) => ed.change((x) => { x.data.design = e.target.value; });
      $("#ct-prefix", body).onchange = (e) => ed.change((x) => { x.data.prefix = e.target.value; });
      $("#ct-names", body).addEventListener("input", (e) => { ed.change((x) => { x.data.names = e.target.value; }); paintCount(); });
      $("#ct-sch", body).onchange = (e) => {
        const sid = e.target.value; e.target.value = ""; if (!sid) return;
        const have = new Set(certNames(ed.rec.data)); const add = state.teachers.filter((t) => t.school_id === sid).map((t) => t.title.trim()).filter((n) => n && !have.has(n));
        if (!add.length) return; const v = [...certNames(ed.rec.data), ...add].join("\n");
        ed.change((x) => { x.data.names = v; if (!x.data.occasion && schoolById(sid)) x.data.school = schoolById(sid).title; }); $("#ct-names", body).value = v; paintCount();
      };
      $("#ct-regen", body).onclick = () => regen(true);
      $$("[data-si]", body).forEach((el) => el.addEventListener(el.type === "checkbox" ? "change" : "input", () => ed.change((x) => {
        const i = Number(el.dataset.si); x.data.signers = (x.data.signers || []).map((s, j) => (j === i ? { ...s, [el.dataset.sf]: el.type === "checkbox" ? el.checked : el.value } : s));
      })));
      bindFields(body, (k, v) => {
        if (k === "body") { ed.change((x) => { x.data.body = v; x.data.body_manual = true; }); return; }
        ed.change((x) => { x.data[k] = v; if (k === "date") x.record_date = v || null; });
        if (k === "occasion") regen();
      });
      bindPrintOptions(body, ed);
    } });
}
export const certSummary = (r) => { const n = certNames(r.data).length; return [(FORMS.cert.types[r.data.ctype] || {}).title, n ? `${n} اسم` : "", r.data.occasion].filter(Boolean).join(" — "); };
export { fmtDate };
