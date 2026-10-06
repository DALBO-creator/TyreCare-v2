import type { StatoSalute } from '@tyrecare/shared';
import { STATI } from './stato';

/** Stato di ciascuno dei quattro pneumatici (AS, AD, PS, PD). */
export interface StatiRuote {
  as: StatoSalute;
  ad: StatoSalute;
  ps: StatoSalute;
  pd: StatoSalute;
}

/**
 * Auto vista dall'alto (SVG), protagonista della home. Carrozzeria metallizzata, vetri, barra luminosa
 * posteriore rossa (marchio) e pneumatici che si illuminano del colore del loro stato.
 * È decorativa: le stesse informazioni sono negli indicatori accanto, perciò `aria-hidden`.
 */
export function autoDallAlto(stati: StatiRuote): string {
  const ruota = (x: number, y: number, stato: StatoSalute): string =>
    `<rect class="tc-auto__ruota tc-auto__ruota--${STATI[stato].classe}" x="${x}" y="${y}"
      width="18" height="50" rx="6" />`;

  return `
  <svg class="tc-auto" viewBox="0 0 160 320" width="160" height="320" aria-hidden="true"
    focusable="false">
    <defs>
      <linearGradient id="tc-vernice" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#1c1c1c" />
        <stop offset=".22" stop-color="#3d3d3d" />
        <stop offset=".5" stop-color="#5a5a5a" />
        <stop offset=".78" stop-color="#3d3d3d" />
        <stop offset="1" stop-color="#1c1c1c" />
      </linearGradient>
      <linearGradient id="tc-vetro" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#0d0d0d" />
        <stop offset="1" stop-color="#262a30" />
      </linearGradient>
      <linearGradient id="tc-tetto" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#232323" />
        <stop offset=".5" stop-color="#383838" />
        <stop offset="1" stop-color="#232323" />
      </linearGradient>
      <filter id="tc-bagliore" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>

    <!-- Ombra a terra -->
    <ellipse cx="80" cy="162" rx="74" ry="156" fill="#000" opacity=".55" filter="url(#tc-bagliore)" />

    <!-- Pneumatici: sotto la carrozzeria, sporgono ai lati -->
    ${ruota(5, 54, stati.as)}
    ${ruota(137, 54, stati.ad)}
    ${ruota(5, 216, stati.ps)}
    ${ruota(137, 216, stati.pd)}

    <!-- Carrozzeria -->
    <path fill="url(#tc-vernice)" stroke="rgba(255,255,255,.12)" stroke-width="1"
      d="M80 6C116 6 134 18 138 50L143 118C145 158 145 202 143 242L138 284C134 306 116 314 80 314
         C44 314 26 306 22 284L17 242C15 202 15 158 17 118L22 50C26 18 44 6 80 6Z" />

    <!-- Linee del cofano -->
    <path d="M52 22C58 48 60 70 58 98M108 22C102 48 100 70 102 98" fill="none"
      stroke="rgba(255,255,255,.07)" stroke-width="1" />

    <!-- Specchietti -->
    <path d="M18 106L6 100Q3 106 8 112L18 114Z" fill="#2a2a2a" />
    <path d="M142 106L154 100Q157 106 152 112L142 114Z" fill="#2a2a2a" />

    <!-- Parabrezza, tetto, lunotto -->
    <path d="M34 102Q80 86 126 102L118 140Q80 132 42 140Z" fill="url(#tc-vetro)" />
    <rect x="42" y="140" width="76" height="94" rx="16" fill="url(#tc-tetto)" />
    <path d="M42 234Q80 242 118 234L124 262Q80 274 36 262Z" fill="url(#tc-vetro)" />

    <!-- Riflesso sul parabrezza -->
    <path d="M44 104Q70 96 92 98L86 108Q66 106 48 112Z" fill="rgba(255,255,255,.06)" />

    <!-- Fari anteriori -->
    <path d="M34 22Q44 14 56 12" stroke="#e8e8e8" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <path d="M126 22Q116 14 104 12" stroke="#e8e8e8" stroke-width="2.5" stroke-linecap="round" fill="none" />

    <!-- Barra luminosa posteriore (rosso del marchio) -->
    <path class="tc-auto__fanale" d="M30 298Q80 310 130 298" stroke-width="3" stroke-linecap="round" fill="none"
      filter="url(#tc-bagliore)" />
    <path class="tc-auto__fanale" d="M30 298Q80 310 130 298" stroke-width="2" stroke-linecap="round" fill="none" />
  </svg>`;
}
