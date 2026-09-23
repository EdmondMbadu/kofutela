import { Component, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { I18n, Language } from '../core/i18n';
import { Icon } from './icon';

@Component({
  selector: 'kf-language-switcher',
  imports: [Icon],
  template: `
    <button
      #trigger
      class="language-trigger"
      type="button"
      aria-label="Change language / Changer de langue"
      title="Change language / Changer de langue"
      [attr.aria-expanded]="open()"
      (click)="open.set(!open())"
    >
      <kf-icon name="globe" />
    </button>
    @if (open()) {
      <div class="language-menu" role="group" aria-label="Language / Langue">
        <span class="language-menu-title">Language / Langue</span>
        <button
          type="button"
          lang="en"
          [attr.aria-pressed]="i18n.language() === 'en'"
          (click)="select('en')"
        >
          <span>English</span>
          @if (i18n.language() === 'en') {
            <kf-icon name="check" />
          }
        </button>
        <button
          type="button"
          lang="fr"
          [attr.aria-pressed]="i18n.language() === 'fr'"
          (click)="select('fr')"
        >
          <span>Français</span>
          @if (i18n.language() === 'fr') {
            <kf-icon name="check" />
          }
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
      align-items: center;
      flex: none;
    }
    .language-trigger {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      padding: 0;
      border: 1px solid #d6e3d9;
      border-radius: 12px;
      background: #f4f8f3;
      color: #174d2e;
      font: inherit;
      cursor: pointer;
      transition:
        background 160ms ease,
        border-color 160ms ease;
    }
    .language-trigger kf-icon {
      font-size: 18px;
    }
    .language-trigger:hover,
    .language-trigger[aria-expanded='true'] {
      background: #e9f3eb;
      border-color: #a4c9ac;
    }
    .language-trigger:focus-visible,
    .language-menu button:focus-visible {
      outline: 2px solid #087f3d;
      outline-offset: 3px;
    }
    .language-menu {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      z-index: 100;
      width: 210px;
      padding: 8px;
      border: 1px solid #e1e9e2;
      border-radius: 16px;
      background: #fff;
      box-shadow:
        0 14px 40px #102b1b20,
        0 2px 8px #102b1b0d;
      color: #111b21;
    }
    .language-menu-title {
      display: block;
      padding: 7px 10px 9px;
      color: #68776c;
      font-size: 11px;
      font-weight: 650;
      letter-spacing: 0.02em;
    }
    .language-menu button {
      display: flex;
      width: 100%;
      min-height: 40px;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: #26372c;
      font: inherit;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
    }
    .language-menu button:hover,
    .language-menu button[aria-pressed='true'] {
      background: #edf6ee;
    }
    .language-menu button[aria-pressed='true'] {
      color: #087f3d;
      font-weight: 650;
    }
    .language-menu button kf-icon {
      font-size: 15px;
    }
    @media (prefers-reduced-motion: reduce) {
      .language-trigger {
        transition: none;
      }
    }
  `,
})
export class LanguageSwitcher {
  readonly i18n = inject(I18n);
  readonly open = signal(false);
  private readonly host = inject(ElementRef<HTMLElement>);
  @ViewChild('trigger') trigger?: ElementRef<HTMLButtonElement>;

  select(language: Language) {
    this.i18n.use(language);
    this.open.set(false);
    this.trigger?.nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node))
      this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.open()) {
      this.open.set(false);
      this.trigger?.nativeElement.focus();
    }
  }
}
