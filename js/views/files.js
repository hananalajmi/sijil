// الملفات: مواد المراحل الدراسية، النشرات الراجعة، والملفات المشتركة مع مستخدمين محددين
import { api } from "../api.js";
import { state, opts, setMyOptions } from "../store.js";
import { esc, $, $$, toast, confirmBox, modal, download } from "../ui.js";

const size = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " م.ب" : Math.max(1, Math.round(n / 1024)) + " ك.ب");

export const TERMS = ["الفصل الأول", "الفصل الثاني"];
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (_) { return ""; } };

async function openFile(f, save = false) {
  if (f.url) { const a = document.createElement("a"); a.href = f.url; a.target = "_blank"; a.rel = "noopener noreferrer"; document.body.appendChild(a); a.click(); a.remove(); return; }
  try {
    const blob = await api.fileBlob(f.storage_path);
    if (save) return download(blob, f.title || "ملف");
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = u; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  } catch (e) { toast("تعذر فتح الملف: " + e.message, "error"); }
}

async function manageShares(f) {
  const [people, shares] = await Promise.all([api.rpc("list_colleagues").catch(() => []), api.shares(f.id).catch(() => [])]);
  const has = new Set(shares.map((s) => s.user_id));
  const body = document.createElement("div");
  body.innerHTML = people.length ? `<p class="hint">اختاري من يمكنه فتح هذا الملف. لا يظهر الملف لغيرهم.</p><div class="checks">${people.map((p) => `<label><input type="checkbox" value="${p.id}" ${has.has(p.id) ? "checked" : ""}>${esc(p.full_name || p.username)} <small dir="ltr">(${esc(p.username)})</small></label>`).join("")}</div>`
    : `<p>لا يوجد مستخدمون مفعّلون آخرون بعد.</p>`;
  const ok = await modal({ title: "مشاركة: " + f.title, body, actions: [{ label: "إلغاء", value: false }, { label: "حفظ", kind: "primary", value: true }] });
  if (!ok) return;
  try {
    for (const cb of $$("input[type=checkbox]", body)) {
      if (cb.checked && !has.has(cb.value)) await api.addShare(f.id, cb.value);
      if (!cb.checked && has.has(cb.value)) await api.removeShare(f.id, cb.value);
    }
    toast("تم تحديث المشاركة");
  } catch (e) { toast(e.message, "error"); }
}

function fileRows(list, { mine = true, share = false } = {}) {
  if (!list.length) return `<p class="hint">لا توجد ملفات.</p>`;
  return `<div class="list">${list.map((f) => `<div class="item" data-id="${f.id}"><span class="t">${f.url ? '<span aria-hidden="true">🔗 </span>' : ""}${esc(f.title)}</span><span class="m">${esc([f.url ? "رابط: " + host(f.url) : size(f.size || 0), new Date(f.created_at).toLocaleDateString("ar-KW")].filter(Boolean).join(" · "))}</span>
    <span class="s"><button class="btn small" data-open>${f.url ? "فتح الموقع" : "فتح"}</button>${f.url ? '<button class="btn small ghost" data-copy>نسخ الرابط</button>' : '<button class="btn small ghost" data-save>تنزيل</button>'}${share && mine ? '<button class="btn small" data-share>المشاركة</button>' : ""}${mine ? '<button class="btn small danger" data-del>حذف</button>' : ""}</span></div>`).join("")}</div>`;
}
function bindRows(root, list, reload) {
  $$(".item[data-id]", root).forEach((it) => {
    const f = list.find((x) => x.id === it.dataset.id);
    it.querySelector("[data-open]").onclick = () => openFile(f);
    const sv = it.querySelector("[data-save]"); if (sv) sv.onclick = () => openFile(f, true);
    const cp = it.querySelector("[data-copy]"); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(f.url); toast("نُسخ الرابط"); } catch (_) { modal({ title: "الرابط", body: `<input readonly dir="ltr" value="${esc(f.url)}" style="width:100%">` }); } };
    const sh = it.querySelector("[data-share]"); if (sh) sh.onclick = () => manageShares(f);
    const del = it.querySelector("[data-del]"); if (del) del.onclick = async () => {
      if (!(await confirmBox(f.url ? "حذف الرابط" : "حذف الملف", f.url ? `سيُحذف الرابط «${f.title}» من القائمة.` : `سيُحذف «${f.title}» نهائياً من التخزين.`, "حذف", true))) return;
      try { await api.deleteFile(f); toast("حُذف الملف"); reload(); } catch (e) { toast(e.message, "error"); }
    };
  });
}
function uploader({ category, stage, term, subcategory, label = "رفع ملف", accept = "" }, done) {
  const lab = document.createElement("label"); lab.className = "btn primary";
  lab.innerHTML = `${esc(label)}<input type="file" hidden multiple ${accept ? `accept="${accept}"` : ""}>`;
  lab.querySelector("input").onchange = async (e) => {
    const files = [...e.target.files]; if (!files.length) return;
    for (const f of files) {
      if (f.size > 50 * 1048576) { toast(`«${f.name}» أكبر من 50 م.ب`, "error"); continue; }
      try { toast("جارٍ رفع " + f.name); await api.upload(f, { category, stage, term, subcategory, title: f.name }); }
      catch (err) { toast(`تعذر رفع «${f.name}»: ${err.message}`, "error"); }
    }
    done();
  };
  return lab;
}

export default async function (main, { name, params }) {
  if (name === "bulletins") {
    const load = async () => {
      const list = await api.files("&category=eq.bulletin&deleted_at=is.null");
      main.innerHTML = `<div class="container"><div class="page-head"><div><h1>النشرات الراجعة</h1><div class="sub">ارفعيها من الجوال أو الكمبيوتر (PDF، Word، صور)</div></div><div class="row" id="up"></div></div><div id="out">${fileRows(list.filter((f) => f.owner_id === state.profile.id || api.demo))}</div></div>`;
      $("#up", main).appendChild(uploader({ category: "bulletin" }, load));
      bindRows(main, list, load);
    };
    return load();
  }
  if (name === "shared") {
    const load = async () => {
      const all = await api.files("&deleted_at=is.null");
      const mine = all.filter((f) => f.category === "shared" && (f.owner_id === state.profile.id || api.demo));
      const withMe = all.filter((f) => f.owner_id !== state.profile.id && !api.demo);
      main.innerHTML = `<div class="container"><div class="page-head"><div><h1>الملفات المشتركة</h1><div class="sub">الملف لا يظهر إلا لمن تختارينهم، والتحقق يتم في قاعدة البيانات نفسها</div></div><div class="row" id="up"></div></div>
        <section class="panel"><h2>ملفات أشاركها</h2><div id="mine">${fileRows(mine, { share: true })}</div></section>
        <section class="panel"><h2>ملفات مشتركة معي</h2><div id="wm">${fileRows(withMe, { mine: false })}</div></section></div>`;
      $("#up", main).appendChild(uploader({ category: "shared", label: "رفع ملف للمشاركة" }, load));
      bindRows($("#mine", main), mine, load); bindRows($("#wm", main), withMe, load);
    };
    return load();
  }
  // المراحل الدراسية والكتب والمناهج: كل صف مقسّم إلى الفصل الأول والفصل الثاني.
  // «مسارات» فيها أكثر من كتاب: لكل كتاب أقسامه وملفاته (تُحفظ أسماء الكتب مع بيانات الموجّه).
  const BOOKS_STAGE = "مسارات", SEP = " · ";
  // التوجيهات الفنية وآلية التقييم تظهر دائماً بعد الكتابين، حتى لو كانت القائمة محفوظة قبل إضافتهما
  const types = (() => {
    const t = [...opts("material_types")], must = ["التوجيهات الفنية", "آلية التقييم"];
    const at = Math.min(t.length, Math.max(0, t.indexOf("كتاب المعلم") + 1) || 2);
    t.splice(at, 0, ...must.filter((m) => !t.includes(m)));
    return t;
  })();
  const term = TERMS.includes(params.term) ? params.term : TERMS[0];
  const q = (g, t, b = "") => `#/materials?stage=${encodeURIComponent(g)}&term=${encodeURIComponent(t)}${b ? "&book=" + encodeURIComponent(b) : ""}`;
  const load = async () => {
    const every = await api.files(`&category=eq.stage_material&deleted_at=is.null`);
    const baseOf = (st) => String(st || "").split(SEP)[0];
    // الصفوف: من القائمة، ويُضاف أي صف قديم له ملفات حتى لا تختفي ملفاته
    const grades = [...opts("material_stages")];
    for (const f of every) { const b = baseOf(f.stage); if (b && !grades.includes(b)) grades.push(b); }
    const stage = grades.includes(params.stage) ? params.stage : grades[0] || "";
    const isBooks = stage === BOOKS_STAGE;
    const saved = state.guide?.data?.my_options?.masarat_books || [];
    const books = [...saved];
    for (const f of every) { const [b, bk] = String(f.stage || "").split(SEP); if (b === BOOKS_STAGE && bk && !books.includes(bk)) books.push(bk); }
    const book = isBooks ? (books.includes(params.book) ? params.book : books[0] || "") : "";
    const key = book ? stage + SEP + book : stage;
    const list = every.filter((f) => f.stage === key && (f.term || TERMS[0]) === term);
    const bookBar = isBooks ? `<div class="toolbar book-tabs" role="group" aria-label="الكتاب">${books.map((b) => `<a class="btn ${b === book ? "primary" : ""}" href="${q(stage, term, b)}">${esc(b)}</a>`).join("")}<button class="btn" id="add-book">+ إضافة كتاب</button>${book ? '<button class="btn ghost small" id="ren-book">تعديل الاسم</button><button class="btn danger small" id="del-book">حذف الكتاب</button>' : ""}</div>` : "";
    const body = isBooks && !book ? `<div class="empty"><h2>لا توجد كتب بعد</h2><p>أضيفي كتاباً لكل مسار، ثم ارفعي ملفاته في كل فصل.</p></div>`
      : `<h2 class="mat-head" style="margin:14px 0 10px">${esc(book ? stage + " — " + book : stage)} — ${term}</h2>
      ${types.map((t) => `<section class="panel" data-t="${esc(t)}"><div class="page-head" style="margin-bottom:8px"><h2>${esc(t)}</h2><div class="up row"></div></div><div class="out">${fileRows(list.filter((f) => f.subcategory === t))}</div></section>`).join("")}`;
    main.innerHTML = `<div class="container"><div class="page-head"><div><h1>المراحل الدراسية والكتب والمناهج</h1><div class="sub">لكل صف وفصل دراسي: الكتاب، كتاب المعلم، التوجيهات الفنية، آلية التقييم، بنك الأسئلة، الملاحظات، الملخصات</div></div></div>
      <div class="toolbar" role="group" aria-label="الصف">${grades.map((g) => `<a class="btn ${g === stage ? "primary" : ""}" href="${q(g, term)}">${esc(g)}</a>`).join("")}</div>
      ${bookBar}
      <div class="toolbar term-tabs" role="group" aria-label="الفصل الدراسي">${TERMS.map((t) => `<a class="btn ${t === term ? "primary" : ""}" href="${q(stage, t, book)}" data-term="${t}">${t}</a>`).join("")}</div>
      ${body}
      <p class="hint">لمشاركة ملف مع زميل، ارفعيه من «الملفات المشتركة».</p></div>`;
    $$("section[data-t]", main).forEach((sec) => {
      const meta = { category: "stage_material", stage: key, term, subcategory: sec.dataset.t };
      const up = sec.querySelector(".up");
      up.appendChild(uploader({ ...meta, label: "+ رفع ملف" }, load));
      bindRows(sec, list, load);
    });
    const askName = (title, value = "") => modal({ title, body: `<div class="f"><label for="bk-name">اسم الكتاب</label><input id="bk-name" value="${esc(value)}" placeholder="مثال: كيمياء — المسار العلمي"></div>`,
      actions: [{ label: "إلغاء", value: null }, { label: "حفظ", kind: "primary", value: (b) => b.querySelector("#bk-name").value.trim().replace(/\s+/g, " ").replaceAll(SEP.trim(), "-") }] });
    const ab = $("#add-book", main);
    if (ab) ab.onclick = async () => {
      const n = await askName("إضافة كتاب"); if (!n) return;
      if (books.includes(n)) { toast("الكتاب موجود", "error"); return; }
      await setMyOptions("masarat_books", [...books, n]); location.hash = q(stage, term, n);
    };
    const rb = $("#ren-book", main);
    if (rb) rb.onclick = async () => {
      const n = await askName("تعديل اسم الكتاب", book); if (!n || n === book) return;
      if (books.includes(n)) { toast("يوجد كتاب بهذا الاسم", "error"); return; }
      const mine = every.filter((f) => f.stage === key);
      try { for (const f of mine) await api.updateFile(f.id, { stage: stage + SEP + n }); }
      catch (e) { toast("تعذر نقل الملفات: " + e.message, "error"); return; }
      await setMyOptions("masarat_books", books.map((b) => (b === book ? n : b))); location.hash = q(stage, term, n);
    };
    const db = $("#del-book", main);
    if (db) db.onclick = async () => {
      if (every.some((f) => f.stage === key)) { toast("احذفي ملفات الكتاب أولاً (في الفصلين)", "error"); return; }
      if (!(await confirmBox("حذف الكتاب", `سيُحذف الكتاب «${book}» من القائمة.`, "حذف", true))) return;
      await setMyOptions("masarat_books", books.filter((b) => b !== book)); location.hash = q(stage, term);
    };
  };
  return load();
}
