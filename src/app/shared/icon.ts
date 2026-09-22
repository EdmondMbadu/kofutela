import { Component, input } from '@angular/core';
const paths: Record<string, string> = {
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  building: 'M4 21V4h11v17 M15 9h5v12 M2 21h20 M8 8h3 M8 12h3 M8 16h3',
  people:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  wallet: 'M3 6h16v14H3z M3 6V4h14v2 M15 11h6v5h-6z M17 13.5h1',
  tool: 'M14 6a5 5 0 0 0-6 6L2 18l4 4 6-6a5 5 0 0 0 6-6l-4 3-3-3Z',
  message: 'M21 11a8 8 0 0 1-8 8H7l-5 3V11a9 9 0 0 1 19 0Z M7 10h9 M7 14h6',
  file: 'M14 2H4v20h16V8Z M14 2v6h6 M8 13h8 M8 17h6',
  chart: 'M3 3v18h18 M7 17v-5 M12 17V7 M17 17v-8',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  shield: 'M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6Z M8 12l3 3 5-6',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  plus: 'M12 5v14 M5 12h14',
  check: 'M5 12l4 4L19 6',
  chevron: 'm9 5 7 7-7 7',
  close: 'm6 6 12 12 M6 18 18 6',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  logout: 'M9 3H3v18h6 M9 12h12 M17 8l4 4-4 4',
  globe: 'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0 M3 12h18 M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
  help: 'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0 M9 8a3 3 0 0 1 6 0c0 3-3 2-3 3 M12 16h.01',
  refresh: 'M20 7a9 9 0 1 0 1 8 M20 2v5h-5',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  lock: 'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4',
};
@Component({
  selector: 'kf-icon',
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path()" /></svg>',
  styles:
    ':host{display:inline-flex;width:1.25em;height:1.25em;flex-shrink:0}svg{width:100%;height:100%}',
})
export class Icon {
  name = input('home');
  path() {
    return paths[this.name()] || paths['home'];
  }
}
