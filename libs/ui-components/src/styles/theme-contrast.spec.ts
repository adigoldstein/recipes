import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(import.meta.dirname, 'theme.css'), 'utf8');

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(([, n, v]) => [
      n,
      v,
    ]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Every text-on-surface pair the UI uses (DESIGN.md Colors).
const TEXT_PAIRS: [text: string, surface: string][] = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'card'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['destructive', 'background'],
  ['board-foreground', 'board'],
  ['hint', 'board'],
  ['hint-muted', 'card'],
  ['hint-muted', 'background'],
  ['flag', 'background'],
  ['flag', 'card'],
  ['primary', 'background'],
];

describe.each([':root', '.dark'])('theme %s', (selector) => {
  const theme = tokens(selector);

  it('defines every DESIGN.md colour token', () => {
    expect(Object.keys(theme)).toHaveLength(24);
  });

  it.each(TEXT_PAIRS)('%s on %s meets WCAG AA (4.5:1)', (text, surface) => {
    expect(contrast(theme[text], theme[surface])).toBeGreaterThanOrEqual(4.5);
  });

  it('focus ring is visible on the page and card (3:1)', () => {
    expect(contrast(theme.ring, theme.background)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme.ring, theme.card)).toBeGreaterThanOrEqual(3);
  });

  // WCAG 1.4.11: the edge of an input, select or toggle must be visible
  // wherever a control can sit (page, card, dialog/popover). --border stays a
  // quiet divider and is not used for controls.
  it.each(['background', 'card', 'popover'])(
    'control border (--input) on %s meets non-text contrast (3:1)',
    (surface) => {
      expect(contrast(theme.input, theme[surface])).toBeGreaterThanOrEqual(3);
    },
  );
});
