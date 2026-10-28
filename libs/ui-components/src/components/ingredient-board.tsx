import type * as React from 'react';
import { cn } from '../lib/utils';
import { Board } from './board';
import { Skeleton } from './ui/skeleton';

export interface IngredientBoardProps {
  title: string;
  /** `IngredientLine`s. */
  children: React.ReactNode;
  className?: string;
}

/** The oak board holding a recipe's ingredient lines (UX-DR6). */
export function IngredientBoard({
  title,
  children,
  className,
}: IngredientBoardProps) {
  return (
    <Board
      data-slot="ingredient-board"
      className={cn('flex flex-col gap-2', className)}
    >
      <h2 className="text-title">{title}</h2>
      <ul>{children}</ul>
    </Board>
  );
}

/** Placeholder with the detail page's footprint while the recipe loads. */
export function RecipeDetailSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex flex-col gap-8 lg:flex-row lg:items-start',
        className,
      )}
    >
      <Board className="flex flex-col gap-3 lg:w-board lg:shrink-0">
        <Skeleton className="h-7 w-1/2 bg-board-foreground/10" />
        {Array.from({ length: 5 }, (_, n) => (
          <Skeleton key={n} className="h-6 w-full bg-board-foreground/10" />
        ))}
      </Board>
      <div className="flex flex-1 flex-col gap-3">
        <Skeleton className="h-7 w-1/3" />
        {Array.from({ length: 3 }, (_, n) => (
          <Skeleton key={n} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
