// المجموعات: لكل مجموعة ملفات مشتركة وجداول بيانات مشتركة.
// المشرف: ينشئ المجموعات ويحدد أعضاءها، ويرفع الملفات، وينشئ الجداول ويحدد أعمدتها.
// الأعضاء: يرون الملفات وينزّلونها، ويعبّئون الجداول ويعدّلونها (التعديلات تُدمج تلقائياً بين الأعضاء).
// قاعدة البيانات هي التي تفرض هذه الصلاحيات؛ الواجهة تُظهر الأزرار المناسبة فقط.
import { api } from "../api.js";
import { state, recordEditor } from "../store.js";
import { esc, $, $$, toast, modal, confirmBox, academicYearOf } from "../ui.js";
import { go, savePill } from "../kit.js";
import { icon } from "../icons.js";
import { openStored } from "../openfile.js";

const isAdmin = () => state.profile?.role === "admin";
const rid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())).slice(0, 8);
const size = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " م.ب" : Math.max(1, Math.round(n / 1024)) + " ك.ب");

export default async function (main, { name, id, params }) {
  if (name === "group-sheet") return sheetPage(main, id);
  if (id) return groupPage(main, id);
  return listPage(main);
}

/* ---------------- قائمة المجموعات ---------------- */
async function listPage(main) {
  const groups = await api.groups().catch((e) => { toast(e.message, "error"); return []; });
  const counts = await Promise.all(groups.map(async (g) => {
    const [m, f, s] = await Promise.all([api.groupMembers(g.id).catch(() => []), api.files(`&category=eq.group&group_id=eq.${g.id}&deleted_at=is.null`).catch(() => []), api.list({ kind: "group_sheet", group: g.id }).catch(() => [])]);
    return { m: (m || []).length, f: f.length, s: s.length };
  }));
  main.innerHTML = `<div class="container">
    <div class="page-head"><div><h1>المجموعات</h1><div class="sub">${isAdmin() ? "أنشئي مجموعة وحددي أعضاءها؛ ثم ارفعي لها ملفات وأنشئي جداول يعبّئها الأعضاء." : "المجموعات التي أنتِ عضوة فيها: ملفاتها المشتركة وجداولها."}</div></div>
      ${isAdmin() ? `<button class="btn primary" id="newg">+ مجموعة جديدة</button>` : ""}</div>
    ${groups.length ? `<div class="grp-grid">${groups.map((g, i) => `<a class="grp-card" href="#/groups/${g.id}">
        <span class="grp-ic">${icon("share")}</span><b>${esc(g.name)}</b>
        <span class="grp-meta">${counts[i].m} عضو · ${counts[i].f} ملف · ${counts[i].s} جدول</span></a>`).join("")}</div>`
      : `<div class="empty"><h2>لا توجد مجموعات</h2><p>${isAdmin() ? "اضغطي «+ مجموعة جديدة» لإنشاء أول مجموعة." : "لم تُضافي إلى أي مجموعة بعد. يضيفك المسؤول عند إنشاء المجموعة."}</p></div>`}
  </div>`;
  const nb = $("#newg", main);
  if (nb) nb.onclick = async () => {
    const v = await modal({ title: "مجموعة جديدة", body: `<div class="f"><label for="gn">اسم المجموعة</label><input id="gn" placeholder="مثال: موجهات الكيمياء — الأحمدي"></div>`,
      actions: [{ label: "إلغاء", value: null }, { label: "إنشاء", kind: "primary", value: (b) => b.querySelector("#gn").value.trim() }] });
    if (!v) return;
    try { const g = await api.createGroup(v); toast("أُنشئت المجموعة؛ أضيفي أعضاءها"); go(`#/groups/${g.id}?members=1`); } catch (e) { toast(e.message, "error"); }
  };
}

/* ---------------- صفحة المجموعة: الأعضاء، الملفات، الجداول ---------------- */
async function groupPage(main, gid) {
  const g = (await api.groups()).find((x) => x.id === gid);
  if (!g) { main.innerHTML = `<div class="container"><div class="empty"><h2>المجموعة غير موجودة أو لستِ عضوة فيها</h2><p><a href="#/groups">كل المجموعات</a></p></div></div>`; return; }
  const admin = isAdmin();
  main.innerHTML = `<div class="container">
    <div class="recbar no-print"><a class="btn icon-btn" href="#/groups" aria-label="رجوع إلى المجموعات" title="كل المجموعات">→</a><span class="grow"></span>
      ${admin ? `<button class="btn" id="ren">تعديل الاسم</button><button class="btn danger" id="delg">حذف المجموعة</button>` : ""}</div>
    <div class="page-head"><div><h1>${esc(g.name)}</h1><div class="sub" id="mem-line"></div></div>${admin ? `<button class="btn" id="mem">${icon("user")} الأعضاء</button>` : ""}</div>
    <section class="panel"><div class="page-head" style="margin-bottom:8px"><h2>${icon("folder")} الملفات المشتركة</h2>
      ${admin ? `<label class="btn primary">+ رفع ملفات<input type="file" id="gup" multiple hidden></label>` : ""}</div>
      <p class="hint" style="margin-top:0">${admin ? "ما ترفعينه هنا يظهر لكل أعضاء المجموعة." : "ملفات رفعها المسؤول لأعضاء المجموعة؛ افتحيها أو نزّليها."}</p><div id="gfiles"></div></section>
    <section class="panel"><div class="page-head" style="margin-bottom:8px"><h2>${icon("layers")} الجداول المشتركة</h2>
      ${admin ? `<button class="btn primary" id="newsheet">+ جدول جديد</button>` : ""}</div>
      <p class="hint" style="margin-top:0">${admin ? "أنشئي جدولاً بالأعمدة المطلوبة، ويعبّئه الأعضاء ويعدّلونه." : "عبّئي بياناتك في الجدول، وتظهر لكل الأعضاء. تُحفظ تلقائياً."}</p><div id="gsheets"></div></section>
  </div>`;

  const paintMembers = async () => {
    const ms = await api.groupMembers(gid).catch(() => []) || [];
    $("#mem-line", main).innerHTML = ms.length ? `الأعضاء (${ms.length}): ${ms.map((m) => esc(m.full_name || m.username)).join("، ")}` : (admin ? "لا يوجد أعضاء بعد — اضغطي «الأعضاء» لإضافتهم." : "");
    return ms;
  };
  const paintFiles = async () => {
    const list = await api.files(`&category=eq.group&group_id=eq.${gid}&deleted_at=is.null`).catch(() => []);
    const box = $("#gfiles", main);
    box.innerHTML = list.length ? `<div class="list">${list.map((f) => `<div class="item" data-f="${f.id}"><span class="t">${esc(f.title)}</span>
        <span class="m">${esc([size(f.size || 0), new Date(f.created_at).toLocaleDateString("ar-KW")].join(" · "))}</span>
        <span class="s"><button class="btn small" data-open>فتح</button><button class="btn small ghost" data-dl>تنزيل</button>${admin ? '<button class="btn small ghost" data-rm style="color:var(--bad)">حذف</button>' : ""}</span></div>`).join("")}</div>`
      : `<p class="hint">لا توجد ملفات بعد.</p>`;
    $$("[data-f]", box).forEach((row) => {
      const f = list.find((x) => x.id === row.dataset.f);
      row.querySelector("[data-open]").onclick = () => openStored(f);
      row.querySelector("[data-dl]").onclick = () => openStored(f, { save: true });
      const rm = row.querySelector("[data-rm]");
      if (rm) rm.onclick = async () => { if (!(await confirmBox("حذف الملف", `حذف «${f.title}» من المجموعة لكل الأعضاء؟`, "حذف", true))) return; try { await api.deleteFile(f); paintFiles(); } catch (e) { toast(e.message, "error"); } };
    });
  };
  const paintSheets = async () => {
    const list = await api.list({ kind: "group_sheet", group: gid, order: "created_at.asc" }).catch(() => []);
    list.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    $("#gsheets", main).innerHTML = list.length ? `<div class="list">${list.map((s) => `<a class="item" href="#/group-sheet/${s.id}"><span class="t">${esc(s.title)}</span>
        <span class="m">${(s.data?.columns || []).length} عمود · ${(s.data?.rows || []).length} صف · آخر تعديل ${new Date(s.updated_at || s.created_at).toLocaleDateString("ar-KW")}</span><span class="s"><span class="btn small">فتح</span></span></a>`).join("")}</div>`
      : `<p class="hint">لا توجد جداول بعد.</p>`;
  };
  await Promise.all([paintMembers(), paintFiles(), paintSheets()]);

  if (!admin) return;
  const up = $("#gup", main);
  up.onchange = async (e) => {
    const fs = [...e.target.files]; e.target.value = ""; if (!fs.length) return;
    let ok = 0;
    for (const f of fs) { try { await api.upload(f, { category: "group", group_id: gid, title: f.name }); ok++; } catch (err) { toast(`تعذر رفع «${f.name}»: ${err.message}`, "error"); } }
    if (ok) toast(ok === 1 ? "رُفع الملف للمجموعة" : `رُفع ${ok} ملفات للمجموعة`);
    paintFiles();
  };
  $("#newsheet", main).onclick = async () => {
    const v = await modal({ title: "جدول جديد", body: `<div class="form" style="grid-template-columns:1fr">
        <div class="f"><label for="st">عنوان الجدول</label><input id="st" placeholder="مثال: ميزانيات المدارس — الفصل الأول"></div>
        <div class="f"><label for="sc">الأعمدة (عمود في كل سطر)</label><textarea id="sc" rows="6" placeholder="الموجهة&#10;المدرسة&#10;عدد المعلمات&#10;ملاحظات"></textarea></div></div>`,
      actions: [{ label: "إلغاء", value: null }, { label: "إنشاء", kind: "primary", value: (b) => ({ title: b.querySelector("#st").value.trim(), cols: b.querySelector("#sc").value.split("\n").map((x) => x.trim()).filter(Boolean) }) }] });
    if (!v) return;
    if (!v.title || !v.cols.length) return toast("اكتبي عنوان الجدول وعموداً واحداً على الأقل", "error");
    try {
      const r = await api.create({ kind: "group_sheet", group_id: gid, title: v.title, academic_year: academicYearOf(), data: { columns: v.cols.map((l) => ({ id: rid(), label: l })), rows: [] } });
      go(`#/group-sheet/${r.id}`);
    } catch (e) { toast(e.message, "error"); }
  };
  $("#ren", main).onclick = async () => {
    const v = await modal({ title: "اسم المجموعة", body: `<div class="f"><input id="gn" value="${esc(g.name)}"></div>`, actions: [{ label: "إلغاء", value: null }, { label: "حفظ", kind: "primary", value: (b) => b.querySelector("#gn").value.trim() }] });
    if (!v) return;
    try { await api.renameGroup(gid, v); $("h1", main).textContent = v; g.name = v; toast("حُفظ"); } catch (e) { toast(e.message, "error"); }
  };
  $("#delg", main).onclick = async () => {
    if (!(await confirmBox("حذف المجموعة", `تُحذف «${g.name}» وكل ملفاتها وجداولها نهائياً لكل الأعضاء. لا يمكن التراجع.`, "حذف نهائياً", true))) return;
    try {
      for (const f of await api.files(`&category=eq.group&group_id=eq.${gid}`)) { try { await api.deleteFile(f); } catch (_) {} }
      await api.deleteGroup(gid); toast("حُذفت المجموعة"); go("#/groups");
    } catch (e) { toast(e.message, "error"); }
  };
  const manage = async () => {
    const [users, ms] = await Promise.all([api.rpc("admin_list_users").catch(() => []), paintMembers()]);
    const have = new Set(ms.map((m) => m.id));
    const cand = (users || []).filter((u) => u.approved);
    const body = document.createElement("div");
    body.innerHTML = cand.length ? `<p class="hint" style="margin-top:0">حددي الموجهات اللاتي ينتمين لهذه المجموعة. يرين ملفاتها وجداولها فقط، ولا يرين سجلات بعضهن الخاصة.</p>
        <div class="checks" style="grid-template-columns:1fr">${cand.map((u) => `<label><input type="checkbox" value="${u.id}" ${have.has(u.id) ? "checked" : ""}>${esc(u.full_name || u.username)} <span class="hint" dir="ltr">${esc(u.username)}</span></label>`).join("")}</div>`
      : `<p>لا توجد حسابات مفعّلة بعد. فعّلي الحسابات من «الحسابات والصلاحيات».</p>`;
    const sel = await modal({ title: `أعضاء «${g.name}»`, body, wide: true, actions: [{ label: "إلغاء", value: null }, { label: "حفظ الأعضاء", kind: "primary", value: (b) => $$("input[type=checkbox]", b).map((c) => [c.value, c.checked]) }] });
    if (!sel) return;
    try {
      for (const [uid, on] of sel) { if (on && !have.has(uid)) await api.addMember(gid, uid); if (!on && have.has(uid)) await api.removeMember(gid, uid); }
      toast("حُفظ الأعضاء"); paintMembers();
    } catch (e) { toast(e.message, "error"); }
  };
  $("#mem", main).onclick = manage;
  if (new URLSearchParams(location.hash.split("?")[1] || "").get("members")) { history.replaceState(null, "", `#/groups/${gid}`); manage(); }
}

/* ---------------- الجدول المشترك: يعبّئه ويعدّله كل الأعضاء ---------------- */
async function sheetPage(main, id) {
  const rec = await api.get(id);
  if (!rec || rec.kind !== "group_sheet" || rec.deleted_at) { main.innerHTML = `<div class="container"><div class="empty"><h2>الجدول غير موجود أو لستِ عضوة في مجموعته</h2><p><a href="#/groups">المجموعات</a></p></div></div>`; return; }
  const admin = isAdmin();
  const ed = recordEditor(rec, { merge: true, onMerged: (r, stats) => { paint(); if (stats.conflicts) toast("عدّلت زميلة الخانة نفسها في الوقت نفسه؛ حُفظت قيمتك.", "error"); } });
  window.__currentEditor = ed;
  main.innerHTML = `<div class="container">
    <div class="recbar no-print"><a class="btn icon-btn" href="#/groups/${rec.group_id}" aria-label="رجوع إلى المجموعة" title="رجوع إلى المجموعة">→</a><span class="grow"></span>
      <button class="btn" id="csv">تنزيل Excel</button>${admin ? `<button class="btn" id="cols">الأعمدة</button><button class="btn danger" id="dels">حذف الجدول</button>` : ""}</div>
    <div class="page-head"><div><h1 id="sh-t"></h1><div class="sub" id="sh-sub"></div></div></div>
    <div class="sheet-wrap"><table class="data sheet-t" id="sheet"></table></div>
    <div class="toolbar" style="margin-top:10px"><button class="btn primary" id="addrow">+ صف جديد</button></div>
  </div>`;
  $(".recbar", main).appendChild(savePill());
  const cols = () => ed.rec.data.columns || [];
  const rows = () => ed.rec.data.rows || [];
  const subLine = async () => {
    let who = [];
    try { who = (await api.rpc("shared_actor_names", { p_record: id })) || []; } catch (_) {}
    $("#sh-sub", main).textContent = [`${rows().length} صف`, who.length ? `عدّل فيه: ${who.map((w) => w.full_name).filter(Boolean).join("، ")}` : "", "تُحفظ التعديلات تلقائياً وتظهر لكل الأعضاء"].filter(Boolean).join(" · ");
  };
  function paint() {
    $("#sh-t", main).textContent = ed.rec.title;
    const focus = document.activeElement?.dataset?.cell;
    const pos = document.activeElement?.selectionStart;
    $("#sheet", main).innerHTML = `<thead><tr><th class="c-n">م</th>${cols().map((c) => `<th>${esc(c.label)}</th>`).join("")}<th class="c-x"></th></tr></thead>
      <tbody>${rows().length ? rows().map((r, i) => `<tr data-r="${r.id}"><td class="c-n">${i + 1}</td>${cols().map((c) => `<td><textarea rows="1" data-cell="${r.id}|${c.id}" aria-label="${esc(c.label)} — صف ${i + 1}">${esc(r.cells?.[c.id] ?? "")}</textarea></td>`).join("")}
        <td class="c-x"><button class="btn small ghost" data-del="${r.id}" title="حذف الصف" aria-label="حذف الصف ${i + 1}" style="color:var(--bad)">✕</button></td></tr>`).join("")
        : `<tr><td colspan="${cols().length + 2}" class="hint" style="text-align:center;padding:18px">لا توجد بيانات بعد — اضغطي «+ صف جديد».</td></tr>`}</tbody>`;
    $$("#sheet textarea", main).forEach((ta) => {
      const fit = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
      fit();
      ta.oninput = () => { fit(); const [r, c] = ta.dataset.cell.split("|"); ed.change((x) => { const row = x.data.rows.find((y) => y.id === r); if (row) row.cells = { ...(row.cells || {}), [c]: ta.value }; }); };
    });
    $$("[data-del]", main).forEach((b) => (b.onclick = async () => {
      if (!(await confirmBox("حذف الصف", "يُحذف هذا الصف لكل أعضاء المجموعة.", "حذف", true))) return;
      ed.change((x) => { x.data.rows = x.data.rows.filter((y) => y.id !== b.dataset.del); }, { immediate: true }); paint();
    }));
    if (focus) { const el = $(`[data-cell="${focus}"]`, main); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(pos, pos); } catch (_) {} } }
    subLine();
  }
  paint();
  $("#addrow", main).onclick = () => {
    const nid = rid();
    ed.change((x) => { x.data.rows = [...(x.data.rows || []), { id: nid, cells: {}, by: state.profile?.id || "" }]; }, { immediate: true });
    paint(); $(`[data-cell^="${nid}|"]`, main)?.focus();
  };
  // تنزيل الجدول كملف يفتحه Excel (CSV بترميز يدعم العربية)
  $("#csv", main).onclick = () => {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["م", ...cols().map((c) => c.label)].map(q).join(","), ...rows().map((r, i) => [i + 1, ...cols().map((c) => r.cells?.[c.id] ?? "")].map(q).join(","))];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `${ed.rec.title}.csv`; document.body.appendChild(a); a.click(); a.remove();
  };
  if (admin) {
    $("#cols", main).onclick = async () => {
      const body = document.createElement("div");
      body.innerHTML = `<div class="form" style="grid-template-columns:1fr"><div class="f"><label for="st">عنوان الجدول</label><input id="st" value="${esc(ed.rec.title)}"></div></div>
        <p class="hint">غيّري اسم أي عمود، أو أضيفي عموداً جديداً في آخر القائمة. حذف العمود يحذف بياناته من الجدول.</p>
        <div id="cl" class="col-list">${cols().map((c) => `<div class="row" data-c="${c.id}"><input value="${esc(c.label)}" aria-label="اسم العمود"><button type="button" class="btn small ghost" data-x style="color:var(--bad)">حذف</button></div>`).join("")}</div>
        <button type="button" class="btn small" id="addc" style="margin-top:8px">+ عمود</button>`;
      const addRow = (c = { id: rid(), label: "" }) => { const d = document.createElement("div"); d.className = "row"; d.dataset.c = c.id; d.innerHTML = `<input value="${esc(c.label)}" aria-label="اسم العمود"><button type="button" class="btn small ghost" data-x style="color:var(--bad)">حذف</button>`; d.querySelector("[data-x]").onclick = () => d.remove(); $("#cl", body).appendChild(d); d.querySelector("input").focus(); };
      $$("[data-x]", body).forEach((b) => (b.onclick = () => b.closest(".row").remove()));
      $("#addc", body).onclick = () => addRow();
      const v = await modal({ title: "الأعمدة", body, wide: true, actions: [{ label: "إلغاء", value: null }, { label: "حفظ", kind: "primary", value: (b) => ({ title: $("#st", b).value.trim(), cols: $$("#cl .row", b).map((r) => ({ id: r.dataset.c, label: r.querySelector("input").value.trim() })).filter((c) => c.label) }) }] });
      if (!v) return;
      if (!v.title || !v.cols.length) return toast("اكتبي العنوان وعموداً واحداً على الأقل", "error");
      ed.change((x) => { x.title = v.title; x.data.columns = v.cols; }, { immediate: true }); await ed.save(); paint();
    };
    $("#dels", main).onclick = async () => {
      if (!(await confirmBox("حذف الجدول", `يُنقل «${ed.rec.title}» إلى سلة المحذوفات ويختفي عن الأعضاء. تستطيعين استعادته من السلة.`, "حذف", true))) return;
      ed.change((x) => { x.deleted_at = new Date().toISOString(); }, { immediate: true });
      try { await ed.save(); go(`#/groups/${rec.group_id}`); } catch (e) { toast(e.message, "error"); }
    };
  }
  // جلب تعديلات الزميلات كل 15 ثانية أثناء فتح الجدول
  const timer = setInterval(async () => {
    if (window.__currentEditor !== ed) return clearInterval(timer);
    if (document.hidden) return;
    try { await ed.pull(); } catch (_) {}
  }, 15000);
}
