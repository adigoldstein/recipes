import type { ReactNode } from 'react';

/** A page's h1; focusable so the layout can move focus to it on navigation. */
export function PageHeading({ children }: { children: ReactNode }) {
  return (
    <h1 tabIndex={-1} className="pt-8 pb-3 text-title outline-none">
      {children}
    </h1>
  );
}
