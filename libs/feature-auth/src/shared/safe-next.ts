const BACKSLASH = '\\';

/**
 * Where to go after login: the `?next=` path, but only if it stays on this site.
 * Anything else (another host, `//host`, `/\host`, a script URL) becomes `/`, so a
 * crafted login link cannot send someone elsewhere after they type their password.
 */
export function safeNext(next: string | null): string {
  if (
    next === null ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    // Browsers strip tabs and newlines and treat a backslash like a slash, so
    // "/\t/host" and "/\host" both mean "//host".
    [...next].some((char) => char.charCodeAt(0) < 0x20 || char === BACKSLASH)
  ) {
    return '/';
  }
  return next;
}
