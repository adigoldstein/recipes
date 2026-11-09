/** The maximum tag name length the server accepts (AD-24). */
export const TAG_NAME_MAX_LENGTH = 40;

/**
 * Cleans a typed tag name the same way the server does (AD-24): Unicode NFC form, no
 * spaces at the ends, and single spaces between words. The form uses it to check if
 * a typed name is an existing tag. The server still makes the real check.
 */
export function normalizeTagName(name: string): string {
  return name.normalize('NFC').split(/\s+/).filter(Boolean).join(' ');
}
