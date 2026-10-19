// OPMercato: network-first app shell, offline fallback for classic local play.
// Do not intercept Supabase's API, authentication or real-time WebSocket traffic.
const CACHE = 'opmercato-shell-v55-transparent-home-logos';
const ROOT=new URL("./",self.location.href);
const ASSETS=[
  "./","./index.html","./classique.html","./opfc.html","./opfc-logo.webp","./opmercato-logo-transparent.png","./opfc-logo-transparent.png","./manifest.webmanifest",
  "./opmercato-logo.jpg","./apple-touch-icon.png","./icon-192.png",
  "./icon-512.png","./icon-512-maskable.png","./favicon-32.png",
  "./characters-data.js","./portrait-map.js","./opmercato-custom-portraits.js",
  "./mercato-upgrade.js","./mercato-rules.js","./mercato-art.js","./mercato-features.js",
  "./mercato-card-premium.js","./mercato-hud-21.js","./mercato-v3-dice.js","./mercato-v3-local.js","./mercato-roster-summary.js","./mercato-smile-summary.js","./opmercato-ships-sprite.webp","./mercato-history-21.js","./mercato-online.js"
];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await Promise.allSettled(ASSETS.map(async path=>{
      await cache.add(new URL(path,ROOT).href);
    }));
  }).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys
    .filter(name=>name.startsWith("opmercato-shell-")&&name!==CACHE)
    .map(name=>caches.delete(name)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(ROOT.pathname))return;
  const cacheKey=req.mode==="navigate"?new URL(url.pathname,ROOT.origin).href:req;
  event.respondWith(
    fetch(req).then(response=>{
      if(response.ok){
        const copy=response.clone();
        event.waitUntil(caches.open(CACHE).then(cache=>cache.put(cacheKey,copy)).catch(()=>{}));
      }
      return response;
    }).catch(async()=>{
      const fallback=await caches.match(cacheKey);
      if(fallback)return fallback;
      if(req.mode==="navigate"){
        const cached=await caches.match(new URL("./index.html",ROOT).href);
        if(cached)return cached;
      }
      return Response.error();
    })
  );
});
