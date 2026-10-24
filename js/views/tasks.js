// قائمة المهام: تُكتب بالكيبورد أو بالقلم (خط اليد)، وبجانب كل مهمة مربع: عند الإنجاز تظهر ✓ ويُشطب عليها.
// خاصة بالموجّه وتُحفظ في بياناته الرئيسية (tasks)؛ لا تظهر في أي تقرير.
import { G, setGuideData } from "../store.js";
import { esc, $, $$, modal, toast } from "../ui.js";
import { icon } from "../icons.js";

const list = () => (Array.isArray(G().tasks) ? G().tasks : []);
const save = (next) => setGuideData("tasks", next);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// صورة خط اليد: تُصغَّر (عرض 700 بكسل كحد أقصى) وتُحفظ PNG شفافاً
const fileToInk = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => { const im = new Image(); im.onerror = rej;
  im.onload = () => { const k = Math.min(1, 700 / im.width), cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL("image/png")); }; im.src = fr.result; }; fr.readAsDataURL(file); });

export default async function (main) {
  main.innerHTML = `<div class="container tasks-page">
    <div class="page-head"><div><a class="hub-back" href="#/hub/plans">${icon("back")} الخطط</a><h1>قائمة المهام</h1>
      <div class="sub">اكتبي المهمة بالكيبورد أو بالقلم، واضغطي المربع عند إنجازها. القائمة خاصة بك.</div></div></div>
    <section class="panel"><form id="tk-form" class="row" style="gap:8px;flex-wrap:wrap">
      <input id="tk-in" type="text" placeholder="اكتبي مهمة جديدة…" aria-label="مهمة جديدة" style="flex:1;min-width:200px" autocomplete="off">
      <button class="btn primary" type="submit">${icon("plus")} إضافة</button>
      <button class="btn" type="button" id="tk-pen">✍️ بالقلم</button></form></section>
    <section class="panel"><div class="row" style="justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <h2 style="margin:0" id="tk-count"></h2><button class="btn small ghost" type="button" id="tk-clear" hidden>حذف المنجزة</button></div>
      <ul class="tasks" id="tk-list"></ul></section></div>`;
  const ul = $("#tk-list", main);
  const paint = () => {
    const L = list(), open = L.filter((t) => !t.done), done = L.filter((t) => t.done);
    $("#tk-count", main).textContent = L.length ? `${open.length} متبقية من ${L.length}` : "لا توجد مهام بعد";
    $("#tk-clear", main).hidden = !done.length;
    ul.innerHTML = [...open, ...done].map((t) => `<li class="task ${t.done ? "done" : ""}" data-id="${esc(t.id)}">
        <label class="tk-box"><input type="checkbox" ${t.done ? "checked" : ""} aria-label="${t.done ? "إلغاء الإنجاز" : "تمت"}"><span aria-hidden="true"></span></label>
        <div class="tk-body" ${t.ink ? "" : 'role="button" tabindex="0" title="اضغطي للتعديل"'}>${t.ink ? `<span class="tk-ink"><img src="${t.ink}" alt="مهمة مكتوبة بخط اليد"></span>` : `<span class="tk-text">${esc(t.text)}</span>`}</div>
        <button class="btn small ghost tk-del" type="button" aria-label="حذف المهمة">${icon("trash")}</button></li>`).join("") || `<li class="hint" style="list-style:none">أضيفي أول مهمة من الأعلى.</li>`;
    $$(".task", ul).forEach((li) => {
      const id = li.dataset.id;
      li.querySelector("input").onchange = async (e) => { await save(list().map((t) => (t.id === id ? { ...t, done: e.target.checked, doneAt: e.target.checked ? new Date().toISOString() : null } : t))); paint(); };
      li.querySelector(".tk-del").onclick = async () => { await save(list().filter((t) => t.id !== id)); paint(); toast("حُذفت المهمة"); };
      const tx = li.querySelector(".tk-body[role=button]");
      if (tx) { const edit = async () => { const t = list().find((x) => x.id === id); if (!t) return;
          const v = await modal({ title: "تعديل المهمة", body: `<div class="f"><input id="tk-e" type="text" value="${esc(t.text)}" aria-label="نص المهمة"></div>`,
            actions: [{ label: "إلغاء", value: null }, { label: "حفظ", kind: "primary", value: (b) => b.querySelector("#tk-e").value.trim() }] });
          if (v) { await save(list().map((x) => (x.id === id ? { ...x, text: v } : x))); paint(); } };
        tx.onclick = edit; tx.onkeydown = (e) => { if (e.key === "Enter") edit(); }; }
    });
  };
  $("#tk-form", main).onsubmit = async (e) => { e.preventDefault(); const inp = $("#tk-in", main), v = inp.value.trim(); if (!v) return inp.focus();
    inp.value = ""; await save([...list(), { id: uid(), text: v, done: false, at: new Date().toISOString() }]); paint(); inp.focus(); };
  $("#tk-pen", main).onclick = async () => {
    const { drawSignature } = await import("../sigpad.js");
    const f = await drawSignature({ modal, toast, title: "مهمة جديدة بالقلم", hint: "اكتبي المهمة داخل المربع بالقلم أو بإصبعك.", saveLabel: "إضافة المهمة", line: false });
    if (!f) return;
    try { const ink = await fileToInk(f); await save([...list(), { id: uid(), ink, done: false, at: new Date().toISOString() }]); paint(); toast("أُضيفت المهمة"); }
    catch (err) { toast("تعذّر حفظ المهمة: " + (err.message || ""), "error"); }
  };
  $("#tk-clear", main).onclick = async () => { await save(list().filter((t) => !t.done)); paint(); toast("حُذفت المهام المنجزة"); };
  paint();
}
