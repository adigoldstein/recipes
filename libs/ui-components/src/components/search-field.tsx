import type * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';

export interface SearchFieldProps extends Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type'
> {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name of the field. */
  label: string;
  /** Accessible name of the clear (x) button. */
  clearLabel: string;
}

/** A pill search field with a clear button that appears once there is text. */
export function SearchField({
  value,
  onValueChange,
  label,
  clearLabel,
  className,
  ...props
}: SearchFieldProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-4 my-auto size-5 text-muted-foreground"
      />
      <Input
        {...props}
        type="search"
        aria-label={label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="rounded-full ps-12 pe-12 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={clearLabel}
          onClick={() => onValueChange('')}
          className="absolute inset-y-0 end-0"
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
