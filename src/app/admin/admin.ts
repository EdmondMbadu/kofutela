import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Cloud, errorMessage, Row } from '../core/cloud';
import { Seo } from '../core/seo';
import { TrPipe } from '../core/i18n';
import { Icon } from '../shared/icon';
import { LanguageSwitcher } from '../shared/language-switcher';
@Component({
  selector: 'kf-admin',
  imports: [FormsModule, RouterLink, Icon, TrPipe, LanguageSwitcher],
  template: ` <main id="main" class="admin-page">
    <header>
      <a class="brand" routerLink="/"
        ><span class="brand-symbol"><kf-icon name="home" /></span>{{ 'kofutela.' | tr }}</a
      >
      <div class="admin-header-actions">
        <kf-language-switcher /><a class="button secondary small" routerLink="/app"
          >{{ 'Back to my space ' | tr }}<kf-icon name="arrow"
        /></a>
      </div>
    </header>
    <span class="eyebrow">{{ 'Platform operations' | tr }}</span>
    <h1>{{ 'A thoughtful eye on things.' | tr }}</h1>
    <p>
      {{
        ' Support, account access and a small, useful view of the pilot. Financial records remain in their own portfolios. '
          | tr
      }}
    </p>
    @if (error()) {
      <div class="error" role="alert">{{ error() | tr }}</div>
    }
    @if (notice()) {
      <div class="success" role="status">{{ notice() | tr }}</div>
    }
    @if (busy() && !overview()) {
      <div class="loading">{{ 'Checking your access…' | tr }}</div>
    }
    @if (overview(); as data) {
      <div class="admin-stats">
        <article>
          <span>{{ 'Accounts' | tr }}</span
          ><strong>{{ data.accounts | tr }}</strong>
        </article>
        <article>
          <span>{{ 'Portfolios' | tr }}</span
          ><strong>{{ data.portfolios | tr }}</strong>
        </article>
        <article>
          <span>{{ 'Your role' | tr }}</span
          ><strong class="role">{{ data.role | tr }}</strong>
        </article>
      </div>
      <div class="section-title">
        <h2>{{ 'Support inbox' | tr }}</h2>
        <button class="button secondary small" [disabled]="busy()" (click)="load()">
          <kf-icon name="refresh" />{{ 'Refresh ' | tr }}
        </button>
      </div>
      <p class="muted">
        {{
          ' Latest 50 requests. Replies appear in the requester’s account; no email is sent. ' | tr
        }}
      </p>
      <div class="admin-tickets">
        @for (ticket of data.tickets; track ticket.id) {
          <article>
            <div class="ticket-heading">
              <span class="badge">{{ ticket.status | tr }}</span
              ><small>{{ ticket.email | tr }}</small>
            </div>
            <h3>{{ ticket.subject | tr }}</h3>
            <p class="message">{{ ticket.body | tr }}</p>
            <form class="form-stack" (ngSubmit)="reply(ticket)">
              <label
                >{{ 'Reply' | tr
                }}<textarea
                  [name]="'reply-' + ticket.id"
                  [(ngModel)]="ticket.reply"
                  required
                  maxlength="4000"
                ></textarea></label
              ><label
                >{{ 'Status' | tr
                }}<select [name]="'status-' + ticket.id" [(ngModel)]="ticket.status">
                  <option value="open">{{ 'Open' | tr }}</option>
                  <option value="closed">{{ 'Closed' | tr }}</option>
                </select></label
              ><button class="button small" [disabled]="busy()">{{ 'Save reply' | tr }}</button>
            </form>
          </article>
        } @empty {
          <div class="empty">
            <kf-icon name="check" />
            <h3>{{ 'All quiet in the inbox.' | tr }}</h3>
            <p>{{ 'New support requests will appear here.' | tr }}</p>
          </div>
        }
      </div>
      @if (data.role === 'superadmin') {
        <section class="role-panel">
          <span class="eyebrow">{{ 'Super administrator' | tr }}</span>
          <h2>{{ 'Trusted access, explicitly granted.' | tr }}</h2>
          <p>
            {{
              ' Only grant access to people you trust. Administrators can read and answer support requests. Super administrators can also grant and revoke platform roles. Your own role cannot be changed here. '
                | tr
            }}
          </p>
          <form class="role-form" (ngSubmit)="grant()">
            <label
              >{{ 'Existing account ID' | tr
              }}<input
                name="uid"
                [(ngModel)]="uid"
                required
                pattern="[a-zA-Z0-9_-]{1,128}"
                maxlength="128"
                placeholder="{{ 'Account ID from the user’s Settings page' | tr }}" /></label
            ><label
              >{{ 'Platform role' | tr
              }}<select name="role" [(ngModel)]="role">
                <option value="admin">{{ 'Administrator' | tr }}</option>
                <option value="superadmin">{{ 'Super administrator' | tr }}</option>
                <option value="none">{{ 'Revoke platform access' | tr }}</option>
              </select></label
            ><label class="confirm"
              ><input type="checkbox" name="confirmed" [(ngModel)]="confirmed" required />{{
                'I have verified this account and intend to change its platform access.' | tr
              }}</label
            ><button class="button small" [disabled]="busy()">
              {{ 'Apply role change' | tr }}
            </button>
          </form>
          <h3>{{ 'Current platform access' | tr }}</h3>
          @for (admin of data.admins; track admin.id) {
            <div class="admin-row">
              <code>{{ admin.id | tr }}</code
              ><span class="badge">{{ admin.role | tr }}</span>
            </div>
          }
        </section>
      }
      <section class="audit">
        <h2>{{ 'Recent platform activity' | tr }}</h2>
        @for (event of data.activity; track event.id) {
          <p>
            <strong>{{ event.action | tr }}</strong> {{ '· ' + event.entityId | tr
            }}<small>{{ 'Actor: ' + event.actorUid | tr }}</small>
          </p>
        } @empty {
          <p>{{ 'No platform actions recorded yet.' | tr }}</p>
        }
      </section>
    } @else if (!busy()) {
      <div class="notice">
        {{
          ' This space requires an explicitly granted platform role. Sign in with the verified project-owner account to initialize the first super administrator. '
            | tr
        }}
      </div>
    }
  </main>`,
  styleUrl: './admin.css',
})
export class Admin {
  cloud = inject(Cloud);
  router = inject(Router);
  overview = signal<Row>(null);
  error = signal('');
  notice = signal('');
  busy = signal(true);
  uid = '';
  role = 'admin';
  confirmed = false;
  constructor() {
    inject(Seo).set('Platform administration', 'Private platform operations.', 'admin', true);
    if (isPlatformBrowser(inject(PLATFORM_ID))) void this.init();
  }
  async init() {
    try {
      await this.cloud.start();
      if (!this.cloud.user()?.emailVerified) {
        await this.router.navigate(['/login'], { queryParams: { returnTo: '/admin' } });
        return;
      }
      await this.cloud.refreshSession();
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async load() {
    this.busy.set(true);
    this.error.set('');
    try {
      this.overview.set(await this.cloud.call('adminOverview', {}));
    } catch (e) {
      this.error.set(errorMessage(e));
      this.overview.set(null);
    } finally {
      this.busy.set(false);
    }
  }
  async reply(ticket: Row) {
    this.busy.set(true);
    try {
      await this.cloud.command('updateSupport', {
        ticketId: ticket.id,
        reply: ticket.reply,
        status: ticket.status,
      });
      this.notice.set('Reply saved to the requester’s support page.');
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async grant() {
    if (!this.confirmed) return;
    this.busy.set(true);
    try {
      await this.cloud.command('setPlatformRole', { uid: this.uid.trim(), role: this.role });
      this.notice.set('Platform access updated and recorded in the audit history.');
      this.uid = '';
      this.confirmed = false;
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
