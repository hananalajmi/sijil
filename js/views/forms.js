// النماذج الرسمية للتوقيع (أولها: تكليف بمهمة خارج مقر العمل — نموذج رقم 4)
// الخطوات: 1) تعبئة بيانات التكليف  2) أسماء المكلَّفين وأرقامهم المدنية (تكتبينها أو يرسلونها برابط)
//          3) طباعة أو Word للتوقيع  4) رفع النسخة الموقّعة والاحتفاظ بها  5) إرسالها
// العام الدراسي يُؤخذ من العام المختار في أعلى الصفحة (ويمكن تغييره في النموذج).
import { api } from "../api.js";
import { state } from "../store.js";
import { esc, $, $$, today, fmtDate, toast, modal, confirmBox } from "../ui.js";
import { field, bindFields, recordPage, go } from "../kit.js";
import { listView } from "./_list.js";
import { FORMS } from "../templates.js";
import { openStored } from "../openfile.js";

const STAGES = { draft: ["مسودة", ""], ready: ["جاهز للتوقيع", "warn"], signed: ["موقّع ومحفوظ", "ok"], sent: ["أُرسل", "ok"] };
export const hijri = (iso) => { try { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso + "T12:00:00")); } catch (_) { return ""; } };
// الرقم المدني: 12 رقماً (تُقبل الأرقام العربية وتُحوَّل)
export const normCivil = (v) => String(v || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/\s|-/g, "");
export const civilState = (v) => { const c = normCivil(v); return !c ? "" : /^[0-9]{12}$/.test(c) ? "ok" : "bad"; };
export function paintCivil(inp) {
  const c = normCivil(inp.value), st = civilState(inp.value);
  inp.classList.toggle("cid-ok", st === "ok"); inp.classList.toggle("cid-bad", st === "bad");
  inp.setAttribute("aria-invalid", st === "bad" ? "true" : "false");
  const n = inp.parentElement.querySelector(".cid-n");
  if (n) { n.textContent = c ? `${c.replace(/\D/g, "").length}/12${/\D/.test(c) ? " — أرقام فقط" : ""}` : ""; n.className = "cid-n " + st; }
}
const token = () => { const a = new Uint8Array(24); crypto.getRandomValues(a); return "f" + [...a].map((b) => "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 56]).join(""); };
const rid = () => Math.random().toString(36).slice(2, 10);
const fillLink = (t) => `${location.href.split("#")[0]}#/f/${t}`;

export default async function (main, { id, params }) {
  if (!id) return listView(main, { kind: "form", title: "النماذج والتكاليف", sub: "نماذج رسمية تُعبّأ وتُطبع للتوقيع، وتُحفظ نسختها الموقّعة وتُرسل. ويمكن إرسال رابط للمكلَّفين ليكتبوا أسماءهم وأرقامهم المدنية.", newLabel: "+ تكليف بمهمة",
    extraHead: `<a class="btn" href="#/print/blank-takleef">نموذج فارغ للطباعة</a><a class="btn ghost" href="assets/forms/takleef-form4.docx" download="تكليف بمهمة خارج مقر العمل - نموذج 4.docx">النموذج الأصلي (Word)</a>`,
    columns: [{ label: "التاريخ", get: (r) => fmtDate(r.record_date) }, { label: "المهمة", get: (r) => r.data.task || "" }, { label: "المكلَّفون", get: (r) => (r.data.people || []).length, cls: "num" },
      { label: "الحالة", get: (r) => (STAGES[r.data.stage] || STAGES.draft)[0] }] });
  const T = FORMS.takleef;
  const rec = id === "new"
    ? { kind: "form", title: T.label, record_date: today(), academic_year: state.year, data: { type: "takleef", date: today(), hijri: hijri(today()), addressee: T.addressee, task: "", from: "", to: "", sign_at: "", people: [], stage: "draft", open: false } }
    : await api.get(id);
  if (!rec) { main.innerHTML = `<div class="container"><div class="empty">السجل غير موجود</div></div>`; return; }

  const ed = await recordPage(main, { rec, title: T.label + " — " + T.formNo,
    beforeApprove: (r) => [!r.data.task && "المهمة", !r.data.from && "بداية المدة", !(r.data.people || []).length && "المكلَّفون",
      (r.data.people || []).some((p) => civilState(p.civil_id) !== "ok") && "رقم مدني ناقص"].filter(Boolean),
    render(body, ed) {
      const r = ed.rec, d = r.data;
      const years = [...new Set([state.year, r.academic_year].filter(Boolean))];
      body.innerHTML = `
      <div class="steps-bar">${["البيانات", "المكلَّفون", "التوقيع", "الإرسال"].map((s, i) => `<span class="${i <= stepOf(d) ? "on" : ""}">${i + 1}. ${s}</span>`).join("")}</div>
      <section class="panel"><h2>1. بيانات التكليف</h2><div class="form">
        ${field({ label: "التاريخ", key: "date", type: "date", value: d.date || r.record_date, required: true })}
        ${field({ label: "الموافق (هجري)", key: "hijri", value: d.hijri || hijri(d.date || r.record_date), hint: "يُحسب تلقائياً من التاريخ، ويمكن تعديله" })}
        ${field({ label: "العام الدراسي", key: "academic_year", type: "select", options: years, value: r.academic_year, custom: false, hint: "من العام المختار في أعلى الصفحة" })}
        ${field({ label: "إلى السيد المحترم /", key: "addressee", value: d.addressee ?? T.addressee, hint: T.addresseeNote })}
        ${field({ label: "وذلك للقيام بـ (المهمة)", key: "task", type: "textarea", value: d.task, wide: true, rows: 3, required: true, placeholder: "مثال: حضور ورشة عمل بعنوان الاتزان (إنماء مهني مبرمج) في ثانوية الصباحية" })}
        ${field({ label: "خلال المدة من", key: "from", type: "date", value: d.from, required: true })}
        ${field({ label: "حتى", key: "to", type: "date", value: d.to })}
        ${field({ label: "يتعذر عليهم الحضور إلى مقر العمل للتوقيع عند", key: "sign_at", type: "select", options: T.signAtOptions, value: d.sign_at, custom: false })}
      </div></section>

      <section class="panel"><div class="page-head" style="margin-bottom:6px"><h2>2. المكلَّفون</h2><button class="btn" id="addp">+ اسم</button></div>
        <p class="hint" style="margin-top:0">الرقم المدني 12 رقماً: تتلوّن الخانة بالأحمر إذا كان ناقصاً، وبالأخضر إذا اكتمل.</p>
        <div class="tbl-wrap"><table class="data people-t"><thead><tr><th class="c-n">م</th><th>الاسم</th><th>الرقم المدني</th><th></th></tr></thead><tbody id="ppl"></tbody></table></div>
        <div class="link-box" id="linkbox"></div></section>

      <section class="panel"><h2>3. الطباعة والتوقيع</h2>
        <p class="hint" style="margin-top:0">اطبعي النموذج أو نزّليه Word ليوقّعه ${esc(T.manager)}، ثم صوّري النسخة الموقّعة أو ارفعيها PDF لتُحفظ هنا.</p>
        <div class="toolbar"><button class="btn" id="pr">طباعة / PDF</button><button class="btn" id="wd">Word</button><a class="btn ghost" href="#/print/blank-takleef">نموذج فارغ</a>
          <label class="btn primary">رفع النسخة الموقّعة<input type="file" id="signed" accept="image/*,application/pdf" hidden></label></div>
        <div id="signedbox"></div></section>

      <section class="panel"><h2>4. الإرسال</h2><div id="sendbox"></div></section>`;

      bindFields(body, (k, v) => {
        ed.change((x) => {
          if (k === "academic_year") x.academic_year = v || state.year;
          else x.data[k] = v;
          if (k === "date") { x.record_date = v || null; x.data.hijri = hijri(v); }
          x.title = T.label + (x.data.task ? " — " + x.data.task.slice(0, 60) : "");
          if (x.data.stage === "draft" && x.data.task && x.data.from && (x.data.people || []).length) x.data.stage = "ready";
        });
        if (k === "date") { const h = $("[data-key='hijri']", body); if (h) h.value = ed.rec.data.hijri; }
      });

      // ---- المكلَّفون
      const paintPeople = () => {
        const ps = ed.rec.data.people || [];
        $("#ppl", body).innerHTML = ps.length ? ps.map((p, i) => `<tr data-p="${p.id}"><td class="c-n">${i + 1}</td>
          <td><input data-f="name" value="${esc(p.name || "")}" aria-label="اسم المكلَّف ${i + 1}" placeholder="الاسم الثلاثي">${p.via === "link" ? '<span class="pill ok" title="أُرسل من رابط التعبئة">من الرابط</span>' : ""}</td>
          <td><div class="cid-wrap"><input data-f="civil_id" class="cid" dir="ltr" inputmode="numeric" maxlength="14" value="${esc(p.civil_id || "")}" aria-label="الرقم المدني ${i + 1}" placeholder="12 رقماً"><span class="cid-n"></span></div></td>
          <td class="c-x"><button class="btn small ghost" data-rm style="color:var(--bad)" aria-label="حذف ${i + 1}">✕</button></td></tr>`).join("")
          : `<tr><td colspan="4" class="hint" style="text-align:center;padding:14px">لا يوجد مكلَّفون بعد — أضيفي الأسماء أو أرسلي رابط التعبئة.</td></tr>`;
        $$("#ppl tr[data-p]", body).forEach((tr) => {
          const pid = tr.dataset.p;
          $$("input", tr).forEach((inp) => {
            if (inp.classList.contains("cid")) paintCivil(inp);
            inp.oninput = () => {
              if (inp.classList.contains("cid")) paintCivil(inp);
              const val = inp.classList.contains("cid") ? normCivil(inp.value) : inp.value;
              ed.change((x) => { const p = x.data.people.find((y) => y.id === pid); if (p) p[inp.dataset.f] = val; });
            };
          });
          $("[data-rm]", tr).onclick = async () => { if (!(await confirmBox("حذف الاسم", "حذف هذا المكلَّف من النموذج؟", "حذف", true))) return; ed.change((x) => { x.data.people = x.data.people.filter((y) => y.id !== pid); }, { immediate: true }); paintPeople(); };
        });
      };
      $("#addp", body).onclick = () => { const nid = rid(); ed.change((x) => { x.data.people = [...(x.data.people || []), { id: nid, name: "", civil_id: "" }]; }, { immediate: true }); paintPeople(); $(`tr[data-p="${nid}"] input`, body)?.focus(); };
      paintPeople();

      // ---- رابط التعبئة للمكلَّفين
      const paintLink = () => {
        const dd = ed.rec.data, box = $("#linkbox", body);
        if (!ed.rec.id) { box.innerHTML = `<p class="hint">احفظي النموذج (اكتبي المهمة) ثم يظهر رابط التعبئة.</p>`; return; }
        box.innerHTML = dd.open && dd.token
          ? `<div class="link-on"><b>رابط التعبئة مفتوح</b> — من يفتحه يكتب اسمه ورقمه المدني فقط، ولا يرى أسماء غيره.
              <div class="row"><input readonly dir="ltr" id="lnk" value="${esc(fillLink(dd.token))}"><button class="btn small" id="cp">نسخ</button>
              <a class="btn small" id="wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`${T.label}: ${dd.task || ""}\nالرجاء كتابة الاسم والرقم المدني:\n${fillLink(dd.token)}`)}">واتساب</a>
              <button class="btn small ghost" id="close">إغلاق الرابط</button><button class="btn small ghost" id="pull">تحديث</button></div></div>`
          : `<button class="btn" id="open">إرسال رابط للمكلَّفين ليكتبوا الاسم والرقم المدني</button>`;
        $("#open", box) && ($("#open", box).onclick = async () => { ed.change((x) => { x.data.token ||= token(); x.data.open = true; }, { immediate: true }); await ed.save(); paintLink(); });
        $("#close", box) && ($("#close", box).onclick = async () => { ed.change((x) => { x.data.open = false; }, { immediate: true }); await ed.save(); await pullInbox(); paintLink(); toast("أُغلق الرابط"); });
        $("#cp", box) && ($("#cp", box).onclick = async () => { try { await navigator.clipboard.writeText($("#lnk", box).value); toast("نُسخ الرابط"); } catch (_) { $("#lnk", box).select(); } });
        $("#pull", box) && ($("#pull", box).onclick = () => pullInbox(true));
      };
      // ما أرسله المكلَّفون: يُضاف للجدول (رقم مدني موجود يُحدَّث اسمه) ثم يُفرَّغ الصندوق بعد الحفظ
      const pullInbox = async (say = false) => {
        if (!ed.rec.id) return;
        let rows = [];
        try { rows = await api.formInbox(ed.rec.id); } catch (_) { return; }
        if (!rows.length) { if (say) toast("لا جديد"); return; }
        ed.change((x) => {
          x.data.people ||= [];
          for (const it of rows) {
            const ex = x.data.people.find((p) => normCivil(p.civil_id) === it.civil_id);
            if (ex) ex.name = it.name; else x.data.people.push({ id: rid(), name: it.name, civil_id: it.civil_id, via: "link" });
          }
          if (x.data.stage === "draft" && x.data.task && x.data.from) x.data.stage = "ready";
        }, { immediate: true });
        await ed.save();
        if (!ed.dirty) await api.clearInbox(rows.map((x) => x.id)).catch(() => {});
        paintPeople(); toast(`وصل ${rows.length} من رابط التعبئة`);
      };
      paintLink(); pullInbox();
      ed.afterCreate = () => paintLink(); // أول حفظ: يظهر زر رابط التعبئة
      const timer = setInterval(() => { if (window.__currentEditor !== ed) return clearInterval(timer); if (!document.hidden && ed.rec.data.open) pullInbox(); }, 20000);

      // ---- الطباعة والنسخة الموقّعة
      $("#pr", body).onclick = async () => { await ed.save(); if (ed.rec.id) go(`#/print/${ed.rec.id}?auto=1`); };
      $("#wd", body).onclick = async () => { await ed.save(); if (ed.rec.id) go(`#/print/${ed.rec.id}?word=1`); };
      const paintSigned = async () => {
        const dd = ed.rec.data, box = $("#signedbox", body);
        const f = dd.signed_file ? await api.fileById(dd.signed_file).catch(() => null) : null;
        box.innerHTML = f ? `<div class="list" style="margin-top:10px"><div class="item"><span class="t">✓ النسخة الموقّعة: ${esc(f.title)}</span><span class="m">رُفعت ${new Date(f.created_at).toLocaleString("ar-KW")}</span>
            <span class="s"><button class="btn small" id="sopen">فتح</button></span></div></div>` : "";
        $("#sopen", box) && ($("#sopen", box).onclick = () => openStored(f));
        paintSend(f);
      };
      $("#signed", body).onchange = async (e) => {
        const file = e.target.files[0]; e.target.value = ""; if (!file) return;
        await ed.save(); if (!ed.rec.id) return toast("اكتبي بيانات التكليف أولاً", "error");
        try {
          const up = await api.upload(file, { category: "attachment", subcategory: "signed", record_id: ed.rec.id, title: `${T.label} موقّع — ${fmtDate(ed.rec.data.date || ed.rec.record_date)}.${(file.name.split(".").pop() || "pdf").toLowerCase()}` });
          ed.change((x) => { x.data.signed_file = up.id; x.data.signed_at = new Date().toISOString(); if (x.data.stage !== "sent") x.data.stage = "signed"; x.data.open = false; }, { immediate: true });
          await ed.save(); toast("حُفظت النسخة الموقّعة"); paintSigned(); paintLink();
        } catch (err) { toast("تعذر الرفع: " + err.message, "error"); }
      };

      // ---- الإرسال
      const paintSend = (f) => {
        const dd = ed.rec.data, box = $("#sendbox", body);
        const log = (dd.sent || []).map((s) => `<li>${esc(new Date(s.at).toLocaleString("ar-KW"))}${s.to ? " — إلى: " + esc(s.to) : ""}</li>`).join("");
        box.innerHTML = f ? `<div class="toolbar"><input id="sendto" placeholder="إلى (اختياري): مثل الشئون التعليمية" style="flex:1;min-width:200px"><button class="btn primary" id="send">إرسال النسخة الموقّعة</button></div>
            <p class="hint">يفتح خيارات المشاركة في جهازك (واتساب، البريد، …). وفي الأجهزة التي لا تدعم ذلك يُنزَّل الملف لترسليه.</p>${log ? `<ul class="sent-log">${log}</ul>` : ""}`
          : `<p class="hint">ارفعي النسخة الموقّعة أولاً، ثم يظهر زر الإرسال.</p>`;
        $("#send", box) && ($("#send", box).onclick = async () => {
          const to = $("#sendto", box).value.trim();
          try {
            const blob = await api.fileBlob(f.storage_path), file = new File([blob], f.title, { type: blob.type || f.mime || "application/octet-stream" });
            let shared = false;
            if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: f.title, text: `${T.label}${ed.rec.data.task ? " — " + ed.rec.data.task : ""}` }); shared = true; } catch (e2) { if (e2.name === "AbortError") return; } }
            if (!shared) { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = f.title; document.body.appendChild(a); a.click(); a.remove(); toast("نُزّل الملف؛ أرسليه من البريد أو واتساب"); }
            ed.change((x) => { x.data.sent = [...(x.data.sent || []), { at: new Date().toISOString(), to }]; x.data.stage = "sent"; }, { immediate: true });
            await ed.save(); paintSend(f);
          } catch (err) { toast(err.message, "error"); }
        });
      };
      paintSigned();
    } });
}
const stepOf = (d) => (d.stage === "sent" ? 3 : d.stage === "signed" ? 2 : (d.people || []).length ? 1 : 0);
