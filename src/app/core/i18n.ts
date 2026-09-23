import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectorRef,
  effect,
  inject,
  Injectable,
  Pipe,
  PipeTransform,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { FRENCH } from './translations';

export type Language = 'en' | 'fr';

@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly language = signal<Language>('en');

  initialize() {
    if (!this.browser) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('kf-language');
    } catch {
      // The language switch still works when browser storage is disabled.
    }
    if (saved === 'en' || saved === 'fr') {
      this.use(saved, false);
      return;
    }
    const preferred = navigator.languages?.[0] || navigator.language;
    if (/^fr(-|$)/i.test(preferred)) this.use('fr', false);
    else this.use('en', false);
  }

  use(language: Language, remember = true) {
    this.language.set(language);
    this.document.documentElement.lang = language;
    if (remember && this.browser) {
      try {
        localStorage.setItem('kf-language', language);
      } catch {
        // Browsers with blocked storage can still switch for this page visit.
      }
    }
  }

  select(value: string) {
    if (value === 'en' || value === 'fr') this.use(value);
  }

  t(value: unknown): string {
    if (value == null) return '';
    const source = String(value);
    if (this.language() === 'en') return source;
    const key = source.trim().replace(/\s+/g, ' ');
    const translated = FRENCH[key] || this.dynamic(key);
    return translated
      ? `${source.match(/^\s*/)?.[0] || ''}${translated}${source.match(/\s*$/)?.[0] || ''}`
      : source;
  }

  private dynamic(value: string): string | undefined {
    let match: RegExpMatchArray | null;
    if ((match = value.match(/^Good to see you, (.+)\.$/)))
      return `Ravi de vous revoir, ${match[1]}.`;
    if ((match = value.match(/^(\d+) units in your portfolio$/)))
      return `${match[1]} logements dans votre portefeuille`;
    if ((match = value.match(/^(\d+) properties · (\d+) units$/)))
      return `${match[1]} propriétés · ${match[2]} logements`;
    if ((match = value.match(/^View as (landlord|tenant)$/)))
      return `Voir comme ${match[1] === 'landlord' ? 'propriétaire' : 'locataire'}`;
    if ((match = value.match(/^of (.+) scheduled this month$/)))
      return `sur ${match[1]} prévus ce mois-ci`;
    if ((match = value.match(/^Joining as (.+)$/)))
      return `Vous rejoignez le logement avec ${match[1]}`;
    if ((match = value.match(/^([0-9]+) units? · (building|house|apartment|commercial)$/)))
      return `${match[1]} logement${match[1] === '1' ? '' : 's'} · ${this.t(match[2])}`;
    if ((match = value.match(/^(\d{4}-\d{2}) · Keep the whole picture in view\.$/)))
      return `${match[1]} · Gardez une vue d’ensemble.`;
    return undefined;
  }
}

@Pipe({ name: 'tr', standalone: true, pure: false })
export class TrPipe implements PipeTransform {
  private readonly i18n = inject(I18n);
  private readonly changeDetector = inject(ChangeDetectorRef);

  constructor() {
    effect(() => {
      this.i18n.language();
      this.changeDetector.markForCheck();
    });
  }

  transform(value: unknown): string {
    return this.i18n.t(value);
  }
}
