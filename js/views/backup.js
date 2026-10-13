// النسخ الاحتياطي والاستعادة: ملف واحد يشمل السجلات والخطط والتقارير المعتمدة والمرفقات والإعدادات
import { api } from "../api.js";
import { state, loadBase } from "../store.js";
import { esc, $, toast, modal, download, fileToDataUrl, today, dataUrlToBlob } from "../ui.js";
import { KIND_LABEL } from "../kit.js";

const ORDER = ["guide_data", "school", "teacher"];

export default async function (main) {
  main.innerHTML = `<div class="container"><div class="page-head"><div><h1>النسخ الاحتياطي والاستعادة</h1><div class="sub">احفظي نسخة دورياً (مثلاً نهاية كل شهر) على جهازك أو في Google Drive</div></div></div>
    <section class="panel"><h2>تنزيل نسخة احتياطية</h2><p>يشمل الملف: كل سجلاتك (مع المحذوفة والمعتمدة)، والخطط، والإعدادات، وسجل العمليات، والمرفقات (الصور والتوقيعات والملفات).</p>
      <label class="row"><input type="checkbox" id="att" checked> تضمين المرفقات (يزيد حجم الملف)</label>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="exp">تنزيل النسخة الاحتياطية</button><span class="hint" id="exp-st"></span></div></section>
    <section class="panel"><h2>استعادة من نسخة احتياطية</h2><p>اختاري ملف النسخة (.json). سيُعرض عليك ملخص قبل أي تغيير، ولن تُستبدل بياناتك الحالية إلا بعد تأكيدك.</p>
      <label class="btn">اختيار ملف النسخة<input type="file" id="imp" accept=".json,application/json" hidden></label><div id="imp-st" class="hint" style="margin-top:8px"></div></section></div>`;

  $("#exp", main).onclick = async () => {
    const st = $("#exp-st", main); const btn = $("#exp", main); btn.disabled = true;
    try {
      st.textContent = "جارٍ تجميع السجلات…";
      const mine = await api.list({ includeDeleted: true, order: "created_at.asc" });
      // ملفات الإنجازات الشهرية المشتركة (كلها، لا ما أنشأتُه فقط)
      const shared = await api.list({ kind: "shared_achievements", includeDeleted: true }).catch(() => []);
      const records = [...mine, ...shared.filter((r) => !mine.some((m) => m.id === r.id))];
      const files = await api.files("");
      const own = files.filter((f) => api.demo || f.owner_id === state.profile.id);
      const blobs = {};
      if ($("#att", main).checked) {
        let i = 0;
        for (const f of own) { st.textContent = `جارٍ تجميع المرفقات ${++i} من ${own.length}…`; if (!f.storage_path) continue; try { blobs[f.id] = await fileToDataUrl(await api.fileBlob(f.storage_path)); } catch (_) { blobs[f.id] = null; } }
      }
      const audit = [];
      const data = { app: "sijil", format: 1, exported_at: new Date().toISOString(), user: { username: state.profile.username, full_name: state.profile.full_name }, records, files: own, blobs,
        options: state.profile.role === "admin" ? await api.options().catch(() => []) : [], audit };
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      download(blob, `نسخة-سجلات-الموجه-${today()}.json`);
      st.textContent = `تم: ${records.length} سجل و${own.length} مرفق (${(blob.size / 1048576).toFixed(1)} م.ب).`;
      try { localStorage.setItem("sijil.lastBackup", new Date().toISOString()); } catch (_) {}
    } catch (e) { st.textContent = ""; toast("تعذر إنشاء النسخة: " + e.message, "error"); }
    btn.disabled = false;
  };

  $("#imp", main).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const st = $("#imp-st", main);
    let data;
    try { data = JSON.parse(await f.text()); if (data.app !== "sijil" || !Array.isArray(data.records)) throw 0; }
    catch (_) { st.textContent = "هذا الملف ليس نسخة احتياطية صالحة من سجلات الموجّه."; return; }
    const current = await api.list({ includeDeleted: true });
    const curIds = new Set(current.map((r) => r.id));
    const counts = {}; data.records.forEach((r) => (counts[r.kind] = (counts[r.kind] || 0) + 1));
    const overlap = data.records.filter((r) => curIds.has(r.id)).length;
    const mode = await modal({ title: "تأكيد الاستعادة", wide: true,
      body: `<p>النسخة من ${new Date(data.exported_at).toLocaleString("ar-KW")} للحساب <b>${esc(data.user?.full_name || data.user?.username || "")}</b>.</p>
        <ul>${Object.entries(counts).map(([k, n]) => `<li>${esc(KIND_LABEL[k] || k)}: ${n}</li>`).join("")}<li>المرفقات: ${data.files?.length || 0}</li></ul>
        <p>${overlap} سجل موجود حالياً بنفس المعرّف.</p>
        <p><b>إضافة فقط:</b> تُضاف السجلات غير الموجودة، ولا يُمس أي سجل حالي.<br><b>إضافة واستبدال:</b> تُضاف الناقصة، وتُستبدل السجلات الموجودة غير المعتمدة بنسختها في الملف. السجلات المعتمدة حالياً لا تُستبدل.</p>`,
      actions: [{ label: "إلغاء", value: null }, { label: "إضافة واستبدال", value: "replace", kind: "danger" }, { label: "إضافة فقط", value: "merge", kind: "primary" }] });
    if (!mode) { st.textContent = "أُلغيت الاستعادة. لم يتغير شيء."; e.target.value = ""; return; }
    const res = { added: 0, replaced: 0, skipped: 0, errors: [] };
    // 1) المرفقات: تُرفع من جديد، وتُحدَّث المراجع إليها
    const idMap = {};
    let i = 0;
    for (const fm of data.files || []) {
      st.textContent = `استعادة المرفقات ${++i} من ${data.files.length}…`;
      if (fm.url && !fm.storage_path) {
        try { const up = await api.addLink({ category: fm.category, stage: fm.stage, term: fm.term, subcategory: fm.subcategory, title: fm.title, url: fm.url }); idMap[fm.id] = up.id; }
        catch (err) { res.errors.push(`رابط «${fm.title}»: ${err.message}`); }
        continue;
      }
      const d = data.blobs?.[fm.id]; if (!d) continue;
      try { const blob = dataUrlToBlob(d); const up = await api.upload(new File([blob], fm.title || "file", { type: fm.mime || blob.type }), { category: fm.category, stage: fm.stage, term: fm.term, subcategory: fm.subcategory, title: fm.title });
        idMap[fm.id] = up.id; } catch (err) { res.errors.push(`مرفق «${fm.title}»: ${err.message}`); }
    }
    const remap = (obj) => { if (obj == null) return obj; let s = JSON.stringify(obj); for (const [a, b] of Object.entries(idMap)) s = s.split(a).join(b); return JSON.parse(s); };
    // 2) السجلات: المدارس والمعلمون أولاً لأن غيرها يرتبط بها
    const recs = [...data.records].sort((a, b) => (ORDER.indexOf(a.kind) + 1 || 9) - (ORDER.indexOf(b.kind) + 1 || 9));
    i = 0;
    for (const r of recs) {
      st.textContent = `استعادة السجلات ${++i} من ${recs.length}…`;
      const body = { id: r.id, kind: r.kind, academic_year: r.academic_year, term: r.term, record_date: r.record_date, school_id: r.school_id, teacher_id: r.teacher_id, title: r.title,
        data: remap(r.data), status: r.status, snapshot: remap(r.snapshot), deleted_at: r.deleted_at };
      try {
        const cur = current.find((c) => c.id === r.id);
        if (!cur) { await api.create(body); res.added++; }
        else if (mode === "replace" && cur.status !== "approved" && r.status !== "approved") {
          await api.update(r.id, { title: body.title, data: body.data, academic_year: body.academic_year, term: body.term, record_date: body.record_date, school_id: body.school_id, teacher_id: body.teacher_id }, cur.version); res.replaced++;
        } else res.skipped++;
      } catch (err) { res.errors.push(`«${r.title || KIND_LABEL[r.kind]}»: ${err.message}`); }
    }
    await loadBase();
    st.innerHTML = `اكتملت الاستعادة: أُضيف ${res.added}، استُبدل ${res.replaced}، بقي كما هو ${res.skipped}.${res.errors.length ? `<br><b style="color:var(--bad)">لم تنجح ${res.errors.length} عملية:</b><br>${res.errors.slice(0, 20).map(esc).join("<br>")}` : ""}`;
    e.target.value = "";
  };
}
