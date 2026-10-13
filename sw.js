// عامل خدمة بسيط لتثبيت الموقع كتطبيق على الجوال. لا يخزّن البيانات ولا الصفحات:
// كل طلب يذهب إلى الإنترنت مباشرة، فتظهر دائماً آخر نسخة من الموقع ومن السجلات.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
