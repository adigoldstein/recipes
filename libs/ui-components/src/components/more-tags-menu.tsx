import { useId, useState, type ReactNode } from 'react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';

export interface MoreTagsOption {
  id: string;
  label: string;
}

export interface MoreTagsMenuProps {
  /** Text of the button that opens the list. */
  label: string;
  /** Heading of the list. */
  title: string;
  /** Accessible name of the sheet's close button. */
  closeLabel: string;
  /** Every tag, pinned or not. */
  options: readonly MoreTagsOption[];
  selectedIds: readonly string[];
  onSelectedIdsChange: (ids: string[]) => void;
  /** The "quick recipes" checkbox at the top of the list. */
  fast?: {
    label: string;
    pressed: boolean;
    onPressedChange: (pressed: boolean) => void;
  };
}

/**
 * The phone's tag filter (UX-DR11): a button that opens a bottom sheet with every
 * tag and a checkbox. Props in, callbacks out.
 */
export function MoreTagsMenu({
  label,
  title,
  closeLabel,
  options,
  selectedIds,
  onSelectedIdsChange,
  fast,
}: MoreTagsMenuProps) {
  const [open, setOpen] = useState(false);
  const headingId = useId();

  const toggle = (id: string, checked: boolean) =>
    onSelectedIdsChange(
      checked
        ? [...selectedIds, id]
        : selectedIds.filter((selected) => selected !== id),
    );

  const list: ReactNode = (
    <ul aria-labelledby={headingId} className="flex flex-col">
      {fast ? (
        <li>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 px-1 text-sm">
            <Checkbox
              checked={fast.pressed}
              onCheckedChange={(checked) =>
                fast.onPressedChange(checked === true)
              }
            />
            {fast.label}
          </label>
        </li>
      ) : null}
      {options.map((option) => (
        <li key={option.id}>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 px-1 text-sm">
            <Checkbox
              checked={selectedIds.includes(option.id)}
              onCheckedChange={(checked) => toggle(option.id, checked === true)}
            />
            {option.label}
          </label>
        </li>
      ))}
    </ul>
  );
  const trigger = (
    <Button variant="outline" className="shrink-0 rounded-full">
      {label}
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent closeLabel={closeLabel}>
        <SheetDescription className="sr-only">{title}</SheetDescription>
        <SheetTitle id={headingId}>{title}</SheetTitle>
        {list}
      </SheetContent>
    </Sheet>
  );
}
