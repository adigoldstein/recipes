import type * as React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { Board } from './board';
import { Skeleton } from './ui/skeleton';

/** Tags shown on a card; the rest collapse into a "+N" pill. */
export const CARD_TAG_LIMIT = 2;

export interface RecipeCardProps {
  title: string;
  /** Tag names in display order. */
  tags: readonly string[];
  /** Accessible name for the "+N" pill, e.g. "ועוד 3 תגיות". */
  overflowLabel?: (hidden: number) => string;
  /** Total time, already formatted; leave out when unknown. */
  time?: string;
  /** Photo URL; without one there is no placeholder and the title is larger. */
  photoUrl?: string;
  /**
   * Renders the card's one link around the content. The app passes a router
   * link; this lib imports no router.
   */
  renderLink: (props: {
    className: string;
    children: React.ReactNode;
  }) => React.ReactElement;
  className?: string;
}

/** A library card: a small board whose whole surface is one link (UX-DR7). */
export function RecipeCard({
  title,
  tags,
  overflowLabel,
  time,
  photoUrl,
  renderLink,
  className,
}: RecipeCardProps) {
  const shown = tags.slice(0, CARD_TAG_LIMIT);
  const hidden = tags.length - shown.length;
  return renderLink({
    className: cn(
      'block h-full rounded-board outline-none transition-transform hover:scale-102 focus-visible:ring-3 focus-visible:ring-ring active:scale-98',
      className,
    ),
    children: (
      <Board data-slot="recipe-card" className="flex h-full flex-col gap-3">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            loading="lazy"
            className="aspect-4/3 w-full rounded-md object-cover"
          />
        ) : null}
        <h2
          dir="auto"
          className={cn(
            'break-words',
            photoUrl ? 'text-title' : 'text-display',
          )}
        >
          {title}
        </h2>
        {shown.length > 0 || time ? (
          <div className="mt-auto flex flex-wrap items-center gap-2 text-label">
            {shown.map((name) => (
              <span
                key={name}
                dir="auto"
                className="rounded-full bg-board-foreground/10 px-3 py-1"
              >
                {name}
              </span>
            ))}
            {hidden > 0 ? (
              <span
                aria-label={overflowLabel?.(hidden)}
                className="rounded-full bg-board-foreground/10 px-3 py-1"
              >
                +{hidden}
              </span>
            ) : null}
            {time ? (
              <span className="ms-auto flex items-center gap-1">
                <Clock aria-hidden="true" className="size-4" />
                <bdi>{time}</bdi>
              </span>
            ) : null}
          </div>
        ) : null}
      </Board>
    ),
  });
}

/** Placeholder with the card's footprint while recipes load. */
export function RecipeCardSkeleton({ className }: { className?: string }) {
  return (
    <Board
      aria-hidden="true"
      data-slot="recipe-card-skeleton"
      className={cn('flex flex-col gap-3', className)}
    >
      <Skeleton className="aspect-4/3 w-full bg-board-foreground/10" />
      <Skeleton className="h-7 w-3/4 bg-board-foreground/10" />
      <Skeleton className="h-6 w-1/2 bg-board-foreground/10" />
    </Board>
  );
}
