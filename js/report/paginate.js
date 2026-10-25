// محرك الطباعة: يوزّع كتل التقرير على صفحات A4 دون تقسيم أي مربع بين صفحتين،
// ويكرر في كل صفحة: الترويسة والشعارات + بيانات التعريف + خانات التوقيع.
//
// شكل التقرير:
// { orientation: 'portrait'|'landscape', frame: bool, cls: 'اسم قالب',
//   header: html, identity: html, footer: html,
//   blocks: [ {html} | {group:{head, items:[html], cls}} | {table:{cls, colgroup, thead, rows:[html]}} ] }

const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

function newSheet(rep, container, bare = false) {
  const s = el(`<section class="sheet ${rep.orientation || "portrait"} ${rep.cls || ""} ${rep.bw ? "bw" : ""} ${bare ? "bare" : ""}" ${rep.style ? `style="${rep.style}"` : ""}>
    <div class="sheet-inner ${rep.frame && !bare ? "framed" : ""}">
      <div class="pg-header">${bare ? "" : rep.header || ""}</div>
      <div class="pg-identity">${bare ? "" : rep.identity || ""}</div>
      <div class="pg-body"></div>
      <div class="pg-footer">${bare ? "" : rep.footer || ""}</div>
      <div class="pg-num"></div>
    </div></section>`);
  container.appendChild(s);
  return s;
}
// قياس دقيق (بالكسور) حتى لا تتجاوز كتلة حدود الصفحة بجزء من المليمتر
const overflows = (body) => { if (body.scrollHeight > body.clientHeight + 1) return true;
  const last = body.lastElementChild; return !!last && last.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom + .5; };

async function waitImages(root) {
  const imgs = [...root.querySelectorAll("img")];
  await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
}

export async function paginate(rep, container) {
  container.innerHTML = "";
  if (document.fonts?.ready) await document.fonts.ready;
  const pages = [];
  // صفحات مستقلة (الغلاف، المحتوى) بلا ترويسة متكررة
  for (const c of rep.covers || []) {
    const cs = newSheet(rep, container, true);
    const cb = cs.querySelector(".pg-body"); cb.innerHTML = `<div class="blk cover-blk">${c}</div>`;
    await waitImages(cs);
    if (overflows(cb)) cb.firstElementChild.classList.add("oversize");
    pages.push(cs);
  }
  let sheet = newSheet(rep, container);
  await waitImages(sheet);
  let body = sheet.querySelector(".pg-body");
  pages.push(sheet);
  // الترويسة والتعريف والتذييل متطابقة في كل الصفحات: تُثبَّت أطوالها كما قيست في الصفحة الأولى
  // (بعد تحميل الشعارات)، حتى لا تُحسب صفحة جديدة قبل ظهور شعاراتها فيُقص آخرها عند الطباعة
  const fixed = [".pg-header", ".pg-identity", ".pg-footer"].map((k) => [k, sheet.querySelector(k).getBoundingClientRect().height]);
  const fresh = () => {
    sheet = newSheet(rep, container);
    for (const [k, h] of fixed) { const e = sheet.querySelector(k); e.style.boxSizing = "border-box"; e.style.height = h + "px"; e.style.overflow = "hidden"; }
    body = sheet.querySelector(".pg-body"); pages.push(sheet);
  };
  const isEmpty = () => body.childElementCount === 0;

  // يضيف عنصراً ذرياً؛ إن لم يتسع ينقله كاملاً للصفحة التالية
  const placeAtomic = (node) => {
    body.appendChild(node);
    if (!overflows(body)) return true;
    if (isEmpty() || body.childElementCount === 1) { node.classList.add("oversize"); return true; } // أكبر من صفحة كاملة (نادر جداً)
    body.removeChild(node); fresh(); body.appendChild(node);
    if (overflows(body)) node.classList.add("oversize");
    return true;
  };

  // HTML كتلة كما تُرسم (لتجربة وضع قسم كامل معاً)
  const asHtml = (b) => b.html ? `<div class="blk">${b.html}</div>`
    : b.group ? `<div class="blk grp ${b.group.cls || ""}">${b.group.head}<div class="grp-items">${b.group.items.join("")}</div></div>`
    : b.table ? `<div class="blk tbl">${b.table.before || ""}<table class="${b.table.cls || ""}">${b.table.colgroup || ""}<thead>${b.table.thead || ""}</thead><tbody>${b.table.rows.join("")}</tbody></table></div>` : "";
  const place = (b) => {
    if (b.pageBreak) { if (!isEmpty()) fresh(); return; }
    // fill: كتلة تملأ المساحة الباقية في الصفحة (مثل صور تقرير الفعالية)؛ إن بقي أقل من min مم تنتقل لصفحة جديدة
    if (b.fill) {
      const node = el(`<div class="blk fill">${b.html}</div>`);
      const mm = 96 / 25.4, fit = () => { node.style.height = "0px"; const cs = getComputedStyle(node);
        const rem = body.getBoundingClientRect().bottom - node.getBoundingClientRect().top - (parseFloat(cs.marginBottom) || 0) - 1;
        node.style.height = Math.max(0, Math.floor(rem)) + "px"; return rem; };
      body.appendChild(node);
      if (fit() < (b.fill.min || 30) * mm && body.childElementCount > 1) { body.removeChild(node); fresh(); body.appendChild(node); fit(); }
      b.fill.fit?.(node);
      return;
    }
    if (b.html) {
      const node = el(`<div class="blk">${b.html}</div>`);
      placeAtomic(node);
      return;
    }
    if (b.group) {
      const g = b.group;
      const build = (items, cont) => el(`<div class="blk grp ${g.cls || ""}">${cont ? g.head.replace("</", " (تابع)</") : g.head}<div class="grp-items">${items.join("")}</div></div>`);
      // 1) جرّب المربع كاملاً في المساحة المتبقية
      let node = build(g.items, false);
      body.appendChild(node);
      if (!overflows(body)) return;
      // مربع قابل للضغط (مثل «خامساً: الملاحظات»): تُقلَّل المسافة فوقه ليبقى في الصفحة نفسها بدل صفحة جديدة
      if (g.squeeze) { node.classList.add("squeezed"); if (!overflows(body)) return; node.classList.remove("squeezed"); }
      body.removeChild(node);
      // 2) إن كان المربع يتسع في صفحة كاملة: يُنقل كاملاً إلى الصفحة التالية (حتى لو بقي فراغ)
      body.appendChild(node);
      const fitsFullPage = node.offsetHeight <= body.clientHeight;
      body.removeChild(node);
      if (!isEmpty() && fitsFullPage) { fresh(); body.appendChild(node); if (!overflows(body)) return; body.removeChild(node); }
      // 3) أكبر من صفحة كاملة: يُقسَّم بين البنود فقط (لا يُقسم البند الواحد)، مع تكرار عنوان المربع
      let i = 0, cont = false;
      while (i < g.items.length) {
        let take = [];
        node = build([], cont); body.appendChild(node);
        const box = node.querySelector(".grp-items");
        while (i < g.items.length) {
          const it = el(`<div>${g.items[i]}</div>`).firstElementChild || el(`<div>${g.items[i]}</div>`);
          box.appendChild(it);
          if (overflows(body)) { box.removeChild(it); break; }
          take.push(g.items[i]); i++;
        }
        if (!take.length) {
          if (isEmpty() || body.childElementCount === 1) { box.appendChild(el(`<div>${g.items[i]}</div>`)); node.classList.add("oversize"); i++; }
          else body.removeChild(node);
        }
        if (i < g.items.length) { fresh(); cont = true; }
      }
      return;
    }
    if (b.table) {
      const t = b.table;
      let cont = false;
      const before = () => (t.before ? (cont ? t.before.replace(/<\/(\w+)>\s*$/, " (تابع)</$1>") : t.before) : "");
      const build = (rows) => el(`<div class="blk tbl">${before()}<table class="${t.cls || ""}">${t.colgroup || ""}<thead>${t.thead || ""}</thead><tbody>${rows.join("")}</tbody></table></div>`);
      let node = build(t.rows); body.appendChild(node);
      if (!overflows(body)) return;
      body.removeChild(node);
      // إن كان الجدول كله يتسع في صفحة كاملة، يُنقل كاملاً للصفحة التالية
      body.appendChild(node); const fits = node.offsetHeight <= body.clientHeight; body.removeChild(node);
      if (!isEmpty() && (t.keepTogether || fits)) { fresh(); body.appendChild(node); if (!overflows(body)) return; body.removeChild(node); }
      // الجدول يُقسم بين الصفوف فقط، ويتكرر العنوان ورأس الجدول في كل صفحة
      let i = 0;
      // كل عنصر في rows قد يحتوي أكثر من صف ويبقى معاً
      while (i < t.rows.length) {
        node = build([]); body.appendChild(node);
        if (overflows(body) && !isEmpty() && body.childElementCount > 1) { body.removeChild(node); fresh(); node = build([]); body.appendChild(node); }
        const tb = node.querySelector("tbody");
        const addRows = (html) => { const tmp = document.createElement("tbody"); tmp.innerHTML = html; const trs = [...tmp.children]; trs.forEach((tr) => tb.appendChild(tr)); return trs; };
        let n = 0;
        while (i < t.rows.length) {
          const trs = addRows(t.rows[i]);
          if (overflows(body)) { trs.forEach((tr) => tb.removeChild(tr)); break; }
          i++; n++;
        }
        if (!n) {
          if (body.childElementCount === 1) { addRows(t.rows[i]); node.classList.add("oversize"); i++; n++; }
          else body.removeChild(node);
        }
        if (n) cont = true;
        if (i < t.rows.length) fresh();
      }
    }
    };
  for (const b of rep.blocks) {
    // keep: قسم كامل (بند) لا يُقسم بين صفحتين ما دام يتسع في صفحة واحدة
    if (b.keep) {
      const node = el(`<div class="blk keep">${b.keep.map(asHtml).join("")}</div>`);
      body.appendChild(node);
      if (!overflows(body)) continue;
      body.removeChild(node);
      body.appendChild(node); let fits = node.offsetHeight <= body.clientHeight;
      // أطول قليلاً من صفحة: يُصغَّر البند قليلاً (حتى 88%) ليبقى كاملاً في صفحة واحدة
      if (!fits) {
        const k = body.clientHeight / node.offsetHeight;
        if (k >= 0.88) { node.style.zoom = String(Math.floor(k * 1000) / 1000); fits = node.offsetHeight <= body.clientHeight; if (!fits) node.style.zoom = ""; }
      }
      body.removeChild(node);
      if (fits) { if (!isEmpty()) fresh(); body.appendChild(node); if (!overflows(body)) continue; body.removeChild(node); }
      // أطول من صفحة كاملة: يوضع جزءاً جزءاً، وكل جزء كامل في صفحة ما دام يتسع
      for (const x of b.keep) place(x);
      continue;
    }
    place(b);
  }
  await Promise.all(pages.map(waitImages));
  // التوقيعات كحاشية في آخر صفحة فقط: مساحتها محجوزة في كل الصفحات، وتظهر في الأخيرة فقط (لا تنتقل وحدها لصفحة جديدة)
  // الكتل «اللاحقة» (class trail، مثل «خامساً: الملاحظات») لا تحمل التوقيع: إن انتقلت وحدها لصفحة جديدة يبقى التوقيع في صفحة التقرير الأخيرة
  const body_ = pages.filter((p) => !p.classList.contains("bare"));
  const trailOnly = (p) => { const k = [...p.querySelectorAll(".pg-body > .blk")]; return k.length > 0 && k.every((x) => x.classList.contains("trail")); };
  const main_ = body_.filter((p) => !trailOnly(p)), lastMain = main_[main_.length - 1];
  body_.forEach((p) => { if (rep.footerLastOnly ? p !== lastMain : trailOnly(p)) p.querySelector(".pg-footer").style.visibility = "hidden"; });
  if (pages.length > 1) pages.forEach((p, i) => (p.querySelector(".pg-num").textContent = `صفحة ${i + 1} من ${pages.length}`));
  return pages;
}

// فحص ذاتي يُستخدم في الاختبارات: لا كتلة تتجاوز حدود جسم الصفحة
export function auditPages(container) {
  const problems = [];
  container.querySelectorAll(".sheet").forEach((s, pi) => {
    const body = s.querySelector(".pg-body").getBoundingClientRect();
    s.querySelectorAll(".pg-body > .blk").forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.bottom > body.bottom + 1 || r.top < body.top - 1) problems.push(`صفحة ${pi + 1}: كتلة خارج الحدود`);
    });
    const inner = s.querySelector(".sheet-inner");
    if (inner.scrollWidth > inner.clientWidth + 1) problems.push(`صفحة ${pi + 1}: محتوى أعرض من الصفحة`);
  });
  return problems;
}
