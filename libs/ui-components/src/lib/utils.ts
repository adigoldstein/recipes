import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge knows only Tailwind's default sizes. Without these, it would think
// a theme size like `text-title` is a color, and remove `text-foreground`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'display',
        'display-lg',
        'title',
        'heading',
        'body',
        'quantity',
        'label',
        'annotation',
      ],
      radius: ['board'],
      container: ['library', 'detail'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
