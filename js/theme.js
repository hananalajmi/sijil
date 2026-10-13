// المظهر: الخط والألوان والنمط وحجم الخط وخط التقارير المطبوعة — يختارها كل موجّه لنفسه
// تُحفظ مع البيانات الرئيسية (تتبعه على كل أجهزته)، ونسخة في المتصفح لتظهر فوراً عند الفتح.

export const FONTS = {
  "IBM Plex Sans Arabic": "IBM+Plex+Sans+Arabic:wght@400;600;700",
  "Tajawal": "Tajawal:wght@400;500;700",
  "Cairo": "Cairo:wght@400;600;700",
  "Almarai": "Almarai:wght@400;700",
  "Noto Kufi Arabic": "Noto+Kufi+Arabic:wght@400;600;700",
  "Noto Naskh Arabic": "Noto+Naskh+Arabic:wght@400;600;700",
  "Amiri": "Amiri:wght@400;700",
  "Readex Pro": "Readex+Pro:wght@400;600;700",
};
// خطوط اسم الموقع والعناوين الرئيسية (مستقلة عن خط النصوص)
export const HEAD_FONTS = {
  "Amiri": ["Amiri:wght@700", "أميري — نسخ كلاسيكي رسمي"],
  "Noto Naskh Arabic": ["Noto+Naskh+Arabic:wght@700", "نوتو نسخ — كتابي تقليدي"],
  "Aref Ruqaa": ["Aref+Ruqaa:wght@700", "عارف رقعة — خط رقعة"],
  "": [null, "نفس خط النصوص"],
};
export const PRINT_FONTS = { "": "Arial — كما في القوالب الرسمية", "Noto Naskh Arabic": "نسخ (Noto Naskh)", "Amiri": "أميري", "Cairo": "القاهرة (Cairo)", "Tajawal": "تجوال (Tajawal)" };

// كل لون: [اللون في الوضع الفاتح، اللون في الوضع الداكن]
export const COLORS = {
  royal: { label: "كحلي وذهبي (ثيم المنصة)", a: ["#1b2f5c", "#a9c0ee"] },
  teal: { label: "فيروزي", a: ["#12796e", "#4cc2b3"] },
  navy: { label: "كحلي", a: ["#1f4e79", "#7fb2e5"] },
  maroon: { label: "عنابي", a: ["#8a1c3b", "#ec8aa6"] },
  purple: { label: "بنفسجي", a: ["#5b3f8c", "#b9a0e6"] },
  olive: { label: "زيتوني", a: ["#55702a", "#a9c97a"] },
  brown: { label: "بني ذهبي", a: ["#8a5a12", "#e0b46a"] },
  slate: { label: "رمادي فحمي", a: ["#3d4a52", "#a9b8c1"] },
};
export const SIZES = { small: { label: "صغير", px: 15 }, normal: { label: "متوسط", px: 17 }, large: { label: "كبير", px: 19 }, xlarge: { label: "كبير جداً", px: 21 } };
export const SHAPES = { round: { label: "حواف مستديرة", r: 10 }, soft: { label: "حواف دائرية أكثر", r: 16 }, sharp: { label: "حواف حادة", r: 2 } };
export const MODES = { auto: "حسب الجهاز", light: "فاتح", dark: "داكن" };
export const DEFAULT_UI = { font: "IBM Plex Sans Arabic", headFont: "Amiri", color: "royal", size: "normal", shape: "soft", mode: "auto", printFont: "", v: 2 };
// تحويل لمرة واحدة إلى ثيم المنصة الموحّد (كحلي وذهبي) والخط الأكبر
const migrate = (u) => (u && u.v === 2 ? u : { ...u, color: "royal", size: u?.size === "large" || u?.size === "xlarge" ? u.size : "normal", shape: "soft", v: 2 });

const KEY = "sijil.ui";
const loaded = new Set(["IBM Plex Sans Arabic"]);
function loadFont(name) {
  const spec = FONTS[name] || HEAD_FONTS[name]?.[0];
  if (!name || loaded.has(name) || !spec) return;
  loaded.add(name);
  const l = document.createElement("link"); l.rel = "stylesheet";
  l.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  document.head.appendChild(l);
}
// خلط لونين بنسبة (لإنتاج الألوان الخفيفة من اللون الأساسي)
function mix(hex, withHex, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(hex), p(withHex)];
  return "#" + a.map((v, i) => Math.round(v * (1 - t) + b[i] * t).toString(16).padStart(2, "0")).join("");
}

export function applyUI(ui = {}) {
  const u = { ...DEFAULT_UI, ...migrate(ui) };
  const c = COLORS[u.color] || COLORS.royal;
  const [al, ad] = c.a;
  loadFont(u.font); if (u.printFont) loadFont(u.printFont); if (u.headFont) loadFont(u.headFont);
  let st = document.getElementById("ui-style");
  if (!st) { st = document.createElement("style"); st.id = "ui-style"; document.head.appendChild(st); }
  const font = `"${u.font}", "IBM Plex Sans Arabic", Tahoma, "Segoe UI", "DejaVu Sans", sans-serif`;
  const royal = u.color === "royal";
  const light = royal ? `--accent:${al};--accent-ink:#ffffff;--accent-soft:#e6ebf5;--bg:#f6f3ec;--sunk:#ece8de;--line:#e1dccf;--line-strong:#cbc3b0;--fg:#16233f;--muted:#5f6779;`
    : `--accent:${al};--accent-ink:#ffffff;--accent-soft:${mix(al, "#ffffff", 0.86)};--bg:${mix(al, "#f4f6f5", 0.94)};--sunk:${mix(al, "#e9eeec", 0.9)};`;
  const dark = royal ? `--accent:${ad};--accent-ink:#0c1630;--accent-soft:#1d2a47;--bg:#0d1526;--surface:#141e33;--sunk:#1a2540;--line:#26324e;--line-strong:#36456a;--fg:#e8ecf5;--muted:#9aa6bf;color-scheme:dark;`
    : `--accent:${ad};--accent-ink:${mix(ad, "#000000", 0.85)};--accent-soft:${mix(ad, "#0f1a18", 0.78)};color-scheme:dark;`;
  const head = u.headFont && HEAD_FONTS[u.headFont] ? `"${u.headFont}", ${font}` : font;
  st.textContent = `:root{--ui:${font};--display:${head};--r:${(SHAPES[u.shape] || SHAPES.round).r}px;${light}${u.printFont ? `--print-font:"${u.printFont}";` : ""}}
html{font-size:${(SIZES[u.size] || SIZES.normal).px}px;--fs:${((SIZES[u.size] || SIZES.normal).px / 15).toFixed(3)}}
body{font-size:${(SIZES[u.size] || SIZES.normal).px}px}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}}}
:root[data-theme="dark"]{${dark}}
.btn,.f input,.f select,.f textarea,.tile,.panel,.list,.tbl-wrap,.nav,.alert,.modal{border-radius:var(--r)}`;
  if (u.mode === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", u.mode);
  try { localStorage.setItem(KEY, JSON.stringify(u)); } catch (_) {}
  return u;
}
export function applyCachedUI() { try { applyUI(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (_) { applyUI({}); } }
export { migrate };
