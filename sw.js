const CACHE='dangelo-dispatch-v46';
const CORE=['/','/index.html','/styles.css','/mobile-polish.css','/time-off.css','/config.js','/auth-persistence.js','/app.js','/mobile.js','/mobile-day-nav.js','/incoming-reorder.js','/half-day.js','/single-day.js','/undo-move.js','/instant-timeoff.js','/time-off.js','/supervisor-tabs.js','/holidays.js','/manifest.webmanifest','/dangelo-logo.svg','/dangelo-app-icon.svg','/icon-192.png','/icon-512.png','/apple-touch-icon.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('/index.html'))));
});