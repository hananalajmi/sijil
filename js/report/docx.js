// تصدير Word قابل للتحرير: يحوّل التقرير المعروض (نفس المعاينة) إلى مستند .docx من اليمين لليسار.
// الترويسة وبيانات التعريف تُوضع في رأس الصفحة، والتوقيعات في تذييلها، فيكررها Word في كل صفحة.
let loading;
function loadDocx() {
  if (window.docx) return Promise.resolve(window.docx);
  loading ||= new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "js/vendor/docx.umd.js";
    s.onload = () => res(window.docx); s.onerror = () => rej(new Error("تعذر تحميل مكتبة Word"));
    document.head.appendChild(s);
  });
  return loading;
}

const pxToHalfPt = (px) => Math.round(parseFloat(px) * 0.75 * 2);
function hexColor(c) {
  const m = (c || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
  if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null;
  return [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("").toUpperCase();
}
const INLINE = new Set(["SPAN", "B", "STRONG", "I", "EM", "BR", "SMALL", "U"]);

export async function exportDocx(rep, flowRoot, filename) {
  const D = await loadDocx();
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ImageRun, Header, Footer, BorderStyle, PageOrientation, VerticalAlign } = D;
  const imgCache = new Map();
  async function imgRun(im) {
    const src = im.currentSrc || im.src;
    if (!imgCache.has(src)) imgCache.set(src, fetch(src).then((r) => r.arrayBuffer()).catch(() => null));
    const data = await imgCache.get(src);
    if (!data) return null;
    const b = new Uint8Array(data.slice(0, 4));
    const type = b[0] === 0x89 ? "png" : b[0] === 0x47 ? "gif" : "jpg";
    const w = Math.max(1, Math.round(im.getBoundingClientRect().width)), h = Math.max(1, Math.round(im.getBoundingClientRect().height));
    return new ImageRun({ data, type, transformation: { width: w, height: h } });
  }
  const align = (cs) => (cs.textAlign === "center" ? AlignmentType.CENTER : cs.textAlign === "left" || cs.textAlign === "end" ? AlignmentType.LEFT : AlignmentType.RIGHT);

  async function runs(node, inherit) {
    const out = [];
    for (const ch of node.childNodes) {
      if (ch.nodeType === 3) {
        const t = ch.textContent.replace(/\s+/g, " ");
        if (!t.trim() && !out.length) continue;
        const cs = getComputedStyle(ch.parentElement);
        out.push(new TextRun({ text: t, bold: Number(cs.fontWeight) >= 600, size: pxToHalfPt(cs.fontSize), color: hexColor(cs.color) || "000000", rightToLeft: true, font: "Arial", underline: cs.textDecorationLine.includes("underline") ? {} : undefined }));
      } else if (ch.nodeType === 1) {
        if (getComputedStyle(ch).display === "none") continue;
        if (ch.tagName === "BR") out.push(new TextRun({ break: 1 }));
        else if (ch.classList.contains("dots") && !ch.textContent.trim()) out.push(new TextRun({ text: " " + "…".repeat(Math.max(6, Math.round(ch.getBoundingClientRect().width / 17))) + " ", rightToLeft: true, font: "Arial", size: pxToHalfPt(getComputedStyle(ch).fontSize) }));
        else if (ch.tagName === "IMG") { const r = await imgRun(ch); if (r) out.push(r); }
        else out.push(...(await runs(ch, inherit)));
      }
    }
    return out;
  }
  const isInlineOnly = (el) => [...el.childNodes].every((c) => c.nodeType === 3 || (c.nodeType === 1 && (INLINE.has(c.tagName) || c.tagName === "IMG")));

  async function blocks(el) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || el.classList.contains("pg-num")) return [];
    if (el.tagName === "TABLE") return [await table(el)];
    if (el.tagName === "IMG") { const r = await imgRun(el); return r ? [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: [r] })] : []; }
    // صف أفقي فقط: flex أفقي، أو grid بأكثر من عمود (grid بعمود واحد = عناصر متتالية)
    const multiCol = cs.display === "grid" ? cs.gridTemplateColumns.trim().split(/\s+/).length > 1 : cs.display === "flex" && !cs.flexDirection.startsWith("column");
    if (multiCol && el.children.length > 1) return [await rowTable(el)];
    if (isInlineOnly(el)) {
      const children = await runs(el);
      const bb = !["TD", "TH"].includes(el.tagName) && hexColor(cs.borderBottomColor) && parseFloat(cs.borderBottomWidth) > 0;
      return [new Paragraph({ bidirectional: true, alignment: align(cs), children,
        shading: hexColor(cs.backgroundColor) ? { fill: hexColor(cs.backgroundColor) } : undefined,
        border: bb ? { bottom: { style: cs.borderBottomStyle === "dotted" || cs.borderBottomStyle === "dashed" ? BorderStyle.DOTTED : BorderStyle.SINGLE, size: 4, color: hexColor(cs.borderBottomColor) } } : undefined,
        spacing: { after: 40 } })];
    }
    const out = [];
    for (const c of el.childNodes) {
      if (c.nodeType === 3) { if (c.textContent.trim()) out.push(new Paragraph({ bidirectional: true, children: [new TextRun({ text: c.textContent.trim(), rightToLeft: true, font: "Arial" })] })); }
      else if (c.nodeType === 1) out.push(...(await blocks(c)));
    }
    return out;
  }
  const border = (cs) => {
    const w = parseFloat(cs.borderTopWidth);
    const b = w > 0 ? { style: BorderStyle.SINGLE, size: Math.max(2, Math.round(w * 6)), color: hexColor(cs.borderTopColor) || "000000" } : { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    return { top: b, bottom: b, left: b, right: b };
  };
  async function cellChildren(td) {
    const ch = await blocks(td);
    return ch.length ? ch : [new Paragraph({ bidirectional: true, children: [] })];
  }
  async function table(t) {
    const rows = [];
    const total = t.getBoundingClientRect().width || 1;
    for (const tr of t.rows) {
      const cells = [];
      for (const td of tr.cells) {
        const cs = getComputedStyle(td);
        cells.push(new TableCell({ children: await cellChildren(td), columnSpan: td.colSpan > 1 ? td.colSpan : undefined, rowSpan: td.rowSpan > 1 ? td.rowSpan : undefined,
          shading: hexColor(cs.backgroundColor) ? { fill: hexColor(cs.backgroundColor) } : undefined, borders: border(cs), verticalAlign: VerticalAlign.CENTER,
          width: { size: Math.round((td.getBoundingClientRect().width / total) * 100), type: WidthType.PERCENTAGE } }));
      }
      rows.push(new TableRow({ children: cells, tableHeader: tr.parentElement.tagName === "THEAD" }));
    }
    // عرض الأعمدة من الصف الأطول (بالـ twips لعرض محتوى الصفحة)
    const ref = [...t.rows].reduce((a, r) => (r.cells.length > (a?.cells.length || 0) ? r : a), null);
    const pageTw = Math.round((t.closest(".sheet")?.classList.contains("landscape") ? 297 - 24 : 210 - 24) * 56.7);
    const columnWidths = ref ? [...ref.cells].map((c) => Math.max(300, Math.round((c.getBoundingClientRect().width / total) * pageTw))) : undefined;
    return new Table({ visuallyRightToLeft: true, width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths, rows });
  }
  async function rowTable(el) {
    const kids = [...el.children].filter((c) => getComputedStyle(c).display !== "none");
    const total = el.getBoundingClientRect().width || 1;
    const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const cells = await Promise.all(kids.map(async (k) => { const kb = await blocks(k); return new TableCell({ children: kb.length ? kb : [new Paragraph({ children: [] })],
      borders: { top: none, bottom: none, left: none, right: none }, verticalAlign: VerticalAlign.CENTER,
      width: { size: Math.round((k.getBoundingClientRect().width / total) * 100), type: WidthType.PERCENTAGE } }); }));
    return new Table({ visuallyRightToLeft: true, width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none }, rows: [new TableRow({ children: cells })] });
  }

  const sheet = flowRoot.querySelector(".sheet");
  const part = async (sel) => { const n = sheet.querySelector(sel); return n && (n.textContent.trim() || n.querySelector("img")) ? await blocks(n) : []; };
  const headerKids = [...(await part(".pg-header")), ...(await part(".pg-identity"))];
  const footerKids = await part(".pg-footer");
  const bodyKids = [];
  for (const b of sheet.querySelectorAll(".pg-body > .blk")) {
    bodyKids.push(...(await blocks(b)));
    bodyKids.push(b.classList.contains("page-after") ? new Paragraph({ children: [new D.PageBreak()] }) : new Paragraph({ children: [], spacing: { after: 60 } }));
  }

  const land = rep.orientation === "landscape";
  const mm = (v) => Math.round(v * 56.7);
  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", rightToLeft: true }, paragraph: { bidirectional: true } } } },
    sections: [{
      properties: { page: { size: { width: mm(210), height: mm(297), orientation: land ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
        margin: { top: mm(8), bottom: mm(8), left: mm(10), right: mm(10), header: mm(6), footer: mm(6) } }, bidi: true },
      headers: { default: new Header({ children: headerKids.length ? headerKids : [new Paragraph({ children: [] })] }) },
      footers: { default: new Footer({ children: footerKids.length ? footerKids : [new Paragraph({ children: [] })] }) },
      children: bodyKids.length ? bodyKids : [new Paragraph({ children: [] })],
    }],
  });
  return Packer.toBlob(doc);
}
