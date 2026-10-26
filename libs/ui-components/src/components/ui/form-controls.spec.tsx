import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DirectionProvider } from './direction';
import { Input } from './input';
import { Label } from './label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Skeleton } from './skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

describe('Input and Label', () => {
  it('is a 44px field named by its label', () => {
    const onChange = vi.fn();
    render(
      <>
        <Label htmlFor="name">שם</Label>
        <Input id="name" onChange={onChange} />
      </>,
    );
    const input = screen.getByLabelText('שם');
    expect(input.className).toContain('h-11');
    expect(input.className).toContain('border-input');
    fireEvent.change(input, { target: { value: 'חומוס' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('is skipped by the keyboard when disabled', () => {
    render(<Input aria-label="חיפוש" disabled />);
    expect(screen.getByLabelText('חיפוש')).toHaveProperty('disabled', true);
  });
});

describe('Skeleton', () => {
  it('renders a pulsing placeholder block', () => {
    render(<Skeleton data-testid="sk" className="h-4" />);
    const block = screen.getByTestId('sk');
    expect(block.className).toContain('animate-pulse');
    expect(block.className).toContain('h-4');
  });
});

describe('Table', () => {
  it('renders table semantics', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>שם</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>עדי</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'שם' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'עדי' })).toBeTruthy();
  });
});

describe('ToggleGroup', () => {
  function renderChips(onValueChange = vi.fn()) {
    render(
      <DirectionProvider dir="rtl">
        <ToggleGroup type="single" onValueChange={onValueChange}>
          <ToggleGroupItem value="all">הכל</ToggleGroupItem>
          <ToggleGroupItem value="dinner">ערב</ToggleGroupItem>
        </ToggleGroup>
      </DirectionProvider>,
    );
    return onValueChange;
  }

  it('selects one chip at a time', () => {
    const onValueChange = renderChips();
    const dinner = screen.getByRole('radio', { name: 'ערב' });
    fireEvent.click(dinner);
    expect(onValueChange).toHaveBeenCalledWith('dinner');
    expect(dinner.getAttribute('aria-checked')).toBe('true');
    expect(dinner.className).toContain('rounded-full');
  });

  it('moves focus between chips with the arrow keys, following RTL', async () => {
    renderChips();
    const [all, dinner] = screen.getAllByRole('radio');
    all.focus();
    // In RTL the next chip lies to the left.
    fireEvent.keyDown(all, { key: 'ArrowLeft' });
    await waitFor(() => expect(document.activeElement).toBe(dinner));
  });
});

describe('Select', () => {
  it('opens from the keyboard and picks an option', () => {
    const onValueChange = vi.fn();
    render(
      <DirectionProvider dir="rtl">
        <Select onValueChange={onValueChange}>
          <SelectTrigger aria-label="תפקיד">
            <SelectValue placeholder="בחירה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">מנהל</SelectItem>
            <SelectItem value="viewer">צופה</SelectItem>
          </SelectContent>
        </Select>
      </DirectionProvider>,
    );
    const trigger = screen.getByRole('combobox', { name: 'תפקיד' });
    expect(trigger.className).toContain('h-11');
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const option = screen.getByRole('option', { name: 'צופה' });
    fireEvent.keyDown(option, { key: 'Enter' });
    expect(onValueChange).toHaveBeenCalledWith('viewer');
  });
});
