/* No caches, background sync, stored forms, credentials or offline ballots. */
self.addEventListener("fetch", (event) => {
  if (new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conexión necesaria</title><body style="font-family:system-ui;padding:2rem"><h1>Necesitas conexión a internet</h1><p>No se guardan votos ni padrones sin conexión. Si confirmaste un voto antes del corte, consulta su estado al recuperar internet; no lo reenvíes automáticamente.</p><button onclick="location.reload()">Volver a conectar</button></body></html>',
    {status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}}
  )));
});
