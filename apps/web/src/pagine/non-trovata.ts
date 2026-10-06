import { paginaAuth } from '../ui/layout';

export function mostraNonTrovata(app: HTMLElement): void {
  app.innerHTML = paginaAuth({
    titolo: 'Pagina non trovata',
    sottotitolo: "L'indirizzo potrebbe essere sbagliato o la pagina non esiste più.",
    corpo: '<a class="btn btn-primary btn-lg w-100" href="/">Vai alla home</a>',
  });
}
