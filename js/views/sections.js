// أقسام التوجيه: المشرف العام ينشئ الأقسام ويعيّن مشرف كل قسم، ومشرف القسم يحدد أعضاءه ومن يعبّي ملف إنجازاته
import { api } from "../api.js";
import { state, SECTION_DEFAULTS } from "../store.js";
import { esc, $, $$, toast, modal, confirmBox } from "../ui.js";

// الحسابات المفعّلة التي يختار منها (المشرف العام: كل الحسابات؛ مشرف القسم: زملاؤه)
async function candidates() {
  if (state.profile?.role === "admin") return (await api.rpc("admin_list_users").catch(() => [])).filter((p) => p.approved);
  const others = (await api.rpc("list_colleagues").catch(() => [])) || [];
  return [{ id: state.profile.id, full_name: state.profile.full_name || "أنا" }, ...others];
}

// نافذة: أعضاء القسم ومن يعبّي ملفه
export async function sectionMembersModal(sec) {
  const people = (await candidates()).filter((p) => p.id !== sec.supervisor_id);
  const mem = new Set(sec.members || []), eds = new Set(sec.editors || []);
  const body = document.createElement("div");
  body.innerHTML = `<p class="hint" style="margin-top:0">«عضو» يرى ملف القسم. «يعبّي» يعدّل الملف. إذا لم تحددي أحداً في «يعبّي» يعبّيه كل الأعضاء. مشرف القسم يعبّي دائماً.</p>
    ${people.length ? `<div class="tbl-wrap"><table class="data"><tr><th>الاسم</th><th>عضو</th><th>يعبّي</th></tr>${people.map((p) => `<tr data-id="${p.id}"><td>${esc(p.full_name || p.username || "")}</td>
      <td><input type="checkbox" data-m ${mem.has(p.id) ? "checked" : ""} aria-label="عضو: ${esc(p.full_name || "")}"></td>
      <td><input type="checkbox" data-e ${eds.has(p.id) ? "checked" : ""} aria-label="يعبّي: ${esc(p.full_name || "")}"></td></tr>`).join("")}</table></div>` : `<p class="hint">لا توجد حسابات مفعّلة أخرى.</p>`}`;
  $$("tr[data-id]", body).forEach((tr) => {
    const m = $("[data-m]", tr), e = $("[data-e]", tr);
    e.onchange = () => { if (e.checked) m.checked = true; };
    m.onchange = () => { if (!m.checked) e.checked = false; };
  });
  const ok = await modal({ title: "أعضاء القسم: " + sec.name, body, wide: true, actions: [{ label: "إلغاء", value: null }, { label: "حفظ", kind: "primary", value: true }] });
  if (!ok) return false;
  const members = $$("tr[data-id]", body).filter((tr) => $("[data-m]", tr).checked).map((tr) => tr.dataset.id);
  const editors = $$("tr[data-id]", body).filter((tr) => $("[data-e]", tr).checked).map((tr) => tr.dataset.id);
  try { await api.updateSection(sec.id, { members, editors }); toast("حُفظ أعضاء القسم"); return true; }
  catch (e) { toast(e.message, "error"); return false; }
}

// تبويب المشرف العام
export async function sectionsAdmin(out) {
  const [secs, people] = await Promise.all([api.sections(), candidates()]);
  const name = (id) => people.find((p) => p.id === id)?.full_name || "";
  const missing = SECTION_DEFAULTS.filter(([n]) => !secs.some((s) => s.name === n));
  out.innerHTML = `<section class="panel"><h2>أقسام التوجيه</h2>
      <p class="hint" style="margin-top:0">لكل قسم مشرف وأعضاء وملف إنجازات شهري خاص به. مشرف القسم يحدد أعضاء قسمه ومن يعبّي ملفه من صفحة «الإنجازات الشهرية».</p>
      <div class="row" style="flex-wrap:wrap">${missing.length ? `<button class="btn primary" id="sec-def">إنشاء الأقسام: ${esc(missing.map(([n]) => n).join("، "))}</button>` : ""}<button class="btn" id="sec-add">+ قسم آخر</button></div></section>
    ${secs.length ? `<div class="tbl-wrap"><table class="data" id="sec-t"><tr><th>القسم</th><th>مشرف القسم</th><th>الأعضاء</th><th>من يعبّي</th><th></th></tr>
      ${secs.map((s) => `<tr data-id="${s.id}"><td><b>${esc(s.name)}</b></td>
        <td><select data-sup aria-label="مشرف القسم"><option value="">— اختاري —</option>${people.map((p) => `<option value="${p.id}" ${p.id === s.supervisor_id ? "selected" : ""}>${esc(p.full_name || p.username)}</option>`).join("")}</select></td>
        <td>${(s.members || []).length}</td><td>${(s.editors || []).length ? (s.editors || []).length : "كل الأعضاء"}</td>
        <td class="row" style="gap:6px"><button class="btn small" data-mem>الأعضاء ومن يعبّي</button><button class="btn small ghost" data-ren>تعديل الاسم</button><button class="btn small ghost" data-del style="color:var(--bad)">حذف</button></td></tr>`).join("")}</table></div>`
      : `<div class="empty">لا توجد أقسام بعد.</div>`}`;
  const again = () => sectionsAdmin(out);
  const d = $("#sec-def", out); if (d) d.onclick = async () => {
    try { for (const [n, stage, subject] of missing) await api.createSection({ name: n, stage: stage || null, subject: subject || null }); toast("أُنشئت الأقسام"); again(); } catch (e) { toast(e.message, "error"); }
  };
  $("#sec-add", out).onclick = async () => {
    const v = await modal({ title: "قسم جديد", body: `<div class="f"><label for="sn">اسم القسم</label><input id="sn" placeholder="مثال: ثانوي — علوم"></div>`, actions: [{ label: "إلغاء", value: null }, { label: "إضافة", kind: "primary", value: (b) => b.querySelector("#sn").value.trim() }] });
    if (!v) return; try { await api.createSection({ name: v }); again(); } catch (e) { toast(e.message, "error"); }
  };
  $$("#sec-t tr[data-id]", out).forEach((tr) => {
    const s = secs.find((x) => x.id === tr.dataset.id);
    $("[data-sup]", tr).onchange = async (e) => { try { await api.updateSection(s.id, { supervisor_id: e.target.value || null }); toast(e.target.value ? `مشرف «${s.name}»: ${name(e.target.value)}` : "أُزيل مشرف القسم"); again(); } catch (err) { toast(err.message, "error"); } };
    $("[data-mem]", tr).onclick = async () => { if (await sectionMembersModal(s)) again(); };
    $("[data-ren]", tr).onclick = async () => {
      const v = await modal({ title: "اسم القسم", body: `<div class="f"><input id="sn" value="${esc(s.name)}"></div>`, actions: [{ label: "إلغاء", value: null }, { label: "حفظ", kind: "primary", value: (b) => b.querySelector("#sn").value.trim() }] });
      if (!v) return; try { await api.updateSection(s.id, { name: v }); again(); } catch (e) { toast(e.message, "error"); }
    };
    $("[data-del]", tr).onclick = async () => {
      if (!(await confirmBox("حذف القسم", `حذف قسم «${s.name}»؟ لا يُحذف القسم إذا كان فيه ملفات إنجازات.`, "حذف", true))) return;
      try { await api.deleteSection(s.id); again(); } catch (e) { toast(/foreign|restrict|ملفات/.test(e.message) ? "لا يمكن حذف قسم فيه ملفات إنجازات" : e.message, "error"); }
    };
  });
}
