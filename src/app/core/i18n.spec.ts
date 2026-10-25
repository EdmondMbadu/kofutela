import { PLATFORM_ID, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { I18n } from './i18n';
import { CONTEXT_LABELS, CONTEXT_ENGLISH, TranslationContext } from './translation-context';
import { FRENCH } from './translations';
import { Cloud } from './cloud';
import { Seo } from './seo';
import { Workspace } from '../workspace/workspace';
import { formSpec } from '../workspace/forms';

describe('French rental vocabulary', () => {
  let i18n: I18n;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: PLATFORM_ID, useValue: 'server' }],
    });
    i18n = TestBed.inject(I18n);
    i18n.use('fr', false);
  });
  it('uses precise property, rental and payment terminology', () => {
    for (const [source, expected] of Object.entries({
      Properties: 'Propriétés',
      Property: 'Propriété',
      Portfolio: 'Parc immobilier',
      Unit: 'Logement / local',
      'Property name': 'Nom de la propriété',
      'Add property': 'Ajouter une propriété',
      'Rent records': 'Suivi des loyers',
      'Record receipt': 'Enregistrer un paiement',
      'Reverse receipt': 'Annuler l’enregistrement',
      Outstanding: 'Reste à payer',
      'The receipt history': 'Historique des paiements',
      'Rent for': 'Loyers pour',
      'Tenants & leases': 'Locataires',
      'Tenants and leases': 'Locataires',
      'Add lease': 'Ajouter un locataire',
      'End lease': 'Terminer la location',
      'Close this chapter.': 'Terminer la location',
      'Lease start': 'Début de la location',
      'Lease end': 'Fin de la location prévue',
      'Active leases': 'Locations en cours',
    }))
      expect(i18n.t(source)).withContext(source).toBe(expected);
  });
  it('translates every domain label and keeps the English version available', () => {
    for (const [context, labels] of Object.entries(CONTEXT_LABELS)) {
      for (const [value, label] of Object.entries(labels)) {
        expect(FRENCH[label]).withContext(`${context}:${value}`).toBeTruthy();
        i18n.use('fr', false);
        expect(i18n.t(value, context as TranslationContext)).toBe(FRENCH[label]);
        i18n.use('en', false);
        expect(i18n.t(value, context as TranslationContext)).toBe(
          CONTEXT_ENGLISH[context as TranslationContext]?.[value] || label,
        );
      }
    }
  });
  it('distinguishes payment, maintenance, support and occupancy states', () => {
    expect(i18n.t('recorded', 'rent')).toBe('Payé');
    expect(i18n.t('recorded', 'receipt')).toBe('Enregistré');
    expect(i18n.t('due', 'rent')).toBe('À payer');
    expect(i18n.t('partial', 'rent')).toBe('Partiellement payé');
    expect(i18n.t('new', 'maintenance')).toBe('Signalée');
    expect(i18n.t('acknowledged', 'maintenance')).toBe('Prise en charge');
    expect(i18n.t('closed', 'support')).toBe('Fermée');
    expect(i18n.t('occupied', 'unit')).toBe('Loué');
    expect(i18n.t('mobile_money', 'payment-method')).toBe('Mobile Money');
    expect(i18n.t('bank', 'payment-method')).toBe('Virement bancaire');
    expect(i18n.t('ready', 'document')).toBe('Disponible');
    expect(i18n.t('Properties', 'rent')).toBe('Properties');
    expect(i18n.t('connected', 'tenant-access')).toBe('Invitation acceptée');
    expect(i18n.t('pending', 'tenant-access')).toBe('Invitation envoyée');
    expect(i18n.t('not_invited', 'tenant-access')).toBe('À inviter');
  });
  it('handles French agreements, validation messages and invitation details', () => {
    expect(i18n.t('1 properties · 1 units')).toBe('1 propriété · 1 logement ou local');
    expect(i18n.t('2 properties · 3 units')).toBe('2 propriétés · 3 logements ou locaux');
    expect(i18n.t('Please complete: Property name.')).toBe(
      'Veuillez compléter : Nom de la propriété.',
    );
    expect(
      i18n.t(
        'Share this link privately with tenant@example.test. It expires in seven days and replaces any previous invitation.',
      ),
    ).toContain('tenant@example.test');
    expect(i18n.t('Due day must be between 1 and 28.')).toContain('jour de paiement du loyer');
  });
  it('translates activity descriptions while preserving embedded names', () => {
    expect(i18n.activity('createProperty', 'Added Properties')).toBe(
      'Propriété ajoutée : Properties',
    );
    expect(i18n.activity('createLease', 'Lease created for Normal')).toBe(
      'Location ajoutée pour Normal',
    );
    expect(i18n.activity('updateMaintenance', 'Maintenance moved to in progress')).toBe(
      'Demande de réparation : En cours',
    );
    expect(i18n.activity('unknown', 'Properties')).toBe('Properties');
  });
  it('marks record names in selectors as data rather than translation keys', () => {
    const options = {
      units: [{ id: 'u', propertyId: 'p', label: 'Normal' }],
      properties: [{ id: 'p', name: 'Properties' }],
      leases: [{ id: 'l', tenantName: 'Open', propertyName: 'Properties', unitLabel: 'Normal' }],
      owner: true,
    };
    for (const action of ['createUnit', 'createLease', 'createMaintenance', 'uploadDocument']) {
      const select = formSpec(action, options).fields.find((field) =>
        ['propertyId', 'unitId', 'leaseId'].includes(field.key),
      );
      expect(select?.options?.every((option) => option.translate === false)).toBeTrue();
    }
  });
});

describe('French screens preserve account data', () => {
  async function screen(section: string) {
    const saveBlob = jasmine.createSpy('saveBlob');
    await TestBed.configureTestingModule({
      imports: [Workspace],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: Seo, useValue: { set() {} } },
        {
          provide: Cloud,
          useValue: {
            user: signal({
              uid: 'owner',
              emailVerified: true,
              displayName: 'Normal',
              email: 'normal@example.test',
            }),
            session: signal(null),
            saveBlob,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ section })), snapshot: { data: {} } },
        },
      ],
    }).compileComponents();
    TestBed.inject(I18n).use('fr', false);
    const fixture = TestBed.createComponent(Workspace);
    const page = fixture.componentInstance;
    page.org.set({ id: 'org', name: 'Properties', currency: 'USD' });
    page.ready.set(true);
    page.leaseId = 'lease';
    page.data.set({
      properties: [
        {
          id: 'property',
          name: 'Record receipt',
          address: '1 Test Street',
          city: 'Open',
          type: 'commercial',
          notes: 'Due',
        },
      ],
      units: [
        {
          id: 'unit',
          propertyId: 'property',
          label: 'Resolved',
          currency: 'USD',
          rentMinor: 10000,
        },
      ],
      leases: [
        {
          id: 'lease',
          tenantName: 'Open',
          propertyName: 'Record receipt',
          unitLabel: 'Resolved',
          status: 'active',
        },
      ],
      messages: [{ id: 'message', body: 'Properties', authorName: 'Normal' }],
      support: [
        {
          id: 'ticket',
          status: 'open',
          subject: 'Properties',
          body: 'Record receipt',
          reply: 'Normal',
        },
      ],
      charges: [
        {
          id: 'charge',
          period: '2026-10',
          tenantName: 'Open',
          propertyName: 'Properties',
          unitLabel: 'Normal',
          currency: 'USD',
          amountMinor: 10000,
          receivedMinor: 10000,
          dueDate: '2026-10-05',
        },
      ],
    });
    fixture.detectChanges();
    return { fixture, page, saveBlob, element: fixture.nativeElement as HTMLElement };
  }
  it('localizes labels without changing property names, addresses or unit names', async () => {
    const { element } = await screen('properties');
    expect(element.textContent).toContain('Propriétés');
    expect(element.textContent).toContain('Record receipt');
    expect(element.textContent).toContain('Open');
    expect(element.textContent).toContain('Due');
    expect(element.textContent).toContain('Resolved');
    expect(element.textContent).toContain('Local commercial');
    expect(element.textContent).toContain('Properties');
  });
  it('keeps messages and author names in their original language', async () => {
    const { element } = await screen('messages');
    expect(element.querySelector('.message-bubble')?.textContent).toContain('Properties');
    expect(element.querySelector('.message-bubble')?.textContent).toContain('Normal');
  });
  it('uses everyday wording throughout the tenant and end-of-rental flow', async () => {
    const { page, fixture, element } = await screen('tenants');
    expect(element.querySelector('a[href="/app/tenants"]')?.textContent?.trim()).toBe('Locataires');
    expect(element.textContent).toContain('Ajouter un locataire');
    expect(element.textContent).toContain('Locations en cours');
    expect(element.textContent).toContain('Terminer la location');
    expect(element.textContent).toContain('À inviter');
    page.open('endLease', {
      id: 'lease',
      status: 'active',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    fixture.detectChanges();
    const dialog = element.querySelector('dialog');
    expect(dialog?.querySelector('h2')?.textContent).toBe('Terminer la location');
    expect(dialog?.textContent).toContain('Date de fin de la location');
    expect(dialog?.textContent).toContain('Pourquoi cette location se termine-t-elle ?');
    expect(dialog?.textContent).not.toContain('bail');
  });
  it('translates authored demo examples while leaving edited demo content untouched', async () => {
    const { page } = await screen('messages');
    const sample = { body: 'Your landlord', sampleCopy: { body: 'Your landlord' } };
    expect(page.displayText(sample, 'body')).toBe('Your landlord');
    page.demo = true;
    expect(page.displayText(sample, 'body')).toBe('Votre propriétaire');
    sample.body = 'Properties';
    expect(page.displayText(sample, 'body')).toBe('Properties');
  });
  it('translates support status while preserving ticket text and replies', async () => {
    const { element } = await screen('support');
    const ticket = element.querySelector('.ticket');
    expect(ticket?.textContent).toContain('Ouverte');
    expect(ticket?.textContent).toContain('Properties');
    expect(ticket?.textContent).toContain('Record receipt');
    expect(ticket?.textContent).toContain('Normal');
  });
  it('exports French payment labels and leaves account records unchanged', async () => {
    const { page, saveBlob } = await screen('reports');
    page.exportCsv();
    const csv = await (saveBlob.calls.mostRecent().args[0] as Blob).text();
    expect(csv).toContain(
      '"Propriété","Logement / local","Devise","Loyer dû","Paiements enregistrés","Reste à payer","État du paiement"',
    );
    expect(csv).toContain('"Open","Properties","Normal"');
    expect(csv).toContain('"Payé"');
    expect(page.rows('charges')[0].propertyName).toBe('Properties');
  });
});
