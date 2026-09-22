import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { I18n } from './i18n';
import { SITE_URL } from './site';
@Injectable({ providedIn: 'root' })
export class Seo {
  private title = inject(Title);
  private meta = inject(Meta);
  private doc = inject(DOCUMENT);
  private i18n = inject(I18n);
  private current?: { title: string; description: string; path: string; privatePage: boolean };

  constructor() {
    effect(() => {
      this.i18n.language();
      if (this.current) this.apply();
    });
  }

  set(title: string, description: string, path = '', privatePage = false) {
    this.current = { title, description, path, privatePage };
    this.apply();
  }

  private apply() {
    if (!this.current) return;
    const { path, privatePage } = this.current;
    const title = this.i18n.t(this.current.title);
    const description = this.i18n.t(this.current.description);
    const fullTitle = `${title} | Kofutela`;
    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({
      name: 'robots',
      content: privatePage ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
    });
    for (const [property, content] of Object.entries({
      'og:title': fullTitle,
      'og:description': description,
      'og:type': 'website',
      'og:url': `${SITE_URL}/${path}`,
      'og:site_name': 'Kofutela',
      'og:image': `${SITE_URL}/social-card.png`,
    }))
      this.meta.updateTag({ property, content });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    let canonical = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.doc.createElement('link');
      canonical.rel = 'canonical';
      this.doc.head.appendChild(canonical);
    }
    canonical.href = `${SITE_URL}/${path}`;
    this.doc.getElementById('structured-data')?.remove();
    if (!privatePage) {
      const script = this.doc.createElement('script');
      script.id = 'structured-data';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Kofutela',
        url: SITE_URL,
        description: this.i18n.t(
          'Rental property management and rent tracking for landlords and tenants everywhere.',
        ),
        inLanguage: this.i18n.language(),
      });
      this.doc.head.appendChild(script);
    }
  }
}
