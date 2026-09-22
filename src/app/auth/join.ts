import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Cloud, errorMessage } from '../core/cloud';
import { Seo } from '../core/seo';
import { TrPipe } from '../core/i18n';
import { Icon } from '../shared/icon';
@Component({
  selector: 'kf-join',
  imports: [FormsModule, RouterLink, Icon, TrPipe],
  template: ` <main id="main" class="join-page">
    <a class="brand" routerLink="/"
      ><span class="brand-symbol"><kf-icon name="home" /></span>{{ 'kofutela.' | tr }}</a
    >
    <section>
      <span class="note-icon"><kf-icon name="home" /></span
      ><span class="eyebrow">{{ 'A space of your own' | tr }}</span>
      <h1>{{ 'You’re invited' | tr }}<br />{{ 'to feel at home.' | tr }}</h1>
      <p>
        {{
          'Connect with your landlord and keep your lease, rent records and updates together.' | tr
        }}
      </p>
      @if (error()) {
        <div class="error" role="alert">{{ error() | tr }}</div>
      }
      @if (!ready()) {
        <div class="loading">{{ 'Checking your account…' | tr }}</div>
      } @else if (!token) {
        <div class="notice">
          {{
            ' This link is missing its invitation. Ask your landlord to share a fresh invitation link. '
              | tr
          }}
        </div>
      } @else if (!cloud.user()?.emailVerified) {
        <div class="notice">
          {{
            ' Sign in and verify the exact email address your landlord invited. Then return to this invitation. '
              | tr
          }}
        </div>
        <div class="form-actions">
          <a class="button secondary" routerLink="/login" [queryParams]="{ returnTo: returnTo }">{{
            'Log in' | tr
          }}</a
          ><a class="button" routerLink="/signup" [queryParams]="{ returnTo: returnTo }">{{
            'Create account' | tr
          }}</a>
        </div>
      } @else {
        <p class="account-email">{{ 'Joining as ' + cloud.user()?.email | tr }}</p>
        <form class="form-stack" (ngSubmit)="accept()">
          <label
            >{{ 'Your name' | tr
            }}<input
              name="displayName"
              [(ngModel)]="displayName"
              required
              maxlength="160"
              autocomplete="name" /></label
          ><button class="button" [disabled]="busy()">
            {{ (busy() ? 'Connecting your home…' : 'Accept invitation') + ' ' | tr
            }}<kf-icon name="arrow" />
          </button>
        </form>
      }
    </section>
    <a routerLink="/help" class="text-link"
      >{{ 'Need a little help? ' | tr }}<kf-icon name="arrow"
    /></a>
  </main>`,
  styles: `
    .join-page {
      max-width: 510px;
      margin: 40px auto;
      padding: 0 24px;
      text-align: center;
    }
    .join-page > section {
      margin: 65px 0 40px;
    }
    .note-icon {
      display: flex;
      margin: 0 auto 25px;
      width: 60px;
      height: 60px;
      font-size: 28px;
    }
    h1 {
      font-size: 45px;
      line-height: 1.1;
      letter-spacing: -2px;
      font-weight: 500;
    }
    p {
      font-size: 14px;
      line-height: 1.8;
      color: var(--muted);
    }
    label {
      text-align: left;
    }
    .form-actions {
      justify-content: center;
    }
    .account-email {
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .join-page > .text-link {
      font-size: 12px;
    }
  `,
})
export class Join {
  cloud = inject(Cloud);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  token = this.route.snapshot.queryParamMap.get('token') || '';
  returnTo = '/join?token=' + encodeURIComponent(this.token);
  displayName = '';
  ready = signal(false);
  busy = signal(false);
  error = signal('');
  private requestId = '';
  constructor() {
    inject(Seo).set('Your invitation home', 'Accept your private tenant invitation.', 'join', true);
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      this.requestId = crypto.randomUUID();
      void this.init();
    }
  }
  async init() {
    try {
      await this.cloud.start();
      this.displayName = this.cloud.user()?.displayName || '';
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.ready.set(true);
    }
  }
  async accept() {
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.cloud.command(
        'acceptInvite',
        { token: this.token, displayName: this.displayName },
        undefined,
        this.requestId,
      );
      localStorage.setItem('kf-workspace', result.id);
      await this.router.navigate(['/app']);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
