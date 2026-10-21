// روابط شخصية يضيفها الموجّه (في الرئيسية أو داخل أي قسم) — تُحفظ في بياناته الرئيسية فقط
import { esc, modal, toast } from "./ui.js";

export const okUrl = (u) => { const t = String(u || "").trim(); if (!t) return ""; const v = /^https?:\/\//i.test(t) ? t : "https://" + t; try { const x = new URL(v); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch (_) { return ""; } };

// يعرض نافذة إضافة/تعديل رابط ويعيد القائمة الجديدة (أو null عند الإلغاء)
export async function editLinkList(list, i) {
  const L = Array.isArray(list) ? list : [], cur = i == null ? { title: "", url: "" } : L[i];
  const v = await modal({ title: i == null ? "إضافة رابط" : "تعديل الرابط", body: `<div class="form" style="grid-template-columns:1fr">
      <div class="f"><label for="ml-t">الاسم</label><input id="ml-t" value="${esc(cur.title)}" placeholder="مثال: الخطة الفصلية"></div>
      <div class="f"><label for="ml-u">الرابط</label><input id="ml-u" dir="ltr" value="${esc(cur.url)}" placeholder="https://…"></div></div>`,
    actions: [...(i == null ? [] : [{ label: "حذف", value: "del" }]), { label: "إلغاء", value: null }, { label: "حفظ", kind: "primary", value: (b) => ({ title: b.querySelector("#ml-t").value.trim(), url: b.querySelector("#ml-u").value }) }] });
  if (!v) return null;
  const next = [...L];
  if (v === "del") { next.splice(i, 1); toast("حُذف الرابط"); return next; }
  const url = okUrl(v.url); if (!url) { toast("الرابط غير صحيح", "error"); return null; }
  const item = { title: v.title || new URL(url).hostname, url };
  if (i == null) next.push(item); else next[i] = item;
  toast("حُفظ الرابط"); return next;
}
