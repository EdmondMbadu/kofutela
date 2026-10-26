import {
  Component,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Cloud, errorMessage, Row } from '../core/cloud';
import { Seo } from '../core/seo';
import { I18n, TrPipe } from '../core/i18n';
import { Icon } from '../shared/icon';
import { LanguageSwitcher } from '../shared/language-switcher';
import { demoData, DemoSession } from './demo';
import { FormSpec, formSpec, formPayload } from './forms';
export const SECTIONS = [
  'dashboard',
  'properties',
  'tenants',
  'rent',
  'maintenance',
  'messages',
  'documents',
  'reports',
  'settings',
  'support',
];
@Component({
  selector: 'kf-workspace',
  imports: [FormsModule, RouterLink, Icon, TrPipe, LanguageSwitcher],
  templateUrl: './workspace.html',
  styleUrl: './workspace.css',
})
export class Workspace implements OnDestroy {
  cloud = inject(Cloud);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private seo = inject(Seo);
  readonly i18n = inject(I18n);
  private demoSession = inject(DemoSession);
  @ViewChild('dialog') dialog?: ElementRef<HTMLDialogElement>;
  readonly nav = [
    { id: 'dashboard', label: 'Overview', icon: 'grid' },
    { id: 'properties', label: 'Properties', icon: 'building', owner: true },
    { id: 'tenants', label: 'Tenants & leases', icon: 'people', owner: true },
    { id: 'rent', label: 'Rent records', icon: 'wallet' },
    { id: 'maintenance', label: 'Maintenance', icon: 'tool' },
    { id: 'messages', label: 'Messages', icon: 'message' },
    { id: 'documents', label: 'Documents', icon: 'file' },
    { id: 'reports', label: 'Reports', icon: 'chart', owner: true },
  ];
  section = signal('dashboard');
  demo = false;
  demoTenant = false;
  menu = signal(false);
  ready = signal(false);
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  toast = signal('');
  formError = signal('');
  org = signal<Row>(null);
  memberships: Row[] = [];
  role = 'owner';
  data = signal<Record<string, Row[]>>({});
  leaseId = '';
  month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kinshasa',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
  currency = 'USD';
  showDeleted = false;
  search = '';
  message = '';
  capped = false;
  action = '';
  spec?: FormSpec;
  form: Row = {};
  file?: File;
  resultLink = '';
  private requestId = '';
  private generation = 0;
  messageRequest?: string;
  setupSteps() {
    return [
      { label: 'Verify your email', done: !!this.cloud.user()?.emailVerified },
      { label: 'Create your portfolio', done: !!this.org() },
      { label: 'Add your first property', done: this.rows('properties').length > 0 },
      { label: 'Add a tenant and lease', done: this.rows('leases').length > 0 },
      {
        label: 'Invite your tenant',
        done: this.rows('leases').some((lease) => !!lease.inviteHash || !!lease.tenantUid),
      },
    ];
  }
  setupComplete() {
    return this.setupSteps().filter((step) => step.done).length;
  }
  nextSetupLabel() {
    return !this.rows('properties').length
      ? 'Add your first property'
      : !this.rows('leases').some((lease) => lease.status === 'active')
        ? 'Add a tenant and lease'
        : 'Invite your tenant';
  }
  async nextSetupStep() {
    if (this.busy()) return;
    if (!this.rows('properties').length) this.open('createProperty');
    else if (!this.rows('leases').some((lease) => lease.status === 'active'))
      this.open('createLease');
    else {
      const lease = this.rows('leases').find((row) => row.status === 'active' && !row.tenantUid);
      if (lease) await this.invite(lease);
    }
  }
  constructor() {
    this.demo = this.route.snapshot.data['demo'] === true;
    this.route.paramMap.subscribe((p) => {
      const next = p.get('section') || 'dashboard';
      this.section.set(SECTIONS.includes(next) ? next : 'dashboard');
      this.menu.set(false);
      this.search = '';
      this.seo.set(
        this.title(),
        'Your private rental-management workspace.',
        this.demo ? 'demo' : 'app',
        true,
      );
      if (this.ready()) void this.load();
    });
    if (isPlatformBrowser(inject(PLATFORM_ID))) void this.init();
  }
  ngOnDestroy() {
    this.generation++;
  }
  get owner() {
    return this.role === 'owner';
  }
  get base() {
    return this.demo ? '/demo' : '/app';
  }
  title() {
    return (
      this.nav.find((n) => n.id === this.section())?.label ||
      (this.section() === 'support' ? 'Support' : 'Settings')
    );
  }
  rows(key: string, includeDeleted = false) {
    const rows = this.data()[key] || [];
    if (this.demo && this.demoTenant) {
      if (['properties', 'units', 'activity'].includes(key)) return [];
      if (key === 'leases') return rows.filter((r) => r.id === 'l1');
      if (['charges', 'receipts', 'maintenance', 'messages', 'documents'].includes(key))
        return rows.filter((r) => r.leaseId === 'l1');
    }
    if (this.demo && key === 'messages') return rows.filter((r) => r.leaseId === this.leaseId);
    if (!includeDeleted && ['properties', 'units'].includes(key)) {
      const deletedProperties = new Set(
        (this.data()['properties'] || []).filter((p) => p.deletedAt).map((p) => p.id),
      );
      return rows.filter(
        (r) => !r.deletedAt && (key !== 'units' || !deletedProperties.has(r.propertyId)),
      );
    }
    return rows;
  }
  hasDeletedEntries() {
    return ['properties', 'units'].some((key) =>
      this.rows(key, true).some((row) => !!row.deletedAt),
    );
  }
  propertyHasOngoingRental(id: string) {
    return (
      this.rows('units', true).some((u) => u.propertyId === id && !!u.activeLeaseId) ||
      this.rows('leases').some((l) => l.propertyId === id && l.status === 'active')
    );
  }
  displayText(row: Row, field: string): string {
    const value = String(row[field] ?? '');
    return this.demo && row.sampleCopy?.[field] === value ? this.i18n.t(value) : value;
  }
  visible(key: string) {
    const search = this.search.toLowerCase();
    return this.rows(key, key === 'properties' && this.showDeleted).filter(
      (r) =>
        !search ||
        ['name', 'tenantName', 'propertyName', 'title', 'unitLabel', 'city'].some((k) =>
          String(r[k] || '')
            .toLowerCase()
            .includes(search),
        ) ||
        (key === 'properties' &&
          this.propertyUnits(r.id).some((u) => String(u.label).toLowerCase().includes(search))),
    );
  }
  name() {
    return this.demo
      ? this.demoTenant
        ? 'Amara'
        : 'Alex'
      : (
          this.cloud.session()?.profile?.displayName ||
          this.cloud.user()?.displayName ||
          'there'
        ).split(' ')[0];
  }
  money(value: number, currency = this.currency) {
    return new Intl.NumberFormat(this.locale(), {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'CDF' ? 2 : 2,
    }).format((value || 0) / 100);
  }
  date(value: string) {
    return value
      ? new Intl.DateTimeFormat(this.i18n.language() === 'fr' ? 'fr-CD' : 'en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${value}T00:00:00Z`))
      : '—';
  }
  currentLease() {
    return this.rows('leases').find((l) => l.id === this.leaseId);
  }
  status(charge: Row) {
    if (charge.cancelled) return 'cancelled';
    if (charge.receivedMinor >= charge.amountMinor) return 'recorded';
    if (charge.receivedMinor > 0) return 'partial';
    return charge.dueDate <
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kinshasa' }).format(new Date())
      ? 'overdue'
      : 'due';
  }
  statusClass(status: string) {
    return ['recorded', 'resolved', 'closed', 'ready'].includes(status)
      ? 'green'
      : ['overdue', 'urgent'].includes(status)
        ? 'red'
        : ['partial', 'new', 'acknowledged', 'in_progress'].includes(status)
          ? 'orange'
          : '';
  }
  total(field: string) {
    return this.rows('charges')
      .filter((c) => c.currency === this.currency && !c.cancelled)
      .reduce((sum, c) => sum + c[field], 0);
  }
  occupancy() {
    const units = this.rows('units');
    return units.length
      ? Math.round((units.filter((u) => u.activeLeaseId).length / units.length) * 100)
      : 0;
  }
  openRepairs() {
    return this.rows('maintenance').filter((m) => !['closed', 'resolved'].includes(m.status));
  }
  locale() {
    return this.i18n.language() === 'fr' ? 'fr-CD' : 'en-US';
  }
  today() {
    return new Intl.DateTimeFormat(this.locale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Africa/Kinshasa',
    }).format(new Date());
  }
  monthLabel() {
    const [y, m] = (this.month || '').split('-').map(Number);
    if (!y || !m) return this.month;
    return new Intl.DateTimeFormat(this.locale(), {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, 1)));
  }
  monthCharges() {
    return this.rows('charges').filter((c) => c.currency === this.currency && !c.cancelled);
  }
  collected() {
    const total = this.total('amountMinor');
    return total ? Math.min(100, Math.round((this.total('receivedMinor') / total) * 100)) : 0;
  }
  fill(charge: Row) {
    return charge.amountMinor
      ? Math.min(100, (charge.receivedMinor / charge.amountMinor) * 100)
      : 0;
  }
  occupiedUnits() {
    return this.rows('units').filter((u) => u.activeLeaseId).length;
  }
  propertyOccupied(id: string) {
    return this.propertyUnits(id).filter((u) => u.activeLeaseId).length;
  }
  /** Everything that needs the user's attention: unpaid rent first (overdue → partial → due), then open repairs. */
  attention(): { kind: 'rent' | 'repair'; status: string; row: Row }[] {
    const order: Record<string, number> = { overdue: 0, partial: 1, due: 2 };
    const rent = this.rows('charges')
      .filter((c) => !c.cancelled && c.receivedMinor < c.amountMinor)
      .map((c) => ({ kind: 'rent' as const, status: this.status(c), row: c }))
      .sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
    const repairs = this.openRepairs().map((t) => ({
      kind: 'repair' as const,
      status: t.status as string,
      row: t,
    }));
    return [...rent, ...repairs];
  }
  readonly connected = (lease: Row) => !!lease.tenantUid;
  leaseLabel(id: string) {
    const lease = this.rows('leases').find((l) => l.id === id);
    return lease ? `${lease.propertyName} · ${lease.unitLabel}` : id;
  }
  initials(name = '') {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  /** 0 = reported, 1 = being handled, 2 = resolved. */
  ticketStep(status: string) {
    return ['resolved', 'closed'].includes(status)
      ? 2
      : ['acknowledged', 'in_progress'].includes(status)
        ? 1
        : 0;
  }
  repairCount(step: number) {
    return this.rows('maintenance').filter((t) => this.ticketStep(t.status) === step).length;
  }
  activeLeases() {
    return this.rows('leases').filter((l) => l.status === 'active');
  }
  availableUnits() {
    return this.rows('units').filter((unit) => !unit.activeLeaseId);
  }
  activityIcon(action: string) {
    return action === 'recordReceipt' || action === 'voidReceipt'
      ? 'wallet'
      : /aintenance/.test(action || '')
        ? 'tool'
        : /essage/.test(action || '')
          ? 'message'
          : 'check';
  }
  propertyUnits(id: string) {
    return this.rows('units', this.showDeleted).filter((u) => u.propertyId === id);
  }
  canUpdate(ticket: Row) {
    return this.owner || ticket.status === 'resolved';
  }
  async init() {
    this.error.set('');
    try {
      if (this.demo) {
        this.demoTenant = this.demoSession.tenant;
        this.role = this.demoTenant ? 'tenant' : 'owner';
        this.month = this.demoSession.month || this.month;
        this.org.set({ id: 'demo', name: this.demoSession.name, currency: 'USD' });
        this.data.set(this.demoSession.data || demoData(this.month));
        this.demoSession.data = this.data();
        this.leaseId = 'l1';
        this.ready.set(true);
        return;
      }
      await this.cloud.start();
      if (!this.cloud.user() || !(await this.cloud.checkVerification())) {
        await this.router.navigate(['/login'], { queryParams: { returnTo: this.router.url } });
        return;
      }
      const session = await this.cloud.refreshSession();
      this.memberships = session.memberships;
      const selected = localStorage.getItem('kf-workspace');
      const membership = this.memberships.find((m) => m.id === selected) || this.memberships[0];
      if (membership) await this.selectOrg(membership.id);
      else if (this.section() === 'support') await this.loadSupport();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.ready.set(true);
    }
  }
  async selectOrg(id: string) {
    this.error.set('');
    this.loading.set(true);
    const selection = ++this.generation;
    try {
      const membership = this.memberships.find((m) => m.id === id);
      if (!membership) return;
      const organization = await this.cloud.document(`organizations/${id}`);
      if (selection !== this.generation) return;
      if (!organization)
        throw new Error('This portfolio is no longer available. Refresh and select another.');
      this.role = membership.role;
      this.org.set(organization);
      this.data.set({});
      this.message = '';
      this.messageRequest = undefined;
      this.currency = this.org().currency;
      this.leaseId = '';
      localStorage.setItem('kf-workspace', id);
      if (!this.owner && this.nav.find((n) => n.id === this.section())?.owner)
        await this.router.navigate([this.base, 'dashboard']);
      await this.load();
    } catch (e) {
      if (selection === this.generation) this.error.set(errorMessage(e));
    } finally {
      if (selection === this.generation) this.loading.set(false);
    }
  }
  async load() {
    if (this.demo) return;
    if (!this.org()) {
      if (this.section() === 'support') {
        this.loading.set(true);
        this.error.set('');
        try {
          await this.loadSupport();
        } catch (e) {
          this.error.set(errorMessage(e));
        } finally {
          this.loading.set(false);
        }
      }
      return;
    }
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const orgId = this.org().id;
      const path = `organizations/${orgId}`;
      const [properties, units, leases] = await Promise.all([
        this.owner ? this.cloud.rows(`${path}/properties`) : [],
        this.owner ? this.cloud.rows(`${path}/units`) : [],
        this.cloud.rows(
          `${path}/leases`,
          this.owner ? [] : [['tenantUid', this.cloud.user()!.uid]],
        ),
      ]);
      if (generation !== this.generation) return;
      const selected =
        leases.find((l) => l.id === this.leaseId) ||
        leases.find((l) => l.status === 'active') ||
        leases[0];
      this.leaseId = selected?.id || '';
      const scope: [string, unknown][] = this.owner ? [] : [['leaseId', this.leaseId]];
      const noLease = !this.owner && !selected;
      if (!noLease)
        await this.cloud.syncRent(orgId, this.month, this.owner ? undefined : selected.id);
      const [charges, receipts, maintenance, documents, messages, activity, support] =
        await Promise.all([
          noLease ? [] : this.cloud.rows(`${path}/charges`, [...scope, ['period', this.month]]),
          noLease ? [] : this.cloud.rows(`${path}/receipts`, [...scope, ['period', this.month]]),
          noLease ? [] : this.cloud.rows(`${path}/maintenance`, scope),
          noLease
            ? []
            : this.cloud.rows(
                `${path}/documents`,
                this.owner ? [] : [...scope, ['status', 'ready']],
              ),
          this.section() === 'messages' && selected
            ? this.cloud.rows(`${path}/messages`, [['leaseId', this.leaseId]], 50, 'createdAt')
            : [],
          this.owner ? this.cloud.rows(`${path}/activity`, [], 8, 'createdAt') : [],
          this.section() === 'support'
            ? this.cloud.rows('supportTickets', [['uid', this.cloud.user()!.uid]])
            : [],
        ]);
      if (generation !== this.generation) return;
      this.capped = [
        properties,
        units,
        leases,
        charges,
        receipts,
        maintenance,
        documents,
        support,
      ].some((a) => a.length > 500);
      this.data.set({
        properties,
        units,
        leases,
        charges,
        receipts,
        maintenance,
        documents,
        messages: messages.reverse(),
        activity,
        support,
      });
    } catch (e) {
      if (generation === this.generation) this.error.set(errorMessage(e));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  private async loadSupport() {
    this.data.update((d) => ({ ...d, support: [] }));
    const support = await this.cloud.rows('supportTickets', [['uid', this.cloud.user()!.uid]]);
    this.data.update((d) => ({ ...d, support }));
  }
  async periodChange() {
    if (!/^\d{4}-\d{2}$/.test(this.month)) return;
    if (this.demo) {
      this.data.set(demoData(this.month));
      this.demoSession.data = this.data();
      this.demoSession.month = this.month;
    } else await this.load();
  }
  async leaseChanged() {
    this.message = '';
    this.messageRequest = undefined;
    await this.load();
  }
  switchDemo() {
    this.demoTenant = !this.demoTenant;
    this.demoSession.tenant = this.demoTenant;
    this.role = this.demoTenant ? 'tenant' : 'owner';
    this.leaseId = 'l1';
    void this.router.navigate(['/demo', 'dashboard']);
  }
  open(action: string, row?: Row) {
    if (this.busy()) return;
    if (action === 'createLease' && !this.availableUnits().length) {
      this.error.set('Add an available unit before creating a lease.');
      return;
    }
    this.action = action;
    this.formError.set('');
    this.resultLink = '';
    this.file = undefined;
    this.requestId = crypto.randomUUID();
    this.spec = formSpec(action, {
      units: this.rows('units'),
      properties: this.rows('properties'),
      leases: this.rows('leases'),
      status: row?.status,
      owner: this.owner,
    });
    this.form = {
      currency: this.org()?.currency || 'USD',
      city: 'Kinshasa',
      type: 'house',
      unitCount: 1,
      dueDay: 5,
      termType: 'ongoing',
      guaranteeMonths: 0,
      method: 'cash',
      priority: 'normal',
      leaseId: this.leaseId,
      displayName:
        this.cloud.session()?.profile?.displayName || this.cloud.user()?.displayName || '',
      name: action === 'updateWorkspace' ? this.org()?.name : '',
      confirmed: false,
      receivedOn: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kinshasa' }).format(
        new Date(),
      ),
      ...row,
    };
    if (row) {
      if (['updateProperty', 'deleteProperty', 'restoreProperty'].includes(action))
        this.form.propertyId = row.id;
      if (['updateUnit', 'deleteUnit', 'restoreUnit'].includes(action)) this.form.unitId = row.id;
      if (action === 'recordReceipt') this.form.chargeId = row.id;
      if (action === 'voidReceipt') this.form.receiptId = row.id;
      if (action === 'updateMaintenance') this.form.ticketId = row.id;
      if (action === 'endLease') {
        this.form.leaseId = row.id;
        this.form.endDate = [row.endDate || this.form.receivedOn, this.form.receivedOn].sort()[0];
      }
      if (row.rentMinor) this.form.rent = row.rentMinor / 100;
      if (action === 'recordReceipt')
        this.form.amount = (row.amountMinor - row.receivedMinor) / 100;
    }
    for (const field of this.spec.fields)
      if (field.type === 'select' && !field.options?.some((o) => o.value === this.form[field.key]))
        this.form[field.key] = field.options?.[0]?.value || '';
    if (action === 'createLease') this.leaseUnitChanged();
    this.dialog?.nativeElement.showModal();
  }
  close() {
    if (!this.busy()) {
      this.dialog?.nativeElement.close();
      this.resultLink = '';
    }
  }
  fileChosen(event: Event) {
    this.file = (event.target as HTMLInputElement).files?.[0];
  }
  leaseUnitChanged() {
    const unit = this.rows('units').find((row) => row.id === this.form.unitId);
    if (unit) {
      this.form.rent = unit.rentMinor / 100;
      this.form.currency = unit.currency;
    }
  }
  guaranteeTotal() {
    const rent = Math.round(Number(this.form.rent) * 100);
    const months = Number(this.form.guaranteeMonths);
    const total = rent * months;
    return Number.isSafeInteger(rent) &&
      rent > 0 &&
      Number.isSafeInteger(months) &&
      months >= 0 &&
      Number.isSafeInteger(total) &&
      total <= 100_000_000_000
      ? total
      : null;
  }
  rentalEnd(lease: Row) {
    return lease.endDate ? this.date(lease.endDate) : this.i18n.t('Ongoing — no end date');
  }
  guaranteeSummary(lease: Row) {
    if (lease.guaranteeTotalMinor === undefined) return this.i18n.t('Guarantee not recorded');
    return `${this.i18n.t('Guarantee')}${this.i18n.language() === 'fr' ? ' ' : ''}: ${lease.guaranteeMonths} ${this.i18n.t('months')} · ${this.money(lease.guaranteeTotalMinor, lease.currency)}`;
  }
  async submit() {
    if (!this.spec || this.busy()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      const payload: Row = formPayload(this.action, this.spec, this.form);
      if (this.action === 'uploadDocument') {
        if (!this.file) throw new Error('Choose a document first.');
        if (
          this.file.size > 10 * 1024 * 1024 ||
          !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(this.file.type)
        )
          throw new Error('Choose a PDF, JPG, PNG or WebP file no larger than 10 MB.');
        if (this.demo)
          throw new Error(
            'Uploads are disabled in the fictional demo. Create an account to store a real document.',
          );
        await this.cloud.upload(this.file, this.org().id, payload.leaseId, payload.title);
      } else if (this.demo) this.demoCommand(this.action, payload);
      else await this.cloud.command(this.action, payload, this.org()?.id, this.requestId);
      this.dialog?.nativeElement.close();
      this.toast.set(
        this.demo
          ? 'Updated in this demo only. Refreshing starts over.'
          : 'Saved. Everything is up to date.',
      );
      if (
        this.action === 'createWorkspace' ||
        this.action === 'updateProfile' ||
        this.action === 'updateWorkspace'
      ) {
        await this.init();
        if (this.action === 'createWorkspace' && this.org())
          await this.router.navigate([this.base, 'dashboard']);
      } else await this.load();
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async invite(lease: Row) {
    if (this.busy()) return;
    this.error.set('');
    if (this.demo) {
      this.toast.set(
        'In your real portfolio, this creates a private seven-day invitation linked to the tenant’s email. No invitation is sent from the demo.',
      );
      return;
    }
    this.busy.set(true);
    try {
      const result = await this.cloud.command('createInvite', { leaseId: lease.id }, this.org().id);
      this.resultLink = `${location.origin}/join?token=${encodeURIComponent(result.token)}`;
      this.spec = {
        title: 'An invitation to their own space.',
        description: `Share this link privately with ${result.email}. It expires in seven days and replaces any previous invitation.`,
        fields: [],
      };
      this.action = 'invite';
      this.dialog?.nativeElement.showModal();
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async copyInvite() {
    try {
      await navigator.clipboard.writeText(this.resultLink);
      this.toast.set('Invitation link copied. Share it privately with the tenant.');
    } catch {
      this.formError.set('Copy the invitation link from the field above.');
    }
  }
  async sendMessage() {
    if (!this.message.trim() || this.busy() || !this.leaseId) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const payload = { leaseId: this.leaseId, body: this.message.trim() };
      if (this.demo) this.demoCommand('sendMessage', payload);
      else
        await this.cloud.command(
          'sendMessage',
          payload,
          this.org().id,
          (this.messageRequest ||= crypto.randomUUID()),
        );
      this.message = '';
      this.messageRequest = undefined;
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async download(doc: Row) {
    if (this.busy()) return;
    this.error.set('');
    this.busy.set(true);
    try {
      await this.cloud.download(doc);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  exportCsv() {
    const rows = [
      [
        'Period',
        'Tenant',
        'Property',
        'Unit',
        'Currency',
        'Scheduled rent',
        'Recorded payments',
        'Outstanding',
        'Payment status',
      ].map((label) => this.i18n.t(label)),
      ...this.rows('charges').map((c) => [
        c.period,
        c.tenantName,
        c.propertyName,
        c.unitLabel,
        c.currency,
        (c.amountMinor / 100).toFixed(2),
        (c.receivedMinor / 100).toFixed(2),
        ((c.amountMinor - c.receivedMinor) / 100).toFixed(2),
        this.i18n.t(this.status(c), 'rent'),
      ]),
    ];
    // Neutralize spreadsheet formulas in user-entered names before CSV export.
    const safe = (v: Row) => {
      const value = String(v ?? '');
      return `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;
    };
    this.cloud.saveBlob(
      new Blob(['\uFEFF' + rows.map((r) => r.map(safe).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
      `kofutela-${this.month}${this.demo ? '-demo' : ''}.csv`,
    );
  }
  async logout() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.cloud.logout();
      await this.router.navigate(['/login']);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  private demoCommand(action: string, p: Row) {
    const d = structuredClone(this.data());
    const id = crypto.randomUUID();
    const add = (key: string, row: Row) => (d[key] ||= []).push({ ...row, id });
    if (action === 'recordReceipt') {
      const c = d['charges'].find((c) => c.id === p.chargeId);
      if (!p.amountMinor || p.amountMinor < 0 || p.amountMinor > c.amountMinor - c.receivedMinor)
        throw new Error('Enter an amount no greater than the outstanding balance.');
      c.receivedMinor += p.amountMinor;
      add('receipts', {
        ...p,
        leaseId: c.leaseId,
        tenantName: c.tenantName,
        currency: c.currency,
        period: c.period,
        voided: false,
      });
    } else if (action === 'voidReceipt') {
      const r = d['receipts'].find((r) => r.id === p.receiptId);
      if (r.voided) throw new Error('Already reversed.');
      r.voided = true;
      r.voidReason = p.reason;
      d['charges'].find((c) => c.id === r.chargeId).receivedMinor -= r.amountMinor;
    } else if (action === 'createProperty') {
      add('properties', p);
      for (let n = 0; n < p.unitCount; n++)
        d['units'].push({
          id: crypto.randomUUID(),
          propertyId: id,
          label: `Unit ${n + 1}`,
          rentMinor: p.rentMinor,
          currency: p.currency,
          activeLeaseId: null,
        });
    } else if (action === 'updateProperty')
      Object.assign(
        d['properties'].find((r) => r.id === p.propertyId),
        p,
      );
    else if (['deleteProperty', 'restoreProperty'].includes(action)) {
      const property = d['properties'].find((r) => r.id === p.propertyId);
      const restoring = action === 'restoreProperty';
      if (!restoring && this.propertyHasOngoingRental(p.propertyId))
        throw new Error('End all ongoing rentals in this property before deleting it.');
      property.deletedAt = restoring ? null : new Date().toISOString();
      for (const unit of d['units'].filter((u) => u.propertyId === p.propertyId)) {
        if (restoring ? unit.deletedWithProperty : !unit.deletedAt) {
          unit.deletedAt = property.deletedAt;
          unit.deletedWithProperty = !restoring;
        }
      }
    } else if (['updateUnit', 'deleteUnit', 'restoreUnit'].includes(action)) {
      const unit = d['units'].find((r) => r.id === p.unitId);
      if (action === 'updateUnit') Object.assign(unit, p);
      else {
        if (
          action === 'deleteUnit' &&
          (unit.activeLeaseId ||
            d['leases'].some((l) => l.unitId === p.unitId && l.status === 'active'))
        )
          throw new Error('End the ongoing rental before deleting this unit.');
        unit.deletedAt = action === 'restoreUnit' ? null : new Date().toISOString();
        unit.deletedWithProperty = false;
      }
    } else if (action === 'createUnit') add('units', { ...p, activeLeaseId: null });
    else if (action === 'createLease') {
      const unit = d['units'].find((r) => r.id === p.unitId);
      if (!unit || unit.deletedAt || unit.activeLeaseId)
        throw new Error('Choose an available unit.');
      if (p.endDate && p.endDate < p.startDate)
        throw new Error('The end date must follow the start date.');
      unit.activeLeaseId = id;
      const property = d['properties'].find((r) => r.id === unit.propertyId);
      const lease = {
        ...p,
        propertyName: property.name,
        propertyId: property.id,
        unitLabel: unit.label,
        status: 'active',
        guaranteeTotalMinor: p.guaranteeMonths * p.rentMinor,
        guaranteeAppliedMinor: 0,
        tenantUid: null,
      };
      add('leases', lease);
      if (
        p.startDate.slice(0, 7) <= this.month &&
        (!p.endDate || p.endDate.slice(0, 7) >= this.month)
      )
        d['charges'].push({
          ...lease,
          id: `charge-${id}`,
          leaseId: id,
          period: this.month,
          dueDate: `${this.month}-${String(p.dueDay).padStart(2, '0')}`,
          amountMinor: p.rentMinor,
          receivedMinor: 0,
          cancelled: false,
        });
    } else if (action === 'endLease') {
      const lease = d['leases'].find((r) => r.id === p.leaseId);
      lease.status = 'ended';
      lease.endDate = p.endDate;
      d['units'].find((r) => r.id === lease.unitId).activeLeaseId = null;
    } else if (action === 'createMaintenance') {
      const lease = d['leases'].find((r) => r.id === p.leaseId);
      add('maintenance', {
        ...p,
        propertyName: lease.propertyName,
        unitLabel: lease.unitLabel,
        tenantName: lease.tenantName,
        status: 'new',
      });
    } else if (action === 'updateMaintenance')
      Object.assign(
        d['maintenance'].find((r) => r.id === p.ticketId),
        { status: p.status, latestNote: p.note },
      );
    else if (action === 'sendMessage')
      add('messages', {
        ...p,
        authorUid: this.demoTenant ? 'demo-tenant' : 'demo-owner',
        authorName: this.name(),
      });
    else if (action === 'createSupport') add('support', { ...p, status: 'open', reply: '' });
    else if (action === 'updateWorkspace') {
      this.org.update((o) => ({ ...o, name: p.name }));
      this.demoSession.name = p.name;
    }
    this.data.set(d);
    this.demoSession.data = d;
  }
}
