import { afterNextRender, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18n, TrPipe } from './core/i18n';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TrPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly i18n = inject(I18n);
  constructor() {
    afterNextRender(() => this.i18n.initialize());
  }
}
