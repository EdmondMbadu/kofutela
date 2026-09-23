import { Component, inject, Input } from '@angular/core';
import { I18n } from '../core/i18n';
import { Icon } from './icon';

@Component({
  selector: 'kf-language-switcher',
  imports: [Icon],
  template: `
    <div class="language-switcher" [class.menu-row]="variant === 'menu'">
      @if (i18n.choiceNeeded() && variant !== 'menu') {
        <p class="language-question">Choose your language / Choisissez votre langue</p>
      }
      @if (variant === 'menu') {
        <span class="language-label"><kf-icon name="globe" /> Language / Langue</span>
      }
      @if (variant !== 'compact') {
        <div
          class="language-options"
          [class.french]="i18n.language() === 'fr'"
          role="group"
          aria-label="Language / Langue"
        >
          <button
            type="button"
            lang="en"
            [attr.aria-pressed]="i18n.language() === 'en'"
            (click)="i18n.select('en')"
          >
            English
          </button>
          <button
            type="button"
            lang="fr"
            [attr.aria-pressed]="i18n.language() === 'fr'"
            (click)="i18n.select('fr')"
          >
            Français
          </button>
        </div>
      }
      @if (variant === 'compact' || variant === 'header') {
        <button
          class="compact-switch"
          [class.header-compact]="variant === 'header'"
          type="button"
          [attr.aria-label]="
            i18n.language() === 'en' ? 'Switch language to French' : 'Passer en anglais'
          "
          (click)="i18n.select(i18n.language() === 'en' ? 'fr' : 'en')"
        >
          <kf-icon name="globe" /><span>{{ i18n.language() === 'en' ? 'EN' : 'FR' }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      flex: none;
    }
    .language-switcher {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
      color: #111b21;
    }
    .language-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 600;
    }
    .language-label kf-icon {
      color: #087f3d;
      font-size: 16px;
    }
    .language-options {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 1fr;
      width: 178px;
      height: 36px;
      padding: 3px;
      border: 1px solid #d6e3d9;
      border-radius: 12px;
      background: #e9f1eb;
      isolation: isolate;
    }
    .language-options::before {
      content: '';
      position: absolute;
      top: 3px;
      bottom: 3px;
      left: 3px;
      width: calc((100% - 6px) / 2);
      border-radius: 9px;
      background: #fff;
      box-shadow: 0 1px 4px #102b1b1c;
      transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .language-options.french::before {
      transform: translateX(100%);
    }
    button {
      position: relative;
      z-index: 1;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: #52645a;
      font: inherit;
      font-size: 12px;
      font-weight: 650;
      cursor: pointer;
    }
    button:hover,
    button[aria-pressed='true'] {
      color: #0e5130;
    }
    button:focus-visible {
      outline: 2px solid #087f3d;
      outline-offset: 2px;
    }
    .compact-switch {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      height: 38px;
      min-width: 57px;
      padding: 0 9px;
      border: 1px solid #d6e3d9;
      border-radius: 11px;
      background: #f4f8f3;
      color: #174d2e;
    }
    .compact-switch kf-icon {
      font-size: 16px;
    }
    .header-compact {
      display: none;
    }
    .menu-row {
      width: 100%;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .language-question {
      position: absolute;
      right: 0;
      top: calc(100% + 10px);
      z-index: 30;
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
    @media (max-width: 1200px) {
      .header-compact {
        display: inline-flex;
      }
      :host:has(.header-compact) .language-options {
        display: none;
      }
    }
    @media (max-width: 390px) {
      .menu-row {
        gap: 5px;
      }
      .menu-row .language-options {
        width: 158px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .language-options::before {
        transition: none;
      }
    }
  `,
})
export class LanguageSwitcher {
  @Input() variant: 'header' | 'menu' | 'compact' | 'inline' = 'header';
  readonly i18n = inject(I18n);
}
