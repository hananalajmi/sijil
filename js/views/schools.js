// المدارس: اسم المدرسة + أسماء معلماتها + ملفات (ميزانية المدرسة، جدول المدرسة، بيانات القسم)
// أسماء المعلمات تُضاف هنا يدوياً، أو تُستخرج من PDF الميزانية بعد تأكيدك، أو من نموذج الزيارة مباشرة.
import { api } from "../api.js";
import { state, refreshPeople } from "../store.js";
import { esc, $, $$, toast, modal, confirmBox } from "../ui.js";
import { field, bindFields, recordPage } from "../kit.js";
import { listView } from "./_list.js";
import { openStored } from "../openfile.js";

const FILE_KINDS = [["budget", "ميزانية المدرسة (PDF أو Word أو Excel)"], ["schedule", "جدول المدرسة (صورة أو PDF أو Word أو Excel)"], ["department", "بيانات القسم العلمي (PDF أو Word أو Excel)"]];
const ACCEPT = ".pdf,.docx,.doc,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default async function (main, { id }) {
  if (!id) return listView(main, { kind: "school", title: "المدارس والمعلمات", sub: "اسم المدرسة وأسماء معلماتها؛ تظهر للاختيار في الزيارات والتقارير", newLabel: "+ مدرسة",
    extraHead: `<label class="btn">إنشاء من ملف الميزانية<input type="file" id="bud-new" accept="${ACCEPT}" hidden></label>`, onReady: () => { const inp = $("#bud-new", main); if (inp) inp.onchange = () => { const f = inp.files[0]; inp.value = ""; if (f) fromBudget(f); }; },byYear: false,
    emptyText: "أضيفي اسم المدرسة، ثم أسماء معلماتها أو ارفعي ملف الميزانية لاستخراجها.",
    columns: [{ label: "المدرسة", get: (r) => r.title }, { label: "المعلمات", get: (r) => state.teachers.filter((t) => t.school_id === r.id).length, cls: "num" }] });

  const rec = id === "new" ? { kind: "school", title: "", data: {} } : await api.get(id);
  if (!rec) { main.innerHTML = `<div class="container"><div class="empty">السجل غير موجود</div></div>`; return; }
  await recordPage(main, { rec, title: rec.title || "مدرسة جديدة", render(body, ed) {
    body.innerHTML = `<section class="panel"><div class="form">${field({ label: "اسم المدرسة", key: "title", value: ed.rec.title, required: true, wide: true })}</div></section>
      <section class="panel"><div class="page-head" style="margin-bottom:8px"><h2>المعلمات</h2><div class="row" id="tbtns"></div></div><div id="tl"></div></section>
      <section class="panel"><h2>ملفات المدرسة</h2><div id="files"></div></section>`;
    bindFields(body, (k, v) => ed.change((r) => { r.title = v; }));
    const tl = $("#tl", body), files = $("#files", body);
    if (!ed.rec.id) { tl.innerHTML = files.innerHTML = `<p class="hint">اكتبي اسم المدرسة أولاً، فتُحفظ تلقائياً.</p>`; ed.afterCreate = () => setup(); return; }
    setup();
    function setup() {

    const paintTeachers = () => {
      const ts = state.teachers.filter((t) => t.school_id === ed.rec.id);
      $("#tbtns", body).innerHTML = `<button class="btn" id="addt">+ إضافة أسماء</button>`;
      tl.innerHTML = ts.length ? `<div class="list">${ts.map((t) => `<div class="item" data-id="${t.id}"><span class="t">${esc(t.title)}</span>
          <span class="s"><button class="btn small ghost" data-ren>تعديل الاسم</button><button class="btn small ghost" data-del style="color:var(--bad)">حذف</button></span></div>`).join("")}</div>`
        : `<p class="hint">لا توجد أسماء بعد. أضيفيها يدوياً، أو ارفعي ملف الميزانية بالأسفل لاستخراجها.</p>`;
      $("#addt", body).onclick = async () => {
        const box = document.createElement("div");
        box.innerHTML = `<p class="hint" style="margin-top:0">الصقي الأسماء كما هي من Excel أو واتساب أو Word، حتى لو فيها أرقام أو أعمدة ثانية؛ نلتقط الأسماء وتراجعينها قبل الإضافة. أو ارفعي ملف Excel أو Word.</p>
          <div class="f"><label for="nm">الأسماء</label><textarea id="nm" rows="8" placeholder="مثال:&#10;1- سارة محمد الرشيدي&#10;2- نورة خالد العتيبي"></textarea></div>
          <label class="btn small" style="margin-top:8px">رفع ملف Excel أو Word<input type="file" id="nmf" accept=".xlsx,.xls,.docx,.doc,.csv,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" hidden></label>
          <span class="hint" id="nmh"></span>`;
        box.querySelector("#nmf").onchange = async (e) => {
          const f = e.target.files[0]; e.target.value = ""; if (!f) return;
          const h = box.querySelector("#nmh"); h.textContent = " جارٍ قراءة الملف…";
          try { const { namesFromFile } = await import("../namesImport.js"); const ns = await namesFromFile(f);
            box.querySelector("#nm").value = ns.join("\n"); h.textContent = ns.length ? ` وُجد ${ns.length} اسم — راجعيها ثم اضغطي «متابعة»` : " لم أجد أسماء في الملف"; }
          catch (err) { h.textContent = " " + err.message; }
        };
        const v = await modal({ title: "إضافة معلمات", body: box,
          actions: [{ label: "إلغاء", value: null }, { label: "متابعة", kind: "primary", value: (b) => b.querySelector("#nm").value }] });
        if (!v || !v.trim()) return;
        const { namesFromText } = await import("../namesImport.js");
        await suggest(namesFromText(v), "لم أجد أسماء في النص. اكتبي اسماً ثلاثياً أو ثنائياً في كل سطر.");
      };
      $$(".item[data-id]", tl).forEach((it) => {
        const t = ts.find((x) => x.id === it.dataset.id);
        it.querySelector("[data-ren]").onclick = async () => {
          const v = await modal({ title: "تعديل الاسم", body: `<div class="f"><input id="rn" value="${esc(t.title)}"></div>`, actions: [{ label: "إلغاء", value: null }, { label: "حفظ", kind: "primary", value: (b) => b.querySelector("#rn").value.trim() }] });
          if (!v) return;
          try { await api.update(t.id, { title: v }, t.version); await refreshPeople(); paintTeachers(); toast("حُفظ"); } catch (e) { toast(e.message, "error"); }
        };
        it.querySelector("[data-del]").onclick = async () => {
          if (!(await confirmBox("حذف الاسم", `يُنقل «${t.title}» إلى سلة المحذوفات، وتبقى زياراتها السابقة كما هي.`, "حذف", true))) return;
          try { await api.update(t.id, { deleted_at: new Date().toISOString() }, t.version); await refreshPeople(); paintTeachers(); } catch (e) { toast(e.message, "error"); }
        };
      });
    };
    async function addNames(names) {
      const have = new Set(state.teachers.filter((t) => t.school_id === ed.rec.id).map((t) => t.title.trim()));
      let n = 0;
      for (const name of names) if (!have.has(name)) { try { await api.create({ kind: "teacher", title: name, school_id: ed.rec.id, data: {} }); have.add(name); n++; } catch (e) { toast(e.message, "error"); } }
      await refreshPeople(); paintTeachers();
      toast(n ? `أُضيف ${n} اسم` : "الأسماء موجودة مسبقاً");
    }
    paintTeachers();

    const paintFiles = async () => {
      const list = await api.files(`&record_id=eq.${ed.rec.id}&category=eq.attachment`).catch(() => []);
      files.innerHTML = FILE_KINDS.map(([k, label]) => {
        const f = list.filter((x) => x.subcategory === k);
        return `<div class="panel" style="background:var(--sunk)" data-k="${k}"><div class="page-head" style="margin-bottom:6px"><h3 style="margin:0">${label}</h3>
          <label class="btn small primary">رفع ملف<input type="file" accept="${k === "schedule" ? ACCEPT + ",image/*" : ACCEPT}" hidden></label></div>
          ${f.length ? `<div class="list">${f.map((x) => `<div class="item" data-f="${x.id}"><span class="t">${/^image\//.test(x.mime || "") ? `<img class="f-thumb" data-thumb alt="" hidden>` : ""}${esc(x.title)}</span><span class="m">${new Date(x.created_at).toLocaleDateString("ar-KW")}</span>
            <span class="s"><button class="btn small" data-open>فتح</button>${k === "budget" ? '<button class="btn small" data-extract>استخراج أسماء المعلمات</button>' : ""}<button class="btn small ghost" data-rm style="color:var(--bad)">حذف</button></span></div>`).join("")}</div>` : `<p class="hint">لم يُرفع ملف بعد.</p>`}</div>`;
      }).join("");
      $$("[data-k]", files).forEach((box) => {
        const k = box.dataset.k;
        box.querySelector("input").onchange = async (e) => {
          const file = e.target.files[0]; if (!file) return;
          try { await api.upload(file, { category: "attachment", subcategory: k, record_id: ed.rec.id, title: file.name }); toast("رُفع الملف"); await paintFiles();
            if (k === "budget") extract(file, file.name); }
          catch (err) { toast("تعذر رفع الملف: " + err.message, "error"); }
        };
        $$("[data-f]", box).forEach((row) => {
          const f = list.find((x) => x.id === row.dataset.f);
          const th = row.querySelector("[data-thumb]");
          if (th) api.fileBlob(f.storage_path).then((b) => { th.src = URL.createObjectURL(b); th.hidden = false; th.onclick = () => row.querySelector("[data-open]").click(); }).catch(() => {});
          row.querySelector("[data-open]").onclick = () => openStored(f);
          const ex = row.querySelector("[data-extract]"); if (ex) ex.onclick = async () => { try { extract(await api.fileBlob(f.storage_path), f.title); } catch (e) { toast(e.message, "error"); } };
          row.querySelector("[data-rm]").onclick = async () => { if (await confirmBox("حذف الملف", `حذف «${f.title}» نهائياً؟`, "حذف", true)) { await api.deleteFile(f); paintFiles(); } };
        });
      });
    };
    async function extract(blob, fname = "") {
      toast("جارٍ قراءة الملف…");
      let names;
      const isPdf = /\.pdf$/i.test(fname) || blob.type === "application/pdf" || (!fname && !blob.type);
      try {
        if (isPdf) { const { namesFromPdf } = await import("../pdfnames.js"); names = await namesFromPdf(blob); }
        else { const { namesFromFile } = await import("../namesImport.js"); names = await namesFromFile(new File([blob], fname || "file", { type: blob.type })); }
      }
      catch (e) { toast(/import|module|fetch|load/i.test(e.message || "") ? "تعذّر تحميل أداة قراءة PDF. تأكدي من الاتصال ثم أعيدي المحاولة." : e.message || "تعذّرت قراءة الملف", "error"); return; }
      await suggest(names, "لم أجد أسماء مكتوبة في الملف. إذا كان الملف مصوَّراً بالكاميرا أو بالماسح (مثل CamScanner) فهو صورة وليس نصاً، ولا يمكن قراءة الأسماء منه. استخدمي ملف PDF المحفوظ من Excel أو Word، أو أضيفي الأسماء يدوياً.");
    }
    // مراجعة الأسماء المقترحة قبل الإضافة
    async function suggest(names, emptyMsg) {
      const have = new Set(state.teachers.filter((t) => t.school_id === ed.rec.id).map((t) => t.title.trim()));
      const fresh = names.filter((n) => !have.has(n));
      if (!fresh.length) { await modal({ title: "إضافة الأسماء", body: `<p>${names.length ? "كل هذه الأسماء مضافة مسبقاً." : emptyMsg}</p>` }); return; }
      const box = document.createElement("div");
      box.innerHTML = `<p class="hint">ألغي تحديد ما ليس اسم معلمة، ثم اضغطي «إضافة المحدد».</p>
        <div class="checks" style="grid-template-columns:1fr">${fresh.map((n, i) => `<label><input type="checkbox" checked value="${i}">${esc(n)}</label>`).join("")}</div>`;
      const ok = await modal({ title: `أسماء مقترحة (${fresh.length})`, body: box, wide: true, actions: [{ label: "إلغاء", value: null }, { label: "إضافة المحدد", kind: "primary", value: (b) => $$("input:checked", b).map((c) => fresh[Number(c.value)]) }] });
      if (ok?.length) await addNames(ok);
    }
    paintFiles();
    }
  }, beforeApprove: () => [] });
}

/* ---------------- إنشاء مدرسة ومعلماتها من ملف الميزانية ----------------
   يقرأ اسم المدرسة وأسماء المعلمات من الملف، فتراجعينها، ثم تُنشأ المدرسة (أو تُكمَّل إن كانت موجودة) ويُرفق ملف الميزانية بها */
async function fromBudget(file) {
  toast("جارٍ قراءة ملف الميزانية…");
  const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  let names = [], school = "";
  try {
    if (isPdf) { const m = await import("../pdfnames.js"); [names, school] = await Promise.all([m.namesFromPdf(file).catch(() => []), m.textFromPdf(file).then(m.schoolNameFromText).catch(() => "")]); }
    else { const [{ namesFromFile, textFromFile }, { schoolNameFromText }] = await Promise.all([import("../namesImport.js"), import("../pdfnames.js")]);
      [names, school] = await Promise.all([namesFromFile(file).catch(() => []), textFromFile(file).then(schoolNameFromText).catch(() => "")]); }
  } catch (e) { toast(e.message || "تعذّرت قراءة الملف", "error"); return; }
  const bx = document.createElement("div");
  bx.innerHTML = `<div class="f"><label for="bn-s">اسم المدرسة</label><input id="bn-s" type="text" value="${esc(school)}" placeholder="مثال: ثانوية …"></div>
    <p class="hint">${school ? "قرأنا اسم المدرسة من الملف — صحّحيه إن احتاج." : "لم نجد اسم المدرسة في الملف، اكتبيه."}</p>
    ${names.length ? `<label class="row" style="gap:8px;margin:10px 0 6px"><input type="checkbox" id="bn-all" checked> <b>كل المعلمات (${names.length})</b></label>
      <div class="checks" style="grid-template-columns:1fr">${names.map((n, i) => `<label><input type="checkbox" checked value="${i}"> ${esc(n)}</label>`).join("")}</div>
      <p class="hint">ألغي تحديد ما ليس اسم معلمة.</p>` : `<p class="hint">لم أجد أسماء مكتوبة في الملف (قد يكون صورة ممسوحة). تُنشأ المدرسة وتضيفين الأسماء يدوياً.</p>`}`;
  const all = bx.querySelector("#bn-all"); const boxes = () => [...bx.querySelectorAll(".checks input")];
  if (all) { all.onchange = () => boxes().forEach((c) => (c.checked = all.checked)); boxes().forEach((c) => (c.onchange = () => (all.checked = boxes().every((x) => x.checked)))); }
  const v = await modal({ title: "إنشاء مدرسة من الميزانية", body: bx, wide: true, actions: [{ label: "إلغاء", value: null },
    { label: "إنشاء المدرسة والمعلمات", kind: "primary", value: (b) => ({ school: b.querySelector("#bn-s").value.trim(), names: [...b.querySelectorAll(".checks input:checked")].map((c) => names[Number(c.value)]) }) }] });
  if (!v) return;
  if (!v.school) return toast("اكتبي اسم المدرسة", "error");
  try {
    let sc = state.schools.find((x) => x.title.trim() === v.school);
    if (!sc) sc = await api.create({ kind: "school", title: v.school, data: {} });
    await api.upload(file, { category: "attachment", subcategory: "budget", record_id: sc.id, title: file.name }).catch(() => {});
    await refreshPeople();
    const have = new Set(state.teachers.filter((t) => t.school_id === sc.id).map((t) => t.title.trim()));
    let n = 0; for (const name of v.names) if (!have.has(name)) { await api.create({ kind: "teacher", title: name, school_id: sc.id, data: {} }); have.add(name); n++; }
    await refreshPeople();
    toast(`أُنشئت «${v.school}»${n ? ` وأُضيف ${n} اسم` : ""}`); location.hash = `#/schools/${sc.id}`;
  } catch (e) { toast(e.message || "تعذّر الإنشاء", "error"); }
}
