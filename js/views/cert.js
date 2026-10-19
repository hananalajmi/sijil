// الشهادات الجاهزة: قالب موحّد بتصاميم خلفية متعددة، وخطوط قابلة للتغيير، وصفة المستلم والعبارات والختام من قوائم منسدلة
// (القوائم تُعدَّل من «الحسابات والصلاحيات ← القوائم المنسدلة»، ويمكن إضافة خيار جديد من الشهادة نفسها).
// اسم واحد أو أسماء كثيرة (شهادة A4 لكل اسم).
import { state, G, opts, schoolById } from "../store.js";
import { esc, $, $$, today, fmtDate } from "../ui.js";
import { field, bindFields, recordPage, schoolOptions } from "../kit.js";
import { FORMS, FIRST_SUPERVISOR } from "../templates.js";
import { printOptionsPanel, bindPrintOptions } from "./teacherVisit.js";
import { CERT_TYPE, RUQAA_MAX, titleStyleOf } from "../report/builders4.js";

const C = FORMS.cert;
// الخطوط: نظام ثابت لكل الشهادات (انظري CERT_TYPE في report/builders4.js) — العنوان نسخ أو رقعة فقط
export const DESIGN_DEFAULTS = {
  waves: { titleStyle: "naskh", title: "شهـادة شكر وتقـديـر", nameColor: "#14254a", logos: { ministry: true, directorate: true } },
};
export const certIssuer = () => `التوجيه الفني للعلوم بمنطقة ${G().region || "الأحمدي"} التعليمية`;
const genderOf = (r) => (/^قسم|^أقسام/.test(r || "") ? "p" : /ة$/.test((r || "").trim()) ? "f" : "m");
// تحويل الضمائر في العبارة حسب المستلم: جهودها ← جهوده / جهودهم
export function genderize(t, g) {
  if (!t || g === "f" || !g) return t || "";
  return t.replace(/حضرت/g, g === "p" ? "حضروا" : "حضر").replace(/([؀-ۿ]{2,})ها(?=[\s،.,:؛!؟]|$)/g, (m, w) => w + (g === "p" ? "هم" : "ه"));
}
export const certTitle = (d) => (d.titleText || "").trim() || (C.types[d.ctype] || C.types.thanks).title;
export const certIntro = (d) => (d.introText || "").trim() || (C.types[d.ctype] || C.types.thanks).intro.replace("{الجهة}", d.issuer || certIssuer());
export const certNames = (d) => String(d.names || "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
// أسطر النص: العبارة + التفاصيل + الختام
export function certLines(d) {
  if (d.body_manual && d.body) return String(d.body).split(/\n+/).map((x) => x.trim()).filter(Boolean); // شهادات قديمة
  const g = d.gender || genderOf(d.recipient);
  return [genderize(d.phrase || "", g), ...String(d.details || "").split(/\n+/), genderize(d.closing || "", g)].map((x) => String(x).trim()).filter(Boolean);
}
// للتوافق مع الشهادات المحفوظة سابقاً
export const certBody = (d) => certLines(d).join("\n");

export function newCert() {
  const g = G(), D = DESIGN_DEFAULTS.waves;
  const d = { type: "cert", ctype: "thanks", design: "waves", recipient: "المعلمة", gender: "f", prefix: "", names: "", issuer: certIssuer(),
    phrase: opts("cert_phrases")[0] || "", details: "", closing: opts("cert_closings")[0] || "", date: today(), showDate: false,
    titleStyle: D.titleStyle, nameColor: D.nameColor, titleText: D.title, sizeTitle: 100, sizeBody: 100,
    logos: { ministry: true, directorate: true },
    signers: [{ on: true, title: "الموجه الأول للعلوم", name: g.first_supervisor || FIRST_SUPERVISOR.name || "" },
      { on: false, title: `الموجه الفني${g.subject ? " لل" + g.subject.replace(/^ال/, "") : ""}`, name: g.full_name || state.profile?.full_name || "", me: true },
      { on: false, title: "مديرة المدرسة", name: "" }] };
  return { kind: "form", title: C.types.thanks.title, record_date: today(), academic_year: state.year, data: d };
}

export async function certEditor(main, rec) {
  return recordPage(main, { backHref: "#/forms?sec=cert", newHref: "#/forms/new?type=cert", rec, title: "شهادة",
    beforeApprove: (r) => [!certNames(r.data).length && "الأسماء"].filter(Boolean),
    render(body, ed) {
      const d = ed.rec.data; if (!C.designs[d.design]) d.design = "waves"; d.logos ||= { ...((DESIGN_DEFAULTS[d.design] || {}).logos || { ministry: true, directorate: true }) };
      const opt = (o, v, l) => `<option value="${esc(o)}" ${o === v ? "selected" : ""}>${esc(l ?? o)}</option>`;
      const tStyle = d.titleStyle || (d.fTitle === "ruqaa" ? "ruqaa" : "naskh");
      const sizeSel = (id, v) => `<select id="${id}">${[80, 90, 100, 110, 120, 130].map((n) => opt(String(n), String(v || 100), n + "%")).join("")}</select>`;
      const signRows = (d.signers || []).map((s, i) => `<tr><td><input type="checkbox" data-si="${i}" data-sf="on" ${s.on ? "checked" : ""} aria-label="إظهار التوقيع ${i + 1}"></td>
        <td><input data-si="${i}" data-sf="title" value="${esc(s.title)}" aria-label="الصفة"></td><td><input data-si="${i}" data-sf="name" value="${esc(s.name)}" aria-label="الاسم"></td></tr>`).join("");
      body.innerHTML = `
      <section class="panel"><h2>التصميم والخطوط</h2>
      <p class="hint" style="margin:0 0 10px">نظام خطوط رسمي ثابت لكل الشهادات: العنوان <b>Noto Naskh Arabic</b>، اسم المكرّم <b>IBM Plex Sans Arabic</b> عريض، النص والتفاصيل <b>Noto Sans Arabic</b>. الخطوط محفوظة داخل الموقع وتُطبع بدقة 300 نقطة/بوصة.</p>
      <div class="form">
        <div class="f"><label for="ct-design">تصميم الخلفية</label><select id="ct-design">${Object.entries(C.designs).map(([k, l]) => opt(k, d.design, l)).join("")}</select></div>
        <div class="f"><label for="ct-type">نوع الشهادة</label><select id="ct-type">${Object.entries(C.types).map(([k, t]) => opt(k, d.ctype, t.title)).join("")}</select></div>
        ${field({ label: "العنوان كما يظهر", key: "titleText", value: certTitle(d), hint: "يمكن كتابته بالتطويل مثل: شهـادة شكر وتقـديـر" })}
        <div class="f"><label for="ct-ft">خط العنوان</label><select id="ct-ft">${["naskh", "ruqaa"].map((k) => opt(k, tStyle, CERT_TYPE[k].label)).join("")}</select>
          <p class="hint" id="ct-ft-h"></p></div>
        <div class="f"><label for="ct-st">حجم العنوان</label>${sizeSel("ct-st", d.sizeTitle)}</div>
        <div class="f"><label for="ct-sb">حجم النص</label>${sizeSel("ct-sb", d.sizeBody)}</div>
        <div class="f"><label for="ct-nc">لون الاسم</label><input type="color" id="ct-nc" value="${esc(d.nameColor || "#8a6a2e")}"></div>
      </div>
      <div class="checks" style="margin-top:10px"><b style="margin-inline-end:8px">الشعارات:</b>${Object.entries(C.logos).map(([k, [, l]]) => `<label><input type="checkbox" data-logo="${k}" ${d.logos[k] ? "checked" : ""}>${esc(l)}</label>`).join("")}</div></section>
      <section class="panel"><h2>الشهادة إلى</h2><div class="form">
        ${field({ label: "الصفة", key: "recipient", type: "select", options: opts("cert_recipients"), value: d.recipient, remember: "cert_recipients" })}
        <div class="f"><label for="ct-g">الضمائر في العبارات</label><select id="ct-g">${opt("f", d.gender, "مؤنث (جهودها، لها)")}${opt("m", d.gender, "مذكر (جهوده، له)")}${opt("p", d.gender, "جمع / قسم (جهودهم، لهم)")}</select></div>
        <div class="f"><label for="ct-prefix">لقب بعد الصفة (اختياري)</label><select id="ct-prefix">${["", "الأستاذة", "الأستاذ", "الدكتورة", "الدكتور", d.prefix].filter((x, i, a) => a.indexOf(x) === i).map((p) => opt(p, d.prefix || "", p || "بدون")).join("")}</select></div>
        <div class="f"><label for="ct-sch">إضافة معلمات مدرسة (اختياري)</label><select id="ct-sch">${schoolOptions("")}</select></div>
      </div>
      <div class="f" style="margin-top:8px"><label for="ct-names">اسم في كل سطر — تُطبع شهادة لكل اسم</label><textarea id="ct-names" rows="5" placeholder="مثال:&#10;لطيفة عبدالهادي&#10;يسرا إمام">${esc(d.names || "")}</textarea></div>
      <p class="hint" id="ct-count"></p></section>
      <section class="panel"><h2>العبارات</h2><div class="form" style="grid-template-columns:1fr">
        ${field({ label: "الجهة (السطر الأول)", key: "introText", value: certIntro(d) })}
        ${field({ label: "العبارة", key: "phrase", type: "select", options: opts("cert_phrases"), value: d.phrase, remember: "cert_phrases", hint: "الضمائر تتغير تلقائياً حسب الاختيار بالأعلى" })}
        ${field({ label: "تفاصيل إضافية (اختياري — كل سطر يظهر سطراً)", key: "details", type: "textarea", rows: 3, value: d.details || "", placeholder: "مثال: من يوم الثلاثاء الموافق 27 / 1 / 2026 إلى الخميس الموافق 29 / 1 / 2026" })}
        ${field({ label: "الختام", key: "closing", type: "select", options: opts("cert_closings"), value: d.closing, remember: "cert_closings" })}
      </div>
      <label class="row" style="gap:8px;margin-top:8px"><input type="checkbox" id="ct-sd" ${d.showDate ? "checked" : ""}> إظهار التاريخ</label>
      <div class="form" style="margin-top:6px">${field({ label: "التاريخ", key: "date", type: "date", value: d.date || ed.rec.record_date })}</div>
      <p class="hint">القوائم تُعدَّل للجميع من «الحسابات والصلاحيات ← القوائم المنسدلة»، ويمكنك إضافة خيار جديد من «+ إضافة خيار جديد للقائمة».</p></section>
      <section class="panel"><h2>التوقيعات</h2><div class="tbl-wrap"><table class="data"><thead><tr><th>إظهار</th><th>الصفة</th><th>الاسم</th></tr></thead><tbody>${signRows}</tbody></table></div>
        <p class="hint">توقيعك وختمك يظهران على خانة «الموجه الفني» حسب «خيارات الطباعة».</p></section>
      ${printOptionsPanel(ed)}`;

      const paintCount = () => { const n = certNames(ed.rec.data).length; $("#ct-count", body).textContent = n ? `سيُطبع ${n} ${n === 1 ? "شهادة" : n === 2 ? "شهادتان" : n <= 10 ? "شهادات" : "شهادة"} بحجم A4 (شهادة لكل اسم).` : "بدون أسماء تُطبع شهادة واحدة بسطر فارغ للكتابة باليد."; };
      paintCount();
      const setVal = (k, v) => { const el = $(`[data-key='${k}']`, body); if (el) el.value = v; };
      const ruqaaHint = () => { const h = $("#ct-ft-h", body); if (!h) return; const x = ed.rec.data, want = $("#ct-ft", body).value;
        h.textContent = want === "ruqaa" && titleStyleOf({ titleStyle: "ruqaa" }, certTitle(x)) !== "ruqaa" ? `العنوان طويل (أكثر من ${RUQAA_MAX} حرفاً)، فيُطبع بخط النسخ الرسمي. الرقعة للعناوين القصيرة فقط.` : ""; };
      ruqaaHint();
      $("#ct-design", body).onchange = (e) => { const D = DESIGN_DEFAULTS[e.target.value] || DESIGN_DEFAULTS.waves;
        ed.change((x) => { Object.assign(x.data, { design: e.target.value, titleStyle: D.titleStyle, nameColor: D.nameColor, logos: { ...D.logos } }); if (!x.data.title_manual) x.data.titleText = D.title || (C.types[x.data.ctype] || C.types.thanks).title; });
        ed.redraw(); };
      $("#ct-type", body).onchange = (e) => { ed.change((x) => { x.data.ctype = e.target.value; const T = C.types[e.target.value] || C.types.thanks; x.title = T.title;
        if (!x.data.title_manual) x.data.titleText = x.data.design === "waves" && e.target.value === "thanks" ? "شهـادة شكر وتقـديـر" : T.title; if (!x.data.intro_manual) x.data.introText = T.intro.replace("{الجهة}", x.data.issuer || certIssuer()); }); ed.redraw(); };
      $("#ct-ft", body).onchange = (e) => { ed.change((x) => { x.data.titleStyle = e.target.value; delete x.data.fTitle; delete x.data.fBody; delete x.data.fName; }); ruqaaHint(); };
      [["ct-st", "sizeTitle"], ["ct-sb", "sizeBody"]].forEach(([id, k]) => ($(`#${id}`, body).onchange = (e) => ed.change((x) => { x.data[k] = /size/.test(k) ? Number(e.target.value) : e.target.value; })));
      $("#ct-nc", body).oninput = (e) => ed.change((x) => { x.data.nameColor = e.target.value; });
      $$("[data-logo]", body).forEach((cb) => (cb.onchange = () => ed.change((x) => { x.data.logos = { ...(x.data.logos || {}), [cb.dataset.logo]: cb.checked }; })));
      $("#ct-g", body).onchange = (e) => ed.change((x) => { x.data.gender = e.target.value; });
      $("#ct-prefix", body).onchange = (e) => ed.change((x) => { x.data.prefix = e.target.value; });
      $("#ct-sd", body).onchange = (e) => ed.change((x) => { x.data.showDate = e.target.checked; });
      $("#ct-names", body).addEventListener("input", (e) => { ed.change((x) => { x.data.names = e.target.value; }); paintCount(); });
      $("#ct-sch", body).onchange = (e) => {
        const sid = e.target.value; e.target.value = ""; if (!sid) return;
        const have = new Set(certNames(ed.rec.data)); const add = state.teachers.filter((t) => t.school_id === sid).map((t) => t.title.trim()).filter((n) => n && !have.has(n));
        if (!add.length) return; const v = [...certNames(ed.rec.data), ...add].join("\n");
        ed.change((x) => { x.data.names = v; if (schoolById(sid)) x.data.school = schoolById(sid).title; }); $("#ct-names", body).value = v; paintCount();
      };
      $$("[data-si]", body).forEach((el) => el.addEventListener(el.type === "checkbox" ? "change" : "input", () => ed.change((x) => {
        const i = Number(el.dataset.si); x.data.signers = (x.data.signers || []).map((s, j) => (j === i ? { ...s, [el.dataset.sf]: el.type === "checkbox" ? el.checked : el.value } : s));
      })));
      bindFields(body, (k, v) => {
        ed.change((x) => {
          x.data[k] = v;
          if (k === "date") x.record_date = v || null;
          if (k === "titleText") { x.data.title_manual = true; setTimeout(ruqaaHint); }
          if (k === "introText") x.data.intro_manual = true;
          if (k === "recipient") { x.data.gender = genderOf(v); }
          x.data.body_manual = false;
        });
        if (k === "recipient") { const g = $("#ct-g", body); if (g) g.value = ed.rec.data.gender; }
      });
      bindPrintOptions(body, ed);
      void setVal;
    } });
}
export const certSummary = (r) => { const n = certNames(r.data).length; return [certTitle(r.data), n ? `${n} اسم` : "", r.data.recipient].filter(Boolean).join(" — "); };
export { fmtDate };
