// المشرف: تفعيل الحسابات، تحديد المسؤول عن التجميع، القوائم المنسدلة، وصلاحيات الملفات المشتركة.
// المشرف لا يرى سجلات الموجّهين ولا يعدّلها — هذا مطبّق في قاعدة البيانات وليس في الواجهة فقط.
import { api } from "../api.js";
import { state, loadOptions } from "../store.js";
import { esc, $, $$, toast, modal } from "../ui.js";
import { go } from "../kit.js";
import { DEFAULT_OPTIONS, TEACHER_VISIT, tvOptionKey } from "../templates.js";

export default async function (main, { params }) {
  if (state.profile.role !== "admin") { main.innerHTML = `<div class="container"><div class="empty">هذه الصفحة للمشرف فقط.</div></div>`; return; }
  const tab = params.tab || "users";
  main.innerHTML = `<div class="container"><div class="page-head"><div><h1>إدارة الحسابات والصلاحيات</h1><div class="sub">المشرف يدير الصلاحيات فقط، ولا يطّلع على سجلات الموجّهين</div></div></div>
    <div class="toolbar">${[["users", "الحسابات"], ["options", "القوائم المنسدلة"], ["files", "صلاحيات الملفات المشتركة"]].map(([k, l]) => `<a class="btn ${k === tab ? "primary" : ""}" href="#/admin?tab=${k}">${l}</a>`).join("")}</div><div id="out"></div></div>`;
  const out = $("#out", main);
  if (tab === "users") return users(out);
  if (tab === "options") return options(out, params);
  return sharedFiles(out);
}

async function users(out) {
  const list = await api.rpc("admin_list_users");
  out.innerHTML = `<div class="tbl-wrap"><table class="data"><tr><th>الاسم</th><th>اسم المستخدم</th><th>البريد</th><th>مفعّل</th><th>المسؤول عن التجميع</th><th>الدور</th><th></th></tr>
    ${list.map((u) => `<tr data-id="${u.id}"><td>${esc(u.full_name)}</td><td dir="ltr">${esc(u.username)}</td><td dir="ltr">${esc(u.email || "")}</td>
      <td><input type="checkbox" data-f="approved" ${u.approved ? "checked" : ""} aria-label="مفعّل"></td><td><input type="checkbox" data-f="is_collector" ${u.is_collector ? "checked" : ""} aria-label="المسؤول عن التجميع"></td>
      <td><select data-f="role"><option value="guide" ${u.role === "guide" ? "selected" : ""}>موجّه</option><option value="admin" ${u.role === "admin" ? "selected" : ""}>مشرف</option></select></td>
      <td><button class="btn small primary" data-save>حفظ</button></td></tr>`).join("")}</table></div>
    <p class="hint">الحسابات الجديدة تنتظر التفعيل هنا. المسؤول عن التجميع يرى فقط الخطط الأسبوعية التي يرسلها أصحابها إليه.</p>`;
  $$("[data-save]", out).forEach((b) => (b.onclick = async () => {
    const tr = b.closest("tr"), f = (n) => tr.querySelector(`[data-f=${n}]`);
    try { await api.rpc("admin_set_user", { p_id: tr.dataset.id, p_approved: f("approved").checked, p_is_collector: f("is_collector").checked, p_role: f("role").value }); toast("تم الحفظ"); }
    catch (e) { toast(e.message, "error"); }
  }));
}

async function options(out, params) {
  await loadOptions();
  const keys = Object.keys(DEFAULT_OPTIONS);
  const general = keys.filter((k) => !k.startsWith("tv."));
  const key = params.key || general[0];
  const o = state.options[key] || { label: key, items: [] };
  out.innerHTML = `<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.4fr)">
    <section class="panel"><h2>القوائم</h2><div class="list">${general.map((k) => `<a class="item" href="#/admin?tab=options&key=${encodeURIComponent(k)}" ${k === key ? 'style="background:var(--accent-soft)"' : ""}><span class="t">${esc(state.options[k]?.label || k)}</span><span class="m">${(state.options[k]?.items || []).length} خيار</span></a>`).join("")}</div>
      <h2 style="margin-top:16px">بنود زيارة المعلم</h2>${TEACHER_VISIT.sections.map((s) => `<details ${key.startsWith("tv." + s.key) ? "open" : ""}><summary><b>${esc(s.screenTitle)}</b></summary><div class="list">${s.items.map((l, i) => { const k = tvOptionKey(s.key, i);
        return `<a class="item" href="#/admin?tab=options&key=${encodeURIComponent(k)}" ${k === key ? 'style="background:var(--accent-soft)"' : ""}><span class="t">${i + 1}. ${esc(l)}</span><span class="m">${(state.options[k]?.items || []).length} خيار</span></a>`; }).join("")}</div></details>`).join("")}</section>
    <section class="panel"><h2>${esc(o.label)}</h2><p class="hint">اكتبي كل خيار في سطر. التعديل يظهر لجميع الموجّهين في القوائم المنسدلة، ولا يغيّر السجلات أو التقارير السابقة.</p>
      <div class="f"><textarea id="items" rows="14" aria-label="الخيارات">${esc(o.items.join("\n"))}</textarea></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="save">حفظ القائمة</button></div></section></div>`;
  $("#save", out).onclick = async () => {
    const items = $("#items", out).value.split("\n").map((x) => x.trim()).filter(Boolean);
    try { await api.saveOption(key, DEFAULT_OPTIONS[key]?.label || o.label, [...new Set(items)]); await loadOptions(); toast("حُفظت القائمة"); go(`#/admin?tab=options&key=${encodeURIComponent(key)}`); }
    catch (e) { toast(e.message, "error"); }
  };
}

async function sharedFiles(out) {
  const files = (await api.files("&category=eq.shared&deleted_at=is.null")).filter((f) => f.owner_id !== state.profile.id);
  const people = await api.rpc("admin_list_users").catch(() => []);
  const name = (id) => people.find((p) => p.id === id)?.full_name || "—";
  out.innerHTML = files.length ? `<p class="hint">تظهر هنا أسماء الملفات المشتركة وأصحابها فقط، ولا يستطيع المشرف فتح محتواها. يمكنه إضافة أو إزالة من يصل إليها.</p>
    <div class="tbl-wrap"><table class="data"><tr><th>الملف</th><th>صاحبه</th><th></th></tr>${files.map((f) => `<tr data-id="${f.id}"><td>${esc(f.title)}</td><td>${esc(name(f.owner_id))}</td><td><button class="btn small" data-m>إدارة الوصول</button></td></tr>`).join("")}</table></div>`
    : `<div class="empty">لا توجد ملفات مشتركة من الموجّهين.</div>`;
  $$("[data-m]", out).forEach((b) => (b.onclick = async () => {
    const f = files.find((x) => x.id === b.closest("tr").dataset.id);
    const shares = await api.shares(f.id); const has = new Set(shares.map((s) => s.user_id));
    const body = document.createElement("div");
    body.innerHTML = `<div class="checks">${people.filter((p) => p.approved && p.id !== state.profile.id && p.id !== f.owner_id).map((p) => `<label><input type="checkbox" value="${p.id}" ${has.has(p.id) ? "checked" : ""}>${esc(p.full_name)}</label>`).join("")}</div>`;
    if (!(await modal({ title: "الوصول إلى: " + f.title, body, actions: [{ label: "إلغاء", value: false }, { label: "حفظ", kind: "primary", value: true }] }))) return;
    try { for (const cb of $$("input", body)) { if (cb.checked && !has.has(cb.value)) await api.addShare(f.id, cb.value); if (!cb.checked && has.has(cb.value)) await api.removeShare(f.id, cb.value); } toast("تم التحديث"); }
    catch (e) { toast(e.message, "error"); }
  }));
}
