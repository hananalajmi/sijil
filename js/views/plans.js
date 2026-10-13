// الخطة الشهرية (التقويم): تُعبأ تلقائياً من التواريخ الهامة والزيارات، ويمكن تعديل أي يوم
import { api } from "../api.js";
import { state, opts, G } from "../store.js";
import { esc, $, $$, today, weekStart, addDays, fmtDate, academicYearOf, WORK_DAYS, DAYS, MONTHS_AR, parseDate, toast, pad2 } from "../ui.js";
import { field, bindFields, recordPage, go } from "../kit.js";
import { listView } from "./_list.js";
import { monthlyDerived } from "../report/context.js";

export default async function (main, ctx) {
  return monthly(main, ctx);
}

/* ======================= الخطة الشهرية ======================= */
async function monthly(main, { id, params }) {
  if (!id) return listView(main, { kind: "monthly_plan", title: "الخطة الشهرية", sub: "تُعبأ تلقائياً من التواريخ الهامة وزيارات المدارس والمعلمين، ويمكن تعديل أي يوم", newLabel: "+ خطة شهر",
    sort: (a, b) => (b.data.month || "").localeCompare(a.data.month || ""),
    columns: [{ label: "الشهر", get: (r) => { const [y, m] = (r.data.month || "").split("-"); return m ? `${MONTHS_AR[Number(m) - 1]} ${y}` : ""; } }] });
  let rec;
  if (id === "new") {
    const month = params.month || today().slice(0, 7);
    const ex = (await api.list({ kind: "monthly_plan" })).find((p) => p.data.month === month);
    if (ex) { location.replace(`#/monthly/${ex.id}`); return; }
    rec = { kind: "monthly_plan", title: `خطة ${month}`, record_date: month + "-01", academic_year: academicYearOf(month + "-01"), data: { month, overrides: {} } };
  } else rec = await api.get(id);
  if (!rec) { main.innerHTML = `<div class="container"><div class="empty">السجل غير موجود</div></div>`; return; }
  await recordPage(main, { rec, title: "الخطة الشهرية", async render(body, ed) {
    body.innerHTML = `<section class="panel"><div class="form">${field({ label: "الشهر", key: "month", type: "month", value: ed.rec.data.month })}</div>
      <p class="hint">الأيام تُعبأ تلقائياً من التواريخ الهامة وزياراتك. اضغطي على أي يوم لتعديل نصه أو تعليمه إجازة.</p></section>
      <div class="mp-cal"><div class="mp-head"><button type="button" class="btn ghost mp-nav" data-go="-1" aria-label="الشهر السابق">→</button><h2 id="mp-title"></h2><button type="button" class="btn ghost mp-nav" data-go="1" aria-label="الشهر التالي">←</button></div>
      <div class="mp-grid" id="mg"></div></div>
      <section class="panel mp-ed" id="mp-ed" aria-live="polite"></section>`;
    let sel = null;
    const paint = async () => {
      const month = ed.rec.data.month, [y, m] = month.split("-").map(Number);
      const derived = await monthlyDerived(month);
      const first = new Date(y, m - 1, 1).getDay(), n = new Date(y, m, 0).getDate();
      const t = today();
      if (!sel || sel > n) sel = t.startsWith(month) ? Number(t.slice(8)) : 1;
      const cells = []; for (let i = 0; i < first; i++) cells.push(null); for (let d = 1; d <= n; d++) cells.push(d); while (cells.length % 7) cells.push(null);
      const ov = ed.rec.data.overrides || {};
      const dayOf = (d) => { const o = ov[d]; return { o, text: o?.text ?? derived[d].text, hol: o?.holiday ?? derived[d].holiday }; };
      $("#mp-title", body).textContent = `${MONTHS_AR[m - 1]} ${y}`;
      // الأسبوع يبدأ بالأحد على اليمين (الصفحة من اليمين لليسار)
      $("#mg", body).innerHTML = DAYS.map((d, k) => `<div class="mp-hd ${k >= 5 ? "we" : ""}"><span class="full">${d}</span><span class="short">${d.replace(/^ال/, "")}</span></div>`).join("") + cells.map((d, k) => {
        if (!d) return `<div class="mp-day mp-blank ${k % 7 >= 5 ? "we" : ""}"></div>`;
        const { o, text, hol } = dayOf(d), iso = `${month}-${pad2(d)}`;
        return `<button type="button" class="mp-day ${k % 7 >= 5 ? "we" : ""} ${hol ? "hol" : ""} ${o ? "ov" : ""} ${iso === t ? "today" : ""} ${d === sel ? "sel" : ""}" data-d="${d}" aria-pressed="${d === sel}" aria-label="${d} ${MONTHS_AR[m - 1]}${hol ? " — إجازة" : ""}">
          <span class="mp-n">${d}</span>${hol ? '<span class="mp-hol">إجازة</span>' : ""}<span class="mp-tx">${esc(text).replace(/\n/g, "<br>")}</span></button>`;
      }).join("");
      $$("#mg [data-d]", body).forEach((b) => (b.onclick = () => { sel = Number(b.dataset.d); paint().then(() => { if (matchMedia("(max-width: 700px)").matches) $("#mp-ed", body).scrollIntoView({ behavior: "smooth", block: "nearest" }); $("#mp-txt", body)?.focus({ preventScroll: true }); }); }));
      // محرر اليوم المختار
      const { o, text, hol } = dayOf(sel), dow = (first + sel - 1) % 7;
      $("#mp-ed", body).innerHTML = `<div class="mp-ed-h"><h3>${DAYS[dow]} ${sel} ${MONTHS_AR[m - 1]} ${y}</h3>
          <div class="row"><button type="button" class="btn small hol-t ${hol ? "on" : ""}" data-hol="${sel}" aria-pressed="${hol}">${hol ? "✓ إجازة" : "تعليم كإجازة"}</button>
          ${o ? `<button type="button" class="btn small ghost" data-reset="${sel}" title="الرجوع للنص التلقائي">↺ النص التلقائي</button>` : ""}</div></div>
        <textarea id="mp-txt" data-day="${sel}" rows="3" aria-label="نص يوم ${sel}" placeholder="لا يوجد شيء في هذا اليوم — اكتبي ما تريدين أن يظهر في الخطة">${esc(text)}</textarea>
        ${derived[sel].text && o ? `<p class="hint">النص التلقائي: ${esc(derived[sel].text).replace(/\n/g, " · ")}</p>` : ""}`;
      const ta = $("#mp-txt", body);
      ta.oninput = () => {
        ed.change((x) => { x.data.overrides ||= {}; x.data.overrides[sel] = { ...(x.data.overrides[sel] || { holiday: derived[sel].holiday }), text: ta.value }; });
        const cell = $(`#mg [data-d="${sel}"]`, body); if (cell) { cell.classList.add("ov"); cell.querySelector(".mp-tx").innerHTML = esc(ta.value).replace(/\n/g, "<br>"); }
      };
      $("[data-hol]", $("#mp-ed", body)).onclick = (e) => { const on = e.currentTarget.getAttribute("aria-pressed") !== "true"; ed.change((x) => { x.data.overrides ||= {}; x.data.overrides[sel] = { text: x.data.overrides[sel]?.text ?? derived[sel].text, holiday: on }; }); paint(); };
      const rs = $("[data-reset]", $("#mp-ed", body)); if (rs) rs.onclick = () => { ed.change((x) => { delete x.data.overrides[sel]; }); paint(); };
    };
    $$(".mp-nav", body).forEach((b) => (b.onclick = async () => {
      await ed.save();
      const [y, m] = ed.rec.data.month.split("-").map(Number), d = new Date(y, m - 1 + Number(b.dataset.go), 1);
      go(`#/monthly/new?month=${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
    }));
    await paint();
    bindFields(body.querySelector("section"), async (k, v) => {
      if (k !== "month" || !v) return;
      const ex = (await api.list({ kind: "monthly_plan" })).find((p) => p.data.month === v && p.id !== ed.rec.id);
      if (ex) { toast("توجد خطة لهذا الشهر، فُتحت لك"); go(`#/monthly/${ex.id}`); return; }
      ed.change((x) => { x.data.month = v; x.data.overrides = {}; x.record_date = v + "-01"; x.academic_year = academicYearOf(v + "-01"); x.title = `خطة ${v}`; });
      paint();
    });
  } });
}

