import { render, screen } from '@testing-library/react';
import { CharacterCounter } from './character-counter';
import { FormField } from './form-field';
import { RequiredMark, RequiredNote } from './required-mark';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

describe('FormField', () => {
  it('names the control by its label and passes the id', () => {
    render(
      <FormField id="title" label="שם המתכון">
        {(control) => <Input {...control} />}
      </FormField>,
    );
    const input = screen.getByLabelText('שם המתכון');
    expect(input.id).toBe('title');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it('marks the control invalid and describes it by hint, error and counter', () => {
    render(
      <FormField
        id="notes"
        label="הערות"
        hint="טיפים"
        error="ארוך מדי"
        counter={<CharacterCounter length={6} max={5} />}
      >
        {(control) => <Textarea {...control} />}
      </FormField>,
    );
    const field = screen.getByLabelText('הערות');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe(
      'notes-hint notes-error notes-counter',
    );
    expect(document.getElementById('notes-error')?.textContent).toBe(
      'ארוך מדי',
    );
    expect(document.getElementById('notes-hint')?.textContent).toBe('טיפים');
    expect(document.getElementById('notes-counter')?.textContent).toBe('6/5');
  });
});

describe('FormField required', () => {
  it('adds a red star to the label and aria-required to the control', () => {
    render(
      <FormField id="title" label="שם המתכון" required>
        {(control) => <Input {...control} />}
      </FormField>,
    );
    const input = screen.getByLabelText(/^שם המתכון/);
    expect(input.getAttribute('aria-required')).toBe('true');
    const star = screen.getByText('*');
    expect(star.getAttribute('aria-hidden')).toBe('true');
    expect(star.className).toContain('text-destructive');
    expect(star.parentElement?.tagName).toBe('LABEL');
    // The star is not part of the control's name.
    expect(screen.getByRole('textbox', { name: 'שם המתכון' })).toBe(input);
  });

  it('marks nothing on an optional field', () => {
    render(
      <FormField id="notes" label="הערות">
        {(control) => <Textarea {...control} />}
      </FormField>,
    );
    expect(screen.queryByText('*')).toBeNull();
    expect(
      screen.getByLabelText('הערות').getAttribute('aria-required'),
    ).toBeNull();
  });

  it('works the same for any control, such as a select trigger', () => {
    render(
      <FormField id="role" label="תפקיד" required>
        {(control) => <button type="button" {...control} />}
      </FormField>,
    );
    expect(
      screen
        .getByRole('button', { name: 'תפקיד' })
        .getAttribute('aria-required'),
    ).toBe('true');
  });
});

describe('RequiredMark and RequiredNote', () => {
  it('draws a hidden red star', () => {
    render(<RequiredMark />);
    const star = screen.getByText('*');
    expect(star.getAttribute('aria-hidden')).toBe('true');
    expect(star.className).toContain('text-destructive');
  });

  it('explains the star in text, with a red star of its own', () => {
    render(<RequiredNote>שדות המסומנים ב־* הם שדות חובה</RequiredNote>);
    const note = screen.getByText(/שדות המסומנים/).closest('p');
    expect(note?.textContent).toBe('שדות המסומנים ב־* הם שדות חובה');
    expect(screen.getByText('*').className).toContain('text-destructive');
  });
});

describe('CharacterCounter', () => {
  it('is muted up to the limit and an error colour past it', () => {
    const { rerender } = render(<CharacterCounter length={5} max={5} />);
    expect(screen.getByText('5/5').className).toContain(
      'text-muted-foreground',
    );
    rerender(<CharacterCounter length={6} max={5} />);
    expect(screen.getByText('6/5').className).toContain('text-destructive');
  });
});
