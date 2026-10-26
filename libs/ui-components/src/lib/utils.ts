import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge only knows Tailwind's default scales; without these, a theme
// size like `text-title` would be read as a colour and drop `text-foreground`.
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
