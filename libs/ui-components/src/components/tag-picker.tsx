import { useState } from 'react';
import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

/** An existing tag in the picker's list. */
export interface TagPickerOption {
  id: string;
  name: string;
}

/** A tag of the recipe: an existing tag with an id, or a new tag with only a name. */
export interface TagPickerValue {
  id?: string;
  name: string;
}

export interface TagPickerLabels {
  /** The text of the field when it is closed. */
  trigger: string;
  /** The placeholder of the search box in the list. */
  search: string;
  /** Shown when the list is empty. */
  empty: string;
  /** The text of the row that creates a tag from the typed text. */
  create: (name: string) => string;
  /** The accessible name of a chip's remove button. */
  remove: (name: string) => string;
  /** The accessible name of the list of chosen tags. */
  chosen: string;
}

export interface TagPickerProps {
  id: string;
  /** All the existing tags, in the order to show them. */
  options: readonly TagPickerOption[];
  value: readonly TagPickerValue[];
  onChange: (value: TagPickerValue[]) => void;
  /**
   * Cleans the typed text the same way the server does (AD-24), so the matching is
   * the same.
   */
  normalize: (text: string) => string;
  maxLength: number;
  labels: TagPickerLabels;
  className?: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  'aria-required'?: true;
}

const CREATE = '__create__';
const sameName = (a: string, b: string) =>
  a.toLocaleLowerCase() === b.toLocaleLowerCase();

/**
 * Chooses the tags of a recipe (FR-22): a field that opens the list of all tags, a
 * search box that filters it, a "create" row for a name that does not exist yet, and
 * the chosen tags as chips you can remove. It gets props and calls callbacks, and
 * knows nothing about the API.
 */
export function TagPicker({
  id,
  options,
  value,
  onChange,
  normalize,
  maxLength,
  labels,
  className,
  ...aria
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const isChosen = (tag: TagPickerValue) =>
    value.some((chosen) =>
      chosen.id && tag.id
        ? chosen.id === tag.id
        : sameName(chosen.name, tag.name),
    );
  const remove = (tag: TagPickerValue) =>
    onChange(
      value.filter((chosen) =>
        chosen.id && tag.id
          ? chosen.id !== tag.id
          : !sameName(chosen.name, tag.name),
      ),
    );

  const typed = normalize(query);
  const shown = options.filter(
    (option) =>
      sameName(option.name, typed) ||
      option.name.toLocaleLowerCase().includes(typed.toLocaleLowerCase()),
  );
  const exists = options.some((option) => sameName(option.name, typed));
  const canCreate = typed !== '' && !exists && !isChosen({ name: typed });

  const toggle = (option: TagPickerOption) => {
    if (isChosen(option)) remove(option);
    else onChange([...value, { id: option.id, name: option.name }]);
    setQuery('');
  };
  const create = () => {
    onChange([...value, { name: typed }]);
    setQuery('');
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-haspopup="listbox"
            {...aria}
            className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-base text-muted-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
          >
            {labels.trigger}
            <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          id={`${id}-list`}
          className="w-(--radix-popover-trigger-width)"
          onCloseAutoFocus={() => setQuery('')}
        >
          {/* We filter by ourselves, so "BBQ " and "bbq" match like on the server. */}
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={labels.search}
              maxLength={maxLength}
              onKeyDown={(event) => {
                if (
                  event.key === 'Backspace' &&
                  query === '' &&
                  value.length > 0
                ) {
                  remove(value[value.length - 1]);
                }
              }}
            />
            <CommandList>
              {shown.length === 0 && !canCreate ? (
                <CommandEmpty>{labels.empty}</CommandEmpty>
              ) : null}
              <CommandGroup>
                {shown.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => toggle(option)}
                  >
                    {option.name}
                    {isChosen(option) ? (
                      <CheckIcon aria-hidden="true" className="ms-auto" />
                    ) : null}
                  </CommandItem>
                ))}
                {canCreate ? (
                  <CommandItem value={CREATE} onSelect={create}>
                    <PlusIcon aria-hidden="true" />
                    {labels.create(typed)}
                  </CommandItem>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 ? (
        <ul aria-label={labels.chosen} className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <li
              key={tag.id ?? `new:${tag.name.toLocaleLowerCase()}`}
              className="flex h-11 items-center gap-1 rounded-full bg-secondary ps-4 pe-1.5 text-sm text-secondary-foreground"
            >
              {tag.name}
              <button
                type="button"
                aria-label={labels.remove(tag.name)}
                onClick={() => remove(tag)}
                className="flex size-9 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <XIcon aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
