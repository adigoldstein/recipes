import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TagPicker,
  type TagPickerLabels,
  type TagPickerValue,
} from './tag-picker';
import { DirectionProvider } from './ui/direction';

const labels: TagPickerLabels = {
  trigger: 'הוספת תגית',
  search: 'חיפוש תגית',
  empty: 'אין תגיות',
  create: (name) => `יצירת תגית '${name}'`,
  remove: (name) => `הסרת התגית ${name}`,
  chosen: 'התגיות של המתכון',
};
const OPTIONS = [
  { id: 'a', name: 'ערב' },
  { id: 'b', name: 'מרק' },
  { id: 'c', name: 'BBQ' },
  { id: 'd', name: 'על האש' },
];
const normalize = (text: string) =>
  text.normalize('NFC').split(/\s+/).filter(Boolean).join(' ');

/** Keeps the value in state, like a form would, and reports every change. */
function renderPicker(initial: TagPickerValue[] = [], options = OPTIONS) {
  const onChange = vi.fn();
  function Host() {
    const [value, setValue] = useState(initial);
    return (
      <TagPicker
        id="tags"
        options={options}
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
        normalize={normalize}
        maxLength={40}
        labels={labels}
      />
    );
  }
  render(
    <DirectionProvider dir="rtl">
      <Host />
    </DirectionProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

const trigger = () => screen.getByRole('button', { name: 'הוספת תגית' });
const rows = () => screen.getAllByRole('option').map((row) => row.textContent);

describe('TagPicker', () => {
  it('lists every tag in the given order as soon as it opens, before any typing', async () => {
    const { user } = renderPicker();
    await user.click(trigger());
    expect(rows()).toEqual(['ערב', 'מרק', 'BBQ', 'על האש']);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('narrows the list as you type, ignoring case', async () => {
    const { user } = renderPicker();
    await user.click(trigger());
    await user.type(screen.getByPlaceholderText('חיפוש תגית'), 'bb');
    expect(rows()).toEqual(['BBQ', "יצירת תגית 'bb'"]);
  });

  it('adds an existing tag by id, shows it as a chip, and marks it in the list', async () => {
    const { user, onChange } = renderPicker();
    await user.click(trigger());
    await user.click(screen.getByRole('option', { name: 'מרק' }));
    expect(onChange).toHaveBeenLastCalledWith([{ id: 'b', name: 'מרק' }]);
    const chips = screen.getByRole('list', { name: 'התגיות של המתכון' });
    expect(within(chips).getByText('מרק')).toBeTruthy();
    // The list stays open for more tags, and the chosen one has a check mark.
    expect(
      screen.getByRole('option', { name: 'מרק' }).querySelector('svg'),
    ).toBeTruthy();
    expect(
      screen.getByRole('option', { name: 'ערב' }).querySelector('svg'),
    ).toBeNull();
  });

  it('removes a chosen tag by picking it again', async () => {
    const { user, onChange } = renderPicker([{ id: 'b', name: 'מרק' }]);
    await user.click(trigger());
    await user.click(screen.getByRole('option', { name: 'מרק' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('offers to create a tag that does not exist, with the text cleaned up', async () => {
    const { user, onChange } = renderPicker();
    await user.click(trigger());
    await user.type(
      screen.getByPlaceholderText('חיפוש תגית'),
      '  ארוחת   שבת ',
    );
    await user.click(
      screen.getByRole('option', { name: "יצירת תגית 'ארוחת שבת'" }),
    );
    expect(onChange).toHaveBeenLastCalledWith([{ name: 'ארוחת שבת' }]);
  });

  it('does not offer to create a tag that exists, whatever its case or spacing', async () => {
    const { user } = renderPicker();
    await user.click(trigger());
    await user.type(screen.getByPlaceholderText('חיפוש תגית'), ' bbq ');
    expect(rows()).toEqual(['BBQ']);
  });

  it('does not offer to create a new tag twice', async () => {
    const { user } = renderPicker([{ name: 'חג' }]);
    await user.click(trigger());
    await user.type(screen.getByPlaceholderText('חיפוש תגית'), 'חג');
    expect(
      screen.queryByRole('option', { name: "יצירת תגית 'חג'" }),
    ).toBeNull();
  });

  it('removes a tag with its chip button', async () => {
    const { user, onChange } = renderPicker([
      { id: 'a', name: 'ערב' },
      { name: 'חג' },
    ]);
    await user.click(screen.getByRole('button', { name: 'הסרת התגית חג' }));
    expect(onChange).toHaveBeenLastCalledWith([{ id: 'a', name: 'ערב' }]);
  });

  it('removes the last chip with Backspace in an empty search box', async () => {
    const { user, onChange } = renderPicker([
      { id: 'a', name: 'ערב' },
      { name: 'חג' },
    ]);
    await user.click(trigger());
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith([{ id: 'a', name: 'ערב' }]);
  });

  it('works from the keyboard: arrows move, Enter picks, Escape closes', async () => {
    const { user, onChange } = renderPicker();
    trigger().focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith([{ id: 'b', name: 'מרק' }]);
    await user.keyboard('{Escape}');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('says so when there are no tags at all', async () => {
    const { user } = renderPicker([], []);
    await user.click(trigger());
    expect(screen.getByText('אין תגיות')).toBeTruthy();
  });

  it('passes the field wiring to the combobox button', () => {
    render(
      <DirectionProvider dir="rtl">
        <TagPicker
          id="tags"
          options={OPTIONS}
          value={[]}
          onChange={() => undefined}
          normalize={normalize}
          maxLength={40}
          labels={labels}
          aria-invalid
          aria-describedby="tags-error"
        />
      </DirectionProvider>,
    );
    expect(trigger().getAttribute('aria-invalid')).toBe('true');
    expect(trigger().getAttribute('aria-describedby')).toBe('tags-error');
    expect(trigger().id).toBe('tags');
  });
});
