// الرفع إلى Google Drive: كل مستخدم يختار مجلده (مثلاً المجلد الذي باسمه في مجلد التوجيه المشترك) مرة واحدة،
// ثم يرفع التقرير إليه بضغطة. لا مفاتيح سرية: «معرّف العميل» و«مفتاح Picker» معرّفات عامة بطبيعتها
// (يُقيَّدان من Google Cloud على رابط الموقع فقط)، والإذن يعطيه كل مستخدم من حسابه في قوقل.
// الصلاحية المطلوبة drive.file: الموقع لا يرى إلا الملفات التي يرفعها والمجلد الذي يختاره المستخدم.
import { state, G } from "./store.js";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
export const driveConfig = () => { const it = state.options?.google_drive?.items || []; return { clientId: String(it[0] || "").trim(), apiKey: String(it[1] || "").trim(), appId: String(it[2] || "").trim() }; };
export const driveReady = () => { const c = driveConfig(); return !!(c.clientId && c.apiKey); };
export const myDriveFolder = () => G().drive_folder || null;

const scripts = {};
const loadScript = (src) => (scripts[src] ||= new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.async = true; s.onload = res; s.onerror = () => { delete scripts[src]; rej(new Error("تعذر الاتصال بخدمات Google")); }; document.head.appendChild(s); }));

let tokenClient = null, token = null, tokenExp = 0, waiting = null;
// يُحمَّل مسبقاً عند فتح المعاينة، حتى يفتح طلب الإذن مباشرة عند الضغط (المتصفح يمنع النوافذ بعد انتظار)
export async function preloadDrive() {
  if (!driveReady()) return false;
  await Promise.all([loadScript("https://accounts.google.com/gsi/client"), loadScript("https://apis.google.com/js/api.js")]);
  await new Promise((r) => window.gapi.load("picker", r));
  if (!tokenClient) tokenClient = window.google.accounts.oauth2.initTokenClient({ client_id: driveConfig().clientId, scope: SCOPE,
    callback: (r) => { const w = waiting; waiting = null; if (r.error) return w?.rej(new Error(r.error === "access_denied" ? "لم تتم الموافقة على الإذن" : r.error)); token = r.access_token; tokenExp = Date.now() + (Number(r.expires_in) || 3000) * 1000 - 60000; w?.res(token); },
    error_callback: (e) => { const w = waiting; waiting = null; w?.rej(new Error(e?.type === "popup_closed" ? "أُغلقت نافذة قوقل قبل الموافقة" : "تعذر فتح نافذة قوقل")); } });
  return true;
}
// يُستدعى مباشرة داخل حدث الضغط
export function requestToken() {
  if (token && Date.now() < tokenExp) return Promise.resolve(token);
  const ask = () => new Promise((res, rej) => { waiting = { res, rej }; tokenClient.requestAccessToken({ prompt: token ? "" : "consent" }); });
  if (!tokenClient) return preloadDrive().then((ok) => { if (!ok || !tokenClient) throw new Error("تعذر الاتصال بخدمات Google، حاولي مرة أخرى"); return ask(); });
  return ask();
}

// رابط مجلد Drive ← معرّفه
export function folderIdFromLink(s) {
  const t = String(s || "").trim(); if (!t) return "";
  const m = t.match(/\/folders\/([\w-]{10,})/) || t.match(/[?&]id=([\w-]{10,})/); if (m) return m[1];
  return /^[\w-]{10,}$/.test(t) ? t : "";
}

// اختيار المجلد من Google Picker (يبدأ من المجلد الملصوق رابطه إن وُجد)؛ اختيار المجلد يعطي الموقع إذن الرفع إليه فقط
export function pickFolder(tok, startId = "") {
  const c = driveConfig(), P = window.google.picker;
  return new Promise((res) => {
    const view = new P.DocsView(P.ViewId.FOLDERS).setSelectFolderEnabled(true).setIncludeFolders(true).setMimeTypes("application/vnd.google-apps.folder");
    if (startId) view.setParent(startId);
    const shared = new P.DocsView(P.ViewId.FOLDERS).setSelectFolderEnabled(true).setIncludeFolders(true).setOwnedByMe(false).setMimeTypes("application/vnd.google-apps.folder");
    const b = new P.PickerBuilder().addView(view).addView(shared).setOAuthToken(tok).setDeveloperKey(c.apiKey).setLocale("ar").setTitle("اختاري مجلدك (مثلاً المجلد الذي باسمك)")
      .enableFeature(P.Feature.SUPPORT_DRIVES).setCallback((d) => { if (d.action === P.Action.PICKED) { const f = d.docs[0]; res({ id: f.id, name: f.name, link: f.url || "" }); } else if (d.action === P.Action.CANCEL) res(null); });
    if (c.appId) b.setAppId(c.appId);
    b.build().setVisible(true);
  });
}

// رفع ملف إلى المجلد (يدعم المجلدات في «الأقراص المشتركة»)
export async function uploadToDrive(tok, blob, name, folderId, mime) {
  const meta = { name, parents: [folderId] };
  const fd = new FormData();
  fd.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  fd.append("file", blob, name);
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink", { method: "POST", headers: { Authorization: "Bearer " + tok }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401) { token = null; throw new Error("انتهت صلاحية الإذن، اضغطي «رفع إلى الدرايف» مرة أخرى"); }
    if (r.status === 403 || r.status === 404) { const e = new Error("لا يوجد إذن للرفع في هذا المجلد. اختاري المجلد من جديد، وتأكدي أن صلاحيتك عليه «محرر»"); e.folder = true; throw e; }
    throw new Error(j.error?.message || "تعذر الرفع");
  }
  void mime; return j;
}
