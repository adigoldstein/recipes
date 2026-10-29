/** Longest tag name the server accepts (AD-24). */
export const TAG_NAME_MAX_LENGTH = 40;

/**
 * A typed tag name the way the server stores it (AD-24): NFC, trimmed, runs of
 * whitespace collapsed to one space. The form uses it to tell whether a typed name
 * is a tag that already exists; the server stays the authority.
 */
export function normalizeTagName(name: string): string {
  return name.normalize('NFC').split(/\s+/).filter(Boolean).join(' ');
}
