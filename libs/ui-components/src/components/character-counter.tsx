import { cn } from '../lib/utils';

export interface CharacterCounterProps {
  length: number;
  max: number;
  className?: string;
}

/**
 * "120/500" under a text field. It turns to the error colour past the limit; the
 * field keeps accepting text (a paste is never cut short) and its error says why
 * the form will not save.
 */
export function CharacterCounter({
  length,
  max,
  className,
}: CharacterCounterProps) {
  return (
    <bdi
      dir="ltr"
      className={cn(
        length > max ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      {length}/{max}
    </bdi>
  );
}
