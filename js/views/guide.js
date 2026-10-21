// البيانات الرئيسية للموجّه + التوقيع والختم والشعارات
import { api } from "../api.js";
import { state, opts, recordEditor, fileUrl, G } from "../store.js";
import { esc, $, $$, toast, modal, confirmBox, shrinkImage, academicYearOf } from "../ui.js";
import { field, bindFields, savePill } from "../kit.js";
import { LOGOS, COVER_LINES, FIRST_SUPERVISOR, MONTHLY_ACH } from "../templates.js";
import { FONTS, HEAD_FONTS, PRINT_FONTS, COLORS, SIZES, SHAPES, MODES, DEFAULT_UI, applyUI, migrate } from "../theme.js";

export default async function (main, { name }) {
  let rec = state.guide || { kind: "guide_data", title: "البيانات الرئيسية", data: {
    full_name: state.profile.full_name, guidance: "التوجيه الفني العام للعلوم", directorate: "الإدارة العامة لمنطقة الأحمدي التعليمية", region: "الأحمدي", subject: "", stage: "" } };
  const ed = recordEditor(rec, { onSaved: (r) => (state.guide = r), onCreated: (r) => (state.guide = r) });
  const d = () => ed.rec.data;
  main.innerHTML = `<div class="container">
    <div class="page-head"><div><h1>${name === "settings" ? "الإعدادات والمظهر" : "البيانات الرئيسية للموجّه الفني"}</h1>
    <div class="sub">تُدخل مرة واحدة وتظهر تلقائياً في كل التقارير والإحصائيات.</div></div></div>
    <section class="panel" id="basic"><h2>بيانات الموجّه</h2><div class="form">
      ${field({ label: "اسم الموجّه الفني", key: "full_name", value: d().full_name, required: true })}
      ${field({ label: "المسمى الوظيفي", key: "job_title", type: "select", options: opts("job_titles"), value: d().job_title })}
      ${field({ label: "المهمة الإضافية", key: "extra_task", type: "select", options: opts("extra_tasks"), value: d().extra_task })}
      ${field({ label: "المرحلة", key: "stage", type: "select", options: opts("stages"), value: d().stage, required: true })}
      ${field({ label: "التخصص / المادة", key: "subject", value: d().subject, placeholder: "مثال: الكيمياء", required: true })}
      ${field({ label: "التوجيه الفني", key: "guidance", value: d().guidance })}
      ${field({ label: "المنطقة التعليمية", key: "directorate", value: d().directorate })}
      ${field({ label: "اسم المنطقة كما يظهر في عناوين التقارير", key: "region", value: d().region, hint: "مثال: الأحمدي" })}
      ${field({ label: "اسم الموجّه الفني الأول", key: "first_supervisor", value: d().first_supervisor || FIRST_SUPERVISOR.name, required: true, hint: "يظهر في آخر الإحصائيات والإنجازات الأسبوعية والشهرية" })}
      ${field({ label: "رقم الهاتف", key: "phone", type: "tel", value: d().phone })}
    </div></section>

    <section class="panel" id="sign"><h2>التوقيع والختم</h2>
      <p class="hint">صوّري توقيعك أو ختمك على ورقة بيضاء وارفعي الصورة: تُزال الخلفية والظل ويُقص حولها ويتوحد لون الحبر تلقائياً، وتراجعين النتيجة قبل الحفظ. لا تظهر في أي تقرير إلا إذا اخترتِ ذلك في شاشة الطباعة لذلك التقرير.</p>
      <div class="grid2">
        <div class="f"><span class="lab">صورة التوقيع</span><div id="sig-slot"></div></div>
        <div class="f"><span class="lab">صورة الختم</span><div id="stamp-slot"></div></div>
      </div></section>

    <section class="panel" id="logos"><h2>الشعارات الرسمية</h2>
      <p class="hint">الشعارات الافتراضية مأخوذة من النماذج الرسمية المرفقة. يمكنك استبدال أي منها، والرجوع للأصل في أي وقت.</p>
      <div class="tbl-wrap"><table class="data"><tr><th>الشعار</th><th>الحالي</th><th></th></tr>
      ${Object.entries(LOGOS).map(([k, l]) => `<tr data-k="${k}"><td>${esc(l.label)}</td><td><img alt="" style="max-height:44px;max-width:220px;background:#fff" data-img></td>
        <td class="row"><label class="btn small">استبدال<input type="file" accept="image/*" hidden></label><button class="btn small ghost" data-reset ${G().logos?.[k] ? "" : "hidden"}>استعادة الأصل</button></td></tr>`).join("")}</table></div></section>

    <section class="panel" id="look"><h2>المظهر</h2><p class="hint">خاص بك وحدك، ويُحفظ مع حسابك فيظهر على كل أجهزتك. التغيير يظهر فوراً.</p><div class="form">
      <div class="f"><label for="ui-font">خط النصوص</label><select id="ui-font" data-ui="font">${Object.keys(FONTS).map((f) => `<option value="${f}" style="font-family:'${f}'">${f}</option>`).join("")}</select></div>
      <div class="f"><label for="ui-head">خط اسم الموقع والعناوين</label><select id="ui-head" data-ui="headFont">${Object.entries(HEAD_FONTS).map(([k, v]) => `<option value="${k}">${v[1]}</option>`).join("")}</select></div>
      <div class="f"><label for="ui-size">حجم الخط</label><select id="ui-size" data-ui="size">${Object.entries(SIZES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}</select></div>
      <div class="f"><label for="ui-mode">الوضع</label><select id="ui-mode" data-ui="mode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div class="f"><label for="ui-shape">النمط</label><select id="ui-shape" data-ui="shape">${Object.entries(SHAPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}</select></div>
      <div class="f"><label for="ui-pf">خط التقارير المطبوعة</label><select id="ui-pf" data-ui="printFont">${Object.entries(PRINT_FONTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><div class="hint">ملف Word يبقى بخط Arial ليفتح على أي جهاز</div></div>
      <div class="f wide"><span class="lab">اللون</span><div class="swatches" role="radiogroup" aria-label="اللون">${Object.entries(COLORS).map(([k, v]) => `<button type="button" class="swatch" data-color="${k}" role="radio" aria-label="${v.label}" title="${v.label}" style="--sw:${v.a[0]}"><i></i><span>${v.label}</span></button>`).join("")}</div></div>
    </div><div class="row" style="margin-top:10px"><button class="btn ghost" id="ui-reset">الرجوع للإعدادات الأصلية</button></div></section>

    <section class="panel" id="covers"><h2>غلاف الإنجازات الأسبوعية والشهرية</h2><p class="hint">النموذجان المرفقان من منطقة حولي. عدّلي سطور الغلاف لتناسب منطقتك؛ تُطبع كما تكتبينها.</p><div class="form">
      ${field({ label: "سطور الغلاف (سطر لكل سطر)", key: "cover.lines", type: "textarea", value: (d().cover?.lines || COVER_LINES).join("\n"), wide: true, rows: 4 })}
      ${field({ label: "مسمى التوقيع الأخير", key: "cover.first_title", value: d().cover?.first_title || FIRST_SUPERVISOR.title })}
      ${field({ label: "مسمى مدير الإدارة (غلاف الإنجازات الشهرية)", key: "cover.director_title", value: d().cover?.director?.title ?? MONTHLY_ACH.director.title })}
      ${field({ label: "اسم مدير الإدارة", key: "cover.director_name", value: d().cover?.director?.name ?? MONTHLY_ACH.director.name })}
      <label class="row"><input type="checkbox" id="hide-dir" ${d().cover?.hideDirector ? "checked" : ""}> إخفاء مدير الإدارة من الغلاف</label>
    </div></section>

    <section class="panel"><h2>الحساب</h2><div class="row">
      <span>اسم المستخدم: <b dir="ltr">${esc(state.profile.username)}</b></span>
      <button class="btn" id="pw">تغيير كلمة المرور</button><button class="btn" id="out-all" type="button">تسجيل الخروج من كل الأجهزة</button></div></section>
  </div>`;
  $(".page-head", main).appendChild(savePill());
  // المظهر
  const ui = () => ({ ...DEFAULT_UI, ...migrate(d().ui || {}) });
  const paintUI = () => { const u = ui(); $$("[data-ui]", main).forEach((el) => (el.value = u[el.dataset.ui] ?? "")); $$(".swatch", main).forEach((b) => b.setAttribute("aria-checked", b.dataset.color === u.color)); };
  paintUI();
  const setUI = (k, v) => { ed.change((r) => { r.data.ui = { ...ui(), [k]: v }; }); applyUI(ui()); paintUI(); };
  $$("[data-ui]", main).forEach((el) => (el.onchange = () => setUI(el.dataset.ui, el.value)));
  $$(".swatch", main).forEach((b) => (b.onclick = () => setUI("color", b.dataset.color)));
  $("#ui-reset", main).onclick = () => { ed.change((r) => { r.data.ui = { ...DEFAULT_UI }; }); applyUI(DEFAULT_UI); paintUI(); };
  // الغلاف
  bindFields($("#covers", main), (k, v) => ed.change((r) => {
    const c = { ...(r.data.cover || {}) };
    if (k === "cover.lines") c.lines = v.split("\n").map((x) => x.trim()).filter(Boolean);
    else if (k === "cover.first_title") c.first_title = v;
    else if (k === "cover.director_title") c.director = { ...(c.director || MONTHLY_ACH.director), title: v };
    else if (k === "cover.director_name") c.director = { ...(c.director || MONTHLY_ACH.director), name: v };
    r.data.cover = c;
  }));
  $("#hide-dir", main).onchange = (e) => ed.change((r) => { r.data.cover = { ...(r.data.cover || {}), hideDirector: e.target.checked }; });
  bindFields($("#basic", main), (k, v) => ed.change((r) => { r.data[k] = v; if (k === "full_name") r.title = "البيانات الرئيسية"; r.academic_year = r.academic_year || academicYearOf(); }));

  const imgSlot = async (box, key, category) => {
    const id = d()[key];
    const u = id ? await fileUrl(id) : null;
    box.innerHTML = `<div class="row">${u ? `<img src="${u}" alt="" style="max-height:80px;max-width:200px;background:#fff;border:1px solid var(--line);border-radius:6px;padding:4px">` : '<span class="hint">لم تُرفع بعد</span>'}
      <label class="btn small">${u ? "استبدال" : "رفع صورة"}<input type="file" accept="image/*" hidden></label>${category === "signature" ? '<button class="btn small" type="button" data-draw>✍️ وقّعي بيدك أو بالقلم</button>' : ""}${u ? '<button class="btn small danger" data-x>إزالة</button>' : ""}</div>`;
    const save = async (f) => { try { const up = await api.upload(await shrinkImage(f, 1000), { category, title: f.name }); ed.change((r) => (r.data[key] = up.id), { immediate: true }); await ed.save(); imgSlot(box, key, category); toast("تم حفظ التوقيع"); }
      catch (err) { toast("تعذر الحفظ: " + err.message, "error"); } };
    const dr = box.querySelector("[data-draw]");
    if (dr) dr.onclick = async () => { const { drawSignature } = await import("../sigpad.js"); const f = await drawSignature({ modal, toast }); if (f) await save(f); };
    box.querySelector("input").onchange = async (e) => {
      const f0 = e.target.files[0]; e.target.value = ""; if (!f0) return;
      // تنظيف تلقائي داخل المتصفح: إزالة الخلفية والقص وتوحيد لون الحبر، مع معاينة قبل الحفظ
      const { inkEditor } = await import("../inkclean.js");
      const f = await inkEditor(f0, { modal, toast, title: category === "signature" ? "تعديل صورة التوقيع" : "تعديل صورة الختم" });
      if (!f) return;
      try { const up = await api.upload(await shrinkImage(f, 1000), { category, title: f.name }); ed.change((r) => (r.data[key] = up.id), { immediate: true }); await ed.save(); imgSlot(box, key, category); toast("تم الرفع"); }
      catch (err) { toast("تعذر الرفع: " + err.message, "error"); }
    };
    const x = box.querySelector("[data-x]"); if (x) x.onclick = async () => { ed.change((r) => (r.data[key] = null), { immediate: true }); await ed.save(); imgSlot(box, key, category); };
  };
  imgSlot($("#sig-slot", main), "signature", "signature");
  imgSlot($("#stamp-slot", main), "stamp", "stamp");

  $$("#logos tr[data-k]", main).forEach(async (tr) => {
    const k = tr.dataset.k, im = tr.querySelector("[data-img]");
    const paint = async () => { const id = d().logos?.[k]; im.src = id ? await fileUrl(id) : LOGOS[k].src; tr.querySelector("[data-reset]").hidden = !id; };
    tr.querySelector("input").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const up = await api.upload(await shrinkImage(f, 1200), { category: "logo", title: LOGOS[k].label });
        ed.change((r) => (r.data.logos = { ...(r.data.logos || {}), [k]: up.id }), { immediate: true }); await ed.save(); paint(); toast("تم استبدال الشعار"); }
      catch (err) { toast("تعذر الرفع: " + err.message, "error"); }
    };
    tr.querySelector("[data-reset]").onclick = async () => { ed.change((r) => { const l = { ...(r.data.logos || {}) }; delete l[k]; r.data.logos = l; }, { immediate: true }); await ed.save(); paint(); };
    paint();
  });

  $("#pw", main).onclick = async () => {
    const v = await modal({ title: "تغيير كلمة المرور", body: `<div class="f"><label for="np">كلمة المرور الجديدة (8 أحرف على الأقل)</label><input id="np" type="password" dir="ltr"></div>`,
      actions: [{ label: "إلغاء", value: null }, { label: "حفظ", kind: "primary", value: (b) => b.querySelector("#np").value }] });
    if (!v) return;
    if (v.length < 8) return toast("كلمة المرور قصيرة", "error");
    try { await api.changePassword(v); toast("تم تغيير كلمة المرور"); } catch (e) { toast(e.message, "error"); }
  };
  $("#out-all", main).onclick = async () => {
    if (!(await confirmBox("تسجيل الخروج من كل الأجهزة", "سيُطلب الدخول بكلمة المرور من جديد في كل جهاز، ومنها الجوال وهذا الجهاز.", "تسجيل الخروج", true))) return;
    await api.signOut(true); location.hash = ""; location.reload();
  };
  if (name === "settings") $("#look", main).scrollIntoView();
  window.__currentEditor = ed;
}

