// نقطة البداية: الدخول، الهيكل العام، والتنقل بين الأقسام
import { api, DEMO } from "./api.js";
import { state, loadBase, setYear, pendingDrafts, opts, addMyOption, logoSrc, subjectAl } from "./store.js";
import { esc, $, $$, toast, modal, academicYearOf } from "./ui.js";
import { applyUI, applyCachedUI } from "./theme.js";
import { initPWA } from "./pwa.js";
import { showIntro, rememberWho, getWho, forgetWho } from "./intro.js";
import { icon } from "./icons.js";
import { startGenderUI } from "./gender.js";
import { SECTIONS, MORE, sectionOf, isExternal, itemsOf } from "./nav.js";
applyCachedUI();
initPWA();

const ROUTES = {
  "": () => import("./views/home.js"),
  guide: () => import("./views/guide.js"), settings: () => import("./views/guide.js"),
  dates: () => import("./views/dates.js"),
  schools: () => import("./views/schools.js"),
  "teacher-visits": () => import("./views/teacherVisit.js"), "school-visits": () => import("./views/schoolVisit.js"),
  exams: () => import("./views/exams.js"),
  weekly: () => import("./views/weeklyReport.js"), "monthly-ach": () => import("./views/sharedAch.js"), "monthly-ach-old": () => import("./views/monthlyAch.js"), compile: () => import("./views/monthlyAch.js"), monthly: () => import("./views/plans.js"),
  "stats-visits": () => import("./views/stats.js"), "stats-theory": () => import("./views/stats.js"), "stats-practical": () => import("./views/stats.js"),
  events: () => import("./views/events.js"), approved: () => import("./views/archive.js"),
  forms: () => import("./views/forms.js"), sign: () => import("./views/sign.js"),
  groups: () => import("./views/groups.js"), "group-sheet": () => import("./views/groups.js"),
  bulletins: () => import("./views/files.js"), shared: () => import("./views/files.js"),
  search: () => import("./views/archive.js"), trash: () => import("./views/archive.js"), backup: () => import("./views/backup.js"),
  admin: () => import("./views/admin.js"), print: () => import("./views/print.js"), hub: () => import("./views/hub.js"), tasks: () => import("./views/tasks.js"), meeting: () => import("./views/meeting.js"), wplan: () => import("./views/wplan.js"), "wplan-collect": () => import("./views/wplanCollect.js"),
};

const root = document.getElementById("root");

function yearOptions() {
  const cur = Number(academicYearOf().split("-")[0]);
  const ys = new Set([state.year, ...opts("years")]); for (let y = cur + 1; y >= cur - 4; y--) ys.add(`${y}-${y + 1}`);
  return [...ys].sort().reverse().map((y) => `<option ${y === state.year ? "selected" : ""}>${y}</option>`).join("") + `<option value="__custom">+ إضافة عام دراسي…</option>`;
}

function navHtml(p) {
  const link = (r, l, i, sub = false) => isExternal(r)
    ? `<a class="nav ${sub ? "sub" : ""}" href="${esc(r)}" target="_blank" rel="noopener noreferrer">${sub ? '<span class="dot" aria-hidden="true"></span>' : icon(i)}<span class="t">${esc(l)} <span aria-hidden="true">↗</span></span></a>`
    : `<a class="nav ${sub ? "sub" : ""}" href="#/${r}" data-r="${r}">${sub ? '<span class="dot" aria-hidden="true"></span>' : icon(i)}<span class="t">${esc(l)}</span></a>`;
  const group = (s) => s.route ? link(s.route, s.label, s.icon)
    : `<div class="nav-grp" data-g="${s.id}"><button type="button" class="nav nav-h" aria-expanded="false">${icon(s.icon)}<span class="t">${esc(s.label)}</span>${icon("chevron", "chev")}</button>
       <div class="nav-items">${itemsOf(s).map(([r, l]) => link(r, l, "", true)).join("")}</div></div>`;
  const who = state.guide?.data || {};
  return `<div class="side-user"><div class="su-av" aria-hidden="true">${icon("user")}</div><div class="su-t"><b>${esc(who.full_name || p.full_name || p.username)}</b><small>${esc(who.job_title || "موجه فني")}${who.subject ? " — " + esc(who.subject) : ""}</small></div></div>
    <div class="side-nav">${link("", "الرئيسية", "home")}${SECTIONS.map(group).join("")}<div class="nav-sep"></div>${group(MORE)}
      ${link("settings", "الإعدادات", "settings")}
      ${p.role === "admin" ? link("admin", "الحسابات والصلاحيات", "shield") : ""}
      <a class="nav" href="#" id="logout">${icon("logout")}<span class="t">تسجيل الخروج</span></a></div>
    <div class="side-deco" aria-hidden="true"></div>`;
}
function shell() {
  const p = state.profile;
  root.innerHTML = `
  <div class="topbar no-print"><button class="btn icon-btn" id="menu" aria-label="القائمة">${icon("menu")}</button><b>منصة سجلات الموجه الفني</b><a class="btn icon-btn" href="#/" aria-label="الرئيسية">${icon("home")}</a></div>
  <div class="app">
    <nav class="side no-print" id="side" aria-label="الأقسام">${navHtml(p)}</nav>
    <main id="main"></main>
  </div>`;
  $("#menu").onclick = () => $("#side").classList.toggle("open");
  $("#logout").onclick = async (e) => { e.preventDefault(); await api.signOut(); location.hash = ""; start(); };
  $$(".nav-h").forEach((b) => (b.onclick = () => { const g = b.closest(".nav-grp"); const open = !g.classList.contains("open"); g.classList.toggle("open", open); b.setAttribute("aria-expanded", open); }));
  $$(".nav[data-r]").forEach((a) => a.addEventListener("click", () => $("#side").classList.remove("open")));
}
// يميّز القسم الحالي ويفتح مجموعته
function markNav(name) {
  const su = document.querySelector(".su-t"), g = state.guide?.data || {}, p = state.profile || {};
  if (su) su.innerHTML = `<b>${esc(g.full_name || p.full_name || p.username || "")}</b><small>${esc(g.job_title || "موجه فني")}${g.subject ? " — " + esc(subjectAl(g.subject)) : ""}</small>`;
  // للصفحات المقسمة بـ ?sec= (التكاليف/المعايير/الشهادات): يُطابَق القسم كذلك
  const sp = new URLSearchParams((location.hash.split("?")[1] || "")).get("sec"), full = sp ? `${name}?sec=${sp}` : name;
  const isCur = (r) => r === full || (r === name && !$$(".nav[data-r]").some((x) => x.dataset.r === full));
  $$(".nav[data-r]").forEach((a) => (isCur(a.dataset.r) ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  const sec = name === "hub" ? null : sectionOf(name);
  $$(".nav-grp").forEach((g) => { const on = !!sec && g.dataset.g === sec.id; g.classList.toggle("current", on); g.classList.toggle("open", on); g.querySelector(".nav-h").setAttribute("aria-expanded", String(on)); });
  if (name === "hub") { const id = location.hash.split("/")[2]?.split("?")[0]; $$(".nav-grp").forEach((g) => g.classList.toggle("current", g.dataset.g === id)); }
}

let navToken = 0;
async function route() {
  const main = $("#main"); if (!main) return;
  const [path, qs] = location.hash.replace(/^#\/?/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  const name = parts[0] || "";
  const params = Object.fromEntries(new URLSearchParams(qs || ""));
  // صفحة المناهج القديمة صارت روابط مكتبة الوزارة
  if (name === "materials") { location.replace("#/hub/curr"); return; }
  markNav(name);
  const loader = ROUTES[name];
  const token = ++navToken;
  if (window.__currentEditor?.dirty) { try { await window.__currentEditor.save(); } catch (_) {} }
  window.__currentEditor = null;
  main.innerHTML = `<div class="container"><p class="hint">جارٍ التحميل…</p></div>`;
  if (!loader) { main.innerHTML = `<div class="container"><div class="empty"><h2>الصفحة غير موجودة</h2><p><a href="#/">العودة للرئيسية</a></p></div></div>`; return; }
  try {
    const mod = await loader();
    if (token !== navToken) return;
    main.innerHTML = "";
    if (name !== "print") {
      const sb = document.createElement("div"); sb.className = "container statusbar no-print";
      sb.innerHTML = `${DEMO ? `<div class="demo-banner" style="flex-basis:100%">وضع تجريبي: البيانات محفوظة في هذا المتصفح فقط وليست في قاعدة البيانات. لا تستخدميه لبيانات حقيقية.</div>` : ""}
        <label class="year-pick">العام الدراسي <select id="year">${yearOptions()}</select></label>`;
      main.appendChild(sb);
      $("#year", sb).onchange = async (e) => {
        if (e.target.value === "__custom") {
          const v = await modal({ title: "إضافة عام دراسي", body: `<div class="f"><label for="ny">العام (مثل 2030-2031)</label><input id="ny" type="text" inputmode="numeric" placeholder="2030-2031"></div>`,
            actions: [{ label: "إلغاء", value: null }, { label: "إضافة", kind: "primary", value: (b) => b.querySelector("#ny").value.trim().replace(/\s+/g, "").replace(/[\/–]/g, "-") }] });
          const m = v && v.match(/^(\d{4})-(\d{4})$/);
          if (!m || Number(m[2]) !== Number(m[1]) + 1) { if (v) toast("اكتبي العام بصيغة 2030-2031", "error"); e.target.innerHTML = yearOptions(); return; }
          await addMyOption("years", v); setYear(v); return route();
        }
        setYear(e.target.value); route();
      };
    }
    const view = document.createElement("div"); main.appendChild(view);
    await mod.default(view, { name, id: parts[1], sub: parts[2], params });
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="container"><div class="empty"><h2>تعذر فتح الصفحة</h2><p>${esc(e.message || e)}</p><p><button class="btn" onclick="location.reload()">إعادة المحاولة</button></p></div></div>`;
  }
}

/* ---------------- الدخول وإنشاء الحساب ---------------- */
// نموذج الدخول (يُستخدم في البطاقة الزجاجية للواجهة الافتتاحية، وفي الصفحة البسيطة)
function authForm(host, { msg = "", username = "", passwordOnly = false, onDone = () => start({ intro: false }) } = {}) {
  host.innerHTML = `<form class="auth-card" id="auth" novalidate>
      ${passwordOnly ? `<h2 class="ac-h">مرحباً ${esc(username)}</h2><p class="hint">انتهت جلستك على هذا الجهاز؛ اكتبي كلمة المرور مرة واحدة.</p>`
        : `<div class="tabs" role="group"><button type="button" data-t="in" aria-pressed="true">تسجيل الدخول</button><button type="button" data-t="up" aria-pressed="false">حساب جديد</button></div>`}
      ${DEMO && !passwordOnly ? `<div class="demo-banner">وضع تجريبي محلي — لم يُربط الموقع بقاعدة البيانات بعد.</div>` : ""}
      <div class="f up" hidden><label for="fn">الاسم الكامل</label><input id="fn" autocomplete="name"></div>
      <div class="f" ${passwordOnly ? "hidden" : ""}><label for="un">اسم المستخدم</label><input id="un" autocomplete="username" dir="ltr" placeholder="مثال: dalal.m" value="${esc(username)}"></div>
      <div class="f up" hidden><label for="em">البريد الإلكتروني (لاستعادة كلمة المرور)</label><input id="em" type="email" dir="ltr" autocomplete="email"></div>
      <div class="f"><label for="pw">كلمة المرور</label><input id="pw" type="password" autocomplete="current-password" dir="ltr"></div>
      <label class="stay in"><input type="checkbox" id="stay" checked> تذكّريني على هذا الجهاز (يفتح الموقع مباشرة دون كلمة مرور)</label>
      <div class="err" id="err">${esc(msg)}</div>
      <button class="btn primary" type="submit" id="go">دخول</button>
      <button class="btn ghost in" type="button" id="forgot">نسيت كلمة المرور</button>
      <p class="hint up" hidden>بعد إنشاء الحساب تدخلين مباشرة (أو بعد تفعيل المشرف إن كان التفعيل يدوياً). وبعدها يفتح الموقع مباشرة على هذا الجهاز دون تسجيل دخول.</p>
    </form>`;
  const q = (x) => host.querySelector(x), qa = (x) => [...host.querySelectorAll(x)];
  let mode = "in";
  qa(".tabs button").forEach((b) => (b.onclick = () => {
    mode = b.dataset.t; qa(".tabs button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    qa(".up").forEach((x) => (x.hidden = mode !== "up")); qa(".in").forEach((x) => (x.hidden = mode !== "in"));
    q("#go").textContent = mode === "up" ? "إنشاء الحساب" : "دخول"; q("#err").textContent = "";
  }));
  q("#forgot").onclick = async () => {
    const v = q("#un").value.trim();
    if (!v.includes("@")) { q("#err").textContent = "اكتبي بريدك الإلكتروني في خانة اسم المستخدم، ثم اضغطي «نسيت كلمة المرور»."; q("#un").closest(".f").hidden = false; return; }
    try { await api.resetPassword(v); q("#err").textContent = "إن كان البريد مسجلاً، فستصلك رسالة لاستعادة كلمة المرور."; } catch (e) { q("#err").textContent = e.message; }
  };
  // يعمل الدخول بالزر نفسه حتى لو منع إطار المعاينة إرسال النماذج
  q("#go").onclick = (e) => { e.preventDefault(); submit(); };
  q("#auth").onsubmit = (e) => { e.preventDefault(); submit(); };
  const submit = async () => {
    const un = q("#un").value.trim(), pw = q("#pw").value;
    const err = q("#err"); err.textContent = "";
    if (!un || !pw) { err.textContent = "اكتبي اسم المستخدم وكلمة المرور"; return; }
    q("#go").disabled = true;
    try {
      if (mode === "up") {
        const fn = q("#fn").value.trim(), em = q("#em").value.trim();
        if (!fn || !em) throw new Error("اكتبي الاسم الكامل والبريد الإلكتروني");
        if (!/^[A-Za-z0-9_.-]{3,32}$/.test(un)) throw new Error("اسم المستخدم بالأحرف الإنجليزية والأرقام فقط (3 إلى 32)، بدون مسافات");
        if (pw.length < 8) throw new Error("كلمة المرور 8 أحرف على الأقل");
        const r = await api.signUp({ username: un, full_name: fn, email: em, password: pw });
        if (!api.session) { err.textContent = r?.id || r?.user ? "أُنشئ الحساب. إن طُلب منك تأكيد البريد فافتحي الرسالة، ثم انتظري تفعيل المشرف." : "أُنشئ الحساب."; q("#go").disabled = false; return; }
      } else await api.signIn(un, pw, { stay: q("#stay").checked });
      await onDone();
    } catch (ex) { err.textContent = ex.message; q("#go").disabled = false; }
  };
  setTimeout(() => (passwordOnly ? q("#pw") : q("#un")).focus(), 50);
}
function authScreen(msg = "") {
  root.innerHTML = `<div class="auth">
    <div class="auth-art"><img class="aa-emblem" src="assets/logos/ministry-emblem.png" alt="شعار وزارة التربية">
      <h1>منصة سجلات الموجه الفني</h1><p>توثيق .. متابعة .. تطوير</p></div>
    <div class="auth-form" id="auth-host"></div></div>`;
  authForm($("#auth-host"), { msg });
}

function offlineScreen() {
  root.innerHTML = `<div class="auth"><div class="auth-art"><div class="stack" aria-hidden="true"><i></i><i></i><i></i></div><h1>سجلات الموجّه الفني</h1></div>
    <div class="auth-form"><div class="auth-card"><h2>لا يوجد اتصال بالإنترنت</h2><p>أنتِ ما زلتِ مسجّلة الدخول. سيفتح الموقع تلقائياً عند عودة الاتصال.</p>
    <button class="btn primary" id="again">إعادة المحاولة</button></div></div></div>`;
  $("#again").onclick = () => start({ intro: false });
  window.addEventListener("online", () => start({ intro: false }), { once: true });
}

function pendingScreen() {
  root.innerHTML = `<div class="auth"><div class="auth-art"><div class="stack" aria-hidden="true"><i></i><i></i><i></i></div><h1>سجلات الموجّه الفني</h1></div>
    <div class="auth-form"><div class="auth-card"><h2>الحساب بانتظار التفعيل</h2><p>أُنشئ حسابك بنجاح. سيتمكن من الدخول بعد أن يفعّله المشرف.</p>
    <button class="btn" id="again">تحقق مرة أخرى</button><button class="btn ghost" id="out">تسجيل الخروج</button></div></div></div>`;
  $("#again").onclick = () => start({ intro: false });
  $("#out").onclick = async () => { await api.signOut(); start(); };
}

// يحفظ اسم الموجّه ومسمّاه ليظهرا في الواجهة الافتتاحية في المرة القادمة
function saveWho() {
  const g = state.guide?.data || {}, p = state.profile || {};
  rememberWho({ u: p.username || "", n: g.full_name || p.full_name || p.username || "", t: [g.job_title || "موجه فني", subjectAl(g.subject)].filter(Boolean).join(" — ") });
}
// فتح المنصة بعد تحميل البيانات
function enterApp() {
  startGenderUI(); // صياغة المذكر للموجّهين
  if (state.guide?.data?.ui) applyUI(state.guide.data.ui);
  saveWho();
  shell();
  const drafts = pendingDrafts();
  if (drafts.length) toast(`يوجد ${drafts.length} تعديل لم يُحفظ في الخادم بعد. افتحي السجل المعني لإعادة الحفظ.`, "error");
  window.onhashchange = route;
  route();
}
// يحمّل الحساب والبيانات؛ يعيد "ok" أو سبب عدم الدخول
async function boot() {
  await api.ready();
  if (!api.session) return "signin";
  try { await loadBase(); }
  catch (e) {
    if (e.status === 401) { await api.signOut(); return "expired"; }
    if (e.code === "network") return "offline"; // لا تسجيل خروج عند انقطاع الإنترنت
    return "error:" + e.message;
  }
  if (!state.profile) return "error:تعذر قراءة بيانات الحساب";
  if (!state.profile.approved) return "pending";
  return "ok";
}
const wantIntro = () => !/[?&]intro=0\b/.test(location.search);

async function start({ intro = true } = {}) {
  if (!intro || !wantIntro()) {
    const st = await boot();
    if (st === "ok") return enterApp();
    if (st === "offline") return offlineScreen();
    if (st === "pending") return pendingScreen();
    return authScreen(st === "expired" ? "انتهت الجلسة، سجّلي الدخول مرة أخرى" : st.startsWith("error:") ? st.slice(6) : "");
  }
  // الواجهة الافتتاحية المتحركة
  root.innerHTML = "";
  const iv = showIntro({ demo: DEMO });
  iv.progress(0.12);
  const st = await boot().catch((e) => "error:" + (e.message || e));
  iv.progress(0.85);
  // شعار مستبدل من الإعدادات (إن وُجد) يحل محل الشعار الافتراضي
  if (st === "ok") logoSrc("emblem").then((u) => { const im = document.querySelector(".ih-emblem"); if (im && u && !u.endsWith("ministry-emblem.png")) im.src = u; }).catch(() => {});
  await iv.ready();
  const who = getWho();
  const afterLogin = async () => {
    const s2 = await boot();
    if (s2 === "ok") { saveWho(); enterApp(); await iv.leave(); return; }
    if (s2 === "pending") { iv.card(`<h2 class="ac-h">الحساب بانتظار التفعيل</h2><p>أُنشئ حسابك بنجاح. ستتمكنين من الدخول بعد أن يفعّله المشرف.</p><button class="btn" id="pend-out">تسجيل الخروج</button>`)
      .querySelector("#pend-out").onclick = async () => { await api.signOut(); iv.closeCard(); }; return; }
    throw new Error(s2 === "offline" ? "تعذر الاتصال بالإنترنت" : s2.replace(/^error:/, ""));
  };
  const openLogin = (opts = {}) => authForm(iv.card(""), { ...opts, onDone: afterLogin });
  if (st === "ok" && who) {
    saveWho(); // تحديث الاسم والمسمى من البيانات الرئيسية
    iv.showRemembered(getWho() || who, async () => { enterApp(); await iv.leave(); }, async () => { forgetWho(); await api.signOut(); start(); });
  } else if (st === "ok") {
    // دخل سابقاً لكن لم يُحفظ الاسم بعد (مثلاً متصفح جديد): يُحفظ الآن ويُعرض
    saveWho(); iv.showRemembered(getWho() || { n: state.profile.full_name }, async () => { enterApp(); await iv.leave(); }, async () => { forgetWho(); await api.signOut(); start(); });
  } else if (st === "offline") {
    iv.card(`<h2 class="ac-h">لا يوجد اتصال بالإنترنت</h2><p>أنتِ ما زلتِ مسجّلة الدخول. سيفتح الموقع تلقائياً عند عودة الاتصال.</p><button class="btn primary" id="again">إعادة المحاولة</button>`).querySelector("#again").onclick = () => start();
    window.addEventListener("online", () => start(), { once: true });
  } else if (st === "pending") {
    iv.card(`<h2 class="ac-h">الحساب بانتظار التفعيل</h2><p>ستتمكنين من الدخول بعد أن يفعّله المشرف.</p><button class="btn" id="again">تحقق مرة أخرى</button>`).querySelector("#again").onclick = () => start();
  } else if (who) {
    // مسجّلة سابقاً وانتهت الجلسة: الاسم والمسمى ثم كلمة المرور فقط
    iv.showRemembered(who, () => openLogin({ username: who.u, passwordOnly: !!who.u, msg: st === "expired" ? "" : st.startsWith("error:") ? st.slice(6) : "" }), () => { forgetWho(); start(); });
  } else {
    iv.showFirst(() => openLogin({ msg: st.startsWith("error:") ? st.slice(6) : "" }));
  }
}

window.addEventListener("beforeunload", (e) => { if (window.__currentEditor?.dirty || state.saveState === "saving") { e.preventDefault(); e.returnValue = ""; } });
// رابط تعبئة النموذج للمكلَّفين: صفحة مستقلة بدون تسجيل دخول (تعرض المهمة وتستقبل الاسم والرقم المدني فقط)
const fillToken = (location.hash.match(/^#\/f\/([A-Za-z0-9_-]{20,80})$/) || [])[1];
if (fillToken) import("./views/formFill.js").then((m) => m.default(root, fillToken));
else start();
