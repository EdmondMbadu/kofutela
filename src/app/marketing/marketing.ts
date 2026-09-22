import { Component, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Seo } from '../core/seo';
import { Icon } from '../shared/icon';
type Story = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: { title: string; body: string }[];
};
const stories: Record<string, Story> = {
  features: {
    eyebrow: 'A little less admin. A lot more clarity.',
    title: 'One place for the things that matter.',
    intro: 'Your properties, people and records. Finally on the same page.',
    sections: [
      {
        title: 'A home for every property',
        body: 'Organize buildings and individual units. Keep addresses, lease dates, monthly rent and occupancy together, without digging through a spreadsheet.',
      },
      {
        title: 'Rent records you can follow',
        body: 'See what is due and what has been recorded. Log cash, bank or mobile-money receipts, including partial amounts. Corrections preserve the original record and the reason for the change.',
      },
      {
        title: 'Good communication, kept together',
        body: 'Invite tenants to their own space. Share messages, track repair requests from reported to resolved, and keep lease documents attached to the right home.',
      },
      {
        title: 'A clearer picture, month by month',
        body: 'Review recorded rent and outstanding balances in USD or CDF, with each currency kept separate. Export monthly records for your own bookkeeping.',
      },
    ],
  },
  landlords: {
    eyebrow: 'For landlords, near and far',
    title: 'Distance changes your view. Not your peace of mind.',
    intro: 'Built for the owner down the street and the family a continent away.',
    sections: [
      {
        title: 'Start with the homes you have',
        body: 'Create a portfolio, add your properties and units, and enter active leases. You do not need a large operation to benefit from a little more structure.',
      },
      {
        title: 'Give tenants their own space',
        body: 'Send a private invitation to the email on a lease. Each tenant sees their own records, documents and conversation—not your other properties or other tenants.',
      },
      {
        title: 'Keep a record. Keep the relationship.',
        body: 'A shared record helps make conversations clearer. Kofutela documents rent activity; payment arrangements remain directly between you and your tenant.',
      },
    ],
  },
  about: {
    eyebrow: 'Our story',
    title: 'It started with a simple question about home.',
    intro:
      'How do you stay close to your properties—and the people living in them—when life takes you elsewhere?',
    sections: [
      {
        title: 'From one family’s experience',
        body: 'Kofutela grew from Edmond’s father’s experience managing rental property in Kinshasa. Addresses in one place, rent updates in another, and too much important context scattered between conversations.',
      },
      {
        title: 'Built around everyday renting',
        body: 'The name Kofutela means “to rent” in Lingala. We are starting with the practical details: clear records, useful conversations and a simpler way to look after a home.',
      },
      {
        title: 'Starting small, thoughtfully',
        body: 'This is an early pilot, shaped around real landlord and tenant needs. We are building a focused tool for Kinshasa and landlords abroad, then improving it with the people who use it.',
      },
    ],
  },
  security: {
    eyebrow: 'Security & trust',
    title: 'Your records deserve their own front door.',
    intro: 'Private by design. Clear about what we do—and what we do not do.',
    sections: [
      {
        title: 'Access follows the lease',
        body: 'Verified accounts are required for portfolio access. Landlords access their own portfolio; tenants access only their linked leases. Platform support roles do not receive blanket access to rent records or documents.',
      },
      {
        title: 'Important changes are checked on the server',
        body: 'The backend validates financial entries, checks permissions and records corrections. Documents are stored privately and downloaded through authenticated access. Google Firebase provides the underlying authentication and infrastructure.',
      },
      {
        title: 'We never move your money',
        body: 'Kofutela is a record-keeping tool, not a bank, wallet, escrow service or payment processor. A recorded receipt is a statement entered by a landlord—not independent proof that funds moved.',
      },
      {
        title: 'An honest pilot',
        body: 'No service can promise perfect security. Use a unique password and verify your email. Please do not upload identity documents or unnecessary sensitive information during the pilot. Files are not automatically scanned for malware.',
      },
    ],
  },
  privacy: {
    eyebrow: 'Privacy · Pilot notice · 22 September 2026',
    title: 'A clear view of your data.',
    intro:
      'This notice describes the current Kofutela pilot. Contact the operator through in-app support for privacy requests.',
    sections: [
      {
        title: 'What the app stores',
        body: 'Account email and profile name; property and lease details entered by landlords; rent records, maintenance requests, messages and uploaded documents. Operational logs may include account identifiers, request details and error information.',
      },
      {
        title: 'Why, where and with whom',
        body: 'We use this information to operate the app, control access, provide support and investigate issues. Firebase and Google Cloud provide infrastructure; the pilot database, Functions and document storage are configured in us-central1. Authentication and CDN services may process data in other locations. Your landlord and linked tenant can see the records intended for their lease. Support staff see submitted support tickets.',
      },
      {
        title: 'Browser storage, analytics and AI',
        body: 'Essential browser storage keeps you signed in and remembers your workspace. Advertising and analytics tracking are not enabled. Public marketing pages may be indexed by search and permitted AI search crawlers. Private app data is not publicly crawlable or supplied to an AI model by this app.',
      },
      {
        title: 'Retention and your choices',
        body: 'Pilot records remain until removed by the operator; there is no automatic retention schedule yet. Request access, correction, export or deletion through Support in your account. Some records may need to be retained to address disputes or applicable obligations. Only enter information you are authorized to share.',
      },
      {
        title: 'Before a broad launch',
        body: 'The operator’s full business identity, jurisdiction-specific terms and a public privacy contact must be finalized before broad commercial launch. This pilot notice is not a claim of regulatory certification.',
      },
    ],
  },
  terms: {
    eyebrow: 'Terms · Pilot version · 22 September 2026',
    title: 'A few important ground rules.',
    intro:
      'Kofutela is an early rental-management pilot. Use it responsibly and understand its current limits.',
    sections: [
      {
        title: 'Record keeping, not payments or legal advice',
        body: 'The app does not collect, hold, transfer or disburse funds. It does not verify that a recorded payment occurred. Lease entries and exports do not replace a signed agreement, professional advice or your obligations under applicable law.',
      },
      {
        title: 'Your account and your records',
        body: 'Use accurate information, protect your account and only enter data you are authorized to manage. Do not impersonate another person, upload harmful files or attempt to access another portfolio. Landlords are responsible for the accuracy of rent entries and lawful sharing with tenants.',
      },
      {
        title: 'Pilot availability and charges',
        body: 'The current pilot has no in-app subscription or payment collection. Features, limits and availability may change. Keep independent copies of important records. We will communicate any future paid offering before asking you to subscribe.',
      },
      {
        title: 'Problems, exit and future terms',
        body: 'Report issues or request account closure through in-app support. Access may be restricted for abuse or security reasons. Formal commercial terms, operator details and applicable jurisdiction will be finalized before broad launch; nothing here excludes rights that cannot legally be excluded.',
      },
    ],
  },
};
@Component({
  selector: 'kf-marketing',
  imports: [RouterLink, Icon],
  templateUrl: './marketing.html',
  styleUrl: './marketing.css',
})
export class Marketing {
  private route = inject(ActivatedRoute);
  private seo = inject(Seo);
  page = '';
  menu = signal(false);
  story?: Story;
  readonly features = [
    {
      icon: 'building',
      title: 'Every home, in view.',
      text: 'Properties, units and leases. A little organization goes a long way.',
    },
    {
      icon: 'wallet',
      title: 'Rent, without the guesswork.',
      text: 'What’s due. What’s recorded. A clear history of every change.',
    },
    {
      icon: 'message',
      title: 'People, kept in the loop.',
      text: 'Messages, repairs and documents, connected to the right home.',
    },
  ];
  readonly faqs = [
    {
      q: 'Does Kofutela collect rent?',
      a: 'No. You and your tenant arrange payments directly. Kofutela records the activity you enter; it does not process, hold or transfer money.',
    },
    {
      q: 'Can I manage my property from abroad?',
      a: 'Yes. The web app works in a browser on your phone or computer. An internet connection is required to save changes. The pilot is designed around properties in Kinshasa and owners living locally or abroad.',
    },
    {
      q: 'How do tenants join?',
      a: 'A landlord creates a lease with the tenant’s email and shares a private invitation link. The tenant signs in with that email, verifies it and accepts the invitation. Invitations expire after seven days.',
    },
    {
      q: 'Which currencies are supported?',
      a: 'USD and Congolese francs (CDF). Each lease uses one currency. Reports keep currencies separate; there is no currency conversion.',
    },
    {
      q: 'Is there a mobile app?',
      a: 'Kofutela is a responsive web app. Use it directly in your mobile browser; there is no native app to install yet.',
    },
    {
      q: 'What are the current pilot limits?',
      a: 'One owned portfolio per account, leases up to 24 months, and private PDF or image documents up to 10 MB. Monthly rent is entered as a full amount, without automatic prorating. This is an early pilot, not a payment or accounting service.',
    },
  ];
  constructor() {
    this.route.url.subscribe((parts) => {
      this.page = parts.map((x) => x.path).join('/');
      this.story = stories[this.page];
      this.menu.set(false);
      this.seo.set(
        this.story?.title || 'Close to home. Even from afar.',
        this.story?.intro ||
          'A simpler way to manage rental properties, track rent and stay connected to tenants. Built for Kinshasa and landlords abroad.',
        this.page,
      );
    });
  }
}
