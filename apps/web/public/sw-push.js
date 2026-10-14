// Web Push (Fase 5): importato dal service worker generato da vite-plugin-pwa (`importScripts`).
// Il contenuto lo manda la Edge Function `invia-notifica`: { titolo, testo, link, id }.
/* global self, clients, URL */

self.addEventListener('push', (evento) => {
  let dati;
  try {
    dati = evento.data ? evento.data.json() : {};
  } catch {
    dati = { testo: evento.data ? evento.data.text() : '' };
  }
  evento.waitUntil(
    self.registration.showNotification(dati.titolo || 'TyreCare', {
      body: dati.testo || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      lang: 'it',
      // Una notifica per appuntamento: la nuova sostituisce la vecchia
      tag: dati.id || undefined,
      data: { link: dati.link || '/notifiche' },
    }),
  );
});

// Tocco sulla notifica: apre la pagina indicata, riusando una finestra dell'app se è già aperta
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = new URL(evento.notification.data?.link || '/notifiche', self.location.origin).href;
  evento.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((finestre) => {
      const aperta = finestre.find((f) => f.url.startsWith(self.location.origin));
      if (aperta) return aperta.navigate(url).then((f) => (f || aperta).focus());
      return clients.openWindow(url);
    }),
  );
});
