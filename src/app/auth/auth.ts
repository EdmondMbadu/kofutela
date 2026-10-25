import { Component, HostListener, inject, OnDestroy, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Cloud, errorMessage } from '../core/cloud';
import { Seo } from '../core/seo';
import { TrPipe } from '../core/i18n';
import { Icon } from '../shared/icon';
import { LanguageSwitcher } from '../shared/language-switcher';
import { accountDestination } from '../core/auth-flow';
@Component({
  selector: 'kf-auth',
  imports: [FormsModule, RouterLink, Icon, TrPipe, LanguageSwitcher],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class AuthPage implements OnDestroy {
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
  resendSeconds = signal(0);
  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;
  private checking = false;
  get returnTo() {
    return accountDestination(this.route.snapshot.queryParamMap.get('returnTo'));
  }
  constructor() {
    this.route.url.subscribe((parts) => {
      this.mode.set(parts[0]?.path || 'login');
      this.error.set('');
      this.notice.set('');
      this.verification.set(
        this.mode() !== 'reset' && !!this.cloud.user() && !this.cloud.user()!.emailVerified,
      );
      this.password = '';
      this.seo.set(
        this.mode() === 'signup'
          ? 'Make yourself at home'
          : this.mode() === 'reset'
            ? 'Reset your password'
            : 'Welcome back',
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
      if (this.destroyed) return;
      if (this.mode() !== 'reset' && this.cloud.user()?.emailVerified) {
        await this.continue();
        return;
      }
      this.verification.set(
        this.mode() !== 'reset' && !!this.cloud.user() && !this.cloud.user()!.emailVerified,
      );
      this.email = this.cloud.user()?.email || '';
      if (this.verification()) await this.checkOnReturn();
      if (!this.destroyed)
        this.timer = setInterval(() => {
          this.resendSeconds.update((seconds) => Math.max(0, seconds - 1));
          if (this.verification() && document.visibilityState === 'visible')
            void this.checkOnReturn();
        }, 1000);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.ready.set(true);
    }
  }
  async submit() {
    if (this.busy() || !this.ready()) return;
    this.error.set('');
    this.notice.set('');
    this.busy.set(true);
    try {
      await this.cloud.start();
      if (this.mode() === 'reset') {
        await this.cloud.reset(this.email, this.returnTo);
        this.notice.set(
          'If this address has an account, a password-reset email is on its way. Check your inbox and spam folder.',
        );
        return;
      }
      if (this.mode() === 'signup') {
        if (!this.accepted)
          throw new Error('Please acknowledge the pilot terms and privacy notice.');
        await this.cloud.signup(this.email, this.password, this.displayName, this.returnTo);
        this.resendSeconds.set(60);
      } else await this.cloud.login(this.email, this.password);
      if (!this.cloud.user()?.emailVerified) {
        this.verification.set(true);
        this.notice.set(
          'Verify your email to protect your portfolio. Check your inbox, then return here.',
        );
      } else await this.continue();
      this.password = '';
    } catch (e) {
      this.error.set(errorMessage(e));
      if (this.mode() !== 'reset' && this.cloud.user() && !this.cloud.user()?.emailVerified) {
        this.verification.set(true);
        this.password = '';
        this.notice.set(
          'Your account is saved. Use “Resend verification email” to request a new link.',
        );
      }
    } finally {
      this.busy.set(false);
    }
  }
  async verify() {
    if (this.busy() || this.checking) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
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
    if (this.busy() || this.resendSeconds()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await this.cloud.sendVerification(this.returnTo);
      this.resendSeconds.set(60);
      this.notice.set('Verification email sent. Check your inbox and spam folder.');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async switchAccount() {
    if (this.busy() || this.checking) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await this.cloud.logout();
      this.verification.set(false);
      this.password = '';
      this.email = '';
      this.displayName = '';
      this.accepted = false;
      this.resendSeconds.set(0);
      await this.router.navigate(['/login'], { queryParams: { returnTo: this.returnTo } });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  @HostListener('window:focus')
  @HostListener('document:visibilitychange')
  async checkOnReturn() {
    if (
      this.destroyed ||
      !this.verification() ||
      this.busy() ||
      this.checking ||
      document.visibilityState === 'hidden'
    )
      return;
    // Poll at most once every five seconds; focusing the page also resumes setup.
    if (Date.now() - this.lastCheck < 5000) return;
    this.lastCheck = Date.now();
    this.checking = true;
    try {
      if (await this.cloud.checkVerification()) {
        if (!this.destroyed) await this.continue();
      } else if (!this.cloud.user()) this.verification.set(false);
    } catch {
      // Manual verification exposes actionable errors; background retries stay quiet.
    } finally {
      this.checking = false;
    }
  }
  private lastCheck = 0;
  ngOnDestroy() {
    this.destroyed = true;
    clearInterval(this.timer);
  }
  private async continue() {
    if (!this.destroyed) await this.router.navigateByUrl(this.returnTo);
  }
}
