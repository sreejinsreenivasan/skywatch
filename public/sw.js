const CACHE="skywatch-shell-v2";
const SHELL=["/","/index.html","/styles.css","/observatory.css","/app.js","/vendor/react.js","/vendor/react-dom.js","/vendor/htm.js"];
self.addEventListener("install",event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.all(SHELL.map(async path=>{try{const response=await fetch(path,{cache:"reload"});if(response.ok)await cache.put(path,response);}catch(error){console.warn("Skywatch shell asset skipped:",path);}}));await self.skipWaiting();})());});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
 if(url.pathname==="/manifest.webmanifest"||url.pathname==="/favicon.ico")return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put("/index.html",copy));}return response;}).catch(async()=>await caches.match("/index.html")||Response.error()));
  return;
 }
 if(SHELL.includes(url.pathname)){
  event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;}catch(error){const cached=await caches.match(request);return cached||Response.error();}})());
 }
});