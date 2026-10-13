// تثبيت الموقع على الشاشة الرئيسية للجوال ليفتح كتطبيق، والدخول محفوظ فيه
let deferred = null;
export const standalone = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (_) { return false; } };
const framed = () => { try { return window.self !== window.top; } catch (_) { return true; } };
export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function initPWA() {
  try {
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; document.dispatchEvent(new Event("sijil:installable")); });
    if ("serviceWorker" in navigator && isSecureContext && !framed()) navigator.serviceWorker.register("sw.js").catch(() => {});
  } catch (_) {}
}

// بطاقة في الصفحة الرئيسية: تظهر على الجوال فقط ما لم يكن الموقع مثبّتاً
export function installCard() {
  let hidden = false; try { hidden = localStorage.getItem("sijil.installHidden") === "1"; } catch (_) {}
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || isIOS();
  // داخل معاينة (إطار) لا يمكن التثبيت، فلا تظهر البطاقة
  if (standalone() || hidden || !mobile || framed()) return null;
  const el = document.createElement("section"); el.className = "panel install-card";
  const steps = isIOS()
    ? `افتحي الموقع في <b>Safari</b> ← زر المشاركة <span aria-hidden="true">⎙</span> ← <b>إضافة إلى الشاشة الرئيسية</b>.`
    : `من قائمة المتصفح <span aria-hidden="true">⋮</span> اختاري <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>.`;
  el.innerHTML = `<div class="grow"><h2 style="margin:0 0 4px">ثبّتي الموقع على شاشة الجوال</h2><p class="hint" style="margin:0">يفتح كتطبيق بضغطة واحدة ويبقى الدخول محفوظاً. ${steps}</p></div>
    <button class="btn primary" id="inst" ${deferred ? "" : "hidden"}>تثبيت الآن</button><button class="btn ghost" id="inst-x">إخفاء</button>`;
  const btn = el.querySelector("#inst");
  document.addEventListener("sijil:installable", () => (btn.hidden = false));
  btn.onclick = async () => { if (!deferred) return; deferred.prompt(); const r = await deferred.userChoice.catch(() => null); deferred = null; if (r?.outcome === "accepted") el.remove(); };
  el.querySelector("#inst-x").onclick = () => { try { localStorage.setItem("sijil.installHidden", "1"); } catch (_) {} el.remove(); };
  return el;
}
