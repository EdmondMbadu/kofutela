import { PLATFORM_ID, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { Cloud } from '../core/cloud';
import { Seo } from '../core/seo';
import { Workspace } from './workspace';

describe('Portfolio setup', () => {
  async function setup() {
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
            user: signal({ emailVerified: true, displayName: 'Test Owner' }),
            session: signal(null),
            command: jasmine.createSpy('command').and.resolveTo({ id: 'saved-record' }),
            rows: jasmine.createSpy('rows').and.resolveTo([]),
            document: jasmine.createSpy('document'),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({})), snapshot: { data: {} } },
        },
      ],
    }).compileComponents();
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const page = TestBed.createComponent(Workspace).componentInstance;
    page.org.set({ id: 'test-portfolio' });
    return page;
  }
  it('reconstructs setup progress from persisted records', async () => {
    const page = await setup();
    expect(page.setupComplete()).toBe(2);
    page.data.set({ properties: [{ id: 'home' }], leases: [] });
    expect(page.setupComplete()).toBe(3);
    page.data.set({ properties: [{ id: 'home' }], leases: [{ id: 'lease', status: 'active' }] });
    expect(page.setupComplete()).toBe(4);
    page.data.set({
      properties: [{ id: 'home' }],
      leases: [{ id: 'lease', inviteHash: 'saved-invitation' }],
    });
    expect(page.setupComplete()).toBe(5);
  });
  it('opens each next form and invites the unlinked active tenant', async () => {
    const page = await setup();
    const open = spyOn(page, 'open');
    const invite = spyOn(page, 'invite').and.resolveTo();
    await page.nextSetupStep();
    expect(open).toHaveBeenCalledWith('createProperty');
    page.data.set({ properties: [{ id: 'home' }], leases: [] });
    await page.nextSetupStep();
    expect(open).toHaveBeenCalledWith('createLease');
    const lease = { id: 'lease', status: 'active', tenantUid: null };
    page.data.set({ properties: [{ id: 'home' }], leases: [lease] });
    await page.nextSetupStep();
    expect(invite).toHaveBeenCalledWith(lease);
  });
  it('offers a new lease when only historical leases remain', async () => {
    const page = await setup();
    page.data.set({ properties: [{ id: 'home' }], leases: [{ id: 'old-lease', status: 'ended' }] });
    const open = spyOn(page, 'open');
    expect(page.nextSetupLabel()).toBe('Add a tenant and lease');
    await page.nextSetupStep();
    expect(open).toHaveBeenCalledWith('createLease');
  });
  it('blocks an empty available-unit selector and prefills rent for the chosen unit', async () => {
    const page = await setup();
    page.data.set({ units: [{ id: 'occupied', activeLeaseId: 'lease' }] });
    page.open('createLease');
    expect(page.error()).toContain('available unit');
    expect(page.spec).toBeUndefined();
    page.data.set({
      properties: [{ id: 'home', name: 'Test Home' }],
      units: [
        { id: 'usd-unit', propertyId: 'home', label: 'One', rentMinor: 45025, currency: 'USD' },
        { id: 'cdf-unit', propertyId: 'home', label: 'Two', rentMinor: 800000, currency: 'CDF' },
      ],
    });
    page.open('createLease');
    expect(page.form.unitId).toBe('usd-unit');
    expect(page.form.rent).toBe(450.25);
    page.form.unitId = 'cdf-unit';
    page.leaseUnitChanged();
    expect(page.form.rent).toBe(8000);
    expect(page.form.currency).toBe('CDF');
  });
  it('offers a valid end date instead of the future scheduled end of a lease', async () => {
    const page = await setup();
    page.open('endLease', { id: 'lease', startDate: '2026-01-01', endDate: '2099-12-31' });
    expect(page.form.endDate).toBe(page.form.receivedOn);
    expect(page.form.leaseId).toBe('lease');
  });
  for (const [action, reference] of [
    ['updateProperty', 'propertyId'],
    ['recordReceipt', 'chargeId'],
    ['voidReceipt', 'receiptId'],
    ['updateMaintenance', 'ticketId'],
    ['endLease', 'leaseId'],
  ])
    it(`submits ${action} with the correct record reference`, async () => {
      const page = await setup();
      const cloud = TestBed.inject(Cloud);
      spyOn(page, 'load').and.resolveTo();
      page.open(action, {
        id: 'source-record',
        status: 'new',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });
      Object.assign(page.form, {
        name: 'Updated home',
        address: 'Test address',
        city: 'Kinshasa',
        reason: 'Test correction',
        amount: 12.34,
        note: 'Test update',
      });
      await page.submit();
      const args = (cloud.command as jasmine.Spy).calls.mostRecent().args;
      expect(args[0]).toBe(action);
      expect(args[1][reference]).toBe('source-record');
      expect(args[2]).toBe('test-portfolio');
      expect(args[3]).toMatch(/^[a-f0-9-]{36}$/);
      expect(page.formError()).toBe('');
    });
  it('keeps form values and the original request UUID when retrying a failed save', async () => {
    const page = await setup();
    const command = TestBed.inject(Cloud).command as jasmine.Spy;
    spyOn(page, 'init').and.resolveTo();
    command.and.rejectWith(new Error('Connection interrupted'));
    page.open('createWorkspace');
    page.form.name = 'My portfolio';
    await page.submit();
    const first = command.calls.mostRecent().args;
    expect(page.form.name).toBe('My portfolio');
    expect(page.formError()).toContain('Connection interrupted');
    command.and.resolveTo({ id: 'saved' });
    await page.submit();
    expect(command.calls.mostRecent().args).toEqual(first);
    expect(page.busy()).toBeFalse();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/app', 'dashboard']);
  });
  it('loads support without a portfolio and shows refresh failures', async () => {
    const page = await setup();
    page.org.set(null);
    page.section.set('support');
    const rows = TestBed.inject(Cloud).rows as jasmine.Spy;
    rows.and.resolveTo([{ id: 'ticket', subject: 'Question' }]);
    await page.load();
    expect(page.rows('support')[0].id).toBe('ticket');
    rows.and.rejectWith(new Error('Connection interrupted'));
    await page.load();
    expect(page.error()).toContain('Connection interrupted');
    expect(page.loading()).toBeFalse();
  });
});
