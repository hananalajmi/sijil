// التقرير الأسبوعي للتوجيه الفني (اجتماع الموجهين الأسبوعي) — على هيئة النموذج المرفق
import { esc, dayName, MONTHS_AR, parseDate } from "../ui.js";
import { headLogos, logoRow } from "./builders.js";

const lam = (subj) => { const s = String(subj || "").trim(); return s.startsWith("ال") ? "لل" + s.slice(2) : s ? "لـ" + s : ""; };
const dm = (iso) => { const d = parseDate(iso); return d ? `${d.getDate()}/${MONTHS_AR[d.getMonth()]}` : ""; };
const dmy = (iso) => { const d = parseDate(iso); return d ? `${d.getDate()} / ${MONTHS_AR[d.getMonth()]} /${d.getFullYear()}` : ""; };

export async function weeklyMeeting(ctx) {
  const d = ctx.rec.data || {}, subj = String(d.subject || "").trim();
  const yEnd = parseDate(d.period_to)?.getFullYear() || "";
  const period = d.period_from ? `${dm(d.period_from)} – ${dm(d.period_to || d.period_from)}/${yEnd}` : "";
  const header = `${logoRow(await headLogos(ctx, "weekly_meeting"), "wm-logos")}
    <div class="wm-title"><div class="wm-t1">التقرير الأسبوعي للتوجيه الفني <span class="wm-red">${esc(lam(subj))}</span></div>
      <div class="wm-t2">الفترة : ${esc(period)}</div></div>`;
  const absent = (() => { const g = {}; for (const a of d.absent || []) if (a?.name) (g[a.reason || ""] ||= []).push(a.name);
    return Object.entries(g).map(([r, ns]) => `(${r ? esc(r) + " : " : ""}${ns.map(esc).join(" – ")})`).join("  "); })();
  const items = (d.items || []).filter(Boolean);
  const blocks = [
    { html: `<p class="wm-lead">تم اجتماع موجهي وموجهات <span class="wm-red">${esc(subj.replace(/^ال/, "ال"))}</span> اجتماعهم الأسبوعي يوم ${esc(dayName(d.meeting_date) || "")} الموافق: ${esc(dmy(d.meeting_date))}</p>` },
    { html: `<p class="wm-line"><b>الحضور</b> : ${(d.attendees || []).map(esc).join(" – ")}</p>` },
    { html: `<p class="wm-line"><b>الغياب</b> : ${absent}</p>` },
    { html: `<p class="wm-line"><b>ونوقشت فيه البنود</b> :</p>` },
    ...items.map((t, i) => ({ html: `<p class="wm-item">${i + 1}– ${esc(t)}</p>` })),
  ];
  const footer = `<div class="wm-sigs"><div><div class="wm-st">مقرر التقرير الأسبوعي</div><div class="wm-sn">${d.reporter ? "أ. " + esc(d.reporter) : ""}</div></div>
    <div><div class="wm-st">الموجه الفني الأول للعلوم</div><div class="wm-sn">${d.first_name ? "أ. " + esc(d.first_name) : ""}</div></div></div>`;
  // التوقيعان حاشية سفلية ثابتة أسفل الصفحة
  return { orientation: "portrait", cls: "t-wm", header, identity: "", footer, blocks };
}
