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
      <span class="language-label" id="kofutela-language-label">
        <kf-icon name="globe" />
        <span class="full-label">Language / Langue</span>
        <span class="short-label">Langue</span>
      </span>
      <div
        class="language-options"
        [class.french]="i18n.language() === 'fr'"
        role="group"
        aria-labelledby="kofutela-language-label"
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
    .language-label {
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      font-size: 12px;
      font-weight: 650;
    }
    .language-label kf-icon {
      color: #087f3d;
      font-size: 14px;
    }
    .short-label {
      display: none;
    }
    .language-options {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 1fr;
      width: 178px;
      height: 34px;
      padding: 3px;
      border: 1px solid #d6e3d9;
      border-radius: 11px;
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
      border-radius: 8px;
      background: #fff;
      box-shadow:
        0 1px 4px #102b1b1c,
        0 1px 1px #102b1b0a;
      transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .language-options.french::before {
      transform: translateX(100%);
    }
    button {
      position: relative;
      z-index: 1;
      min-width: 0;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: #52645a;
      font: inherit;
      font-size: 12px;
      font-weight: 650;
      cursor: pointer;
      transition: color 180ms ease;
    }
    button:hover,
    button[aria-pressed='true'] {
      color: #0e5130;
    }
    button:focus-visible {
      outline: 2px solid #087f3d;
      outline-offset: -2px;
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
      .language-label {
        font-size: 11px;
      }
      .language-options {
        width: 170px;
      }
      .language-question {
        right: 12px;
      }
    }
    @media (max-width: 350px) {
      .full-label {
        display: none;
      }
      .short-label {
        display: inline;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .language-options::before,
      button {
        transition: none;
      }
    }
  `,
})
export class LanguageSwitcher {
  readonly i18n = inject(I18n);
}
