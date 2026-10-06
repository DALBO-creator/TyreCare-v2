import '@fontsource-variable/inter';
import './styles/main.scss';
import { registerSW } from 'virtual:pwa-register';
import { mostraAnteprima } from './anteprima';

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mostraAnteprima(app);
}

// Quando è disponibile una nuova versione dell'app chiede all'utente se ricaricare
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('È disponibile una nuova versione di TyreCare. Aggiornare ora?')) {
      void updateSW(true);
    }
  },
});
