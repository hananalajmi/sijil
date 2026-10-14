// الملفات: مواد المراحل الدراسية، النشرات الراجعة، والملفات المشتركة مع مستخدمين محددين
import { api } from "../api.js";
import { state, opts, setMyOptions } from "../store.js";
import { esc, $, $$, toast, confirmBox, modal } from "../ui.js";
import { openStored } from "../openfile.js";

const size = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " م.ب" : Math.max(1, Math.round(n / 1024)) + " ك.ب");

export const TERMS = ["الفصل الأول", "الفصل الثاني"];
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (_) { return ""; } };

const openFile = (f, save = false) => openStored(f, { save });

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

function fileRows(list, { mine = true, share = false, canDel = null, who = null } = {}) {
  if (!list.length) return `<p class="hint">لا توجد ملفات.</p>`;
  return `<div class="list">${list.map((f) => { const del = canDel ? canDel(f) : mine; const by = who ? who(f) : "";
    return `<div class="item" data-id="${f.id}"><span class="t">${f.url ? '<span aria-hidden="true">🔗 </span>' : ""}${esc(f.title)}</span><span class="m">${esc([f.url ? "رابط: " + host(f.url) : size(f.size || 0), new Date(f.created_at).toLocaleDateString("ar-KW"), by].filter(Boolean).join(" · "))}</span>
    <span class="s"><button class="btn small" data-open>${f.url ? "فتح الرابط" : "فتح"}</button>${f.url ? '<button class="btn small ghost" data-copy>نسخ الرابط</button>' : '<button class="btn small ghost" data-save>تنزيل</button>'}${share && mine ? '<button class="btn small" data-share>المشاركة</button>' : ""}${del ? '<button class="btn small danger" data-del>حذف</button>' : ""}</span></div>`; }).join("")}</div>`;
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
function uploader({ category, stage, subject, term, subcategory, label = "رفع ملف", accept = "", existing = [] }, done) {
  const lab = document.createElement("label"); lab.className = "btn primary";
  lab.innerHTML = `${esc(label)}<input type="file" hidden multiple ${accept ? `accept="${accept}"` : ""}>`;
  lab.querySelector("input").onchange = async (e) => {
    const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
    for (const f of files) {
      if (f.size > 50 * 1048576) { toast(`«${f.name}» أكبر من 50 م.ب — أضيفيه كرابط بدل الرفع`, "error"); continue; }
      // منع التكرار: نفس الاسم أو نفس الحجم في نفس المكان
      const dup = existing.find((x) => !x.url && (x.title === f.name || (x.size && x.size === f.size)));
      if (dup && !(await confirmBox("الملف موجود", `يوجد ملف مشابه هنا: «${dup.title}». هل تريدين رفعه مرة أخرى؟`, "رفع رغم ذلك"))) continue;
      try { toast("جارٍ رفع " + f.name); await api.upload(f, { category, stage, subject, term, subcategory, title: f.name }); }
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
  // مكتبة المناهج المشتركة بين كل الموجهات: لكل مادة وصف وفصل دراسي أقسامها (كتاب، كتاب المعلم، التوجيهات…).
  // الكتاب يُرفع أو يُضاف رابطه مرة واحدة فيراه الجميع؛ الحذف لصاحبة الملف وللمشرفة.
  // «مسارات» فيها أكثر من كتاب: لكل كتاب أقسامه وملفاته.
  const BOOKS_STAGE = "مسارات", SEP = " · ", MOE = "https://elibrary.moe.edu.kw/StudentsLibrary";
  const types = (() => {
    const t = [...opts("material_types")], must = ["التوجيهات الفنية", "آلية التقييم"];
    const at = Math.min(t.length, Math.max(0, t.indexOf("كتاب المعلم") + 1) || 2);
    t.splice(at, 0, ...must.filter((m) => !t.includes(m)));
    return t;
  })();
  const remember = (k, v) => { try { localStorage.setItem("sijil.mat." + k, v); } catch (_) {} };
  const recall = (k) => { try { return localStorage.getItem("sijil.mat." + k) || ""; } catch (_) { return ""; } };
  const term = TERMS.includes(params.term) ? params.term : TERMS.includes(recall("term")) ? recall("term") : TERMS[0];
  const ALIAS = { "العاشر": "الصف العاشر", "الحادي عشر": "الصف الحادي عشر", "الثاني عشر": "الصف الثاني عشر" };
  const norm = (st) => { const [b, ...r] = String(st || "").split(SEP); return [ALIAS[b] || b, ...r].join(SEP); };
  const plainSubject = (x) => String(x || "").trim().replace(/^ال(?=\S{3,})/, "");
  const me = state.profile?.id, admin = state.profile?.role === "admin" || api.demo;
  const q = (o) => `#/materials?${new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString()}`;
  let names = null;
  const load = async () => {
    const [every, colleagues] = await Promise.all([api.files(`&category=eq.stage_material&deleted_at=is.null`), names ? Promise.resolve(null) : api.rpc("list_colleagues").catch(() => [])]);
    if (!names) names = new Map((colleagues || []).map((c) => [c.id, c.full_name]));
    const who = (f) => (f.owner_id === me ? "أضفتُه" : names.get(f.owner_id) ? "أضافته: " + names.get(f.owner_id) : "");
    const canDel = (f) => f.owner_id === me || admin;
    // المواد: من القائمة + مادة الموجّهة + أي مادة لها ملفات
    const mySubject = plainSubject(state.guide?.data?.subject);
    const subjects = [...opts("material_subjects")];
    for (const x of [mySubject, ...every.map((f) => f.subject)]) if (x && !subjects.includes(x)) subjects.push(x);
    const wantS = params.subject || recall("subject") || mySubject;
    const subject = subjects.includes(wantS) ? wantS : subjects[0] || "";
    const inSubject = every.filter((f) => !f.subject || f.subject === subject);
    const baseOf = (st) => String(st || "").split(SEP)[0];
    const grades = [...opts("material_stages")];
    for (const f of inSubject) { const b = baseOf(norm(f.stage)); if (b && !grades.includes(b)) grades.push(b); }
    const want = ALIAS[params.stage] || params.stage || recall("stage");
    const stage = grades.includes(want) ? want : grades.find((g) => inSubject.some((f) => baseOf(norm(f.stage)) === g)) || (grades.includes("الصف العاشر") ? "الصف العاشر" : grades[0] || "");
    remember("stage", stage); remember("term", term); remember("subject", subject);
    const isBooks = stage === BOOKS_STAGE;
    const books = [...(state.guide?.data?.my_options?.masarat_books || [])];
    for (const f of inSubject) { const [b, bk] = String(f.stage || "").split(SEP); if (b === BOOKS_STAGE && bk && !books.includes(bk)) books.push(bk); }
    const book = isBooks ? (books.includes(params.book) ? params.book : books[0] || "") : "";
    const key = book ? stage + SEP + book : stage;
    const list = inSubject.filter((f) => norm(f.stage) === key && (f.term || TERMS[0]) === term);
    const link = (o) => q({ subject, stage, term, book, ...o });
    const bookBar = isBooks ? `<div class="toolbar book-tabs" role="group" aria-label="الكتاب">${books.map((b) => `<a class="btn ${b === book ? "primary" : ""}" href="${link({ book: b })}">${esc(b)}</a>`).join("")}<button class="btn" id="add-book">+ إضافة كتاب</button>${book ? '<button class="btn ghost small" id="ren-book">تعديل الاسم</button><button class="btn danger small" id="del-book">حذف الكتاب</button>' : ""}</div>` : "";
    const body = isBooks && !book ? `<div class="empty"><h2>لا توجد كتب بعد</h2><p>أضيفي كتاباً لكل مسار، ثم ارفعي ملفاته أو أضيفي رابطه في كل فصل.</p></div>`
      : `<h2 class="mat-head" style="margin:14px 0 10px">${esc([subject, book ? stage + " — " + book : stage, term].join(" — "))}</h2>
      ${types.map((t) => `<section class="panel" data-t="${esc(t)}"><div class="page-head" style="margin-bottom:8px"><h2>${esc(t)}</h2><div class="up row"></div></div><div class="out">${fileRows(list.filter((f) => f.subcategory === t), { canDel, who })}</div></section>`).join("")}`;
    main.innerHTML = `<div class="container"><div class="page-head"><div><h1>المراحل الدراسية والكتب والمناهج</h1><div class="sub">مكتبة مشتركة بين كل الموجهات: ما يُضاف هنا يراه الجميع، فلا حاجة لرفع الكتاب أكثر من مرة</div></div>
        <div class="row"><a class="btn" href="${MOE}" target="_blank" rel="noopener noreferrer">مكتبة وزارة التربية ↗</a></div></div>
      <section class="panel mat-pick"><div class="form">
        <div class="f"><label for="mat-subject">المادة</label><select id="mat-subject">${subjects.map((x) => `<option ${x === subject ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
        <div class="f"><label for="mat-stage">الصف</label><select id="mat-stage">${grades.map((g) => `<option ${g === stage ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></div>
        <div class="f"><label for="mat-term">الفصل الدراسي</label><select id="mat-term">${TERMS.map((t) => `<option ${t === term ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      </div></section>
      ${bookBar}
      ${body}
      <p class="hint">لإضافة كتاب من مكتبة الوزارة: افتحي «مكتبة وزارة التربية»، افتحي الكتاب وانسخي رابطه، ثم «+ رابط» في القسم المناسب. الرابط لا يأخذ مساحة من المنصة. الحذف لمن أضافت الملف وللمشرفة فقط.</p></div>`;
    $("#mat-subject", main).onchange = (e) => { location.hash = q({ subject: e.target.value, stage, term }); };
    $("#mat-stage", main).onchange = (e) => { location.hash = q({ subject, stage: e.target.value, term }); };
    $("#mat-term", main).onchange = (e) => { location.hash = link({ term: e.target.value }); };
    $$("section[data-t]", main).forEach((sec) => {
      const t = sec.dataset.t, here = list.filter((f) => f.subcategory === t);
      const meta = { category: "stage_material", stage: key, subject, term, subcategory: t };
      const up = sec.querySelector(".up");
      const lb = document.createElement("button"); lb.className = "btn"; lb.type = "button"; lb.textContent = "+ رابط";
      lb.onclick = async () => {
        const r = await modal({ title: `إضافة رابط — ${t}`, body: `<div class="f"><label for="ln-url">الرابط</label><input id="ln-url" dir="ltr" inputmode="url" placeholder="https://elibrary.moe.edu.kw/…"></div>
            <div class="f"><label for="ln-title">اسم الكتاب أو الملف</label><input id="ln-title" placeholder="مثال: كيمياء ١١ — الجزء الثاني"></div>`,
          actions: [{ label: "إلغاء", value: null }, { label: "إضافة", kind: "primary", value: (b) => ({ url: b.querySelector("#ln-url").value.trim(), title: b.querySelector("#ln-title").value.trim() }) }] });
        if (!r || !r.url) return;
        if (!/^https?:\/\/\S+$/i.test(r.url)) { toast("الرابط يجب أن يبدأ بـ https://", "error"); return; }
        const dup = every.find((f) => f.url && f.url === r.url);
        if (dup) { toast(`هذا الرابط مضاف من قبل: «${dup.title}» (${[dup.subject, norm(dup.stage), dup.term, dup.subcategory].filter(Boolean).join(" — ")})`, "error"); return; }
        try { await api.addLink({ ...meta, url: r.url, title: r.title || host(r.url) }); toast("أُضيف الرابط"); load(); } catch (e) { toast(e.message, "error"); }
      };
      up.appendChild(lb);
      up.appendChild(uploader({ ...meta, label: "+ رفع ملف", existing: here }, load));
      bindRows(sec, list, load);
    });
    const askName = (title, value = "") => modal({ title, body: `<div class="f"><label for="bk-name">اسم الكتاب</label><input id="bk-name" value="${esc(value)}" placeholder="مثال: كيمياء — المسار العلمي"></div>`,
      actions: [{ label: "إلغاء", value: null }, { label: "حفظ", kind: "primary", value: (b) => b.querySelector("#bk-name").value.trim().replace(/\s+/g, " ").replaceAll(SEP.trim(), "-") }] });
    const ab = $("#add-book", main);
    if (ab) ab.onclick = async () => {
      const n = await askName("إضافة كتاب"); if (!n) return;
      if (books.includes(n)) { toast("الكتاب موجود", "error"); return; }
      await setMyOptions("masarat_books", [...books, n]); location.hash = link({ book: n });
    };
    const inBook = inSubject.filter((f) => norm(f.stage) === key);
    const rb = $("#ren-book", main);
    if (rb) rb.onclick = async () => {
      if (!admin && inBook.some((f) => f.owner_id !== me)) { toast("في هذا الكتاب ملفات أضافتها زميلات، تعديل اسمه للمشرفة فقط", "error"); return; }
      const n = await askName("تعديل اسم الكتاب", book); if (!n || n === book) return;
      if (books.includes(n)) { toast("يوجد كتاب بهذا الاسم", "error"); return; }
      try { for (const f of inBook) await api.updateFile(f.id, { stage: stage + SEP + n }); }
      catch (e) { toast("تعذر نقل الملفات: " + e.message, "error"); return; }
      await setMyOptions("masarat_books", books.map((b) => (b === book ? n : b))); location.hash = link({ book: n });
    };
    const db = $("#del-book", main);
    if (db) db.onclick = async () => {
      if (inBook.length) { toast("احذفي ملفات الكتاب أولاً (في الفصلين)", "error"); return; }
      if (!(await confirmBox("حذف الكتاب", `سيُحذف الكتاب «${book}» من القائمة.`, "حذف", true))) return;
      await setMyOptions("masarat_books", books.filter((b) => b !== book)); location.hash = link({ book: "" });
    };
  };
  return load();
}
