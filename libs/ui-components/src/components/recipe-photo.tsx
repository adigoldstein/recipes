import { cn } from '../lib/utils';

export interface RecipePhotoProps {
  src: string;
  /** What the picture shows, for a screen reader (the recipe's title is not enough alone). */
  alt: string;
  /** The credit line, already worded, e.g. "מקור: example.com". Left out when none. */
  credit?: string;
  className?: string;
}

/**
 * The recipe's photo on the detail page (UX-DR8): board-shaped, with the handle slot
 * cut through the picture, 4:3 on a phone and 16:9 from `lg`. It is at the top of the
 * page, so it loads at once; width and height are set so the page does not jump.
 */
export function RecipePhoto({ src, alt, credit, className }: RecipePhotoProps) {
  return (
    <figure
      data-slot="recipe-photo"
      className={cn('flex flex-col gap-2', className)}
    >
      <div className="relative overflow-hidden rounded-board">
        <img
          src={src}
          alt={alt}
          width={1600}
          height={1200}
          fetchPriority="high"
          className="aspect-4/3 w-full object-cover lg:aspect-video"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-3 mx-auto h-3 w-11 rounded-full bg-background"
        />
      </div>
      {credit ? (
        <figcaption className="text-label text-muted-foreground">
          {credit}
        </figcaption>
      ) : null}
    </figure>
  );
}
