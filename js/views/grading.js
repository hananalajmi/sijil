// لجان تقدير درجات الامتحان (نموذج: الاسم، الرقم المدني، مركز العمل، العمل في اللجنة)
// التعبئة من ميزانية المدارس (معلمو كل مدرسة)، والتوزيع مصححان لكل مراجع،
// واستبعاد (حالات خاصة / غير ملتزمة بالحضور / إحالة)، وتلوين الاسم حسب الفئة.
import { api } from "../api.js";
import { state, G } from "../store.js";
import { esc, $, $$, today, toast, modal, confirmBox } from "../ui.js";
import { field, bindFields, recordPage } from "../kit.js";
import { FORMS } from "../templates.js";
import { normCivil, paintCivil } from "./forms.js";

const T = FORMS.grading;
const rid = () => Math.random().toString(36).slice(2, 10);
const CATS = [["", "عادي (أسود)"], ["new", "جديد (أحمر)"], ["expert", "خبرة (أخضر)"], ["head", "رئيس قسم (أزرق)"]];
const CAT_COLOR = { new: "#c62828", expert: "#2e7d32", head: "#1565c0" };
const ROLES = ["مصحح", "مراجع"];
const EXCL = ["حالات خاصة", "غير ملتزمة بالحضور", "إحالة"];
const schoolTitle = (id) => state.schools.find((s) => s.id === id)?.title || "";
// اسم الموجه الذي أضاف الصف (يظهر في الشاشة فقط، لا في المطبوع)
const myName = () => String(G().full_name || state.profile?.full_name || "").trim();
export const isGradingPurpose = (d) => !d.purpose || d.purpose === T.purposes[0];

export function newGrading() {
  // ملف مشترك بين الموجهين (نفس صلاحيات الإنجازات المشتركة)، ويُميَّز بـ data.doc
  return { kind: "shared_achievements", title: T.label, record_date: today(), academic_year: state.year,
    data: { doc: "teacher_list", type: "grading", purpose: T.purposes[0], last_col: "التوقيع", period: T.periods[0], grade: T.grade, subject: T.subject, region: G().region || "الأحمدي", rows: [] } };
}
export const gradingSummary = (r) => {
  const rows = (r.data.rows || []).filter((x) => !x.excl && (x.name || "").trim());
  return `${isGradingPurpose(r.data) ? "لجان تقدير الدرجات — الفترة " + (r.data.period || "") : (r.data.purpose || "") + (r.data.topic ? ": " + r.data.topic : "")} — ${rows.length} معلم`;
};

export async function gradingEditor(main, rec) {
  // الأرقام المدنية والفئات من نماذج اللجان السابقة (لا تُكتب كل مرة)
  const prev = new Map();
  try {
    const old = (await api.list({ kind: "shared_achievements" })).filter((r) => r.data?.doc === "teacher_list" && r.id !== rec.id)
      .sort((a, b) => String(a.updated_at || "").localeCompare(String(b.updated_at || "")));
    for (const r of old) for (const p of r.data.rows || []) { const k = (p.name || "").trim(); if (k) prev.set(k, { civil_id: p.civil_id || "", cat: p.cat || "" }); }
  } catch (_) {}

  return recordPage(main, { backHref: "#/forms?sec=grading", newHref: "#/forms/new?type=grading", rec, title: T.label + " (ملف مشترك)", merge: true,
    beforeApprove: (r) => [!(r.data.rows || []).some((x) => !x.excl) && "أسماء المعلمين"].filter(Boolean),
    render(body, ed) {
      const r = ed.rec, d = r.data;
      const years = [...new Set([state.year, r.academic_year].filter(Boolean))];
      body.innerHTML = `
      <section class="panel"><h2>البيانات</h2><div class="form">
        ${field({ label: "الغرض من القائمة", key: "purpose", type: "select", options: T.purposes, value: d.purpose || T.purposes[0], remember: "grading_purposes", wide: true, hint: "لجان تقدير الدرجات، أو حضور ورشة/دورة… ويمكن إضافة غرض جديد" })}
      </div><div class="form" id="gr-g">
        ${field({ label: "الفترة", key: "period", type: "select", options: T.periods, value: d.period || T.periods[0] })}
        ${field({ label: "الصف", key: "grade", type: "select", options: T.grades, value: d.grade || T.grade, remember: "grading_grades" })}
        ${field({ label: "المجال", key: "subject", type: "select", options: T.subjects, value: d.subject || T.subject, remember: "grading_subjects" })}
      </div><div class="form" id="gr-o">
        ${field({ label: "العنوان (مثل: عنوان الورشة)", key: "topic", type: "textarea", rows: 2, value: d.topic || "", wide: true })}
        ${field({ label: "التاريخ", key: "date", type: "date", value: d.date || "" })}
        ${field({ label: "المكان", key: "place", value: d.place || "" })}
        ${field({ label: "عنوان العمود الأخير", key: "last_col", type: "select", options: T.lastCols, value: d.last_col || "التوقيع", remember: "grading_lastcols" })}
      </div><div class="form">        ${field({ label: "العام الدراسي", key: "academic_year", type: "select", options: years, value: r.academic_year, custom: false })}
        ${field({ label: "المنطقة التعليمية", key: "region", value: d.region ?? (G().region || "الأحمدي") })}
      </div></section>
      <section class="panel"><div class="page-head" style="margin-bottom:6px"><h2>المعلمون</h2>
        <div class="toolbar" style="margin:0"><button class="btn primary" id="gr-fill">تعبئة من ميزانية المدارس</button><button class="btn" id="gr-civ">الأرقام المدنية من الميزانيات</button><button class="btn" id="gr-add">+ اسم</button></div></div>
        <p class="hint" style="margin-top:0">الفئة تحدد لون الاسم في النموذج: <b style="color:${CAT_COLOR.new}">الجدد بالأحمر</b>، <b style="color:${CAT_COLOR.expert}">الخبرة بالأخضر</b>، <b style="color:${CAT_COLOR.head}">رؤساء الأقسام بالأزرق</b>، والباقي بالأسود. المستبعدات لا يظهرن في النموذج المطبوع.</p>
        <div id="gr-count" class="hint" style="font-weight:600;margin:6px 0"></div>
        <div class="tbl-wrap"><table class="data gr-t"><thead><tr><th class="c-n">م</th><th>الاسم</th><th>الرقم المدني</th><th>مركز العمل</th><th>الفئة</th><th id="gr-lc">العمل في اللجنة</th><th>استبعاد</th><th></th></tr></thead><tbody id="gr-rows"></tbody></table></div></section>`;

      bindFields(body, (k, v) => ed.change((x) => {
        if (k === "academic_year") x.academic_year = v || state.year; else x.data[k] = v;
        x.title = isGradingPurpose(x.data) ? `${T.label} (الفترة ${x.data.period || ""})` : `${x.data.purpose || "قائمة معلمين"}${x.data.topic ? " — " + x.data.topic.slice(0, 50) : ""}`;
        if (k === "purpose" || k === "last_col") paint();
      }));

      const count = () => {
        const rs = ed.rec.data.rows || [], inc = rs.filter((x) => !x.excl);
        const c = (role) => inc.filter((x) => x.role === role).length;
        if (!isGradingPurpose(ed.rec.data)) { $("#gr-count", body).textContent = `العدد: ${inc.length} · مستبعد: ${rs.length - inc.length}`; return; }
        $("#gr-count", body).textContent = `المشاركون: ${inc.length} · مصحح: ${c("مصحح")} · مراجع: ${c("مراجع")} (المطلوب تقريباً: ${inc.length - Math.round(inc.length / 3)} مصحح و${Math.round(inc.length / 3)} مراجع) · بدون تحديد: ${inc.filter((x) => !x.role).length} · مستبعد: ${rs.length - inc.length}`;
      };
      const paint = () => {
        const rs = ed.rec.data.rows || [], G_ = isGradingPurpose(ed.rec.data);
        $("#gr-g", body).style.display = G_ ? "" : "none"; $("#gr-o", body).style.display = G_ ? "none" : ""; $$("[data-gonly]", body).forEach((e) => (e.style.display = G_ ? "" : "none"));
        $("#gr-lc", body).textContent = G_ ? "العمل في اللجنة" : (ed.rec.data.last_col || "التوقيع");
        $("#gr-rows", body).innerHTML = rs.length ? rs.map((p, i) => `<tr data-p="${p.id}" style="${p.excl ? "opacity:.5" : ""}"><td class="c-n">${i + 1}</td>
          <td>${p.by ? `<div class="hint" style="font-size:11px;margin-bottom:2px">أضافته: ${esc(p.by)}</div>` : ""}<input data-f="name" value="${esc(p.name || "")}" aria-label="الاسم ${i + 1}" style="min-width:170px;color:${CAT_COLOR[p.cat] || "inherit"};font-weight:600"></td>
          <td><div class="cid-wrap"><input data-f="civil_id" class="cid" dir="ltr" inputmode="numeric" maxlength="14" value="${esc(p.civil_id || "")}" aria-label="الرقم المدني ${i + 1}" placeholder="12 رقماً"><span class="cid-n"></span></div></td>
          <td><input data-f="school" value="${esc(p.school || "")}" aria-label="مركز العمل ${i + 1}" style="min-width:130px"></td>
          <td><select data-f="cat" aria-label="الفئة ${i + 1}">${CATS.map(([v, l]) => `<option value="${v}" ${(p.cat || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select></td>
          <td>${G_ ? `<select data-f="role" aria-label="العمل في اللجنة ${i + 1}"><option value="">—</option>${ROLES.map((x) => `<option ${p.role === x ? "selected" : ""}>${x}</option>`).join("")}</select>` : `<input data-f="note" value="${esc(p.note || "")}" aria-label="العمود الأخير ${i + 1}" placeholder="(فارغ للتوقيع)" style="min-width:110px">`}</td>
          <td><select data-f="excl" aria-label="استبعاد ${i + 1}"><option value="">—</option>${EXCL.map((x) => `<option ${p.excl === x ? "selected" : ""}>${x}</option>`).join("")}</select></td>
          <td class="c-x"><button class="btn small ghost" data-rm style="color:var(--bad)" aria-label="حذف ${i + 1}">✕</button></td></tr>`).join("")
          : `<tr><td colspan="8" class="hint" style="text-align:center;padding:14px">لا توجد أسماء بعد — اضغطي «تعبئة من ميزانية المدارس».</td></tr>`;
        $$("#gr-rows tr[data-p]", body).forEach((tr) => {
          const pid = tr.dataset.p;
          $$("input,select", tr).forEach((el) => {
            if (el.classList.contains("cid")) paintCivil(el);
            const ev = el.tagName === "SELECT" ? "change" : "input";
            el.addEventListener(ev, () => {
              if (el.classList.contains("cid")) paintCivil(el);
              const f = el.dataset.f, val = f === "civil_id" ? normCivil(el.value) : el.value;
              ed.change((x) => { const p = x.data.rows.find((y) => y.id === pid); if (p) p[f] = val; if (f === "excl" && val && p) p.role = ""; }, { immediate: el.tagName === "SELECT" });
              if (el.tagName === "SELECT" && f !== "role") paint(); else count();
            });
          });
          $("[data-rm]", tr).onclick = async () => { if (!(await confirmBox("حذف الاسم", "حذف هذا الاسم من النموذج؟", "حذف", true))) return; ed.change((x) => { x.data.rows = x.data.rows.filter((y) => y.id !== pid); }, { immediate: true }); paint(); };
        });
        count();
      };

      $("#gr-add", body).onclick = () => { const nid = rid(); ed.change((x) => { x.data.rows = [...(x.data.rows || []), { id: nid, name: "", civil_id: "", school: "", cat: "", role: "", excl: "", by: myName() }]; }, { immediate: true }); paint(); $(`tr[data-p="${nid}"] input`, body)?.focus(); };

      // تعبئة من ميزانية المدارس: معلمو المدارس المختارة (المسجلون من ملف الميزانية في «المدارس والمعلمات»)
      $("#gr-fill", body).onclick = async () => {
        const schools = state.schools.filter((s) => state.teachers.some((t) => t.school_id === s.id));
        if (!schools.length) { toast("لا توجد مدارس فيها معلمات — أضيفيها من «المدارس والمعلمات» (إنشاء مدرسة من الميزانية)", "error"); return; }
        const pr = modal({ title: "تعبئة من ميزانية المدارس", wide: true,
          body: `<p class="hint" style="margin-top:0">اختاري المدارس؛ تُضاف معلماتها مع اسم المدرسة كمركز عمل. الموجود مسبقاً لا يتكرر.</p>
            <label style="display:block;margin:6px 0"><input type="checkbox" id="gs-all" checked> كل المدارس</label>
            <div id="gs-l">${schools.map((s) => `<label style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)"><input type="checkbox" value="${s.id}" checked><span style="flex:1">${esc(s.title)}</span><span class="hint">${state.teachers.filter((t) => t.school_id === s.id).length} معلم</span></label>`).join("")}</div>`,
          actions: [{ label: "إلغاء", value: null }, { label: "إضافة", kind: "primary", value: (b) => $$("#gs-l input:checked", b).map((c) => c.value) }] });
        const all = $("#gs-all"); if (all) all.onchange = () => $$("#gs-l input").forEach((c) => { c.checked = all.checked; });
        const ids = await pr; if (!ids?.length) return;
        const have = new Set((ed.rec.data.rows || []).map((p) => (p.name || "").trim()));
        const add = [];
        for (const sid of ids) for (const t of state.teachers.filter((x) => x.school_id === sid)) {
          const name = (t.title || "").trim(); if (!name || have.has(name)) continue; have.add(name);
          const pv = prev.get(name) || {};
          const cat = pv.cat || (/رئيس/.test(t.data?.job_title || "") ? "head" : "");
          add.push({ id: rid(), teacher_id: t.id, name, civil_id: normCivil(t.data?.civil_id || pv.civil_id || ""), school: schoolTitle(sid), cat, role: "", excl: "", by: myName() });
        }
        if (add.length) { ed.change((x) => { x.data.rows = [...(x.data.rows || []).filter((p) => (p.name || "").trim()), ...add]; }, { immediate: true }); paint(); }
        // الأرقام المدنية من ملفات الميزانية المرفوعة لكل مدرسة (لمن ليس له رقم)
        const got = await civilFromBudgets(ids);
        toast(`${add.length ? `أُضيف ${add.length} اسم` : "كل الأسماء مضافة مسبقاً"}${got ? ` · ${got} رقم مدني من الميزانيات` : ""}`);
      };

      // يقرأ ملفات الميزانية (المرفقة بالمدارس) ويكمل الأرقام المدنية الناقصة
      const civilFromBudgets = async (sids) => {
        const names = new Map(); // المدرسة ← أسماء بلا رقم
        for (const sid of sids) { const st = schoolTitle(sid); const ns = (ed.rec.data.rows || []).filter((p) => p.school === st && (p.name || "").trim() && !normCivil(p.civil_id)).map((p) => p.name.trim()); if (ns.length) names.set(sid, ns); }
        if (!names.size) return 0;
        toast("جارٍ قراءة الأرقام المدنية من ملفات الميزانية…");
        const found = new Map(); let noFile = 0, failed = 0;
        const { civilIdsFromBudget } = await import("../pdfnames.js");
        for (const [sid, ns] of names) {
          const files = (await api.files(`&record_id=eq.${sid}&category=eq.attachment`).catch(() => [])).filter((f) => f.subcategory === "budget");
          if (!files.length) { noFile++; continue; }
          for (const f of files) {
            const left = ns.filter((n) => !found.has(n)); if (!left.length) break;
            try { const blob = await api.fileBlob(f.storage_path); const m = await civilIdsFromBudget(new File([blob], f.title || "budget", { type: f.mime || blob.type }), left); m.forEach((v, k) => found.set(k, v)); }
            catch (e) { console.warn(e); failed++; }
          }
        }
        if (found.size) { ed.change((x) => { x.data.rows.forEach((p) => { const v = found.get((p.name || "").trim()); if (v && !normCivil(p.civil_id)) p.civil_id = v; }); }, { immediate: true }); paint(); }
        const miss = [...names.values()].flat().length - found.size;
        if (miss > 0) toast(`${miss} اسم بدون رقم مدني${noFile ? ` (${noFile} مدرسة بلا ملف ميزانية مرفوع)` : ""}${failed ? " — تعذّرت قراءة بعض الملفات (قد تكون مصوَّرة)" : ""}`, "error");
        return found.size;
      };
      $("#gr-civ", body).onclick = async () => {
        const sids = [...new Set((ed.rec.data.rows || []).map((p) => state.schools.find((s) => s.title === p.school)?.id).filter(Boolean))];
        if (!sids.length) { toast("لا توجد مدارس من مدارسك في القائمة", "error"); return; }
        const n = await civilFromBudgets(sids); if (n) toast(`أُضيف ${n} رقم مدني من الميزانيات`); else if (!(ed.rec.data.rows || []).some((p) => !normCivil(p.civil_id))) toast("كل الأسماء لها أرقام مدنية");
      };

      paint();
    } });
}
