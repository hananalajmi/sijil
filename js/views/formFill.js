// صفحة رابط التعبئة للمكلَّفين (بدون تسجيل دخول):
// تعرض اسم النموذج والمهمة والمدة فقط، وتستقبل الاسم والرقم المدني. لا تعرض أي بيانات لغير المرسِل.
import { api } from "../api.js";
import { esc, fmtDate } from "../ui.js";
import { normCivil, civilState, paintCivil } from "./forms.js";
import { FORMS } from "../templates.js";

export default async function (root, token) {
  document.title = "تعبئة نموذج — منصة سجلات الموجه الفني";
  root.innerHTML = `<main class="fill-page"><div class="fill-card"><p class="hint">جارٍ التحميل…</p></div></main>`;
  const card = root.querySelector(".fill-card");
  let f = null;
  try { f = await api.publicForm(token); } catch (e) { card.innerHTML = `<h1>تعذر فتح النموذج</h1><p>${esc(e.message)}</p>`; return; }
  if (!f) { card.innerHTML = `<div class="fill-head"><img src="assets/logos/ministry-emblem.png" alt="شعار وزارة التربية"><div>وزارة التربية</div></div><h1>الرابط غير صالح أو أُغلق</h1><p class="hint">تواصلي مع الموجهة التي أرسلت الرابط.</p>`; return; }
  const period = [f.from && fmtDate(f.from), f.to && f.to !== f.from && fmtDate(f.to)].filter(Boolean).join(" حتى ");
  card.innerHTML = `<div class="fill-head"><img src="assets/logos/ministry-emblem.png" alt="شعار وزارة التربية"><div>وزارة التربية</div></div>
    <h1>${esc(FORMS[f.type]?.label || "تكليف بمهمة خارج مقر العمل")}</h1>
    <dl class="fill-info">${f.task ? `<dt>المهمة</dt><dd>${esc(f.task)}</dd>` : ""}${period ? `<dt>المدة</dt><dd>${esc(period)}</dd>` : ""}${f.guide ? `<dt>من</dt><dd>${esc(f.guide)}</dd>` : ""}</dl>
    <form id="ff" novalidate>
      <div class="f"><label for="nm" class="req">الاسم الثلاثي</label><input id="nm" autocomplete="name" required></div>
      <div class="f"><label for="cid" class="req">الرقم المدني</label>
        <div class="cid-wrap"><input id="cid" class="cid" dir="ltr" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="12 رقماً"><span class="cid-n"></span></div>
        <div class="hint">12 رقماً — تتلوّن الخانة بالأحمر إذا كان الرقم ناقصاً.</div></div>
      <p class="fill-err" id="err" role="alert"></p>
      <button class="btn primary" id="go" type="submit">إرسال</button>
      <p class="hint">لا يظهر اسمك ورقمك المدني إلا للموجهة صاحبة النموذج.</p>
    </form>`;
  const cid = card.querySelector("#cid"), nm = card.querySelector("#nm"), err = card.querySelector("#err");
  cid.oninput = () => paintCivil(cid);
  card.querySelector("#ff").onsubmit = async (e) => {
    e.preventDefault(); err.textContent = "";
    const name = nm.value.trim().replace(/\s+/g, " "), c = normCivil(cid.value);
    if (name.split(" ").length < 2) { err.textContent = "اكتبي الاسم الثلاثي"; nm.focus(); return; }
    if (civilState(c) !== "ok") { paintCivil(cid); err.textContent = "الرقم المدني يجب أن يكون 12 رقماً"; cid.focus(); return; }
    const b = card.querySelector("#go"); b.disabled = true; b.textContent = "جارٍ الإرسال…";
    try {
      await api.publicSubmit(token, name, c);
      card.innerHTML = `<div class="fill-head"><img src="assets/logos/ministry-emblem.png" alt=""><div>وزارة التربية</div></div>
        <div class="fill-done"><div class="ok-mark" aria-hidden="true">✓</div><h1>تم الإرسال</h1><p>شكراً ${esc(name.split(" ")[0])}، وصل اسمك ورقمك المدني.</p><p class="hint">إذا أخطأتِ في الاسم، أرسليه مرة ثانية بنفس الرقم المدني ويُصحَّح.</p>
        <button class="btn" id="again">إرسال اسم آخر</button></div>`;
      card.querySelector("#again").onclick = () => location.reload();
    } catch (e2) { err.textContent = e2.message || "تعذر الإرسال"; b.disabled = false; b.textContent = "إرسال"; }
  };
}
