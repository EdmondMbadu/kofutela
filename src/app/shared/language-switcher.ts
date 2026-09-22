import { Component, inject } from '@angular/core';
import { I18n } from '../core/i18n';
import { Icon } from './icon';

@Component({
  selector: 'kf-language-switcher',
  imports: [Icon],
  template: `
    <div class="language-switcher">
      @if (i18n.choiceNeeded()) {
        <p class="language-question">Choose your language / Choisissez votre langue</p>
      }
      <label for="kofutela-language"><kf-icon name="globe" /> Language / Langue</label>
      <select
        id="kofutela-language"
        aria-label="Language / Langue"
        [value]="i18n.language()"
        (change)="i18n.select($any($event.target).value)"
      >
        <option value="en">English</option>
        <option value="fr">Français</option>
      </select>
    </div>
  `,
  styles: `
    :host {
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      min-height: 46px;
      padding: 5px max(24px, env(safe-area-inset-right));
      border-bottom: 1px solid #e0e9e1;
      background: #f8fbf7;
    }
    .language-switcher {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #111b21;
    }
    label {
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      font-size: 12px;
      font-weight: 650;
    }
    label kf-icon {
      color: #087f3d;
      font-size: 14px;
    }
    select {
      width: auto;
      min-width: 105px;
      min-height: 32px;
      border: 1px solid #cbdccd;
      border-radius: 8px;
      padding: 4px 8px;
      background: #fff;
      color: #111b21;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .language-question {
      position: absolute;
      right: 24px;
      top: calc(100% + 8px);
      width: max-content;
      max-width: min(290px, calc(100vw - 36px));
      margin: 0;
      padding: 10px 14px;
      border-radius: 12px;
      background: #111b21;
      color: white;
      font-size: 12px;
      line-height: 1.4;
      box-shadow: 0 8px 28px #111b2129;
    }
    @media (max-width: 520px) {
      :host {
        min-height: 46px;
        padding: 4px max(12px, env(safe-area-inset-right));
      }
      label {
        font-size: 11px;
      }
      select {
        min-width: 94px;
        font-size: 12px;
      }
      .language-question {
        right: 12px;
      }
    }
  `,
})
export class LanguageSwitcher {
  readonly i18n = inject(I18n);
}
