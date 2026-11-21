// توزيع لجان تقدير الدرجات على الأسئلة (من القائمة الأساسية للمعلمين):
// لجنة المراجعة الفنية (الموجهون + رؤساء أقسام أو معلمون خبرة)، ولجان أسئلة مستقلة (السؤال الأول والثاني)،
// وطاولات: لكل سؤال مصححان ومراجع واحد. يُحفظ في data.dist داخل القائمة المشتركة نفسها.
import { esc, $, $$, toast, confirmBox } from "../ui.js";

// لجنتا السؤال الأول والثاني موجودتان افتراضياً (كما في النموذج: الأولى 9 مصححين، والثانية 7 مصححين ومراجع)
export const DEF_COMMS = () => [{ label: "لجنة السؤال الأول", nc: 9, nr: 0, c: [], r: [] }, { label: "لجنة السؤال الثاني", nc: 7, nr: 1, c: [], r: [] }];
export const DEF_DIST = () => ({ guides: "", review: ["", "", "", "", "", ""], comms: [], questions: "3, 4, 5, 6", tables: [] });
export const normDist = (saved) => { const d0 = { ...DEF_DIST(), ...(saved || {}) }; if (!d0.comms_set && !(d0.comms || []).length) d0.comms = DEF_COMMS(); d0.comms = d0.comms.map((c) => ({ ...c, label: String(c.label || "").replace(/\s*\(\s*الجيولوجيا\s*\)/, "") })); return d0; };
const qList = (dist) => String(dist.questions || "").split(/[,،\s]+/).map((x) => x.trim()).filter(Boolean);
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
export function autoDistribute(d, dist) {
  const qs = qList(dist), all = people(d);
  const fixed = new Set([...(dist.review || []).filter(Boolean)]);
  const free = all.filter((p) => !fixed.has(p.id));
  let C = free.filter((p) => p.role !== "مراجع"), R = free.filter((p) => p.role === "مراجع").sort((a, b) => (RANK[a.cat || ""] - RANK[b.cat || ""]));
  // الجدد في مجموعة، والباقي في أخرى؛ كل زوج يأخذ من الاثنتين ما أمكن
  const news = C.filter((p) => p.cat === "new"), olds = C.filter((p) => p.cat !== "new");
  const takeC = () => (olds.length ? olds.shift() : news.shift());
  const takeMate = () => (news.length ? news.shift() : olds.shift());
  const comms = (dist.comms || []).map((c) => {
    const nc = Math.max(0, Number(c.nc) || 0), nr = Math.max(0, Number(c.nr) || 0);
    const cc = []; for (let i = 0; i < nc; i++) { const p = i % 2 ? takeMate() : takeC(); cc.push(p?.id || ""); }
    const rr = []; for (let i = 0; i < nr; i++) rr.push(R.shift()?.id || "");
    return { ...c, c: cc, r: rr };
  });
  const left = olds.length + news.length;
  const n = Math.max(1, Number(dist.ntables) || Math.ceil(Math.max(left / (2 * (qs.length || 1)), R.length / (qs.length || 1))) || 1);
  const tables = [];
  for (let t = 0; t < n; t++) {
    const q = {};
    for (const k of qs) { const a = takeC(), b = takeMate(); q[k] = { c: [a?.id || "", b?.id || ""], r: R.shift()?.id || "" }; }
    tables.push({ q });
  }
  return { ...dist, comms, tables, ntables: dist.ntables || "" };
}

export function distPanel(body, ed) {
  const host = document.createElement("section");
  host.className = "panel"; host.id = "gr-dist";
  body.appendChild(host);
  const D = () => (normDist(ed.rec.data.dist));
  const save = (fn) => { ed.change((x) => { const d0 = normDist(x.data.dist); fn(d0); x.data.dist = d0; }, { immediate: true }); };
  const opt = (sel, used) => {
    const ps = people(ed.rec.data);
    return `<option value="">—</option>` + ps.map((p) => `<option value="${p.id}" ${p.id === sel ? "selected" : ""}>${esc(p.name)}${p.role ? " · " + p.role : ""}${used.has(p.id) && p.id !== sel ? " (موزّعة)" : ""}</option>`).join("");
  };
  const slot = (path, val, used) => { const p = people(ed.rec.data).find((x) => x.id === val); return `<select data-slot="${path}" style="min-width:150px;font-weight:600;color:${p ? colorOf(p) : "inherit"}" aria-label="اختيار اسم">${opt(val, used)}</select>`; };
  const colorOf = (p) => ({ new: "#e00000", expert: "#00a03c", head: "#0050d0" })[p.cat] || "#000";

  const paint = () => {
    const d = ed.rec.data;
    if (d.purpose && d.purpose !== "لجان تقدير درجات امتحان") { host.style.display = "none"; return; }
    host.style.display = "";
    const dist = D(), qs = qList(dist), usedArr = usedIds(dist), used = new Set(usedArr);
    const dup = new Set(usedArr.filter((x, i) => usedArr.indexOf(x) !== i));
    const all = people(d), notUsed = all.filter((p) => !used.has(p.id));
    host.innerHTML = `<div class="page-head" style="margin-bottom:6px"><h2>توزيع اللجان على الأسئلة</h2>
        <div class="toolbar" style="margin:0"><button class="btn primary" id="ds-auto">توزيع تلقائي</button><a class="btn" href="#/print/${ed.rec.id || ""}?view=dist" ${ed.rec.id ? "" : 'aria-disabled="true"'}>طباعة التوزيع</a><button class="btn ghost" id="ds-clear">تفريغ التوزيع</button></div></div>
      <p class="hint" style="margin-top:0">يُوزَّع من القائمة أعلاه: لكل سؤال مصححان ومراجع، والجدد يُخلطون مع غيرهم. بعد التوزيع تقدرين تغيّرين أي اسم من القائمة المنسدلة.</p>
      <div class="hint" style="font-weight:600;margin:6px 0">الموزَّع: ${used.size} من ${all.length}${notUsed.length ? ` · غير موزَّع: ${notUsed.length}` : ""}${dup.size ? ` · <span style="color:var(--bad)">أسماء مكررة: ${dup.size}</span>` : ""}</div>
      ${notUsed.length ? `<details style="margin-bottom:8px"><summary class="hint">غير الموزَّعين</summary><p>${notUsed.map((p) => `<span class="pill" style="color:${colorOf(p)}">${esc(p.name)}${p.role ? " · " + p.role : ""}</span>`).join(" ")}</p></details>` : ""}

      <h3>لجنة المراجعة الفنية</h3>
      <div class="form"><div class="f wide"><label for="ds-g">الموجهون (يُكتبون كما تريدين)</label><textarea id="ds-g" rows="2" placeholder="أ. … - أ. …">${esc(dist.guides || "")}</textarea></div></div>
      <p class="hint">رؤساء أقسام أو معلمين خبرة:</p>
      <div class="row" style="gap:6px;flex-wrap:wrap">${(dist.review || []).map((v, i) => `<span>${i + 1}- ${slot(`review.${i}`, v, used)}</span>`).join("")}<button class="btn small" id="ds-revadd">+ خانة</button></div>

      <h3 style="margin-top:14px">لجان أسئلة مستقلة <small class="hint">(مثل لجنة السؤال الأول والثاني)</small></h3>
      ${(dist.comms || []).map((c, ci) => `<div class="panel" style="padding:10px;margin:6px 0">
        <div class="row" style="gap:8px;flex-wrap:wrap;align-items:end"><div class="f" style="flex:1;min-width:200px"><label>عنوان اللجنة</label><input data-cl="${ci}" value="${esc(c.label || "")}"></div>
          <div class="f" style="width:110px"><label>عدد المصححين</label><input type="number" min="0" max="30" data-cn="${ci}" value="${Number(c.nc) || 0}"></div>
          <div class="f" style="width:110px"><label>عدد المراجعين</label><input type="number" min="0" max="5" data-cr="${ci}" value="${Number(c.nr) || 0}"></div>
          <button class="btn small ghost" data-cx="${ci}" style="color:var(--bad)">حذف اللجنة</button></div>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><b>المصححون:</b> ${Array.from({ length: Number(c.nc) || 0 }, (_, i) => `<span>${i + 1}- ${slot(`comms.${ci}.c.${i}`, (c.c || [])[i] || "", used)}</span>`).join("")}</div>
        ${Number(c.nr) ? `<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><b>المراجع:</b> ${Array.from({ length: Number(c.nr) }, (_, i) => slot(`comms.${ci}.r.${i}`, (c.r || [])[i] || "", used)).join("")}</div>` : ""}</div>`).join("")}
      <button class="btn small" id="ds-comadd">+ لجنة سؤال</button>

      <h3 style="margin-top:14px">الطاولات</h3>
      <div class="row" style="gap:10px;flex-wrap:wrap;align-items:end"><div class="f" style="width:170px"><label for="ds-q">أرقام الأسئلة</label><input id="ds-q" value="${esc(dist.questions || "")}" placeholder="3, 4, 5, 6"></div>
        <div class="f" style="width:150px"><label for="ds-n">عدد الطاولات</label><input id="ds-n" type="number" min="0" max="40" value="${esc(dist.ntables || "")}" placeholder="تلقائي"></div></div>
      ${(dist.tables || []).map((t, ti) => `<div class="panel" style="padding:10px;margin:8px 0"><b>طاولة (${ti + 1})</b>
        <div class="tbl-wrap"><table class="data"><thead><tr><th>السؤال</th><th>المصحح 1</th><th>المصحح 2</th><th>المراجع</th></tr></thead><tbody>
        ${qs.map((k) => { const s = (t.q || {})[k] || {}; return `<tr><td class="num"><b>${esc(k)}</b></td><td>${slot(`tables.${ti}.${k}.c.0`, (s.c || [])[0] || "", used)}</td><td>${slot(`tables.${ti}.${k}.c.1`, (s.c || [])[1] || "", used)}</td><td>${slot(`tables.${ti}.${k}.r`, s.r || "", used)}</td></tr>`; }).join("")}
        </tbody></table></div></div>`).join("") || `<p class="hint">اضغطي «توزيع تلقائي» لتوزيع الأسماء على الطاولات.</p>`}`;

    $$("[data-slot]", host).forEach((sel) => (sel.onchange = () => {
      const path = sel.dataset.slot.split("."), v = sel.value;
      save((dd) => {
        if (path[0] === "review") dd.review[+path[1]] = v;
        else if (path[0] === "comms") { const c = dd.comms[+path[1]]; c[path[2]] = [...(c[path[2]] || [])]; c[path[2]][+path[3]] = v; }
        else { const t = dd.tables[+path[1]]; t.q ||= {}; const s = (t.q[path[2]] ||= { c: ["", ""], r: "" }); if (path[3] === "r") s.r = v; else { s.c = [...(s.c || ["", ""])]; s.c[+path[4]] = v; } }
      });
      paint();
    }));
    $("#ds-g", host).oninput = (e) => ed.change((x) => { x.data.dist = { ...normDist(x.data.dist), guides: e.target.value }; });
    $("#ds-q", host).onchange = (e) => { save((dd) => { dd.questions = e.target.value; }); paint(); };
    $("#ds-n", host).onchange = (e) => { save((dd) => { dd.ntables = e.target.value; }); };
    $("#ds-revadd", host).onclick = () => { save((dd) => { dd.review = [...(dd.review || []), ""]; }); paint(); };
    $("#ds-comadd", host).onclick = () => { const n = (D().comms || []).length; save((dd) => { dd.comms = [...(dd.comms || []), { label: `لجنة السؤال ${["الأول", "الثاني", "الثالث", "الرابع"][n] || n + 1}`, nc: 9, nr: 0, c: [], r: [] }]; }); paint(); };
    $$("[data-cl]", host).forEach((i) => (i.oninput = () => ed.change((x) => { const dd = normDist(x.data.dist); dd.comms = dd.comms.map((c, k) => (k === +i.dataset.cl ? { ...c, label: i.value } : c)); x.data.dist = dd; })));
    $$("[data-cn],[data-cr]", host).forEach((i) => (i.onchange = () => { const k = i.dataset.cn ?? i.dataset.cr, f = i.dataset.cn != null ? "nc" : "nr"; save((dd) => { dd.comms[+k] = { ...dd.comms[+k], [f]: Math.max(0, Number(i.value) || 0) }; }); paint(); }));
    $$("[data-cx]", host).forEach((b) => (b.onclick = async () => { if (!(await confirmBox("حذف اللجنة", "حذف هذه اللجنة من التوزيع؟", "حذف", true))) return; save((dd) => { dd.comms = dd.comms.filter((_, k) => k !== +b.dataset.cx); dd.comms_set = true; }); paint(); }));
    $("#ds-auto", host).onclick = async () => {
      if (!people(ed.rec.data).length) { toast("أضيفي أسماء المعلمين أولاً", "error"); return; }
      const has = usedIds(D()).length - (D().review || []).filter(Boolean).length;
      if (has && !(await confirmBox("توزيع تلقائي", "سيُعاد توزيع الطاولات ولجان الأسئلة (لجنة المراجعة الفنية لا تتغير). متابعة؟", "توزيع"))) return;
      const nd = autoDistribute(ed.rec.data, D());
      ed.change((x) => { x.data.dist = nd; }, { immediate: true }); paint();
      const left = people(ed.rec.data).filter((p) => !new Set(usedIds(nd)).has(p.id)).length;
      const empty = usedIds({ ...nd, review: [] }).length;
      toast(`وُزّعت الأسماء على ${nd.tables.length} طاولة${left ? ` · بقي ${left} بدون توزيع` : ""}`);
      void empty;
    };
    $("#ds-clear", host).onclick = async () => { if (!(await confirmBox("تفريغ التوزيع", "تفريغ كل الخانات؟", "تفريغ", true))) return; save((dd) => { dd.tables = []; dd.comms = (dd.comms || []).map((c) => ({ ...c, c: [], r: [] })); dd.review = (dd.review || []).map(() => ""); }); paint(); };
  };
  paint();
  return paint;
}
