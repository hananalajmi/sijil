// الواجهة الافتتاحية المتحركة: الشعار وعنوان المنصة يبرزان بالتكبير من الداخل، والأيقونات تخرج من الكتاب وتطفو،
// والكتاب متحرك (ضوء وصفحة تُقلب وشرارات). بعد اكتمال التحميل: زر «تسجيل الدخول» أول مرة فقط،
// وبعدها يظهر اسم الموجّه ومسمّاه الوظيفي وزر «دخول» مباشر.
import { esc } from "./ui.js";

const A = "assets/ui/";
// المواضع بالنسبة المئوية من صورة الخلفية (1536×1024)
const TILES = [
  ["data", "البيانات الرئيسية", 22.4, 30.6], ["curr", "المناهج", 33.5, 40.1], ["plans", "الخطط", 45.8, 45.1], ["visits", "الزيارات", 58.7, 47.9],
  ["reports", "التقارير", 69.9, 41.4], ["ach", "الإنجازات", 80.7, 45.0], ["stats", "الإحصائيات", 90.8, 48.1],
];
const SPINES = [["البيانات الرئيسية", 13.4, 59.7], ["الزيارات", 12.4, 65.5], ["الخطط والإنجازات", 12.4, 71.6], ["الإحصائيات والتقارير", 12.4, 77.0]];
const BOOK = [51.4, 62.5]; // مركز الكتاب
const WHO = "sijil.who";

export const rememberWho = (w) => { try { localStorage.setItem(WHO, JSON.stringify(w)); } catch (_) {} };
export const getWho = () => { try { return JSON.parse(localStorage.getItem(WHO) || "null"); } catch (_) { return null; } };
export const forgetWho = () => { try { localStorage.removeItem(WHO); } catch (_) {} };
export const reducedMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; } };

const preload = (src) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = () => r(); i.src = src; });

export function showIntro({ demo = false } = {}) {
  document.getElementById("intro-host")?.remove();
  const root = document.createElement("div"); root.id = "intro-host"; document.body.appendChild(root);
  const sparks = Array.from({ length: 22 }, (_, i) => {
    const t = TILES[i % TILES.length];
    return `<i style="--sx:${BOOK[0] + (Math.random() * 16 - 8)}%;--sy:${BOOK[1] + (Math.random() * 6 - 3)}%;--tx:${t[2] - BOOK[0]}cqw;--ty:${(t[3] - BOOK[1]) * 0.6667}cqw;--d:${(2.6 + Math.random() * 2.4).toFixed(2)}s;--dl:${(1.6 + Math.random() * 4).toFixed(2)}s"></i>`;
  }).join("");
  // مسارات ذهبية من الكتاب إلى كل أيقونة (منحنيات)
  const paths = TILES.map(([, , x, y], i) => {
    const sx = BOOK[0] * 15.36, sy = BOOK[1] * 10.24, ex = x * 15.36, ey = (y + 7) * 10.24;
    const cx = (sx + ex) / 2 + (ex < sx ? -60 : 60), cy = Math.min(sy, ey) - 90;
    return `<path d="M${sx.toFixed(0)} ${sy.toFixed(0)} Q ${cx.toFixed(0)} ${cy.toFixed(0)} ${ex.toFixed(0)} ${ey.toFixed(0)}" style="--i:${i}"/>`;
  }).join("");
  root.innerHTML = `<div class="intro ${reducedMotion() ? "still" : ""}" id="intro" role="dialog" aria-label="منصة سجلات الموجه الفني">
    <div class="intro-backdrop" style="background-image:url(${A}splash-bg.jpg)"></div>
    <div class="intro-stage">
      <img class="intro-bg" src="${A}splash-bg.jpg" alt="" draggable="false">
      <div class="intro-book" aria-hidden="true"><span class="ib-glow"></span><span class="ib-sweep"></span><span class="ib-page"></span></div>
      <svg class="intro-streams" viewBox="0 0 1536 1024" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="gstream" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff3c4" stop-opacity=".95"/><stop offset="1" stop-color="#d4a94f" stop-opacity=".2"/></linearGradient></defs>${paths}</svg>
      <div class="intro-sparks" aria-hidden="true">${sparks}</div>
      ${SPINES.map(([t, x, y], i) => `<span class="intro-spine" style="left:${x - 8.5}%;top:${y}%;--i:${i}">${esc(t)}</span>`).join("")}
      <div class="intro-head">
        <img class="ih-emblem" src="assets/logos/ministry-emblem.png" alt="شعار وزارة التربية">
        <div class="ih-min">وزارة التربية</div><div class="ih-state">دولة الكويت</div>
        <div class="ih-line"></div>
        <h1 class="ih-title">منصة سجلات الموجه الفني</h1>
        <div class="ih-tag">توثيق .. متابعة .. تطوير</div>
      </div>
      ${TILES.map(([k, l, x, y], i) => `<div class="intro-tile" style="--x:${x}%;--y:${y}%;--fx:${BOOK[0] - x}cqw;--fy:${(BOOK[1] - y) * 0.6667}cqw;--i:${i}">
        <div class="it-in"><img src="${A}icon-${k}.png" alt=""><span>${esc(l)}</span></div></div>`).join("")}
    </div>
    <div class="intro-ui" id="intro-ui" aria-live="polite">
      <div class="iu-load" id="iu-load"><div class="iu-bar"><span id="iu-fill"></span></div><div class="iu-txt">جاري تهيئة المنصة <span class="iu-dots">...</span></div></div>
    </div>
  </div>`;
  const intro = root.querySelector("#intro"), ui = root.querySelector("#intro-ui"), fill = root.querySelector("#iu-fill");
  let shown = 0;
  const minTime = new Promise((r) => setTimeout(r, reducedMotion() ? 400 : 2600));
  const assets = Promise.all([preload(A + "splash-bg.jpg"), ...TILES.map(([k]) => preload(A + `icon-${k}.png`)), document.fonts?.ready]).catch(() => {});

  const ctl = {
    el: intro,
    progress(p) { shown = Math.max(shown, Math.min(1, p)); fill.style.width = (shown * 100).toFixed(0) + "%"; },
    async ready() { await Promise.all([minTime, assets]); ctl.progress(1); await new Promise((r) => setTimeout(r, 350)); },
    // أول مرة: زر التسجيل
    showFirst(onClick) {
      ui.innerHTML = `<div class="iu-auth iu-in"><button class="iu-btn" id="iu-signin" type="button">تسجيل الدخول</button>
        ${demo ? `<div class="iu-note">وضع تجريبي — البيانات في هذا المتصفح فقط</div>` : ""}</div>`;
      ui.querySelector("#iu-signin").onclick = onClick; ui.querySelector("#iu-signin").focus({ preventScroll: true });
    },
    // المرات التالية: الاسم والمسمى الوظيفي ثم زر الدخول
    showRemembered(who, onEnter, onSwitch) {
      ui.innerHTML = `<div class="iu-auth iu-in iu-who">
        <div class="iu-id"><div><div class="iu-name">${esc(who.n || who.u || "")}</div><div class="iu-title">${esc(who.t || "")}</div></div></div>
        <button class="iu-btn" id="iu-enter" type="button">دخول</button>
        <button class="iu-link" id="iu-switch" type="button">الدخول بحساب آخر</button></div>`;
      ui.querySelector("#iu-enter").onclick = onEnter; ui.querySelector("#iu-switch").onclick = onSwitch;
      ui.querySelector("#iu-enter").focus({ preventScroll: true });
    },
    // بطاقة زجاجية فوق المشهد للدخول أو إنشاء حساب
    card(html) {
      let c = intro.querySelector(".iu-card-wrap");
      if (!c) { c = document.createElement("div"); c.className = "iu-card-wrap"; intro.appendChild(c); }
      c.innerHTML = `<div class="iu-card" role="dialog" aria-modal="true">${html}</div>`;
      c.addEventListener("click", (e) => { if (e.target === c && c.dataset.dismiss !== "0") c.remove(); });
      return c.querySelector(".iu-card");
    },
    closeCard() { intro.querySelector(".iu-card-wrap")?.remove(); },
    // الانتقال للمنصة: تكبير نحو الكتاب ثم اختفاء
    async leave() {
      ctl.closeCard();
      intro.classList.add("leaving");
      await new Promise((r) => setTimeout(r, reducedMotion() ? 0 : 700));
      root.remove();
    },
    remove() { root.remove(); },
  };
  return ctl;
}
