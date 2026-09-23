import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Cloud, errorMessage } from '../core/cloud';
import { Seo } from '../core/seo';
import { TrPipe } from '../core/i18n';
import { Icon } from '../shared/icon';
import { LanguageSwitcher } from '../shared/language-switcher';
@Component({
  selector: 'kf-auth',
  imports: [FormsModule, RouterLink, Icon, TrPipe, LanguageSwitcher],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class AuthPage {
  cloud = inject(Cloud);
  private router = inject(Router);
  route = inject(ActivatedRoute);
  private seo = inject(Seo);
  mode = signal('login');
  ready = signal(false);
  busy = signal(false);
  error = signal('');
  notice = signal('');
  verification = signal(false);
  email = '';
  password = '';
  displayName = '';
  accepted = false;
  constructor() {
    this.route.url.subscribe((parts) => {
      this.mode.set(parts[0]?.path || 'login');
      this.error.set('');
      this.notice.set('');
      this.seo.set(
        this.mode() === 'signup' ? 'Make yourself at home' : 'Welcome back',
        'Sign in securely to your Kofutela account.',
        this.mode(),
        true,
      );
    });
    if (isPlatformBrowser(inject(PLATFORM_ID))) void this.init();
  }
  async init() {
    try {
      await this.cloud.start();
      this.verification.set(!!this.cloud.user() && !this.cloud.user()!.emailVerified);
      this.email = this.cloud.user()?.email || '';
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.ready.set(true);
    }
  }
  async submit() {
    this.error.set('');
    this.notice.set('');
    this.busy.set(true);
    try {
      await this.cloud.start();
      if (this.mode() === 'reset') {
        await this.cloud.reset(this.email);
        this.notice.set(
          'If this address has an account, a password-reset email is on its way. Check your inbox and spam folder.',
        );
        return;
      }
      if (this.mode() === 'signup') {
        if (!this.accepted)
          throw new Error('Please acknowledge the pilot terms and privacy notice.');
        await this.cloud.signup(this.email, this.password, this.displayName);
      } else await this.cloud.login(this.email, this.password);
      if (!this.cloud.user()?.emailVerified) {
        this.verification.set(true);
        this.notice.set(
          'Verify your email to protect your portfolio. Check your inbox, then return here.',
        );
      } else await this.continue();
    } catch (e) {
      this.error.set(errorMessage(e));
      if (this.cloud.user() && !this.cloud.user()?.emailVerified) this.verification.set(true);
    } finally {
      this.busy.set(false);
    }
  }
  async verify() {
    this.busy.set(true);
    this.error.set('');
    try {
      if (await this.cloud.checkVerification()) await this.continue();
      else
        this.notice.set(
          'Your email is not verified yet. Open the link in your email, then try again.',
        );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async resend() {
    this.busy.set(true);
    try {
      await this.cloud.sendVerification();
      this.notice.set('Verification email sent. Check your inbox and spam folder.');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async switchAccount() {
    await this.cloud.logout();
    this.verification.set(false);
    this.password = '';
    this.notice.set('');
  }
  private async continue() {
    const target = this.route.snapshot.queryParamMap.get('returnTo');
    await this.router.navigateByUrl(
      target && /^\/(app|join|admin|super-admin)(\/|\?|$)/.test(target) ? target : '/app',
    );
  }
}
