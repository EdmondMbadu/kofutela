import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Seo } from '../core/seo';
import { TrPipe } from '../core/i18n';
import { LanguageSwitcher } from './language-switcher';
@Component({
  selector: 'kf-not-found',
  imports: [RouterLink, TrPipe, LanguageSwitcher],
  template: `<div style="display:flex;justify-content:flex-end;padding:20px">
      <kf-language-switcher variant="compact" />
    </div>
    <main id="main" style="max-width:550px;margin:15vh auto;padding:30px;text-align:center">
      <span class="eyebrow">{{ '404 · A little off the path' | tr }}</span>
      <h1 style="font-size:45px;letter-spacing:-2px">{{ 'Let’s get you home.' | tr }}</h1>
      <p class="muted">{{ 'This page may have moved, or the address is not quite right.' | tr }}</p>
      <a class="button" routerLink="/">{{ 'Back to Kofutela →' | tr }}</a>
    </main>`,
})
export class NotFound {
  constructor() {
    inject(Seo).set('Page not found', 'Let’s get you back to Kofutela.', '404', true);
  }
}
