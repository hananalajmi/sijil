// توزيع لجان تقدير الدرجات على الأسئلة (من القائمة الأساسية للمعلمين):
// لجنة المراجعة الفنية (الموجهون + رؤساء أقسام أو معلمون خبرة)، ولجان أسئلة مستقلة (اختيارية)،
// وطاولات: لكل سؤال مصححان ومراجع واحد. يُحفظ في data.dist داخل القائمة المشتركة نفسها.
import { esc, $, $$, toast, confirmBox } from "../ui.js";
import { opts, state } from "../store.js";
import { api } from "../api.js";

// أسماء موجهي المادة: من قائمة «أسماء الموجهين حسب التخصص» (التخصص|الاسم)، ومن حسابات الزملاء المسجلين
const nrm = (t) => String(t || "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ـ/g, "").replace(/^ال/, "").replace(/\s+/g, " ").trim();
let colCache = null;
export async function subjectGuides(subject) {
  const sub = nrm(subject || "الكيمياء");
  const fromList = opts("guide_names").map((l) => String(l).split("|").map((x) => x.trim())).filter(([sp, n]) => n && nrm(sp).includes(sub)).map(([, n]) => n);
  if (fromList.length) return [...new Set(fromList)];
  colCache ||= (await api.rpc("list_colleagues").catch(() => [])) || [];
  return [...new Set(colCache.map((c) => String(c.full_name || "").trim()).filter(Boolean))];
}

// مجموعات طاولات: لكل مجموعة أسئلتها وعدد طاولاتها (افتراضياً: طاولة للسؤالين 1 و2، وطاولات للأسئلة 3–6)
// ولكل سؤال في الطاولة مصححتان ومراجعة
// المجموعة الأولى (السؤال 1 و2): المصححات من المعلمات الجدد، والمراجعة معلمة عادية
export const DEF_GROUPS = () => [{ questions: "1, 2", ntables: "1", cfrom: "new", rfrom: "std" }, { questions: "3, 4, 5, 6", ntables: "" }];
export const DEF_DIST = () => ({ v: 4, guides: "", review: ["", "", "", "", "", ""], comms: [], groups: DEF_GROUPS(), tables: [] });
export const normDist = (saved) => {
  const d0 = { ...DEF_DIST(), ...(saved || {}) };
  if (saved && (saved.v || 0) < 3) { // نسخ سابقة: لجنتا السؤال الأول والثاني الافتراضيتان تُحذفان، والأسئلة تصير مجموعات
    d0.comms = (d0.comms || []).filter((c) => !/^لجنة السؤال (الأول|الثاني)/.test(String(c.label || "")));
    d0.groups = [{ questions: "1, 2", ntables: "1", cfrom: "new", rfrom: "std" }, { questions: "3, 4, 5, 6", ntables: d0.ntables || "" }];
    d0.v = 3;
  }
  if (!Array.isArray(d0.groups) || !d0.groups.length) d0.groups = DEF_GROUPS();
  if ((d0.v || 0) < 4) { d0.groups = d0.groups.map((g) => (/^\s*1[,،\s]+2\s*$/.test(g.questions || "") && !g.cfrom ? { ...g, cfrom: "new", rfrom: "std" } : g)); d0.v = 4; }
  return d0;
};
const qOf = (str) => String(str || "").split(/[,،\s]+/).map((x) => x.trim()).filter(Boolean);
const tableQs = (t) => (t.qs ? qOf(t.qs) : Object.keys(t.q || {}).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)));
// بنات / بنين: من اختيار السطر، وإلا من الاسم الأول (مذكر/مؤنث)، وإلا من اسم المدرسة (… بنات / … بنين)
const nA = (t) => String(t || "").replace(/[أإآ]/g, "ا").replace(/ـ/g, "").trim();
const MALE = new Set(["محمد", "احمد", "محمود", "علي", "حسن", "حسين", "عمر", "عثمان", "يوسف", "ابراهيم", "اسماعيل", "فهد", "خالد", "سالم", "ناصر", "مشعل", "مبارك", "سعد", "سعود", "بدر", "فيصل", "جاسم", "صالح", "طلال", "عادل", "وليد", "ماجد", "نايف", "راشد", "حمد", "حمود", "عيسى", "موسى", "يحيى", "مصطفى", "مرتضى", "يعقوب", "طارق", "زياد", "مساعد", "متعب", "نواف", "ضاري", "بندر", "تركي", "سلطان", "منصور", "مرزوق", "عايض", "غانم", "هادي", "جابر", "ثامر", "سامي", "هاني", "انور", "ايمن", "رامي", "حازم", "باسل", "عمار", "معاذ", "انس", "حامد", "حمزة", "اسامة", "طلحة", "عبيدة", "معاوية", "حذيفة", "عروة", "فلاح", "مطلق", "دخيل", "شبيب", "صقر", "عوض", "مشاري", "علاء", "بهاء", "ضياء", "وائل", "نبيل", "جمال", "كمال", "سمير", "شريف", "اشرف", "ياسر", "عامر", "فارس", "فراس", "مازن", "نادر", "سيف", "غازي", "هشام", "عصام", "عماد", "رائد", "منذر", "مهند", "قاسم", "هاشم", "عباس", "جعفر", "كاظم", "صادق", "رضا", "مهدي", "سليمان", "داود", "ادريس", "زكريا", "بشار", "شادي", "عبد", "عبدالله", "عبدالرحمن", "عبدالعزيز", "عبدالله", "مرشد", "مطر", "عبيد", "نجم", "منيف", "محسن", "مفرح", "دهام", "سلمان", "عبدالمحسن", "يوسف", "عطية"]);
const FEMALE = new Set(["مريم", "هيا", "نوف", "ريم", "دانه", "شيخه", "دلال", "عبير", "امل", "ايمان", "ابتسام", "اسيل", "اريج", "بشاير", "تهاني", "جنان", "حنان", "حصه", "رهف", "روان", "زينب", "سعاد", "سهام", "شهد", "شوق", "عهود", "غدير", "فجر", "مها", "ميساء", "نسرين", "نور", "هند", "وعد", "ياسمين", "وجدان", "افنان", "بدور", "جواهر", "العنود", "عنود", "الجوهره", "استقلال", "اكرام", "رباب", "رحاب", "رشا", "رانيا", "ديما", "عذاري", "غاده", "ايناس", "هاله", "مزنه", "معالي", "نوير", "النوار", "مراحب", "هاجر", "يسرا", "لجين", "منيره", "نفله", "اميره", "سحر", "قمر", "بثينه", "خلود", "سوزان", "ليال", "شروق", "وفاء", "منال", "نوال", "امال", "اماني", "تغريد", "حلا", "دينا", "سمر", "عائشه", "خديجه", "فاطمه", "زهراء", "بتول", "رغد", "جود", "لمى", "رزان", "دانيه", "غلا", "مشاعل", "نجود", "عالية", "عاليه", "ريهام", "شيرين", "مرام", "سماح", "وداد", "اخلاص", "انتصار", "ابتهال", "تسنيم", "سندس", "اشواق", "نهال", "ميار", "لين", "جيهان", "نيفين", "ايات", "رحمه", "الهام", "سوسن", "حياة", "فدوى", "اسيل", "ساره"]);
export function sexGuess(p) {
  if (p?.sex) return { sex: p.sex, src: "" };
  let w = nA(p?.name).replace(/^(ا\s*[.\/]|الاستاذ[هة]?|المعلم[هة]?)\s*/, "").split(/\s+/)[0] || "";
  const w2 = w.replace(/ة$/, "ه");
  let g = "";
  if (MALE.has(w) || MALE.has(w2) || /^عبد/.test(w) || /^ابو/.test(w)) g = "m";
  else if (FEMALE.has(w2) || FEMALE.has(w) || /[ةه]$/.test(w) || /اء$/.test(w) || /ى$/.test(w)) g = "f";
  if (g) return { sex: g, src: "name" };
  const sc = p?.school || "";
  if (/بنين|ذكور/.test(sc)) return { sex: "m", src: "school" };
  if (/بنات|إناث|اناث/.test(sc)) return { sex: "f", src: "school" };
  return { sex: "", src: "" };
}
export const sexOf = (p) => sexGuess(p).sex;
export const SEX_LABEL = { f: "لجنة البنات", m: "لجنة البنين" };
const people = (d) => (d.rows || []).filter((p) => !p.excl && (p.name || "").trim());
const RANK = { head: 0, expert: 1, "": 2, new: 3 };

// كل المواضع التي فيها اسم (لمعرفة المستخدم وغير الموزَّع)
export function usedIds(dist) {
  const out = [];
  (dist.review || []).forEach((x) => x && out.push(x));
  (dist.comms || []).forEach((c) => [...(c.c || []), ...(c.r || [])].forEach((x) => x && out.push(x)));
  (dist.tables || []).forEach((t) => Object.values(t.q || {}).forEach((s) => [...(s.c || []), s.r].forEach((x) => x && out.push(x))));
  return out;
}

// توزيع تلقائي: المصححون (2 لكل سؤال، يُخلط الجدد مع غيرهم) والمراجعون (1 لكل سؤال، الأولوية لرؤساء الأقسام ثم الخبرة)
// الفصل بين البنات والبنين (افتراضياً): كل لجنة لها طاولاتها، والترقيم يبدأ من 1 في كل لجنة
// المدارس المشمولة في الفرز (الافتراضي: كل المدارس)؛ تُحفظ المستثناة في dist.schools_off
const schoolKey = (p) => String(p.school || "").trim() || "بدون مدرسة";
export const inScope = (dist) => { const off = new Set(dist.schools_off || []); return (p) => !off.has(schoolKey(p)); };
export function autoDistribute(d, dist) {
  const all = people(d).filter(inScope(dist));
  if (dist.split === false) return distCore(all, dist);
  const f = all.filter((p) => sexOf(p) !== "m"), m = all.filter((p) => sexOf(p) === "m");
  const A = f.length ? distCore(f, dist) : { comms: (dist.comms || []).map((c) => ({ ...c, c: [], r: [] })), tables: [] };
  const B = m.length ? distCore(m, { ...dist, comms: [] }) : { tables: [] };
  return { ...dist, comms: A.comms, tables: [...A.tables.map((t) => ({ ...t, sex: "f" })), ...B.tables.map((t) => ({ ...t, sex: "m" }))] };
}
function distCore(all, dist) {
  const fixed = new Set([...(dist.review || []).filter(Boolean)]);
  const free = all.filter((p) => !fixed.has(p.id));
  let C = free.filter((p) => p.role !== "مراجع"), R = free.filter((p) => p.role === "مراجع").sort((a, b) => (RANK[a.cat || ""] - RANK[b.cat || ""]));
  // الجدد في مجموعة، والباقي في أخرى؛ كل زوج يأخذ من الاثنتين ما أمكن
  const news = C.filter((p) => p.cat === "new"), olds = C.filter((p) => p.cat !== "new");
  const takeC = () => (olds.length ? olds.shift() : news.shift());
  const takeMate = () => (news.length ? news.shift() : olds.shift());
  // مراجعة «معلم عادي»: من المراجعات العاديات أولاً، ثم من المعلمات العاديات، ثم أي مراجعة
  const takeStd = () => { let i = R.findIndex((p) => !p.cat); if (i >= 0) return R.splice(i, 1)[0]; i = olds.findIndex((p) => !p.cat); if (i >= 0) return olds.splice(i, 1)[0]; return R.shift(); };
  const takeNew = () => (news.length ? news.shift() : olds.shift());
  const gs = dist.groups || DEF_GROUPS(), byGroup = gs.map(() => []);
  const fillGroup = (g, gi) => {
    const qs = qOf(g.questions); if (!qs.length) return;
    const last = gi === gs.length - 1, left = olds.length + news.length;
    // عدد الطاولات: كما كُتب، وإلا طاولة واحدة للمجموعات الأولى، والأخيرة تأخذ الباقين
    const n = Number(g.ntables) > 0 ? Number(g.ntables) : last ? Math.max(1, Math.ceil(Math.max(left / (2 * qs.length), R.length / qs.length))) : 1;
    for (let t = 0; t < n; t++) {
      const q = {};
      for (const k of qs) {
        const a = g.cfrom === "new" ? takeNew() : takeC(), b = g.cfrom === "new" ? takeNew() : takeMate();
        const r = g.rfrom === "std" ? takeStd() : R.shift();
        q[k] = { c: [a?.id || "", b?.id || ""], r: r?.id || "" };
      }
      byGroup[gi].push({ qs: g.questions, q });
    }
  };
  // المجموعات المخصصة للجدد أولاً (حتى لا يُستهلك الجدد في غيرها)، ثم لجان الأسئلة، ثم باقي المجموعات
  gs.forEach((g, gi) => { if (g.cfrom === "new") fillGroup(g, gi); });
  const comms = (dist.comms || []).map((c) => {
    const nc = Math.max(0, Number(c.nc) || 0), nr = Math.max(0, Number(c.nr) || 0);
    const cc = []; for (let i = 0; i < nc; i++) { const p = i % 2 ? takeMate() : takeC(); cc.push(p?.id || ""); }
    const rr = []; for (let i = 0; i < nr; i++) rr.push(R.shift()?.id || "");
    return { ...c, c: cc, r: rr };
  });
  gs.forEach((g, gi) => { if (g.cfrom !== "new") fillGroup(g, gi); });
  const tables = byGroup.flat();
  return { ...dist, comms, tables };
}

// عدة توزيعات في الملف نفسه (مثل «بنين» و«بنات»): لكل توزيع مدارسه وطاولاته وطباعته
const rid = () => Math.random().toString(36).slice(2, 10);
export const distsOf = (data) => (Array.isArray(data?.dists) && data.dists.length ? data.dists : [{ id: "d0", name: "التوزيع", ...(data?.dist || {}) }]);
export function distPanel(body, ed) {
  const host = document.createElement("section");
  host.className = "panel"; host.id = "gr-dist";
  body.appendChild(host);
  let cur = 0;
  const curIdx = () => Math.min(cur, distsOf(ed.rec.data).length - 1);
  const D = () => normDist(distsOf(ed.rec.data)[curIdx()]);
  const put = (x, d0) => { const all = distsOf(x.data).map((v) => ({ ...v })); all[curIdx()] = { ...d0, id: all[curIdx()].id || rid(), name: all[curIdx()].name || "التوزيع" }; x.data.dists = all; };
  const save = (fn) => { ed.change((x) => { const d0 = normDist(distsOf(x.data)[curIdx()]); fn(d0); put(x, d0); }, { immediate: true }); };
  const opt = (sel, used) => {
    const ps = people(ed.rec.data).filter((p) => inScope(D())(p) || p.id === sel);
    return `<option value="">—</option>` + ps.map((p) => `<option value="${p.id}" ${p.id === sel ? "selected" : ""}>${esc(p.name)}${p.role ? " · " + p.role : ""}${used.has(p.id) && p.id !== sel ? " (موزّعة)" : ""}</option>`).join("");
  };
  const slot = (path, val, used) => { const p = people(ed.rec.data).find((x) => x.id === val); return `<select data-slot="${path}" style="min-width:150px;font-weight:600;color:${p ? colorOf(p) : "inherit"}" aria-label="اختيار اسم">${opt(val, used)}</select>`; };
  const colorOf = (p) => ({ new: "#e00000", expert: "#00a03c", head: "#0050d0" })[p.cat] || "#000";

  let guideList = [];
  // الفرز والتوزيع للمسؤول فقط (مدير الحسابات أو منشئة الملف)؛ الباقون يشاهدون ويطبعون
  const canManage = () => api.demo || state.profile?.role === "admin" || (!!ed.rec.owner_id && ed.rec.owner_id === state.profile?.id) || !ed.rec.id;
  const paint = () => {
    const d = ed.rec.data;
    if (d.purpose && d.purpose !== "لجان تقدير درجات امتحان") { host.style.display = "none"; return; }
    host.style.display = "";
    const dist = D(), usedArr = usedIds(dist), used = new Set(usedArr);
    const dup = new Set(usedArr.filter((x, i) => usedArr.indexOf(x) !== i));
    const everyone = people(d), all = everyone.filter(inScope(dist)), notUsed = all.filter((p) => !used.has(p.id)), unk = all.filter((p) => !sexOf(p));
    const schools = [...new Set(everyone.map(schoolKey))].sort((a, b) => a.localeCompare(b, "ar")), off = new Set(dist.schools_off || []);
    host.innerHTML = `<div class="page-head" style="margin-bottom:6px"><h2>توزيع اللجان على الأسئلة</h2>
        <div class="toolbar" style="margin:0"><button class="btn primary" id="ds-auto">توزيع تلقائي</button><a class="btn" href="#/print/${ed.rec.id || ""}?view=dist&d=${curIdx()}" ${ed.rec.id ? "" : 'aria-disabled="true"'}>طباعة التوزيع</a><button class="btn ghost" id="ds-clear">تفريغ التوزيع</button></div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0 10px">${distsOf(d).map((x, k) => `<button class="btn small ${k === curIdx() ? "primary" : ""}" data-dt="${k}">${esc(x.name || "التوزيع")}</button>`).join("")}
        <button class="btn small" id="ds-new">+ توزيع جديد</button>
        <span style="flex:1"></span><input id="ds-name" value="${esc(distsOf(d)[curIdx()].name || "التوزيع")}" aria-label="اسم التوزيع" style="width:150px" placeholder="مثل: بنين">
        ${distsOf(d).length > 1 ? '<button class="btn small ghost" id="ds-del" style="color:var(--bad)">حذف هذا التوزيع</button>' : ""}</div>
      <p class="hint" style="margin-top:0">يُوزَّع من القائمة أعلاه: لكل سؤال مصححتان ومراجعة، والجدد يُخلطون مع غيرهم. بعد التوزيع تقدرين تغيّرين أي اسم من القائمة المنسدلة.</p>
      <div class="hint" style="font-weight:600;margin:6px 0">الموزَّع: ${used.size} من ${all.length}${notUsed.length ? ` · غير موزَّع: ${notUsed.length}` : ""}${dup.size ? ` · <span style="color:var(--bad)">أسماء مكررة: ${dup.size}</span>` : ""}</div>
      ${notUsed.length ? `<details style="margin-bottom:8px"><summary class="hint">غير الموزَّعين</summary><p>${notUsed.map((p) => `<span class="pill" style="color:${colorOf(p)}">${esc(p.name)}${p.role ? " · " + p.role : ""}</span>`).join(" ")}</p></details>` : ""}

      <h3>المدارس المشمولة في الفرز</h3>
      ${schools.length ? `<label style="display:inline-flex;gap:6px;align-items:center;margin-bottom:4px"><input type="checkbox" id="ds-sall" ${off.size ? "" : "checked"}> <b>كل المدارس</b> <span class="hint">(${schools.length - schools.filter((x) => off.has(x)).length} من ${schools.length})</span></label>
      <div class="checks" id="ds-sl">${schools.map((sc) => { const n = everyone.filter((p) => schoolKey(p) === sc).length; return `<label><input type="checkbox" value="${esc(sc)}" ${off.has(sc) ? "" : "checked"}> ${esc(sc)} <span class="hint">(${n})</span></label>`; }).join("")}</div>
      <p class="hint">بعد تغيير المدارس اضغطي «توزيع تلقائي». الأسماء من المدارس غير المحددة لا تدخل الفرز.</p>` : `<p class="hint">لا توجد أسماء بعد.</p>`}

      <h3 style="margin-top:14px">لجنة المراجعة الفنية</h3>
      <p class="hint" style="margin:0 0 4px">موجهو ${esc(d.subject || "الكيمياء")}:</p>
      ${guideList.length ? `<label style="display:inline-flex;gap:6px;align-items:center;margin-bottom:4px"><input type="checkbox" id="ds-gall" ${guideList.every((n) => (dist.guide_list || []).includes(n)) ? "checked" : ""}> <b>تحديد الكل</b></label>
      <div class="checks no-gender" id="ds-gl">${[...new Set([...guideList, ...(dist.guide_list || [])])].map((n) => `<label><input type="checkbox" value="${esc(n)}" ${(dist.guide_list || []).includes(n) ? "checked" : ""}> ${esc(n)}</label>`).join("")}</div>`
        : `<p class="hint">لا توجد أسماء موجهين مسجلة لهذه المادة — اكتبيها في الخانة التالية.</p>`}
      <div class="form"><div class="f wide"><label for="ds-g">أسماء إضافية (اختياري)</label><input id="ds-g" value="${esc(dist.guides || "")}" placeholder="أ. … - أ. …"></div></div>
      <p class="hint">رؤساء أقسام أو معلمين خبرة:</p>
      <div class="row" style="gap:6px;flex-wrap:wrap">${(dist.review || []).map((v, i) => `<span>${i + 1}- ${slot(`review.${i}`, v, used)}</span>`).join("")}<button class="btn small" id="ds-revadd">+ خانة</button></div>

      <h3 style="margin-top:14px">لجان أسئلة مستقلة <small class="hint">(اختياري — لجنة خاصة لسؤال معيّن)</small></h3>
      ${(dist.comms || []).map((c, ci) => `<div class="panel" style="padding:10px;margin:6px 0">
        <div class="row" style="gap:8px;flex-wrap:wrap;align-items:end"><div class="f" style="flex:1;min-width:200px"><label>عنوان اللجنة</label><input data-cl="${ci}" value="${esc(c.label || "")}"></div>
          <div class="f" style="width:110px"><label>عدد المصححين</label><input type="number" min="0" max="30" data-cn="${ci}" value="${Number(c.nc) || 0}"></div>
          <div class="f" style="width:110px"><label>عدد المراجعين</label><input type="number" min="0" max="5" data-cr="${ci}" value="${Number(c.nr) || 0}"></div>
          <button class="btn small ghost" data-cx="${ci}" style="color:var(--bad)">حذف اللجنة</button></div>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><b>المصححون:</b> ${Array.from({ length: Number(c.nc) || 0 }, (_, i) => `<span>${i + 1}- ${slot(`comms.${ci}.c.${i}`, (c.c || [])[i] || "", used)}</span>`).join("")}</div>
        ${Number(c.nr) ? `<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><b>المراجع:</b> ${Array.from({ length: Number(c.nr) }, (_, i) => slot(`comms.${ci}.r.${i}`, (c.r || [])[i] || "", used)).join("")}</div>` : ""}</div>`).join("")}
      <button class="btn small" id="ds-comadd">+ لجنة سؤال</button>

      <h3 style="margin-top:14px">الطاولات</h3>
      <p class="hint" style="margin:0 0 4px">كل مجموعة لها أسئلتها وطاولاتها الخاصة (مثلاً السؤال 1 و2 على طاولة لحالها):</p>
      ${(dist.groups || []).map((g, gi) => `<div class="row" style="gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:6px"><b style="align-self:center">مجموعة ${gi + 1}</b>
        <div class="f" style="width:170px"><label>أرقام الأسئلة</label><input data-gq="${gi}" value="${esc(g.questions || "")}" placeholder="3, 4, 5, 6"></div>
        <div class="f" style="width:150px"><label>عدد الطاولات</label><input data-gn="${gi}" type="number" min="0" max="40" value="${esc(g.ntables || "")}" placeholder="تلقائي"></div>
        <div class="f" style="width:150px"><label>المصححون</label><select data-gc="${gi}"><option value="">من الجميع</option><option value="new" ${g.cfrom === "new" ? "selected" : ""}>معلمون جدد</option></select></div>
        <div class="f" style="width:150px"><label>المراجع</label><select data-gr="${gi}"><option value="">حسب القائمة</option><option value="std" ${g.rfrom === "std" ? "selected" : ""}>معلم عادي</option></select></div>
        ${(dist.groups || []).length > 1 ? `<button class="btn small ghost" data-gx="${gi}" style="color:var(--bad)">حذف</button>` : ""}</div>`).join("")}
      <button class="btn small" id="ds-gadd">+ مجموعة طاولات</button>
      <label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input type="checkbox" id="ds-split" ${dist.split === false ? "" : "checked"}> <b>فصل البنات عن البنين</b> <span class="hint">(يُعرف من الاسم الأول مذكر أو مؤنث، أو من اسم المدرسة، ويمكن تحديده من «بنات/بنين» في السطر)</span></label>
      ${unk.length && dist.split !== false ? `<p class="hint" style="color:var(--bad)">${unk.length} اسم لم يُعرف إن كان بنات أو بنين (يُحسب مع البنات): حدّديه من جدول المعلمين.</p>` : ""}
      ${(() => { let last = null, num = 0; return (dist.tables || []).map((t, ti) => { const sx = dist.split === false ? "" : t.sex || "f"; const headH = sx !== last ? `<h3 style="margin:14px 0 4px;color:var(--brand,#1b2a4e)">${sx ? SEX_LABEL[sx] : ""}</h3>` : ""; if (sx !== last) num = 0; last = sx; num++;
        return `${headH}<div class="panel" style="padding:10px;margin:8px 0"><b>طاولة (${num})</b>
        <div class="tbl-wrap"><table class="data"><thead><tr><th>السؤال</th><th>المصحح 1</th><th>المصحح 2</th><th>المراجع</th></tr></thead><tbody>
        ${tableQs(t).map((k) => { const s = (t.q || {})[k] || {}; return `<tr><td class="num"><b>${esc(k)}</b></td><td>${slot(`tables.${ti}.${k}.c.0`, (s.c || [])[0] || "", used)}</td><td>${slot(`tables.${ti}.${k}.c.1`, (s.c || [])[1] || "", used)}</td><td>${slot(`tables.${ti}.${k}.r`, s.r || "", used)}</td></tr>`; }).join("")}
        </tbody></table></div></div>`; }).join(""); })() || `<p class="hint">اضغطي «توزيع تلقائي» لتوزيع الأسماء على الطاولات.</p>`}`;

    if (!canManage()) {
      $$("input,select,textarea,button", host).forEach((el) => { el.disabled = true; });
      host.querySelector(".page-head")?.insertAdjacentHTML("afterend", `<div class="alert" style="margin:6px 0">الفرز والتوزيع يعدّله المسؤول فقط. تقدرين تشوفينه وتطبعينه.</div>`);
      return;
    }
    $$("[data-dt]", host).forEach((b) => (b.onclick = () => { cur = +b.dataset.dt; paint(); }));
    $("#ds-name", host).onchange = (e) => { const v = e.target.value.trim() || "التوزيع"; ed.change((x) => { const all = distsOf(x.data).map((q) => ({ ...q })); all[curIdx()].name = v; all[curIdx()].id ||= rid(); x.data.dists = all; }, { immediate: true }); paint(); };
    $("#ds-new", host).onclick = () => { const all = distsOf(ed.rec.data); const nm = all.length === 1 && !all.some((q) => q.name === "بنات") ? "بنات" : all.some((q) => q.name === "بنين") ? "توزيع " + (all.length + 1) : "بنين";
      ed.change((x) => { x.data.dists = [...distsOf(x.data).map((q) => ({ ...q, id: q.id || rid() })), { ...DEF_DIST(), id: rid(), name: nm, split: false, guides: D().guides, guide_list: D().guide_list, review: [...(D().review || [])] }]; }, { immediate: true });
      cur = distsOf(ed.rec.data).length - 1; paint(); toast(`أُضيف توزيع «${nm}» — حدّدي مدارسه ثم «توزيع تلقائي»`); };
    $("#ds-del", host)?.addEventListener("click", async () => { if (!(await confirmBox("حذف التوزيع", `حذف توزيع «${D().name || ""}»؟ (أسماء المعلمين لا تُحذف)`, "حذف", true))) return; ed.change((x) => { x.data.dists = distsOf(x.data).filter((_, k) => k !== curIdx()); }, { immediate: true }); cur = 0; paint(); });
    $$("[data-slot]", host).forEach((sel) => (sel.onchange = () => {
      const path = sel.dataset.slot.split("."), v = sel.value;
      save((dd) => {
        if (path[0] === "review") dd.review[+path[1]] = v;
        else if (path[0] === "comms") { const c = dd.comms[+path[1]]; c[path[2]] = [...(c[path[2]] || [])]; c[path[2]][+path[3]] = v; }
        else { const t = dd.tables[+path[1]]; t.q ||= {}; const s = (t.q[path[2]] ||= { c: ["", ""], r: "" }); if (path[3] === "r") s.r = v; else { s.c = [...(s.c || ["", ""])]; s.c[+path[4]] = v; } }
      });
      paint();
    }));
    const saveGl = () => { const v = $$("#ds-gl input:checked", host).map((c) => c.value); save((dd) => { dd.guide_list = v; }); const a = $("#ds-gall", host); if (a) a.checked = guideList.every((n) => v.includes(n)); };
    $$("#ds-gl input", host).forEach((c) => (c.onchange = saveGl));
    const ga = $("#ds-gall", host); if (ga) ga.onchange = () => { $$("#ds-gl input", host).forEach((c) => (c.checked = ga.checked)); saveGl(); };
    $("#ds-g", host).oninput = (e) => ed.change((x) => { put(x, { ...normDist(distsOf(x.data)[curIdx()]), guides: e.target.value }); });
    $$("[data-gq],[data-gn]", host).forEach((i) => (i.onchange = () => { const k = +(i.dataset.gq ?? i.dataset.gn), f = i.dataset.gq != null ? "questions" : "ntables"; save((dd) => { dd.groups = dd.groups.map((g, j) => (j === k ? { ...g, [f]: i.value } : g)); }); }));
    $$("[data-gc],[data-gr]", host).forEach((i) => (i.onchange = () => { const k = +(i.dataset.gc ?? i.dataset.gr), f = i.dataset.gc != null ? "cfrom" : "rfrom"; save((dd) => { dd.groups = dd.groups.map((g, j) => (j === k ? { ...g, [f]: i.value } : g)); }); }));
    const saveSch = () => { const on = new Set($$("#ds-sl input:checked", host).map((c) => c.value)); save((dd) => { dd.schools_off = schools.filter((x) => !on.has(x)); }); paint(); };
    $$("#ds-sl input", host).forEach((c) => (c.onchange = saveSch));
    const sa = $("#ds-sall", host); if (sa) sa.onchange = () => { $$("#ds-sl input", host).forEach((c) => (c.checked = sa.checked)); saveSch(); };
    $("#ds-split", host).onchange = (e) => { save((dd) => { dd.split = e.target.checked; }); paint(); };
    $$("[data-gx]", host).forEach((b) => (b.onclick = () => { save((dd) => { dd.groups = dd.groups.filter((_, j) => j !== +b.dataset.gx); }); paint(); }));
    $("#ds-gadd", host).onclick = () => { save((dd) => { dd.groups = [...(dd.groups || []), { questions: "", ntables: "1" }]; }); paint(); };
    $("#ds-revadd", host).onclick = () => { save((dd) => { dd.review = [...(dd.review || []), ""]; }); paint(); };
    $("#ds-comadd", host).onclick = () => { const n = (D().comms || []).length; save((dd) => { dd.comms = [...(dd.comms || []), { label: `لجنة السؤال ${["الأول", "الثاني", "الثالث", "الرابع"][n] || n + 1}`, nc: 9, nr: 0, c: [], r: [] }]; }); paint(); };
    $$("[data-cl]", host).forEach((i) => (i.oninput = () => ed.change((x) => { const dd = normDist(distsOf(x.data)[curIdx()]); dd.comms = dd.comms.map((c, k) => (k === +i.dataset.cl ? { ...c, label: i.value } : c)); put(x, dd); })));
    $$("[data-cn],[data-cr]", host).forEach((i) => (i.onchange = () => { const k = i.dataset.cn ?? i.dataset.cr, f = i.dataset.cn != null ? "nc" : "nr"; save((dd) => { dd.comms[+k] = { ...dd.comms[+k], [f]: Math.max(0, Number(i.value) || 0) }; }); paint(); }));
    $$("[data-cx]", host).forEach((b) => (b.onclick = async () => { if (!(await confirmBox("حذف اللجنة", "حذف هذه اللجنة من التوزيع؟", "حذف", true))) return; save((dd) => { dd.comms = dd.comms.filter((_, k) => k !== +b.dataset.cx); dd.comms_set = true; }); paint(); }));
    $("#ds-auto", host).onclick = async () => {
      if (!people(ed.rec.data).length) { toast("أضيفي أسماء المعلمين أولاً", "error"); return; }
      const has = usedIds(D()).length - (D().review || []).filter(Boolean).length;
      if (has && !(await confirmBox("توزيع تلقائي", "سيُعاد توزيع الطاولات ولجان الأسئلة (لجنة المراجعة الفنية لا تتغير). متابعة؟", "توزيع"))) return;
      const nd = autoDistribute(ed.rec.data, D());
      ed.change((x) => { put(x, nd); }, { immediate: true }); paint();
      const left = people(ed.rec.data).filter((p) => !new Set(usedIds(nd)).has(p.id)).length;
      const empty = usedIds({ ...nd, review: [] }).length;
      toast(`وُزّعت الأسماء على ${nd.tables.length} طاولة${left ? ` · بقي ${left} بدون توزيع` : ""}`);
      void empty;
    };
    $("#ds-clear", host).onclick = async () => { if (!(await confirmBox("تفريغ التوزيع", "تفريغ كل الخانات؟", "تفريغ", true))) return; save((dd) => { dd.tables = []; dd.comms = (dd.comms || []).map((c) => ({ ...c, c: [], r: [] })); dd.review = (dd.review || []).map(() => ""); }); paint(); };
  };
  paint();
  subjectGuides(ed.rec.data.subject).then((l) => { guideList = l; paint(); });
  return paint;
}
