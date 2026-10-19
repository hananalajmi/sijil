// زيارة الموجه الفني للمدرسة (وتشمل الزيارة الاستطلاعية وزيارة المتابعة كنوع زيارة إلى أن يصل قالبها الخاص)
import { api } from "../api.js";
import { state, opts, schoolById, teacherById } from "../store.js";
import { esc, $, $$, today, dayName, fmtDate, academicYearOf, toast } from "../ui.js";
import { field, bindFields, recordPage, schoolOptions, teacherOptions, photoSlots, promptNewOption, addTeacherName } from "../kit.js";
import { SCHOOL_VISIT } from "../templates.js";
import { goalsText, recordsText } from "../svtext.js";
import { listView } from "./_list.js";
import { printOptionsPanel, bindPrintOptions } from "./teacherVisit.js";
import { linkedRowsFor, mergeLinked, sameRows, schoolVisitLinker, weeklyFor } from "../svlink.js";

export default async function (main, { id, params }) {
  if (!id) return listView(main, { kind: "school_visit", title: "زيارة الموجه الفني للمدرسة", sub: "الزيارة الاستطلاعية وزيارة المتابعة والتوجيهية تُسجَّل هنا باختيار نوع الزيارة", newLabel: "+ زيارة مدرسة", schoolFilter: true,
    columns: [{ label: "التاريخ", get: (r) => fmtDate(r.record_date) }, { label: "المدرسة", get: (r) => schoolById(r.school_id)?.title || "—" }, { label: "نوع الزيارة", get: (r) => r.data.visit_type },
      { label: "الهدف", get: (r) => (r.data.goals || []).join("، ") }] });

  const rec = id === "new" ? { kind: "school_visit", title: "", record_date: today(), academic_year: state.year, term: opts("terms")[0] || "", school_id: params.school || null,
    data: { visit_type: params.type || "", goals: [], records: [], teacher_rows: [{}], template: SCHOOL_VISIT.version } } : await api.get(id);
  if (!rec) { main.innerHTML = `<div class="container"><div class="empty">السجل غير موجود</div></div>`; return; }
  const wlink = schoolVisitLinker(rec); // تسجيل الزيارة تلقائياً في الإنجازات الأسبوعية

  await recordPage(main, { rec, title: "زيارة الموجه الفني للمدرسة", beforeApprove: (r) => [!r.school_id && "المدرسة", !r.record_date && "التاريخ", !r.data.visit_type && "نوع الزيارة"].filter(Boolean),
    async render(body, ed, approved) {
      // زيارات المعلمين لنفس المدرسة ونفس اليوم تُضاف تلقائياً (ما لم تكن الزيارة معتمدة)
      const resync = async () => {
        if (ed.rec.status === "approved" || !ed.rec.school_id || !ed.rec.record_date) return false;
        const rows = mergeLinked(ed.rec.data.teacher_rows, await linkedRowsFor(ed.rec.school_id, ed.rec.record_date));
        if (sameRows(rows, ed.rec.data.teacher_rows)) return false;
        const first = !(ed.rec.data.teacher_rows || []).some((t) => t.tv) && rows.some((t) => t.tv);
        ed.change((x) => {
          x.data.teacher_rows = rows.length ? rows : [{}];
          if (first && !(x.data.goals || []).includes("زيارة معلم")) x.data.goals = SCHOOL_VISIT.goals.filter((g) => g === "زيارة معلم" || (x.data.goals || []).includes(g));
        });
        return true;
      };
      await resync();
      const r = ed.rec, d = r.data;
      const checks = (name, list, chosen) => `<div class="checks">${list.map((g) => `<label><input type="checkbox" data-list="${name}" value="${esc(g)}" ${chosen?.includes(g) ? "checked" : ""}>${esc(g)}</label>`).join("")}</div>`;
      body.innerHTML = `
      <section class="panel" id="basic"><div class="form">
        <div class="f"><label for="sch" class="req">المدرسة</label><select id="sch" data-key="school_id">${schoolOptions(r.school_id, { allowAdd: true })}</select></div>
        ${field({ label: "التاريخ", key: "record_date", type: "date", value: r.record_date, required: true })}
        <div class="f"><span class="lab">اليوم</span><input readonly id="day" value="${esc(dayName(r.record_date))}"></div>
        ${field({ label: "الفترة الدراسية", key: "term", type: "select", options: opts("terms"), value: r.term })}
        ${field({ label: "نوع الزيارة", key: "visit_type", type: "select", options: opts("school_visit_types"), value: d.visit_type, required: true })}
        <div class="f"><span class="lab">الموجه الفني</span><input readonly value="${esc(state.guide?.data?.full_name || state.profile.full_name)}"></div>
        ${field({ label: "رئيس القسم (للتوقيع)", key: "head_name", value: d.head_name })}
        ${field({ label: "مدير المدرسة (للتوقيع)", key: "principal_name", value: d.principal_name })}
      </div><div class="sv-link" id="wklink" role="status"></div></section>
      <div class="grid2">
        <section class="panel"><h2>الهدف من الزيارة</h2>${checks("goals", SCHOOL_VISIT.goals, d.goals)}${field({ label: "أخرى", key: "goals_other", value: d.goals_other })}
          ${field({ label: "نص الهدف من الزيارة (يُكتب تلقائياً، ويمكنك تعديله)", key: "goals_text", type: "textarea", rows: 3, wide: true, value: d.goals_text || "" })}
          <button type="button" class="btn small ghost" data-regen="goals">↻ إعادة كتابة النص من الاختيارات</button></section>
        <section class="panel"><h2>السجلات التي تمت متابعتها</h2>${checks("records", SCHOOL_VISIT.records, d.records)}${field({ label: "أخرى", key: "records_other", value: d.records_other })}
          ${field({ label: "نص السجلات (يُكتب تلقائياً، ويمكنك تعديله)", key: "records_text", type: "textarea", rows: 3, wide: true, value: d.records_text || "" })}
          <button type="button" class="btn small ghost" data-regen="records">↻ إعادة كتابة النص من الاختيارات</button></section>
      </div>
      <section class="panel"><h2>زيارة معلم + ما تم إنجازه</h2><p class="hint" style="margin-top:0">زيارات المعلمين في هذه المدرسة بنفس التاريخ تُضاف هنا تلقائياً (المظلّلة)، وتُعدَّل من صفحة زيارة المعلم. ويمكن إضافة صف يدوي.</p><div class="tbl-wrap"><table class="data" id="trows"><thead><tr><th>اسم المعلم</th><th>الصف</th><th>الفصل</th><th>الحصة</th><th>عنوان الدرس</th><th></th></tr></thead><tbody></tbody></table></div>
        <div class="row" style="margin-top:8px"><button class="btn small" id="addrow">+ صف معلم</button></div>
        <div style="margin-top:10px">${field({ label: "ما تم إنجازه (كل بند في سطر)", key: "achieved", type: "textarea", value: d.achieved, wide: true, rows: 6 })}</div></section>
      <section class="panel"><h2>ما يستجد من أعمال / التوصيات</h2>${field({ label: "كل توصية في سطر", key: "recommendations", type: "textarea", value: d.recommendations, wide: true, rows: 5 })}</section>
      <section class="panel"><h2>صور (اختياري)</h2><div id="photos"></div></section>
      ${printOptionsPanel(ed)}`;
      // النص التلقائي: يُعاد كتابته عند تغيير الاختيارات ما لم تعدّليه بنفسك
      const GEN = { goals: goalsText, records: recordsText };
      const regen = (which, force = false) => {
        const d2 = ed.rec.data;
        if (!force && d2[which + "_text_manual"]) return;
        const t = GEN[which](d2);
        ed.change((x) => { x.data[which + "_text"] = t; if (force) x.data[which + "_text_manual"] = false; });
        const ta = $(`[data-key='${which}_text']`, body); if (ta) ta.value = t;
      };
      $$("[data-regen]", body).forEach((b) => (b.onclick = () => regen(b.dataset.regen, true)));
      bindFields(body, (k, v) => {
        if (k === "goals_text" || k === "records_text") { ed.change((x) => { x.data[k] = v; x.data[k + "_manual"] = true; }); return; }
        if (k === "goals_other" || k === "records_other") { ed.change((x) => { x.data[k] = v; }); regen(k.split("_")[0]); return; }
        ed.change((x) => {
          if (k === "school_id") x.school_id = v || null;
          else if (k === "record_date") { x.record_date = v || null; x.academic_year = academicYearOf(v || undefined); }
          else if (k === "term") x.term = v; else x.data[k] = v;
          x.title = [schoolById(x.school_id)?.title, x.data.visit_type, fmtDate(x.record_date)].filter(Boolean).join(" — ");
        });
        if (k === "record_date") $("#day", body).value = dayName(ed.rec.record_date);
        if (k === "school_id") { prefillNames(); }
        if (k === "school_id" || k === "record_date") resync().then(() => paintRows());
      });
      $$("[data-list]", body).forEach((cb) => (cb.onchange = () => { ed.change((x) => {
        const L = new Set(x.data[cb.dataset.list] || []); cb.checked ? L.add(cb.value) : L.delete(cb.value);
        const order = cb.dataset.list === "goals" ? SCHOOL_VISIT.goals : SCHOOL_VISIT.records; x.data[cb.dataset.list] = order.filter((g) => L.has(g));
      }); regen(cb.dataset.list); }));
      const tb = $("#trows tbody", body);
      function paintRows() {
        const rows = ed.rec.data.teacher_rows?.length ? ed.rec.data.teacher_rows : [{}];
        tb.innerHTML = rows.map((t, i) => t.tv ? `<tr class="tr-linked" data-i="${i}"><td>${esc(teacherById(t.teacher)?.title || t.teacher_name || "")}<div class="linked-tag">من زيارة المعلم</div></td><td>${esc(t.grade || "")}</td><td>${esc(t.section || "")}</td><td>${esc(t.period || "")}</td><td>${esc(t.lesson || "")}</td><td><a class="btn small ghost" href="#/teacher-visits/${t.tv}" title="فتح زيارة المعلم">فتح</a></td></tr>` : `<tr data-i="${i}"><td><select data-c="teacher" aria-label="المعلم">${teacherOptions(t.teacher, ed.rec.school_id, { allowAdd: true })}</select></td>
          <td><select data-c="grade" data-list="grades" aria-label="الصف"><option value=""></option>${[...new Set([...opts("grades"), t.grade].filter(Boolean))].map((g) => `<option ${g === t.grade ? "selected" : ""}>${esc(g)}</option>`).join("")}<option value="__custom">+ إضافة خيار جديد…</option></select></td>
          <td><select data-c="section" data-list="sections" aria-label="الفصل"><option value=""></option>${[...new Set([...opts("sections"), t.section].filter(Boolean))].map((g) => `<option ${g === t.section ? "selected" : ""}>${esc(g)}</option>`).join("")}<option value="__custom">+ إضافة خيار جديد…</option></select></td>
          <td><select data-c="period" data-list="periods" aria-label="الحصة"><option value=""></option>${[...new Set([...opts("periods"), t.period].filter(Boolean))].map((g) => `<option ${g === t.period ? "selected" : ""}>${esc(g)}</option>`).join("")}<option value="__custom">+ إضافة خيار جديد…</option></select></td><td><input data-c="lesson" value="${esc(t.lesson || "")}" aria-label="عنوان الدرس"></td>
          <td><button class="btn small ghost" data-del aria-label="حذف الصف">✕</button></td></tr>`).join("");
        $$("[data-c]", tb).forEach((el) => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", async () => {
          const i = Number(el.closest("tr").dataset.i);
          if (el.value === "__custom") { if (!(await promptNewOption(el, el.dataset.list))) return; }
          if (el.value === "__new") { const tid = await addTeacherName(ed.rec.school_id); if (!tid) { el.value = ""; return; } ed.change((x) => { x.data.teacher_rows[i] = { ...(x.data.teacher_rows[i] || {}), teacher: tid, teacher_name: teacherById(tid)?.title || "" }; }); paintRows(); return; }
          ed.change((x) => { x.data.teacher_rows ||= [{}]; x.data.teacher_rows[i] = { ...(x.data.teacher_rows[i] || {}), [el.dataset.c]: el.value };
            if (el.dataset.c === "teacher") x.data.teacher_rows[i].teacher_name = teacherById(el.value)?.title || ""; });
        }));
        $$("[data-del]", tb).forEach((b) => (b.onclick = () => { const i = Number(b.closest("tr").dataset.i); ed.change((x) => x.data.teacher_rows.splice(i, 1)); paintRows(); }));
      }
      paintRows();
      // أسماء التوقيع تُقترح من آخر زيارة لنفس المدرسة
      async function prefillNames() {
        if (!ed.rec.school_id || (ed.rec.data.head_name && ed.rec.data.principal_name)) return;
        const prev = (await api.list({ kind: "school_visit", school: ed.rec.school_id })).find((v) => v.id !== ed.rec.id && (v.data.head_name || v.data.principal_name));
        if (!prev) return;
        ed.change((x) => { x.data.head_name ||= prev.data.head_name || ""; x.data.principal_name ||= prev.data.principal_name || ""; });
        body.querySelector("[data-key=head_name]").value = ed.rec.data.head_name; body.querySelector("[data-key=principal_name]").value = ed.rec.data.principal_name;
      }
      if (!ed.rec.id) prefillNames();
      $("#addrow", body).onclick = () => { ed.change((x) => (x.data.teacher_rows = [...(x.data.teacher_rows || []), {}])); paintRows(); };
      photoSlots($("#photos", body), d.photos || [], 3, (ids) => ed.change((x) => (x.data.photos = ids), { immediate: true }), { recordId: r.id });
      bindPrintOptions(body, ed);
      // الربط بالإنجازات الأسبوعية
      const paintWk = async () => {
        const box = $("#wklink", body); if (!box) return;
        if (!ed.rec.record_date || !ed.rec.school_id) { box.innerHTML = `<span class="hint">بعد اختيار المدرسة والتاريخ تُسجَّل هذه الزيارة تلقائياً في «الإنجازات الأسبوعية» لأسبوعها.</span>`; return; }
        const wr = await weeklyFor(ed.rec.record_date).catch(() => null);
        box.innerHTML = wr ? `<span>✓ مسجّلة في الإنجازات الأسبوعية: الأسبوع <b>${esc(wr.data.week_label || "")}</b> (من ${fmtDate(wr.data.week_start)})${wr.status === "approved" ? ' <span class="pill ok">معتمد، لا يتغير إلا بإلغاء اعتماده</span>' : ""}</span> <a class="btn small" href="#/weekly/${wr.id}">فتح الإنجازات الأسبوعية</a>`
          : `<span class="hint">تُسجَّل في الإنجازات الأسبوعية عند الحفظ (أيام الأحد إلى الخميس).</span>`;
      };
      ed.afterSave = async (saved) => {
        const res = await wlink(saved);
        if (res?.created) toast("سُجّلت الزيارة في «الإنجازات الأسبوعية» لهذا الأسبوع.");
        else if (res?.approved) toast("الإنجازات الأسبوعية لهذا الأسبوع معتمدة، فلم تُضف إليها الزيارة. ألغي اعتمادها لإضافتها.", "error");
        if (res) paintWk();
      };
      ed.afterTrash = (gone) => wlink(gone, { removed: true });
      paintWk();
    } });
}
