const BACKSLASH = '\\';

/**
 * Returns where to go after login: the `?next=` path, but only if it stays on this
 * site. Anything else (another host, `//host`, `/\host`, a script URL) becomes `/`,
 * so a fake login link cannot send the user to another site after they log in.
 */
export function safeNext(next: string | null): string {
  if (
    next === null ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    // Browsers remove tabs and new lines, and treat a backslash like a slash, so
    // "/\t/host" and "/\host" both mean "//host".
    [...next].some((char) => char.charCodeAt(0) < 0x20 || char === BACKSLASH)
  ) {
    return '/';
  }
  return next;
}
