import { cn } from '../lib/utils';
import { useIsDesktop } from '../hooks/use-media-query';
import { MoreTagsMenu } from './more-tags-menu';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

export interface TagFilterOption {
  id: string;
  label: string;
}

export interface TagFilterProps {
  /** Accessible name of the chip group. */
  label: string;
  /** Label of the chip that clears the tag selection. */
  allLabel: string;
  options: readonly TagFilterOption[];
  selectedIds: readonly string[];
  onSelectedIdsChange: (ids: string[]) => void;
  /** The independent "quick recipes" chip. */
  fast: {
    label: string;
    pressed: boolean;
    onPressedChange: (pressed: boolean) => void;
  };
  /**
   * Every tag, pinned or not. On desktop the row shows them all (pinned first) and
   * scrolls sideways. On a phone the whole row gives way to one button that opens a
   * sheet with a checkbox for each tag and for the quick filter.
   */
  more?: {
    label: string;
    title: string;
    closeLabel: string;
    /** Every tag, pinned or not. */
    options: readonly TagFilterOption[];
  };
  /** "הכל" on a phone: clears the tags and the quick chip in one step. */
  onClearAll?: () => void;
  className?: string;
}

// Item values that are not tag ids; tag ids are UUIDs, so they cannot collide.
const ALL = 'all';
const FAST = 'fast';

const CHIP =
  'bg-secondary text-secondary-foreground hover:bg-secondary/80 data-[state=on]:hover:bg-primary/80';

/**
 * The library's chip row: "הכל" clears the tags, the other chips are
 * multi-select (UX-DR11). It scrolls sideways inside its own row.
 */
export function TagFilter({
  label,
  allLabel,
  options,
  selectedIds,
  onSelectedIdsChange,
  fast,
  more,
  onClearAll = () => onSelectedIdsChange([]),
  className,
}: TagFilterProps) {
  const desktop = useIsDesktop();
  const unpinned = (more?.options ?? []).filter(
    (option) => !options.some((pinned) => pinned.id === option.id),
  );
  const chips = [...options, ...unpinned];
  const value = [
    ...(selectedIds.length === 0 ? [ALL] : selectedIds),
    ...(fast.pressed ? [FAST] : []),
  ];
  const handleChange = (next: string[]) => {
    const wantsFast = next.includes(FAST);
    if (wantsFast !== fast.pressed) fast.onPressedChange(wantsFast);
    const pressedAll = next.includes(ALL) && !value.includes(ALL);
    const tags = next.filter((item) => item !== ALL && item !== FAST);
    const changed =
      tags.length !== selectedIds.length ||
      tags.some((id) => !selectedIds.includes(id));
    if (pressedAll) onSelectedIdsChange([]);
    else if (changed) onSelectedIdsChange(tags);
  };
  if (!desktop && more) {
    return (
      <div className={cn('flex items-center gap-2 py-1', className)}>
        <ToggleGroup
          type="multiple"
          aria-label={label}
          value={selectedIds.length === 0 && !fast.pressed ? [ALL] : []}
          onValueChange={(next) => {
            if (!next.includes(ALL)) return;
            onClearAll();
          }}
        >
          <ToggleGroupItem value={ALL} className={CHIP}>
            {allLabel}
          </ToggleGroupItem>
        </ToggleGroup>
        <MoreTagsMenu
          {...more}
          fast={fast}
          selectedIds={selectedIds}
          onSelectedIdsChange={onSelectedIdsChange}
        />
      </div>
    );
  }
  return (
    <div
      className={cn('flex items-center gap-2 overflow-x-auto py-1', className)}
    >
      <ToggleGroup
        type="multiple"
        aria-label={label}
        value={value}
        onValueChange={handleChange}
        className="flex-nowrap"
      >
        <ToggleGroupItem value={ALL} className={CHIP}>
          {allLabel}
        </ToggleGroupItem>
        <ToggleGroupItem value={FAST} className={CHIP}>
          {fast.label}
        </ToggleGroupItem>
        {chips.map((option) => (
          <ToggleGroupItem key={option.id} value={option.id} className={CHIP}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
