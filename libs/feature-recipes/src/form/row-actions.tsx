import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@bite-and-board/ui-components';

export interface RowActionsProps {
  index: number;
  count: number;
  moveUpLabel: string;
  moveDownLabel: string;
  removeLabel: string;
  onMove: (to: number) => void;
  onRemove: () => void;
  className?: string;
}

/**
 * The move up, move down and remove buttons of a list row. They are real buttons, so
 * the keyboard works. When a row reaches the top or the bottom, its move button is
 * disabled, and focus moves to the other move button so it is not lost.
 */
export function RowActions({
  index,
  count,
  moveUpLabel,
  moveDownLabel,
  removeLabel,
  onMove,
  onRemove,
  className,
}: RowActionsProps) {
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);
  const moved = useRef<'up' | 'down' | null>(null);
  const first = index === 0;
  const last = index === count - 1;

  useEffect(() => {
    if (!moved.current) return;
    const [wanted, other] = moved.current === 'up' ? [up, down] : [down, up];
    moved.current = null;
    (wanted.current?.disabled ? other : wanted).current?.focus();
  }, [index, first, last]);

  return (
    <div className={className}>
      <Button
        ref={up}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={moveUpLabel}
        disabled={first}
        onClick={() => {
          moved.current = 'up';
          onMove(index - 1);
        }}
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        ref={down}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={moveDownLabel}
        disabled={last}
        onClick={() => {
          moved.current = 'down';
          onMove(index + 1);
        }}
      >
        <ArrowDown aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={removeLabel}
        disabled={count <= 1}
        onClick={onRemove}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  );
}
