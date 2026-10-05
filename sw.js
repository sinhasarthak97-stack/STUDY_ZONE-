const C='study-zone-v6',F=['./','./index.html','./manifest.webmanifest','./logo.png','./icon-192.png','./icon-512.png','./icon-maskable-192.png','./icon-maskable-512.png'],CDN='https://cdnjs.cloudflare.com/';
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||(new URL(r.url).origin!==location.origin&&!r.url.startsWith(CDN)))return;
e.respondWith(fetch(r).then(res=>{if(res.ok||res.type==='opaque'){const c=res.clone();caches.open(C).then(x=>x.put(r,c))}return res}).catch(()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match('./index.html'):Response.error()))))});
