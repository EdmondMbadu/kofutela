/** Only resume routes that belong to the signed-in application. */
export function accountDestination(value: string | null | undefined): string {
  if (!value || /[\\\r\n]/.test(value)) return '/app';
  try {
    const base = 'https://kofutela.web.app';
    const url = new URL(value, base);
    if (
      !value.startsWith('/') ||
      value.startsWith('//') ||
      url.origin !== base ||
      !/^\/(app|join|admin|super-admin)(\/|$)/.test(url.pathname)
    )
      return '/app';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/app';
  }
}

export function accountContinueUrl(origin: string, returnTo?: string | null): string {
  const url = new URL('/login', origin);
  url.searchParams.set('returnTo', accountDestination(returnTo));
  return url.href;
}
