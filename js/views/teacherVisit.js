// زيارة المعلم / رئيس القسم — شاشة إدخال تفاعلية، وطباعة على هيئة النموذج الرسمي المختصر
import { api } from "../api.js";
import { state, opts, schoolById, teacherById, fileUrl, setMyOptions } from "../store.js";
import { esc, $, $$, today, dayName, fmtDate, academicYearOf, toast, modal } from "../ui.js";
import { field, bindFields, recordPage, schoolOptions, teacherOptions, photoSlots, signaturePad, addTeacherName, promptNewOption } from "../kit.js";
import { TEACHER_VISIT, tvOptionKey, TV_LEVELS } from "../templates.js";
import { listView } from "./_list.js";
import { teacherVisitLinker, schoolVisitFor } from "../svlink.js";

export function printOptionsPanel(ed, { sigsEveryPage = false } = {}) {
  const p = ed.rec.data.print || {};
  const g = state.guide?.data || {};
  return `<section class="panel"><h2>خيارات الطباعة لهذا التقرير</h2><div class="print-opts">
    ${sigsEveryPage ? `<label><input type="checkbox" data-p="sigsEveryPage" ${p.sigsEveryPage !== false ? "checked" : ""}> تكرار التوقيعات في كل صفحة</label>` : ""}
    <label><input type="checkbox" data-p="showSignature" ${p.showSignature ? "checked" : ""} ${g.signature ? "" : "disabled"}> إظهار توقيعي</label>
    <label><input type="checkbox" data-p="showStamp" ${p.showStamp ? "checked" : ""} ${g.stamp ? "" : "disabled"}> إظهار ختمي</label>
    <label><input type="checkbox" data-p="showDate" ${p.showDate ? "checked" : ""}> إظهار تاريخ التوقيع</label>
    <input type="date" data-p="date" value="${esc(p.date || today())}" aria-label="تاريخ التوقيع">
    ${g.signature && g.stamp ? "" : `<a href="#/settings">رفع التوقيع والختم من الإعدادات</a>`}</div></section>`;
}
export function bindPrintOptions(body, ed) {
  $$("[data-p]", body).forEach((el) => el.addEventListener("change", () => ed.change((r) => { r.data.print = { ...(r.data.print || {}), [el.dataset.p]: el.type === "checkbox" ? el.checked : el.value }; })));
}

function visitNumber(rec, all) {
  if (!rec.teacher_id || !rec.record_date) return "";
  const same = all.filter((v) => v.teacher_id === rec.teacher_id && v.academic_year === rec.academic_year && v.term === rec.term && v.id !== rec.id);
  return same.filter((v) => (v.record_date || "") < rec.record_date || ((v.record_date || "") === rec.record_date && v.created_at < (rec.created_at || "9"))).length + 1;
}

export default async function (main, { id, params }) {
  if (!id) return listView(main, { kind: "teacher_visit", title: "زيارة المعلم / رئيس القسم", sub: "كل زيارة تدخل تلقائياً في إحصائية زيارات المعلمين مرة واحدة", newLabel: "+ زيارة جديدة", schoolFilter: true,
    columns: [{ label: "التاريخ", get: (r) => fmtDate(r.record_date) }, { label: "المعلم", get: (r) => teacherById(r.teacher_id)?.title || "—" }, { label: "المدرسة", get: (r) => schoolById(r.school_id)?.title || "" },
      { label: "الصف", get: (r) => [r.data.grade, r.data.section].filter(Boolean).join("/") }, { label: "الدرس", get: (r) => r.data.lesson }, { label: "الفترة", get: (r) => r.term }] });

  const t0 = teacherById(params.teacher);
  const rec = id === "new" ? { kind: "teacher_visit", title: "", record_date: today(), academic_year: state.year, term: opts("terms")[0] || "",
    teacher_id: t0?.id || null, school_id: t0?.school_id || null, data: { visitee: "teacher", subject: opts("subjects")[0] || "كيمياء", items: {}, photos: [], template: TEACHER_VISIT.version } } : await api.get(id);
  if (!rec) { main.innerHTML = `<div class="container"><div class="empty">السجل غير موجود</div></div>`; return; }
  const all = await api.list({ kind: "teacher_visit" });
  const link = teacherVisitLinker(rec); // تسجيل الزيارة تلقائياً في زيارة الموجه للمدرسة

  await recordPage(main, { rec, title: "زيارة رئيس قسم - موجه فني للمعلم", beforeApprove: (r) => [
      !r.school_id && "المدرسة", !r.teacher_id && "اسم المعلم", !r.record_date && "تاريخ الزيارة", !r.term && "الفصل الدراسي"].filter(Boolean),
    async render(body, ed) {
      const r = ed.rec, d = r.data;
      d.items ||= {};
      body.innerHTML = `
      <section class="panel" id="basic"><div class="form">
        <div class="f"><label for="sch" class="req">المدرسة</label><select id="sch" data-key="school_id">${schoolOptions(r.school_id, { allowAdd: true })}</select></div>
        <div class="f"><label for="tch" class="req">اسم المعلم</label><select id="tch" data-key="teacher_id">${teacherOptions(r.teacher_id, r.school_id, { allowAdd: true })}</select><div class="hint">تظهر معلمات المدرسة المختارة فقط</div></div>
        ${field({ label: "صفة من تمت زيارته", key: "visitee", type: "select", options: ["معلم", "رئيس قسم"], value: d.visitee === "head" ? "رئيس قسم" : "معلم", custom: false })}
        ${field({ label: "المادة", key: "subject", type: "select", options: opts("subjects"), value: d.subject, remember: "subjects" })}
        ${field({ label: "الصف", key: "grade", type: "select", options: opts("grades"), value: d.grade })}
        ${field({ label: "الشعبة", key: "section", type: "select", options: opts("sections"), value: d.section, remember: "sections" })}
        ${field({ label: "تاريخ الزيارة", key: "record_date", type: "date", value: r.record_date, required: true })}
        <div class="f"><span class="lab">اليوم</span><input readonly id="day" value="${esc(dayName(r.record_date))}"></div>
        ${field({ label: "الفصل الدراسي", key: "term", type: "select", options: opts("terms"), value: r.term, required: true })}
        ${field({ label: "الحصة", key: "period", type: "select", options: opts("periods"), value: d.period, custom: false })}
        <div class="f"><span class="lab">رقم الزيارة</span><input readonly id="vno" value="${visitNumber(r, all)}"><div class="hint">يُحسب تلقائياً لهذا المعلم في الفصل نفسه</div></div>
        ${field({ label: "المكان", key: "place", type: "select", options: opts("places"), value: d.place, remember: "places" })}
        ${field({ label: "عنوان الدرس", key: "lesson", value: d.lesson, wide: true })}
      </div><div class="sv-link" id="svlink" role="status"></div></section>
      <p class="hint">لكل بند ثلاثة مستويات جاهزة؛ اختاري منها أو اكتبي ملاحظة. «تعديل الخيارات» يضيف أو يغيّر خيارات البند لك وحدك. يمكن ترك أي بند فارغاً، ولن يظهر في الطباعة.</p>
      <div class="tv-sections">${TEACHER_VISIT.sections.map((s) => `<div class="tv-sec" data-s="${s.key}"><h3>${esc(s.screenTitle)}<small data-count></small></h3>
        ${s.items.map((label, i) => { const v = d.items[s.key]?.[i] || ""; const list = opts(tvOptionKey(s.key, i)); const isList = !v || list.includes(v);
          return `<div class="tv-item ${v ? "filled" : ""}" data-i="${i}"><span class="n">${i + 1}</span><span class="lbl">${esc(label)}</span><div class="ctl">
            <div class="row" style="flex-wrap:nowrap"><select aria-label="${esc(label)}" style="flex:1;min-width:0"><option value="">—</option>${list.map((o, k) => `<option value="${esc(o)}" ${o === v ? "selected" : ""}>${["●●●", "●●○", "●○○"][k] ? ["●●●", "●●○", "●○○"][k] + " " : ""}${esc(o)}</option>`).join("")}<option value="__add">+ إضافة خيار جديد للقائمة…</option><option value="__text" ${!isList ? "selected" : ""}>✎ كتابة ملاحظة…</option></select>
            <button type="button" class="btn small ghost" data-editopts title="تعديل خيارات هذا البند">تعديل الخيارات</button></div>
            <textarea aria-label="ملاحظة: ${esc(label)}" ${isList ? "hidden" : ""}>${isList ? "" : esc(v)}</textarea></div></div>`; }).join("")}</div>`).join("")}</div>
      <section class="panel" style="margin-top:14px"><h2>التوصيات</h2>${field({ label: "كل توصية في سطر", key: "recommendations", type: "textarea", value: d.recommendations, wide: true, rows: 5 })}</section>
      <section class="panel"><h2>توثيق الزيارة</h2><p class="hint">حتى 3 صور، وتُطبع أسفل التوصيات.</p><div id="photos"></div></section>
      <section class="panel"><h2>التوقيعات على الشاشة</h2><div class="row" id="sigs"></div></section>
      ${printOptionsPanel(ed)}`;

      const counts = () => $$(".tv-sec", body).forEach((sec) => { const n = $$(".tv-item.filled", sec).length; sec.querySelector("[data-count]").textContent = n ? `${n} مُختار` : ""; });
      counts();
      bindFields($("#basic", body), (k, v) => {
        ed.change((x) => {
          if (k === "school_id") { x.school_id = v || null; if (x.teacher_id && teacherById(x.teacher_id)?.school_id !== x.school_id) x.teacher_id = null; }
          else if (k === "teacher_id") { if (v === "__new") return; x.teacher_id = v || null; const t = teacherById(v); if (t) x.school_id = t.school_id || x.school_id; }
          else if (k === "record_date") { x.record_date = v || null; x.academic_year = academicYearOf(v || undefined); }
          else if (k === "term") x.term = v;
          else if (k === "visitee") x.data.visitee = v === "رئيس قسم" ? "head" : "teacher";
          else x.data[k] = v;
          x.title = [teacherById(x.teacher_id)?.title, fmtDate(x.record_date)].filter(Boolean).join(" — ");
        });
        if (k === "school_id") $("#tch", body).innerHTML = teacherOptions(ed.rec.teacher_id, ed.rec.school_id, { allowAdd: true });
        if (k === "teacher_id" && v === "__new") {
          addTeacherName(ed.rec.school_id).then((tid) => {
            if (tid) ed.change((x) => { x.teacher_id = tid; x.title = [teacherById(tid)?.title, fmtDate(x.record_date)].filter(Boolean).join(" — "); });
            $("#tch", body).innerHTML = teacherOptions(ed.rec.teacher_id, ed.rec.school_id, { allowAdd: true });
            $("#vno", body).value = visitNumber(ed.rec, all);
          });
          return;
        }
        if (k === "teacher_id") $("#sch", body).value = ed.rec.school_id || "";
        if (k === "record_date") $("#day", body).value = dayName(ed.rec.record_date);
        $("#vno", body).value = visitNumber(ed.rec, all);
      });
      $$(".tv-item", body).forEach((it) => {
        const s = it.closest(".tv-sec").dataset.s, i = Number(it.dataset.i);
        const sel = it.querySelector("select"), ta = it.querySelector("textarea");
        const set = (v) => { ed.change((x) => { x.data.items[s] ||= []; x.data.items[s][i] = v; }); it.classList.toggle("filled", !!v.trim()); counts(); };
        sel.onchange = async () => {
          if (sel.value === "__add") { const v = await promptNewOption(sel, tvOptionKey(s, i)); ta.hidden = true; ta.value = ""; set(v || ""); return; }
          if (sel.value === "__text") { ta.hidden = false; ta.focus(); set(ta.value); } else { ta.hidden = true; ta.value = ""; set(sel.value); } };
        ta.oninput = () => set(ta.value);
        it.querySelector("[data-editopts]").onclick = async () => {
          const key = tvOptionKey(s, i);
          const items = await modal({ title: "خيارات: " + TEACHER_VISIT.sections.find((x) => x.key === s).items[i],
            body: `<p class="hint">كل خيار في سطر، والأسطر الثلاثة الأولى تمثل المستويات (عالٍ، متوسط، يحتاج إلى تحسين). التعديل لك وحدك ولا يغيّر الزيارات السابقة.</p><div class="f"><textarea id="oi" rows="7">${esc(opts(key).join("\n"))}</textarea></div>`,
            actions: [{ label: "إلغاء", value: null }, { label: "استعادة الافتراضي", value: "reset" }, { label: "حفظ", kind: "primary", value: (b) => b.querySelector("#oi").value.split("\n").map((x) => x.trim()).filter(Boolean) }] });
          if (!items) return;
          const list = items === "reset" ? [...(TV_LEVELS[s]?.[i] || [])] : items;
          await setMyOptions(key, list);
          const cur = ed.rec.data.items?.[s]?.[i] || "";
          sel.innerHTML = `<option value="">—</option>${list.map((o, k) => `<option value="${esc(o)}" ${o === cur ? "selected" : ""}>${["●●●", "●●○", "●○○"][k] ? ["●●●", "●●○", "●○○"][k] + " " : ""}${esc(o)}</option>`).join("")}<option value="__add">+ إضافة خيار جديد للقائمة…</option><option value="__text">✎ كتابة ملاحظة…</option>`;
          if (cur && !list.includes(cur)) { sel.value = "__text"; ta.hidden = false; ta.value = cur; }
          toast("حُفظت خيارات البند");
        };
      });
      bindFields(body.querySelector("section:nth-of-type(2)"), (k, v) => ed.change((x) => (x.data[k] = v)));
      // الربط بزيارة المدرسة: بعد كل حفظ تُحدَّث زيارة المدرسة لنفس اليوم (أو تُنشأ)
      const paintLink = async () => {
        const box = $("#svlink", body); if (!box) return;
        const sv = await schoolVisitFor(ed.rec).catch(() => null);
        box.innerHTML = !ed.rec.school_id || !ed.rec.record_date ? `<span class="hint">بعد اختيار المدرسة والتاريخ تُسجَّل هذه الزيارة تلقائياً في «زيارة الموجه للمدرسة» لنفس اليوم.</span>`
          : sv ? `<span>✓ مسجّلة في زيارة الموجه للمدرسة: <b>${esc(schoolById(sv.school_id)?.title || "")}</b> — ${fmtDate(sv.record_date)}${sv.status === "approved" ? ' <span class="pill ok">معتمدة، لا تتغير إلا بإلغاء اعتمادها</span>' : ""}</span> <a class="btn small" href="#/school-visits/${sv.id}">فتح زيارة المدرسة وإكمال البنود</a>`
          : `<span class="hint">ستُسجَّل في زيارة المدرسة عند الحفظ.</span>`;
      };
      ed.afterSave = async (saved) => {
        const res = await link(saved);
        if (res?.created) toast("سُجّلت الزيارة في «زيارة الموجه للمدرسة» لهذا اليوم. أكملي باقي بنودها من هناك.");
        else if (res?.approved) toast("زيارة المدرسة لهذا اليوم معتمدة، فلم تُضف إليها هذه الزيارة. ألغي اعتمادها لإضافتها.", "error");
        if (res) paintLink();
      };
      ed.afterTrash = (gone) => link(gone, { removed: true });
      paintLink();
      photoSlots($("#photos", body), d.photos || [], 3, (ids) => ed.change((x) => (x.data.photos = ids), { immediate: true }), { recordId: r.id });
      const sigBox = $("#sigs", body);
      const paintSigs = async () => {
        const slot = async (key, label) => { const u = ed.rec.data[key] ? await fileUrl(ed.rec.data[key]) : null;
          return `<div class="f" style="min-width:220px"><span class="lab">${label}</span>${u ? `<img src="${u}" alt="" style="height:70px;background:#fff;border:1px solid var(--line);border-radius:6px">` : '<span class="hint">لا يوجد</span>'}
            <div class="row"><button class="btn small" data-sig="${key}">${u ? "إعادة التوقيع" : "توقيع على الشاشة"}</button>${u ? `<button class="btn small ghost" data-clear="${key}">إزالة</button>` : ""}</div></div>`; };
        sigBox.innerHTML = (await slot("teacher_signature", ed.rec.data.visitee === "head" ? "توقيع رئيس القسم (المُزار)" : "توقيع معلم الفصل")) + (ed.rec.data.visitee === "head" ? "" : await slot("head_signature", "توقيع رئيس القسم"));
        $$("[data-sig]", sigBox).forEach((b) => (b.onclick = async () => {
          const f = await signaturePad("التوقيع"); if (!f) return;
          try { const up = await api.upload(f, { category: "signature", record_id: ed.rec.id, title: "توقيع" }); ed.change((x) => (x.data[b.dataset.sig] = up.id), { immediate: true }); paintSigs(); }
          catch (e) { toast("تعذر حفظ التوقيع: " + e.message, "error"); }
        }));
        $$("[data-clear]", sigBox).forEach((b) => (b.onclick = () => { ed.change((x) => (x.data[b.dataset.clear] = null), { immediate: true }); paintSigs(); }));
      };
      paintSigs();
      bindPrintOptions(body, ed);
    } });
}
