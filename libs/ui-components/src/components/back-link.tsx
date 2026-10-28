import type { ReactElement, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from './ui/button';

export interface BackLinkProps {
  label: string;
  /**
   * Renders the router link around the content. The app passes a link to the
   * fallback page with the history behaviour; this lib imports no router.
   */
  link: (children: ReactNode) => ReactElement;
}

/**
 * The back button every page except the library has: an arrow that points to the
 * start of the line (right in Hebrew) and a label, 44 px high.
 */
export function BackLink({ label, link }: BackLinkProps) {
  return (
    <Button asChild variant="ghost" className="w-fit">
      {link(
        <>
          <ArrowRight aria-hidden="true" className="ltr:rotate-180" />
          {label}
        </>,
      )}
    </Button>
  );
}
