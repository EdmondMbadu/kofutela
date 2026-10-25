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
import { CONTEXT_LABELS, CONTEXT_ENGLISH, TranslationContext } from './translation-context';

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

  t(value: unknown, context?: TranslationContext): string {
    if (value == null) return '';
    let source = String(value);
    if (context) {
      const labels: Readonly<Record<string, string>> = CONTEXT_LABELS[context];
      const label = labels[source];
      if (!label) return source;
      if (this.language() === 'en') return CONTEXT_ENGLISH[context]?.[source] || label;
      source = label;
    }
    if (this.language() === 'en') return source;
    const key = source.trim().replace(/\s+/g, ' ');
    const translated = FRENCH[key] || this.dynamic(key);
    return translated
      ? `${source.match(/^\s*/)?.[0] || ''}${translated}${source.match(/\s*$/)?.[0] || ''}`
      : source;
  }

  activity(action: string, detail: string): string {
    if (this.language() === 'en') return detail;
    const added = detail.match(/^Added (.+)$/s);
    if (added && ['createProperty', 'createUnit'].includes(action))
      return `${this.t(action, 'activity')} : ${added[1]}`;
    const tenant = detail.match(/^Lease created for (.+)$/s);
    if (action === 'createLease' && tenant) return `Location ajoutée pour ${tenant[1]}`;
    const period = detail.match(/^Receipt recorded for (\d{4}-\d{2})$/);
    if (action === 'recordReceipt' && period)
      return `Paiement de loyer enregistré pour ${period[1]}`;
    const repair = detail.match(/^Maintenance: (.+)$/s);
    if (action === 'createMaintenance' && repair)
      return `Demande de réparation créée : ${repair[1]}`;
    const status = detail.match(/^Maintenance moved to (.+)$/);
    if (action === 'updateMaintenance' && status)
      return `Demande de réparation : ${this.t(status[1].replace(/ /g, '_'), 'maintenance')}`;
    const label = this.t(action, 'activity');
    return label === action ? detail : label;
  }

  private dynamic(value: string): string | undefined {
    let match: RegExpMatchArray | null;
    if ((match = value.match(/^Good to see you, (.+)\.$/)))
      return `Ravi de vous revoir, ${match[1]}.`;
    if ((match = value.match(/^(\d+) units in your portfolio$/)))
      return `${match[1]} logement${match[1] === '1' ? '' : 's'} ou ${match[1] === '1' ? 'local' : 'locaux'} dans votre parc immobilier`;
    if ((match = value.match(/^(\d+) properties · (\d+) units$/)))
      return `${match[1]} propriété${match[1] === '1' ? '' : 's'} · ${match[2]} logement${match[2] === '1' ? '' : 's'} ou ${match[2] === '1' ? 'local' : 'locaux'}`;
    if ((match = value.match(/^View as (landlord|tenant)$/)))
      return `Voir comme ${match[1] === 'landlord' ? 'propriétaire' : 'locataire'}`;
    if ((match = value.match(/^of (.+) scheduled this month$/)))
      return `sur ${match[1]} prévus ce mois-ci`;
    if ((match = value.match(/^Joining as (.+)$/))) return `Compte utilisé : ${match[1]}`;
    if ((match = value.match(/^Please complete: (.+)\.$/)))
      return `Veuillez compléter : ${this.t(match[1])}.`;
    if ((match = value.match(/^Check the value for: (.+)\.$/)))
      return `Vérifiez la valeur de : ${this.t(match[1])}.`;
    if ((match = value.match(/^Choose an available option for: (.+)\.$/)))
      return `Choisissez une option disponible pour : ${this.t(match[1])}.`;
    if ((match = value.match(/^([0-9]+) units? · (building|house|apartment|commercial)$/)))
      return `${match[1]} logement${match[1] === '1' ? '' : 's'} ou ${match[1] === '1' ? 'local' : 'locaux'} · ${this.t(match[2], 'property-type')}`;
    if (
      (match = value.match(
        /^Share this link privately with (.+)\. It expires in seven days and replaces any previous invitation\.$/,
      ))
    )
      return `Transmettez ce lien en privé à ${match[1]}. Il est valable sept jours et remplace toute invitation précédente.`;
    if ((match = value.match(/^Unit (\d+)$/))) return `Logement / local ${match[1]}`;
    if (value === 'Main home') return 'Logement principal';
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

  transform(value: unknown, context?: TranslationContext): string {
    return this.i18n.t(value, context);
  }
}
