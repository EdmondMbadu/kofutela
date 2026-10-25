import { PLATFORM_ID, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
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
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({})), snapshot: { data: {} } },
        },
      ],
    }).compileComponents();
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
});
