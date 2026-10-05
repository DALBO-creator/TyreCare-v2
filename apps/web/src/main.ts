import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  app.innerHTML = `
    <h1 class="display-5 fw-bold">TyreCare</h1>
    <p class="lead text-body-secondary">Fase 0 — progetto configurato.</p>
  `;
}

// Quando è disponibile una nuova versione dell'app chiede all'utente se ricaricare
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('È disponibile una nuova versione di TyreCare. Aggiornare ora?')) {
      void updateSW(true);
    }
  },
});
