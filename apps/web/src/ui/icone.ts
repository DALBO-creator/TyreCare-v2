import { createElement, type IconNode } from 'lucide';

/**
 * Restituisce l'SVG di un'icona Lucide come stringa HTML, con la classe `tc-icona`.
 * Le icone sono decorative (`aria-hidden`): il significato va sempre dato anche dal testo.
 * Si importano solo le icone usate, così il bundle resta piccolo.
 */
export function icona(nodo: IconNode): string {
  return createElement(nodo, {
    class: 'tc-icona',
    'aria-hidden': 'true',
    focusable: 'false',
  }).outerHTML;
}
