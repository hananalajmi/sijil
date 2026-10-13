// الإنجازات الشهرية — «إنجازات التوجيه الفني للعلوم» بأقسامها الثمانية.
// تُقترح البيانات تلقائياً من سجلات الشهر (فعاليات، تواريخ هامة، زيارات، امتحانات) دون تكرار.
import { api } from "../api.js";
import { state, G, opts } from "../store.js";
import { esc, $, $$, today, fmtDate, dayName, academicYearOf, MONTHS_AR, toast } from "../ui.js";
import { field, bindFields, recordPage, go, photoSlots } from "../kit.js";
import { listView } from "./_list.js";
import { monthlyAuto, mergeRows, mergeText, compiledMonthlyContext } from "../report/context.js";
import { MONTHLY_ACH } from "../templates.js";
import { printOptionsPanel, bindPrintOptions } from "./teacherVisit.js";

const mLabel = (m) => { const [y, n] = (m || "").split("-"); return n ? `${MONTHS_AR[Number(n) - 1]} ${y}` : ""; };

// يدمج الاقتراحات التلقائية في السجل؛ يعيد عدد ما أُضيف
function applyAuto(x, auto) {
  let added = 0;
  for (const [path, linesArr] of Object.entries(auto.text)) {
    const [k, i] = path.split(".");
    if (i === undefined) { const r = mergeText(x.data[k] || "", linesArr); x.data[k] = r.text; added += r.added; }
    else { x.data[k] ||= {}; const r = mergeText(x.data[k][i] || "", linesArr); x.data[k][i] = r.text; added += r.added; }
  }
  for (const [k, rows] of Object.entries(auto.tables)) { const r = mergeRows(x.data[k] || [], rows); x.data[k] = r.rows; added += r.added; }
  return added;
}

export default async function (main, ctx) {
  if (ctx.name === "compile") return compile(main, ctx);
  const { id, params } = ctx;
  if (!id) return listView(main, { kind: "monthly_achievements", title: "الإنجازات الشهرية (النموذج السابق)", sub: "إنجازات التوجيه الفني للعلوم — تُقترح تلقائياً من سجلات الشهر", newLabel: "+ إنجازات شهر",
    sort: (a, b) => (b.data.month || "").localeCompare(a.data.month || ""),
    columns: [{ label: "الشهر", get: (r) => mLabel(r.data.month) }, { label: "أُرسلت للتجميع", get: (r) => (r.data.submitted ? "نعم" : "لا") }] });
  let rec;
  if (id === "new") {
    const month = params.month || today().slice(0, 7);
    const ex = (await api.list({ kind: "monthly_achievements" })).find((p) => p.data.month === month);
    if (ex) { location.replace(`#/monthly-ach-old/${ex.id}`); return; }
    rec = { kind: "monthly_achievements", title: `إنجازات ${mLabel(month)}`, record_date: month + "-01", academic_year: academicYearOf(month + "-01"),
      data: { template: MONTHLY_ACH.version, month, books: {}, quality: {}, committees: {}, delivered: [], supervised: [], meetings: [], attended: [], photos: [], submitted: false, guide_name: G().full_name || "" } };
    applyAuto(rec, await monthlyAuto(month));
  } else rec = await api.get(id);
  if (!rec) { main.innerHTML = `<div class="container"><div class="empty">السجل غير موجود</div></div>`; return; }

  await recordPage(main, { rec, title: "الإنجازات الشهرية — إنجازات التوجيه الفني للعلوم", render(body, ed) {
    const d = ed.rec.data;
    const sec = (si) => MONTHLY_ACH.sections[si];
    const tableEditor = (key, cols) => `<div class="tbl-wrap"><table class="data" data-tbl="${key}"><thead><tr>${cols.map(([, l]) => `<th>${esc(l)}</th>`).join("")}<th></th></tr></thead><tbody></tbody></table></div>
      <button class="btn small" data-addrow="${key}" style="margin-top:6px">+ صف</button>`;
    const EVC = [["event", "الفعالية"], ["date", "اليوم و التاريخ"], ["place", "المكان"], ["target", "الفئة المستهدفة"]];
    const MC = [["meeting", "الإجتماع"], ["date", "اليوم و التاريخ"], ["place", "المكان"], ["manager", "إدارة الإجتماع"], ["target", "الفئة المستهدفة"]];
    const rowsFields = (key, labels) => labels.map((l, i) => field({ label: l, key: `${key}.${i}`, type: "textarea", value: d[key]?.[i], wide: true, rows: 3 })).join("");
    body.innerHTML = `
    <section class="panel" id="basic"><div class="form">${field({ label: "الشهر", key: "month", type: "month", value: d.month })}</div>
      <label class="row" style="margin-top:10px"><input type="checkbox" id="sub" ${d.submitted ? "checked" : ""}> إرسال إنجازاتي إلى المسؤول عن التجميع (المقرر) ليجمعها مع إنجازات الزملاء</label>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="sync">تحديث من السجلات</button><span class="hint">يضيف من فعاليات الشهر وتواريخه الهامة وزياراته وامتحاناته ما لم يُضف بعد، ولا يمسح ما كتبتِه.</span></div></section>
    <section class="panel"><h2>أولاً: ${esc(sec(0).title)}</h2><div class="form">${rowsFields("books", sec(0).parts[0].rows)}</div></section>
    <section class="panel"><h2>ثانياً: ${esc(sec(1).title)}</h2>
      <h3>${esc(sec(1).parts[0].head)}</h3>${tableEditor("delivered", EVC)}
      <h3 style="margin-top:14px">${esc(sec(1).parts[1].head)}</h3>${tableEditor("supervised", EVC)}</section>
    <section class="panel"><h2>ثالثاً: ${esc(sec(2).title)}</h2><div class="form">${rowsFields("quality", sec(2).parts[0].rows)}</div></section>
    <section class="panel"><h2>رابعاً: ${esc(sec(3).title)}</h2><h3>${esc(sec(3).parts[0].head)}</h3>${tableEditor("meetings", MC)}
      <h3 style="margin-top:14px">${esc(sec(3).parts[1].head)}</h3><div class="form">${rowsFields("committees", sec(3).parts[1].rows)}</div></section>
    <section class="panel"><h2>خامساً: ${esc(sec(4).title)}</h2><h3>${esc(sec(4).parts[0].head)}</h3>${tableEditor("attended", EVC)}
      <div style="margin-top:12px">${field({ label: sec(4).parts[1].head + " (كل نقطة في سطر)", key: "opinions", type: "textarea", value: d.opinions, wide: true })}</div></section>
    <section class="panel"><h2>سادساً: ${esc(sec(5).title)}</h2>${field({ label: "كل نقطة في سطر", key: "activities", type: "textarea", value: d.activities, wide: true })}</section>
    <section class="panel"><h2>سابعاً: ${esc(sec(6).title)}</h2>${field({ label: "كل نقطة في سطر", key: "exams", type: "textarea", value: d.exams, wide: true })}</section>
    <section class="panel"><h2>ثامناً: ${esc(sec(7).title)}</h2><div id="photos"></div><button class="btn small" id="addph" style="margin-top:8px">+ صورة فعالية</button></section>
    ${printOptionsPanel(ed, { sigsEveryPage: true })}`;

    const paintTable = (key, cols) => {
      const tb = body.querySelector(`[data-tbl=${key}] tbody`);
      const rows = ed.rec.data[key] || [];
      tb.innerHTML = rows.map((r, i) => `<tr data-i="${i}">${cols.map(([c]) => c === "date" ? `<td><input type="date" data-c="date" value="${esc(r.date || "")}"></td>`
          : c === "target" ? `<td><input data-c="target" list="tg" value="${esc(r.target || "")}"></td>` : `<td><input data-c="${c}" value="${esc(r[c] || "")}"></td>`).join("")}
        <td><button class="btn small ghost" data-del aria-label="حذف">✕</button>${r.src ? '<span class="pill acc" title="من السجلات">تلقائي</span>' : ""}</td></tr>`).join("") || `<tr><td colspan="${cols.length + 1}" class="hint">لا توجد صفوف.</td></tr>`;
      $$("tr[data-i]", tb).forEach((tr) => {
        const i = Number(tr.dataset.i);
        $$("[data-c]", tr).forEach((inp) => inp.addEventListener("input", () => ed.change((x) => (x.data[key][i] = { ...x.data[key][i], [inp.dataset.c]: inp.value }))));
        tr.querySelector("[data-del]").onclick = () => { ed.change((x) => x.data[key].splice(i, 1)); paintTable(key, cols); };
      });
    };
    const TABLES = { delivered: EVC, supervised: EVC, attended: EVC, meetings: MC };
    body.insertAdjacentHTML("beforeend", `<datalist id="tg">${opts("target_groups").map((t) => `<option value="${esc(t)}">`).join("")}</datalist>`);
    Object.entries(TABLES).forEach(([k, c]) => paintTable(k, c));
    $$("[data-addrow]", body).forEach((b) => (b.onclick = () => { const k = b.dataset.addrow; ed.change((x) => (x.data[k] = [...(x.data[k] || []), {}])); paintTable(k, TABLES[k]); }));

    const phBox = $("#photos", body);
    const paintPhotos = () => {
      const list = ed.rec.data.photos || [];
      phBox.innerHTML = list.length ? list.map((p, i) => `<div class="panel" data-i="${i}" style="background:var(--sunk)"><div class="form">
          <div class="f"><label>اسم الفعالية</label><input data-c="event" value="${esc(p.event || "")}"></div>
          <div class="f"><label>اليوم / التاريخ</label><input type="date" data-c="date" value="${esc(p.date || "")}"></div>
          <div class="f"><label>مكان الفعالية</label><input data-c="place" value="${esc(p.place || "")}"></div></div>
          <div class="ph" style="margin-top:8px"></div><button class="btn small danger" data-del style="margin-top:6px">حذف</button></div>`).join("") : `<p class="hint">تُضاف تلقائياً صور تقارير الفعاليات في هذا الشهر، ويمكنك إضافة غيرها.</p>`;
      $$(".panel[data-i]", phBox).forEach((el) => {
        const i = Number(el.dataset.i);
        $$("[data-c]", el).forEach((inp) => inp.addEventListener("input", () => ed.change((x) => (x.data.photos[i] = { ...x.data.photos[i], [inp.dataset.c]: inp.value }))));
        photoSlots(el.querySelector(".ph"), list[i].photo ? [list[i].photo] : [], 1, (ids) => ed.change((x) => (x.data.photos[i] = { ...x.data.photos[i], photo: ids[0] || null }), { immediate: true }), { recordId: ed.rec.id });
        el.querySelector("[data-del]").onclick = () => { ed.change((x) => x.data.photos.splice(i, 1)); paintPhotos(); };
      });
    };
    paintPhotos();
    $("#addph", body).onclick = () => { ed.change((x) => (x.data.photos = [...(x.data.photos || []), {}])); paintPhotos(); };

    bindFields(body, async (k, v) => {
      if (k === "month") {
        if (!v) return;
        const ex = (await api.list({ kind: "monthly_achievements" })).find((p) => p.data.month === v && p.id !== ed.rec.id);
        if (ex) { toast("توجد إنجازات لهذا الشهر، فُتحت لك"); go(`#/monthly-ach-old/${ex.id}`); return; }
        ed.change((x) => { x.data.month = v; x.record_date = v + "-01"; x.academic_year = academicYearOf(v + "-01"); x.title = `إنجازات ${mLabel(v)}`; });
        return;
      }
      ed.change((x) => { if (k.includes(".")) { const [a, i] = k.split("."); x.data[a] ||= {}; x.data[a][i] = v; } else x.data[k] = v; });
    });
    $("#sub", body).onchange = (e) => ed.change((x) => { x.data.submitted = e.target.checked; x.data.guide_name = G().full_name || state.profile.full_name; }, { immediate: true });
    $("#sync", body).onclick = async () => {
      const auto = await monthlyAuto(ed.rec.data.month);
      let added = 0; ed.change((x) => { added = applyAuto(x, auto); });
      toast(added ? `أُضيف ${added} عنصر جديد من السجلات` : "لا يوجد جديد في سجلات هذا الشهر"); ed.redraw();
    };
    bindPrintOptions(body, ed);
  } });
}

/* ======================= تجميع الإنجازات (المسؤول عن التجميع / المقرر) ======================= */
async function compile(main, { params }) {
  if (!state.profile.is_collector) { main.innerHTML = `<div class="container"><div class="empty"><h2>هذه الصفحة للمسؤول عن التجميع</h2><p>يحدده المشرف من صفحة الحسابات والصلاحيات.</p></div></div>`; return; }
  const month = params.month || today().slice(0, 7);
  const ctx = await compiledMonthlyContext(month);
  const weekly = await api.listSubmitted("weekly_report", "month", month).catch(() => []);
  main.innerHTML = `<div class="container"><div class="page-head"><div><h1>تجميع الإنجازات</h1><div class="sub">تظهر هنا فقط التقارير التي أرسلها الموجّهون إليك، ولا يمكنك تعديلها</div></div></div>
    <div class="toolbar"><input type="month" id="m" value="${month}" aria-label="الشهر"></div>
    <section class="panel"><h2>الإنجازات الشهرية المجمعة — ${esc(mLabel(month))}</h2>
      ${ctx.count ? `<p>${ctx.count} موجّه أرسلوا إنجازاتهم: ${ctx.names.map(esc).join("، ")}</p><div class="row"><a class="btn primary" href="#/print/compiled-ach?month=${month}&auto=1">طباعة التقرير المجمع / PDF</a><a class="btn" href="#/print/compiled-ach?month=${month}">معاينة</a><a class="btn" href="#/print/compiled-ach?month=${month}&word=1">Word</a></div>`
        : `<p class="hint">لم يرسل أحد إنجازاته لهذا الشهر بعد.</p>`}</section>
    <section class="panel"><h2>التقارير الأسبوعية المرسلة — ${esc(mLabel(month))}</h2>
      ${weekly.length ? `<div class="list">${weekly.sort((a, b) => a.data.week_start.localeCompare(b.data.week_start)).map((w) => `<a class="item" href="#/print/${w.id}"><span class="t">${esc(w.data.guide_name || "")}</span><span class="m">الأسبوع ${esc(w.data.week_label || "")} — من ${fmtDate(w.data.week_start)}</span><span class="s"><span class="btn small">معاينة / طباعة</span></span></a>`).join("")}</div>` : `<p class="hint">لا توجد تقارير أسبوعية مرسلة لهذا الشهر.</p>`}</section></div>`;
  $("#m", main).onchange = (e) => go(`#/compile?month=${e.target.value}`);
}
