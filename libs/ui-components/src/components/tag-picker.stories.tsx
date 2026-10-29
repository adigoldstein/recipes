import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormField } from './form-field';
import {
  TagPicker,
  type TagPickerLabels,
  type TagPickerOption,
  type TagPickerValue,
} from './tag-picker';

const meta = { title: 'UI kit/TagPicker' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const labels: TagPickerLabels = {
  trigger: 'הוספת תגית',
  search: 'חיפוש תגית או שם חדש',
  empty: 'אין תגיות',
  create: (name) => `יצירת תגית '${name}'`,
  remove: (name) => `הסרת התגית ${name}`,
  chosen: 'התגיות של המתכון',
};

const normalize = (text: string) =>
  text.normalize('NFC').split(/\s+/).filter(Boolean).join(' ');

const PINNED = [
  'בוקר',
  "בראנץ'",
  'צהריים',
  'ערב',
  'נשנוש',
  'עיקרית',
  'תוספת',
  'מנה ראשונה/סלט',
  'מרק',
  'מאפה',
  'קינוח',
  'משקה',
  'רוטב/ממרח',
];
const FREE = [
  'על האש',
  'פינגר פוד',
  'מסיבות',
  'BBQ',
  'ארוחת שבת',
  'מתאים להקפאה',
  'ילדים אוהבים',
  'קל ומהיר להכנה באמצע השבוע אחרי יום עבודה ארוך',
];
const toOptions = (names: string[]): TagPickerOption[] =>
  names.map((name, index) => ({ id: `tag-${index}-${name}`, name }));

const FEW = toOptions(PINNED);
const MANY = toOptions([...PINNED, ...FREE]);

function Demo({
  options,
  initial = [],
  error,
  required,
}: {
  options: TagPickerOption[];
  initial?: TagPickerValue[];
  error?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState<TagPickerValue[]>(initial);
  return (
    <div className="mx-auto max-w-sm">
      <FormField id="tags" label="תגיות" error={error} required={required}>
        {(field) => (
          <TagPicker
            {...field}
            options={options}
            value={value}
            onChange={setValue}
            normalize={normalize}
            maxLength={40}
            labels={labels}
          />
        )}
      </FormField>
    </div>
  );
}

export const Empty: Story = { render: () => <Demo options={FEW} /> };

export const WithChosenTags: Story = {
  render: () => (
    <Demo
      options={MANY}
      initial={[
        { id: MANY[3].id, name: 'ערב' },
        { id: MANY[13].id, name: 'על האש' },
        { name: 'חג' },
      ]}
    />
  ),
};

export const ManyTagsAndLongNames: Story = {
  render: () => (
    <Demo
      options={MANY}
      initial={[{ id: MANY[20].id, name: MANY[20].name }, ...[]]}
    />
  ),
};

export const WithError: Story = {
  render: () => <Demo options={FEW} error="יש לבחור תגית" required />,
};

export const NoTagsYet: Story = { render: () => <Demo options={[]} /> };
