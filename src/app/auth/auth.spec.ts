import { PLATFORM_ID, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthPage } from './auth';
import { Cloud } from '../core/cloud';
import { Seo } from '../core/seo';

const account = (emailVerified = false) => ({
  email: 'account@example.test',
  displayName: 'Test Owner',
  emailVerified,
});

describe('Account creation and recovery', () => {
  async function setup(
    mode = 'signup',
    user: ReturnType<typeof account> | null = null,
    returnTo = '/join?token=test-invitation',
    typedEmail = '',
  ) {
    const cloud = {
      user: signal(user),
      session: signal(null),
      start: jasmine.createSpy('start').and.resolveTo(),
      signup: jasmine.createSpy('signup').and.callFake(async () => cloud.user.set(account())),
      login: jasmine.createSpy('login').and.resolveTo(),
      reset: jasmine.createSpy('reset').and.resolveTo(),
      checkVerification: jasmine
        .createSpy('checkVerification')
        .and.callFake(async () => cloud.user()?.emailVerified === true),
      sendVerification: jasmine.createSpy('sendVerification').and.resolveTo(),
      logout: jasmine.createSpy('logout').and.callFake(async () => cloud.user.set(null)),
    };
    await TestBed.configureTestingModule({
      imports: [AuthPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: Cloud, useValue: cloud },
        { provide: Seo, useValue: { set: jasmine.createSpy('set') } },
        {
          provide: ActivatedRoute,
          useValue: {
            url: of([{ path: mode }]),
            snapshot: { queryParamMap: convertToParamMap({ returnTo }) },
          },
        },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(AuthPage);
    const page = fixture.componentInstance;
    page.email = typedEmail;
    await page.init();
    fixture.detectChanges();
    return { page, cloud, navigate, router, fixture };
  }
  it('creates the account, keeps the invitation, and waits for verification', async () => {
    const { page, cloud, navigate } = await setup();
    page.email = 'account@example.test';
    page.password = 'Test-password-123';
    page.displayName = 'Test Owner';
    page.accepted = true;
    await page.submit();
    expect(cloud.signup).toHaveBeenCalledOnceWith(
      page.email,
      'Test-password-123',
      'Test Owner',
      '/join?token=test-invitation',
    );
    expect(page.verification()).toBeTrue();
    expect(page.password).toBe('');
    expect(navigate).not.toHaveBeenCalled();
  });
  it('requires acknowledgement before creating the account', async () => {
    const { page, cloud } = await setup();
    await page.submit();
    expect(cloud.signup).not.toHaveBeenCalled();
    expect(page.error()).toContain('acknowledge');
  });
  it('keeps an email typed while Firebase is still initializing', async () => {
    const { page } = await setup('login', null, '/app', 'typed@example.test');
    expect(page.email).toBe('typed@example.test');
  });
  it('keeps a created account recoverable when the first verification email fails', async () => {
    const { page, cloud } = await setup();
    page.accepted = true;
    cloud.signup.and.callFake(async () => {
      cloud.user.set(account());
      throw { code: 'auth/network-request-failed' };
    });
    await page.submit();
    expect(page.verification()).toBeTrue();
    expect(page.notice()).toContain('account is saved');
    expect(page.error()).toContain('internet');
  });
  it('refreshes verification before entering the invited workspace', async () => {
    const { page, cloud, navigate } = await setup('login', account());
    cloud.checkVerification.and.resolveTo(true);
    await page.verify();
    expect(navigate).toHaveBeenCalledWith('/join?token=test-invitation');
  });
  it('keeps an unverified account out of the workspace', async () => {
    const { page, navigate } = await setup('login', account());
    await page.verify();
    expect(navigate).not.toHaveBeenCalled();
    expect(page.notice()).toContain('not verified yet');
  });
  it('resumes automatically when returning from email verification', async () => {
    const { page, cloud, navigate } = await setup('login', account());
    cloud.checkVerification.and.resolveTo(true);
    spyOn(Date, 'now').and.returnValue(Date.now() + 6000);
    await page.checkOnReturn();
    expect(navigate).toHaveBeenCalledWith('/join?token=test-invitation');
  });
  it('resends with the destination, clears stale errors, and prevents repeated clicks', async () => {
    const { page, cloud } = await setup('login', account());
    page.error.set('Old error');
    await page.resend();
    await page.resend();
    expect(cloud.sendVerification).toHaveBeenCalledOnceWith('/join?token=test-invitation');
    expect(page.error()).toBe('');
    expect(page.resendSeconds()).toBe(60);
  });
  it('redirects an already verified account to its saved destination', async () => {
    const { navigate } = await setup('login', account(true));
    expect(navigate).toHaveBeenCalledWith('/join?token=test-invitation');
  });
  it('keeps password recovery accessible for an unverified account', async () => {
    const { page, cloud, fixture } = await setup('reset', account());
    expect(page.verification()).toBeFalse();
    expect(fixture.nativeElement.querySelector('input[type=email]')).toBeTruthy();
    await page.submit();
    expect(cloud.reset).toHaveBeenCalledWith('account@example.test', '/join?token=test-invitation');
    expect(page.notice()).toContain('If this address has an account');
  });
  it('switches accounts without losing the invitation', async () => {
    const { page, router } = await setup('signup', account());
    await page.switchAccount();
    expect(page.verification()).toBeFalse();
    expect(page.email).toBe('');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnTo: '/join?token=test-invitation' },
    });
  });
  it('shows signout failures and keeps the current verification screen', async () => {
    const { page, cloud } = await setup('login', account());
    cloud.logout.and.rejectWith(new Error('Unable to sign out.'));
    await page.switchAccount();
    expect(page.error()).toBe('Unable to sign out.');
    expect(page.verification()).toBeTrue();
    expect(page.busy()).toBeFalse();
  });
});
