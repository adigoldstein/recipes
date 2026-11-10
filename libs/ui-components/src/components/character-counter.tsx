import { cn } from '../lib/utils';

export interface CharacterCounterProps {
  length: number;
  max: number;
  className?: string;
}

/**
 * Shows "120/500" under a text field. Above the limit it turns to the error color.
 * The field still accepts text (a paste is never cut), and the field's error explains
 * why the form will not save.
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
