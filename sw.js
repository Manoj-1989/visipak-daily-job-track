// Minimal service worker — its only two jobs are (1) satisfying the browser's "this is an
// installable app" checklist (Chrome requires a registered service worker with a fetch handler
// before it will show the install prompt / add-to-home-screen banner) and (2) letting the app's
// own page open from cache if there's no connection, so a factory tablet with a flaky signal still
// shows the last-loaded screen instead of a blank error. It deliberately does NOT try to cache or
// intercept the Firebase/Firestore SDK scripts, PDF.js, or any Firestore network calls — all of
// those are cross-origin and need to always hit the network live; caching them would risk serving
// stale app logic or breaking the live data sync this app depends on.
const CACHE_NAME = "visipak-daily-job-track-shell-v1";
const APP_SHELL_URL = "./index.html";

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll([APP_SHELL_URL, "./manifest.webmanifest"]);
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(names){
      return Promise.all(names.filter(function(n){ return n !== CACHE_NAME; }).map(function(n){ return caches.delete(n); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event){
  var req = event.request;
  var url = new URL(req.url);
  // Only ever handle this app's own same-origin page navigation — everything else (Firestore
  // reads/writes, the Firebase/PDF.js CDN scripts, any other asset) is left completely alone and
  // goes straight to the network exactly as it would with no service worker installed at all.
  var isOwnPageRequest = url.origin === self.location.origin && (req.mode === "navigate" || url.pathname === new URL(APP_SHELL_URL, self.location.href).pathname);
  if(!isOwnPageRequest) return;

  event.respondWith(
    fetch(req).then(function(res){
      var copy = res.clone();
      caches.open(CACHE_NAME).then(function(cache){ cache.put(APP_SHELL_URL, copy); });
      return res;
    }).catch(function(){
      return caches.match(APP_SHELL_URL);
    })
  );
});
