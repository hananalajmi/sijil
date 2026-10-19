// معاينة الطباعة: نفس الصفحات تُطبع وتُحفظ PDF، وتُصدَّر Word
import { api } from "../api.js";
import { state } from "../store.js";
import { esc, $, toast, download, modal } from "../ui.js";
import { BUILDERS } from "../report/builders.js";
import { paginate, auditPages } from "../report/paginate.js";
import { recordContext, visitStatsContext, examStatsContext, compiledMonthlyContext, monthlyDerived } from "../report/context.js";
import { KIND_LABEL, KIND_ROUTE } from "../kit.js";

// الآيباد والآيفون (سفاري): لا يدعمان اتجاه الصفحة العرضي في الطباعة ولا الطباعة التلقائية
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) || /[?&]ios=1\b/.test(location.search);
// سفاري (ماك) أيضاً يضيف هوامشه للطباعة؛ فيُفعَّل له «هامش الأمان» افتراضياً
const SAFARI = IOS || /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(navigator.userAgent);

async function monthlyContext(rec) {
  const derived = await monthlyDerived(rec.data.month);
  const days = {};
  for (const [k, v] of Object.entries(derived)) {
    const o = rec.data.overrides?.[k];
    days[k] = { text: o?.text ?? v.text, holiday: o?.holiday ?? v.holiday };
  }
  return { kind: "monthly_plan", month: rec.data.month, days };
}

// يحدد التقرير المطلوب ويعيد [السياق، اسم الملف، رابط الرجوع، السجل]
export async function resolveReport(id, params) {
  if (id === "stats-visits") return [await visitStatsContext({ year: params.year || state.year, term: params.term, school: params.school || "" }), "إحصائية زيارات المعلمين", "#/stats-visits", null];
  if (id === "stats-exams") return [await examStatsContext({ year: params.year || state.year, term: params.term, examType: params.type, version: params.version }), params.type === "practical" ? "إحصائية الامتحان العملي" : "إحصائية الامتحان النظري", `#/stats-${params.type}`, null];
  if (id === "compiled-ach") return [await compiledMonthlyContext(params.month), "الإنجازات الشهرية المجمعة", "#/compile?month=" + params.month, null];
  // نسخة فارغة من أي نموذج (للطباعة أو لإرسالها لمعلم/زميلة يعبّئها بيده): بلا اسمي وتوقيعي وختمي
  if (id === "blank-criteria") { const c = await recordContext({ kind: "form", title: "بطاقة قياس المعايير الفنية", academic_year: state.year, data: { type: "criteria", blank: true } }); c.print = {}; return [c, "بطاقة قياس المعايير الفنية (فارغة)", "#/forms?sec=criteria", null]; }
  if (id === "blank-cert") { const c = await recordContext({ kind: "form", title: "شهادة", academic_year: state.year, data: { type: "cert", ctype: params.ctype || "thanks", design: params.design || "waves", blank: true, signers: [] } }); c.print = {}; return [c, "شهادة (فارغة)", "#/forms?sec=cert", null]; }
  if (id === "blank-takleef") return [await recordContext({ kind: "form", title: "تكليف بمهمة خارج مقر العمل", academic_year: state.year, data: { type: "takleef", blank: true } }), "نموذج تكليف بمهمة (فارغ)", "#/forms?sec=takleef", null];
  const bk = (id.match(/^blank-(teacher_visit|school_visit|event_report)$/) || [])[1];
  if (bk) {
    const c = await recordContext({ kind: bk, title: "", academic_year: state.year, data: { blank: true, visitee: params.head ? "head" : "teacher" } });
    c.guide = { ...c.guide, full_name: "", signature: null, stamp: null }; c.print = {}; c.blank = true;
    return [c, `${KIND_LABEL[bk]} (نسخة فارغة)`, `#/${KIND_ROUTE[bk]}`, null];
  }
  const rec = await api.get(id);
  if (!rec) throw new Error("السجل غير موجود");
  const back = state.profile && rec.owner_id && rec.owner_id !== state.profile.id && rec.kind !== "shared_achievements" ? `#/compile?month=${rec.data?.month || ""}` : `#/${KIND_ROUTE[rec.kind]}/${rec.id}`;
  const name = rec.title || KIND_LABEL[rec.kind];
  if (rec.status === "approved" && rec.snapshot) return [rec.snapshot, name, back, rec]; // النسخة الثابتة المعتمدة
  if (rec.kind === "monthly_plan") return [await monthlyContext(rec), name, back, rec];
  return [await recordContext(rec), name, back, rec];
}
export const contextFor = resolveReport;

export function builderFor(ctx) {
  const k = ctx.kind || ctx.rec?.kind;
  return BUILDERS[k];
}

export default async function (main, { id, params }) {
  const [ctx, name, back, rec] = await resolveReport(id, params);
  const build = builderFor(ctx);
  if (!build) throw new Error("لا يوجد قالب طباعة لهذا النوع");
  const rep = await build(ctx);
  main.innerHTML = `<div class="preview-bar no-print">
      <a class="btn" href="${back}">→ رجوع</a><a class="btn icon-btn" href="#/" aria-label="الرئيسية">⌂</a>
      <b style="flex:1;min-width:0">${esc(name)}${rec?.status === "approved" ? ' <span class="pill ok">نسخة معتمدة</span>' : id.startsWith("blank-") ? "" : ' <span class="pill">مسودة</span>'}</b>
      <label class="row" style="font-size:13.5px">اتجاه الصفحة <select id="orient" aria-label="اتجاه الصفحة"><option value="">حسب القالب (${rep.orientation === "landscape" ? "عرضي" : "طولي"})</option><option value="portrait">طولي</option><option value="landscape">عرضي</option></select></label>
      <label class="row" style="font-size:13.5px"><input type="checkbox" id="bw"> أبيض وأسود</label>
      <label class="row" style="font-size:13.5px" title="تصغير الصفحة داخل الورقة: صغّريه إذا قُصّت الأطراف أو انقسمت الصفحة على ورقتين، وكبّريه إذا كانت الهوامش كبيرة">حجم الطباعة <select id="pscale" aria-label="حجم الطباعة">${[100, 97, 94, 91, 88, 85, 82, 79, 76, 73, 70].map((v) => `<option value="${v}">${v}%${v === 100 ? " (كامل)" : ""}</option>`).join("")}</select></label>
      <button class="btn primary" id="print">طباعة / حفظ PDF</button>
      <button class="btn" id="word">تصدير Word</button>
      <button class="btn" id="share" title="يرسل الملف (Word) عبر واتساب أو البريد من جهازك">إرسال</button>
      ${!rec && id !== "compiled-ach" && !id.startsWith("blank-") ? `<button class="btn" id="freeze">حفظ نسخة معتمدة</button>` : ""}
    </div>
    <p class="hint no-print" style="margin:10px 0 0">لحفظ PDF: اضغطي «طباعة / حفظ PDF» ثم اختاري «حفظ كـ PDF» (في الجوال: مشاركة ← حفظ في الملفات). الملف مطابق لهذه المعاينة. «إرسال» يرسل الملف بصيغة Word عبر واتساب أو البريد، ولإرساله PDF: احفظيه PDF ثم أرسليه من الملفات.</p>
    <div class="preview-wrap"><div class="sheets" id="sheets"></div></div>
    <div class="flow" id="flow" aria-hidden="true"></div>`;
  const sheets = $("#sheets", main);
  const templateOrientation = rep.orientation || "portrait";
  const oKey = "sijil.orient." + (ctx.kind || ctx.rec?.kind);
  try { const o = localStorage.getItem(oKey); if (o) $("#orient", main).value = o; } catch (_) {}
  let pageStyle = document.getElementById("page-style");
  if (!pageStyle) { pageStyle = document.createElement("style"); pageStyle.id = "page-style"; document.head.appendChild(pageStyle); }
  // حجم الطباعة (تصغير الصفحة داخل الورقة): يُحفظ على هذا الجهاز. الافتراضي في الآيباد وسفاري 82%، وفي غيرهما كامل
  const scKey = "sijil.printscale2", sel = $("#pscale", main);
  let sc = SAFARI || IOS ? 82 : 100;
  try { const v = Number(localStorage.getItem(scKey)); if (v >= 70 && v <= 100) sc = v; } catch (_) {}
  if (![...sel.options].some((o) => Number(o.value) === sc)) sel.insertAdjacentHTML("beforeend", `<option value="${sc}">${sc}%</option>`);
  sel.value = String(sc);
  const applyScale = () => document.documentElement.style.setProperty("--print-s", String(Number(sel.value) / 100));
  applyScale();
  sel.onchange = () => { try { localStorage.setItem(scKey, sel.value); } catch (_) {} applyScale(); };
  const render = async () => {
    rep.bw = $("#bw", main).checked;
    rep.orientation = $("#orient", main).value || templateOrientation;
    // اتجاه ورقة الطباعة يتبع الاختيار. الآيباد والآيفون يطبعان طولياً دائماً، فتُدار الصفحة العرضية وتُصغَّر قليلاً لتدخل كاملة في الورقة
    pageStyle.textContent = IOS ? `@media print { @page { size: A4 portrait; margin: 0; } }` : `@media print { @page { size: A4 ${rep.orientation}; margin: 0; } }`;
    await paginate(rep, sheets); const p = auditPages(sheets); if (p.length) console.warn(p); window.__printAudit = p;
    // كل صفحة داخل «ورقة» للطباعة: تُصغَّر بهامش الأمان، وفي الآيباد تُدار الصفحة العرضية لتطبع على ورقة طولية
    [...sheets.querySelectorAll(":scope > .sheet")].forEach((s) => {
      const land = s.classList.contains("landscape");
      const w = document.createElement("div"); w.className = "fit-page " + (land ? (IOS ? "r" : "l") : "p");
      s.replaceWith(w); w.appendChild(s);
    });
  };
  // المعاينة على الشاشة تُصغَّر لتظهر الصفحة كاملة بعرض الجهاز (الآيباد والجوال)؛ الطباعة لا تتأثر
  // (أُلغي تصغير المعاينة: في الآيفون والآيباد يمنع الحد الأدنى لحجم الخط تصغير النص فيتداخل مع الصفحة)
  const fitPreview = () => {};
  const render0 = render;
  const renderFit = async () => { await render0(); fitPreview(); };
  await renderFit();
  addEventListener("resize", fitPreview);
  $("#bw", main).onchange = renderFit;
  $("#orient", main).onchange = () => { try { localStorage.setItem(oKey, $("#orient", main).value); } catch (_) {} renderFit(); };

  // فتح نافذة الطباعة (اختيار الطابعة أو الحفظ PDF). بعض الصفحات المضمّنة تمنعها، فنكتشف ذلك ونوضّح البديل
  const doPrint = () => {
    if (IOS) { try { window.print(); } catch (_) {} return; } // سفاري الآيباد: لا تُعرف حالة النافذة، فلا تظهر رسالة بديلة
    let opened = false;
    const mark = () => (opened = true);
    window.addEventListener("beforeprint", mark, { once: true });
    const t0 = Date.now();
    try { window.print(); } catch (_) {}
    if (Date.now() - t0 > 400) opened = true; // المتصفح أوقف الصفحة أثناء عرض نافذة الطباعة
    setTimeout(() => {
      window.removeEventListener("beforeprint", mark);
      if (opened) return;
      const framed = (() => { try { return window.self !== window.top; } catch (_) { return true; } })();
      modal({ title: "لم تُفتح نافذة الطباعة", body: framed
        ? `<p>هذه الصفحة معروضة داخل إطار معاينة، والمتصفح يمنع فيه نافذة الطباعة واختيار الطابعة.</p><p>في الموقع بعد نشره على رابطك الخاص تفتح نافذة الطباعة مباشرة عند الضغط على «طباعة».</p><p>يمكنك الآن تجربة فتح الصفحة في نافذة مستقلة ثم الطباعة منها.</p>`
        : `<p>لم يستجب المتصفح لأمر الطباعة. جرّبي اختصار <b dir="ltr">Ctrl+P</b> (أو <b dir="ltr">⌘+P</b> في ماك)، وفي الجوال: زر المشاركة ← طباعة.</p>`,
        actions: framed ? [{ label: "إغلاق", value: null }, { label: "فتح في نافذة مستقلة", kind: "primary", value: "open" }] : [{ label: "حسناً", value: null }] })
        .then((v) => { if (v === "open") window.open(location.href.replace(/([?&])auto=1&?/, "$1"), "_blank", "noopener"); });
    }, 700);
  };
  $("#print", main).onclick = doPrint;
  // الطباعة التلقائية عند فتح المعاينة: سفاري الآيباد يمنعها ويعرض رسالة حظر، فيكتفى فيه بتنبيه للضغط على زر الطباعة
  if (params.auto === "1") {
    history.replaceState(null, "", location.hash.replace(/([?&])auto=1&?/, "$1").replace(/[?&]$/, ""));
    const pdfHint = params.pdf === "1";
    if (IOS) { $("#print", main).classList.add("pulse"); toast(pdfHint ? "اضغطي «طباعة / حفظ PDF» ثم زر المشاركة ← «حفظ في الملفات» ليُحفظ PDF" : "المعاينة جاهزة — اضغطي «طباعة / حفظ PDF»"); }
    else { if (pdfHint) toast("في نافذة الطباعة اختاري «حفظ كـ PDF» (Save as PDF) بدل الطابعة"); setTimeout(doPrint, pdfHint ? 900 : 300); }
  }
  const word = async (mode = "download") => {
    try {
      toast("جارٍ تجهيز ملف Word…");
      const flow = $("#flow", main);
      flow.innerHTML = "";
      const tmp = document.createElement("div"); tmp.className = "sheets"; flow.appendChild(tmp);
      // نسخة متصلة بلا تقسيم صفحات؛ Word يقسم الصفحات بنفسه ويكرر الرأس والتذييل
      const flowRep = { ...rep, blocks: rep.blocks.flatMap((b) => (b.keep ? b.keep : [b])) };
      const { paginate: _p } = await import("../report/paginate.js");
      const sheet = document.createElement("section");
      sheet.className = `sheet ${rep.orientation} ${rep.cls || ""}`; if (rep.style) sheet.setAttribute("style", rep.style);
      sheet.innerHTML = `<div class="sheet-inner ${rep.frame ? "framed" : ""}"><div class="pg-header">${rep.header || ""}</div><div class="pg-identity">${rep.identity || ""}</div><div class="pg-body"></div><div class="pg-footer">${rep.footer || ""}</div></div>`;
      tmp.appendChild(sheet);
      const body = sheet.querySelector(".pg-body");
      // الغلاف وصفحة المحتوى: كل منها في صفحة مستقلة داخل ملف Word
      for (const c of rep.covers || []) { const div = document.createElement("div"); div.className = "blk cover-blk page-after"; div.innerHTML = c; body.appendChild(div); }
      for (const b of flowRep.blocks) {
        const div = document.createElement("div"); div.className = "blk";
        if (b.pageBreak) { const last = body.lastElementChild; if (last) last.classList.add("page-after"); continue; }
        if (b.html) div.innerHTML = b.html;
        else if (b.group) { div.className += " grp " + (b.group.cls || ""); div.innerHTML = b.group.head + `<div class="grp-items">${b.group.items.join("")}</div>`; }
        else if (b.table) { div.className += " tbl"; div.innerHTML = `${b.table.before || ""}<table class="${b.table.cls || ""}">${b.table.colgroup || ""}<thead>${b.table.thead || ""}</thead><tbody>${b.table.rows.join("")}</tbody></table>`; }
        body.appendChild(div);
      }
      await Promise.all([...sheet.querySelectorAll("img")].map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r)))));
      const { exportDocx } = await import("../report/docx.js");
      const blob = await exportDocx(rep, tmp, name);
      const fname = `${name.replace(/[\\/:*?"<>|]/g, "-")}.docx`;
      flow.innerHTML = "";
      window.__lastDocx = blob;
      if (mode === "share") {
        // الإرسال من الجهاز (واتساب، البريد، …)؛ وإن لم يدعم المتصفح ذلك يُنزَّل الملف لإرساله يدوياً
        const file = new File([blob], fname, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === "AbortError") return; }
        }
        download(blob, fname); toast("نُزّل الملف؛ أرسليه من البريد أو واتساب"); return;
      }
      download(blob, fname);
    } catch (e) { console.error(e); toast("تعذر إنشاء ملف Word: " + e.message, "error"); }
  };
  $("#word", main).onclick = () => word();
  $("#share", main).onclick = () => word("share");
  const fr = $("#freeze", main);
  if (fr) fr.onclick = async () => {
    const ok = await modal({ title: "حفظ نسخة معتمدة", body: "<p>تُحفظ هذه الإحصائية كما هي الآن كنسخة ثابتة في «التقارير المعتمدة»، ولا تتغير لاحقاً بتعديل الزيارات.</p>", actions: [{ label: "إلغاء", value: false }, { label: "حفظ واعتماد", kind: "primary", value: true }] });
    if (!ok) return;
    try { await api.create({ kind: "note", title: `${name} — ${ctx.year || ""} ${ctx.term ? "الفترة " + ctx.term : ""}`.trim(), academic_year: ctx.year || state.year, term: ctx.term || null, data: { report_kind: ctx.kind }, status: "approved", snapshot: ctx });
      toast("حُفظت النسخة المعتمدة"); }
    catch (e) { toast(e.message, "error"); }
  };
  if (params.word) word();
}
