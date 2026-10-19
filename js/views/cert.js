// الشهادات الجاهزة: قالب موحّد بتصاميم خلفية متعددة، وخطوط قابلة للتغيير، وصفة المستلم والعبارات والختام من قوائم منسدلة
// (القوائم تُعدَّل من «الحسابات والصلاحيات ← القوائم المنسدلة»، ويمكن إضافة خيار جديد من الشهادة نفسها).
// اسم واحد أو أسماء كثيرة (شهادة A4 لكل اسم).
import { state, G, opts, schoolById } from "../store.js";
import { esc, $, $$, today, fmtDate } from "../ui.js";
import { field, bindFields, recordPage, schoolOptions } from "../kit.js";
import { FORMS, FIRST_SUPERVISOR } from "../templates.js";
import { printOptionsPanel, bindPrintOptions } from "./teacherVisit.js";
import { CERT_TYPE, RUQAA_MAX, titleStyleOf } from "../report/builders4.js";
import { goldDefaults, goldSVG, goldResources, GOLD_BGS, TITLE_COLORS, TEXT_FONTS } from "../report/certGolden.js";
import { modal, toast } from "../ui.js";

const C = FORMS.cert;
// الخطوط: نظام ثابت لكل الشهادات (انظري CERT_TYPE في report/builders4.js) — العنوان نسخ أو رقعة فقط
export const DESIGN_DEFAULTS = {
  golden: { titleStyle: "ruqaa", title: "شكر وتقدير", nameColor: "#14254a", logos: {} },
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
  Object.assign(d, goldDefaults(), { design: "golden", titleText: "شكر وتقدير", firstSupName: g.first_supervisor || FIRST_SUPERVISOR.name || "" });
  return { kind: "form", title: C.types.thanks.title, record_date: today(), academic_year: state.year, data: d };
}

// ---------------- محرّر القالب الرسمي الذهبي ----------------
const LOGO_CHOICES = () => [["", "بدون شعار"], ...Object.entries(C.logos).filter(([k]) => k !== "seal").map(([k, [, l]]) => [k, l]), ["custom", "صورة من جهازي…"]];
// تصغير الصورة المرفوعة (بحد أقصى 900 بكسل) مع الحفاظ على النسبة والشفافية
const readLogo = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => { const im = new Image(); im.onerror = () => rej(new Error("الصورة غير صالحة"));
  im.onload = () => { const k = Math.min(1, 900 / Math.max(im.width, im.height)), cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL("image/png")); }; im.src = fr.result; }; fr.readAsDataURL(file); });
function goldenEditor(body, ed, designSel) {
  const d = ed.rec.data; for (const [k, v] of Object.entries(goldDefaults())) if (d[k] === undefined) d[k] = v;
  const opt = (o, v, l) => `<option value="${esc(o)}" ${o === v ? "selected" : ""}>${esc(l ?? o)}</option>`;
  const logoCtl = (side, label) => `<div class="f cg-logo"><label for="cg-${side}">${label}</label>
      <select id="cg-${side}" data-side="${side}">${LOGO_CHOICES().map(([k, l]) => opt(k, d["gLogo" + side] || "", l)).join("")}</select>
      <div class="row" style="gap:6px;margin-top:6px"><label class="btn sm">رفع / استبدال<input type="file" accept="image/*" data-up="${side}" hidden></label>
      <button class="btn sm ghost" type="button" data-del="${side}">حذف الشعار</button></div></div>`;
  body.innerHTML = `
    <section class="panel cg-live-wrap"><h2>معاينة مباشرة</h2><div id="cg-live" class="cg-live" aria-live="polite"></div>
      <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn primary" type="button" id="cg-preview">معاينة الشهادة</button><button class="btn" type="button" id="cg-pdf">تنزيل PDF</button>
        <button class="btn" type="button" id="cg-print">طباعة الشهادة</button><button class="btn ghost" type="button" id="cg-reset">إعادة تعيين الحقول</button></div>
      <p class="hint">الخطوط محفوظة داخل الموقع وتُضمَّن في ملف PDF. أماكن الشعارين والعنوان والتوقيع ثابتة في كل الشهادات.</p></section>
    <section class="panel"><h2>التصميم والشعاران</h2><div class="form">
      <div class="f"><label for="ct-design">تصميم الشهادة</label>${designSel}</div>
      <div class="f"><label for="cg-bg">الخلفية</label><select id="cg-bg">${Object.entries(GOLD_BGS).map(([k, b]) => opt(k, d.bg || "frame", b.label)).join("")}</select></div>
      ${logoCtl("R", "الشعار الأيمن")}${logoCtl("L", "الشعار الأيسر")}</div></section>
    <section class="panel"><h2>العنوان والسطران التعريفيان</h2><div class="form" style="grid-template-columns:1fr">
      ${field({ label: "عنوان الشهادة (خط زخرفي)", key: "titleText", value: d.titleText || "شكر وتقدير" })}
      <div class="form" style="margin:0"><div class="f"><label for="cg-art">شكل العنوان</label><select id="cg-art">${opt("art", d.titleArt || "art", "الخط الديواني المرسوم (لعبارة «شكر وتقدير»)")}${opt("font", d.titleArt, "خط الرقعة (لأي عنوان)")}</select></div>
        <div class="f"><label for="cg-tc">لون العنوان</label><select id="cg-tc">${Object.entries(TITLE_COLORS).map(([k, l]) => opt(k, d.titleColor || "auto", l)).join("")}</select></div></div>
      ${field({ label: "السطر التعريفي الأول (اختياري)", key: "line1", value: d.line1 || "", placeholder: "اتركيه فارغاً أو اكتبي ما تريدين" })}
      ${field({ label: "السطر التعريفي الثاني (اختياري)", key: "line2", value: d.line2 || "" })}</div></section>
    <section class="panel"><h2>العبارة فوق الاسم</h2><div class="form" style="grid-template-columns:1fr">
      ${field({ label: "العبارة", key: "intro", type: "select", options: opts("cert_g_intros"), value: d.intro ?? "", remember: "cert_g_intros", hint: "لعبارة جديدة: «+ إضافة خيار جديد للقائمة» — وتُعدَّل القوائم من الحسابات والصلاحيات ← القوائم المنسدلة" })}</div></section>
    <section class="panel"><h2>المسمى والاسم</h2><div class="form">
      ${field({ label: "المسمى الوظيفي (مذكر أو مؤنث)", key: "jobTitle", type: "select", options: opts("cert_g_titles"), value: d.jobTitle, remember: "cert_g_titles" })}
      <div class="f"><label for="ct-sch">إضافة معلمات مدرسة (اختياري)</label><select id="ct-sch">${schoolOptions("")}</select></div></div>
      <div class="f" style="margin-top:8px"><label for="ct-names">الاسم — اسم في كل سطر، وتُطبع شهادة لكل اسم (يظهر بجانب المسمى)</label><textarea id="ct-names" rows="4" placeholder="مثال:&#10;لطيفة عبدالهادي الجداوي">${esc(d.names || "")}</textarea></div>
      <p class="hint" id="ct-count"></p></section>
    <section class="panel"><h2>العبارة تحت الاسم (حسب الموضوع)</h2><div class="form" style="grid-template-columns:1fr">
      ${field({ label: "اختاري عبارة", key: "phrase", type: "select", options: opts("cert_g_phrases"), value: d.phrase, remember: "cert_g_phrases", hint: "تُكتب في المربع بالأسفل وتتغير الضمائر حسب المسمى (جهودها / جهوده)" })}
      <div class="f"><label for="cg-body">نص العبارة — عدّليه كما تريدين، وكل سطر يظهر سطراً (مثل التاريخ أو مكان الورشة)</label><textarea id="cg-body" rows="4">${esc(d.body ?? d.phrase ?? "")}</textarea></div>
      ${field({ label: "الختام (اختياري)", key: "closing", type: "select", options: opts("cert_closings"), value: d.closing || "", remember: "cert_closings" })}</div></section>
    <section class="panel"><h2>الخط ولون الخط</h2><div class="form">
      <div class="f"><label for="cg-nf">خط المسمى والاسم</label><select id="cg-nf">${Object.entries(TEXT_FONTS).map(([k, [, l]]) => opt(k, d.nameFont || "plex", l)).join("")}</select></div>
      <div class="f"><label for="cg-nc">لون المسمى والاسم</label><input type="color" id="cg-nc" value="${esc(d.nameColor || GOLD_BGS[d.bg || "frame"].nameColor || "#14254a")}"></div>
      <div class="f"><label for="cg-tf">خط العبارات</label><select id="cg-tf">${Object.entries(TEXT_FONTS).map(([k, [, l]]) => opt(k, d.textFont || "notosans", l)).join("")}</select></div>
      <div class="f"><label for="cg-tcol">لون العبارات</label><input type="color" id="cg-tcol" value="${esc(d.textColor || "#1d2333")}"></div></div></section>
    <section class="panel"><h2>التوقيع (أسفل اليسار)</h2><div class="form">
      <div class="f"><label>المسمى</label><input value="الموجه الأول للعلوم" disabled></div>
      ${field({ label: "اسم الموجه الأول (اختياري)", key: "firstSupName", value: d.firstSupName || "" })}</div>
      <p class="hint">لا يُطبع تاريخ في هذا القالب.</p></section>`;
  // المعاينة المباشرة
  let res = null, tm = 0, resKey = "";
  const live = $("#cg-live", body);
  const paint = async () => { const x = { ...goldDefaults(), ...ed.rec.data }, key = [x.gLogoR, x.gLogoL, (x.gLogoR_img || "").length, (x.gLogoL_img || "").length].join("|");
    if (!res || key !== resKey) { res = await goldResources(x); resKey = key; }
    live.innerHTML = goldSVG(x, certNames(x)[0] || "", res); };
  const repaint = () => { clearTimeout(tm); tm = setTimeout(paint, 120); };
  paint();
  const paintCount = () => { const n = certNames(ed.rec.data).length; $("#ct-count", body).textContent = n ? `سيُطبع ${n} ${n === 1 ? "شهادة" : n === 2 ? "شهادتان" : n <= 10 ? "شهادات" : "شهادة"} بحجم A4 أفقي (شهادة لكل اسم). المعاينة تعرض الاسم الأول.` : "بدون اسم تُطبع شهادة بسطر فارغ للكتابة باليد."; };
  paintCount();
  $("#cg-bg", body).onchange = (e) => { const v = e.target.value, P = GOLD_BGS[v];
    ed.change((x) => { const prev = GOLD_BGS[x.data.bg || "frame"]; x.data.bg = v;
      if (P.defLogoR && (x.data.gLogoR || "ministry") === "ministry") x.data.gLogoR = P.defLogoR; else if (!P.defLogoR && prev?.defLogoR && x.data.gLogoR === prev.defLogoR) x.data.gLogoR = "ministry"; });
    $("#cg-R", body).value = ed.rec.data.gLogoR || ""; repaint(); };
  $("#cg-art", body).onchange = (e) => { ed.change((x) => { x.data.titleArt = e.target.value; }); repaint(); };
  $("#cg-tc", body).onchange = (e) => { ed.change((x) => { x.data.titleColor = e.target.value; }); repaint(); };
  $$("[data-side]", body).forEach((sel) => (sel.onchange = () => { const s = sel.dataset.side;
    if (sel.value === "custom" && !ed.rec.data["gLogo" + s + "_img"]) { $(`[data-up='${s}']`, body).click(); sel.value = ed.rec.data["gLogo" + s] || ""; return; }
    ed.change((x) => { x.data["gLogo" + s] = sel.value; }); repaint(); }));
  $$("[data-up]", body).forEach((inp) => (inp.onchange = async () => { const s = inp.dataset.up, f = inp.files[0]; inp.value = ""; if (!f) return;
    try { const url = await readLogo(f); ed.change((x) => { x.data["gLogo" + s] = "custom"; x.data["gLogo" + s + "_img"] = url; }); $(`#cg-${s}`, body).value = "custom"; repaint(); toast("تم رفع الشعار"); }
    catch (e) { toast(e.message || "تعذّر قراءة الصورة", "error"); } }));
  $$("[data-del]", body).forEach((b) => (b.onclick = () => { const s = b.dataset.del; ed.change((x) => { x.data["gLogo" + s] = ""; x.data["gLogo" + s + "_img"] = ""; }); $(`#cg-${s}`, body).value = ""; repaint(); }));
  $("#ct-names", body).addEventListener("input", (e) => { ed.change((x) => { x.data.names = e.target.value; }); paintCount(); repaint(); });
  $("#ct-sch", body).onchange = (e) => { const sid = e.target.value; e.target.value = ""; if (!sid) return;
    const have = new Set(certNames(ed.rec.data)); const add = state.teachers.filter((t) => t.school_id === sid).map((t) => t.title.trim()).filter((n) => n && !have.has(n));
    if (!add.length) return; const v = [...certNames(ed.rec.data), ...add].join("\n"); ed.change((x) => { x.data.names = v; }); $("#ct-names", body).value = v; paintCount(); repaint(); };
  // الضمائر حسب المسمى: المعلم ← جهوده، المعلمة ← جهودها
  const gOf = (t) => (/ة(\s|$)/.test(String(t || "").split("/")[0].trim()) ? "f" : "m");
  const setBody = (v) => { $("#cg-body", body).value = v; ed.change((x) => { x.data.body = v; }); };
  bindFields(body, (k, v) => { ed.change((x) => { x.data[k] = v; if (k === "titleText") x.title = v || "شكر وتقدير"; });
    if (k === "phrase" && v) setBody(genderize(v, gOf(ed.rec.data.jobTitle)));
    if (k === "jobTitle") { const ph = ed.rec.data.phrase || "", cur = $("#cg-body", body).value; // تُعاد صياغة العبارة فقط إن لم تُعدَّل يدوياً
      if (ph && [genderize(ph, "f"), genderize(ph, "m")].includes(cur)) setBody(genderize(ph, gOf(v))); }
    repaint(); });
  $("#cg-body", body).addEventListener("input", (e) => { ed.change((x) => { x.data.body = e.target.value; }); repaint(); });
  $("#cg-nf", body).onchange = (e) => { ed.change((x) => { x.data.nameFont = e.target.value; }); repaint(); };
  $("#cg-tf", body).onchange = (e) => { ed.change((x) => { x.data.textFont = e.target.value; }); repaint(); };
  $("#cg-nc", body).oninput = (e) => { ed.change((x) => { x.data.nameColor = e.target.value; }); repaint(); };
  $("#cg-tcol", body).oninput = (e) => { ed.change((x) => { x.data.textColor = e.target.value; }); repaint(); };
  $("#cg-preview", body).onclick = () => ed.openPrint?.("");
  $("#cg-print", body).onclick = () => ed.openPrint?.("?auto=1");
  $("#cg-pdf", body).onclick = () => ed.openPrint?.("?auto=1&pdf=1");
  $("#cg-reset", body).onclick = async () => {
    const ok = await modal({ title: "إعادة تعيين الحقول", body: "<p>تُمسح كل الحقول (ومنها الأسماء والشعاران المرفوعان) وترجع للقيم الافتراضية. التصميم يبقى كما هو.</p>", actions: [{ label: "إلغاء", value: false }, { label: "إعادة التعيين", kind: "primary", value: true }] });
    if (!ok) return; const g = G(); ed.change((x) => { Object.assign(x.data, goldDefaults(), { names: "", firstSupName: g.first_supervisor || FIRST_SUPERVISOR.name || "" }); x.title = "شكر وتقدير"; }); ed.redraw(); };
}

export async function certEditor(main, rec) {
  return recordPage(main, { backHref: "#/forms?sec=cert", newHref: "#/forms/new?type=cert", rec, title: "شهادة",
    beforeApprove: (r) => [!certNames(r.data).length && "الأسماء"].filter(Boolean),
    render(body, ed) {
      const d = ed.rec.data; if (!C.designs[d.design]) d.design = "waves";
      const designSel = `<select id="ct-design">${Object.entries(C.designs).map(([k, l]) => `<option value="${k}" ${k === d.design ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
      const bindDesign = () => { $("#ct-design", body).onchange = (e) => { const v = e.target.value;
        ed.change((x) => { x.data.design = v; if (v === "golden") { for (const [k, val] of Object.entries(goldDefaults())) if (x.data[k] === undefined) x.data[k] = val; if (!x.data.firstSupName) x.data.firstSupName = G().first_supervisor || FIRST_SUPERVISOR.name || ""; }
          else { const D = DESIGN_DEFAULTS.waves; x.data.titleStyle ||= D.titleStyle; x.data.logos ||= { ...D.logos }; if (!x.data.title_manual || x.data.titleText === "شكر وتقدير") x.data.titleText = D.title; } }); ed.redraw(); }; };
      if (d.design === "golden") { goldenEditor(body, ed, designSel); bindDesign(); return; } d.logos ||= { ...((DESIGN_DEFAULTS[d.design] || {}).logos || { ministry: true, directorate: true }) };
      const opt = (o, v, l) => `<option value="${esc(o)}" ${o === v ? "selected" : ""}>${esc(l ?? o)}</option>`;
      const tStyle = d.titleStyle || (d.fTitle === "ruqaa" ? "ruqaa" : "naskh");
      const sizeSel = (id, v) => `<select id="${id}">${[80, 90, 100, 110, 120, 130].map((n) => opt(String(n), String(v || 100), n + "%")).join("")}</select>`;
      const signRows = (d.signers || []).map((s, i) => `<tr><td><input type="checkbox" data-si="${i}" data-sf="on" ${s.on ? "checked" : ""} aria-label="إظهار التوقيع ${i + 1}"></td>
        <td><input data-si="${i}" data-sf="title" value="${esc(s.title)}" aria-label="الصفة"></td><td><input data-si="${i}" data-sf="name" value="${esc(s.name)}" aria-label="الاسم"></td></tr>`).join("");
      body.innerHTML = `
      <section class="panel"><h2>التصميم والخطوط</h2>
      <p class="hint" style="margin:0 0 10px">نظام خطوط رسمي ثابت لكل الشهادات: العنوان <b>Noto Naskh Arabic</b>، اسم المكرّم <b>IBM Plex Sans Arabic</b> عريض، النص والتفاصيل <b>Noto Sans Arabic</b>. الخطوط محفوظة داخل الموقع وتُطبع بدقة 300 نقطة/بوصة.</p>
      <div class="form">
        <div class="f"><label for="ct-design">تصميم الشهادة</label>${designSel}</div>
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
      bindDesign();
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
