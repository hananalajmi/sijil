// فتح وتنزيل الملفات المخزنة بطريقة تعمل على الآيباد والآيفون:
// سفاري يمنع فتح نافذة جديدة إذا جاءت بعد انتظار التحميل، لذلك تُفتح النافذة فوراً عند الضغط،
// ثم يوضع فيها رابط مؤقت (ساعة) يفتح الملف مباشرة من التخزين دون تحميله كاملاً داخل الصفحة أولاً.
// يجب استدعاء openStored مباشرة من حدث الضغط (قبل أي await).
import { api } from "./api.js";
import { toast, modal, download, esc } from "./ui.js";

function clickLink(href, { blank = true, name = "" } = {}) {
  const a = document.createElement("a");
  a.href = href; a.rel = "noopener noreferrer";
  if (blank) a.target = "_blank";
  if (name) a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

export function openStored(f, { save = false } = {}) {
  if (f.url) { clickLink(f.url); return; }
  const name = f.title || "ملف";
  let w = null;
  if (!save && api.signedUrl) {
    try {
      w = window.open("", "_blank");
      if (w) {
        w.document.write(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)}</title><p dir="rtl" style="font:18px system-ui,sans-serif;padding:24px;color:#14254a">جارٍ فتح «${esc(name)}»…</p>`);
        w.document.close();
        w.opener = null;
      }
    } catch (_) { w = null; }
  }
  toast(save ? "جارٍ تجهيز التنزيل…" : "جارٍ فتح الملف…");
  (async () => {
    try {
      if (api.signedUrl) {
        const url = await api.signedUrl(f.storage_path, save ? name : "");
        if (save) { clickLink(url, { blank: false }); return; }
        if (w && !w.closed) { w.location.replace(url); return; }
        // النافذة مُنعت: زر يضغطه المستخدم فيفتح الملف
        await modal({ title: name, body: `<p>الملف جاهز.</p><p><a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">فتح الملف</a></p>`, actions: [{ label: "إغلاق", value: null }] });
        return;
      }
      // الوضع التجريبي: الملف محفوظ داخل المتصفح
      const blob = await api.fileBlob(f.storage_path);
      if (save) { download(blob, name); return; }
      const u = URL.createObjectURL(f.mime && !blob.type ? new Blob([blob], { type: f.mime }) : blob);
      clickLink(u);
      setTimeout(() => URL.revokeObjectURL(u), 120000);
    } catch (e) {
      if (w && !w.closed) w.close();
      toast("تعذر فتح الملف: " + e.message, "error");
    }
  })();
}
