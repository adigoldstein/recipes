import type { Meta, StoryObj } from '@storybook/react-vite';
import { CharacterCounter } from './character-counter';
import { FormField } from './form-field';
import { RequiredNote } from './required-mark';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

const meta = { title: 'UI kit/Form field' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithCounter: Story = {
  render: () => (
    <div className="max-w-sm">
      <FormField
        id="story-notes"
        label="הערות וטיפים"
        counter={<CharacterCounter length={120} max={5000} />}
      >
        {(control) => <Textarea {...control} defaultValue="אפשר להקפיא" />}
      </FormField>
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div className="max-w-sm">
      <FormField id="story-title" label="שם המתכון" error="יש למלא את השדה">
        {(control) => <Input {...control} />}
      </FormField>
    </div>
  ),
};

export const OverTheLimit: Story = {
  render: () => (
    <div className="max-w-sm">
      <FormField
        id="story-desc"
        label="תיאור"
        error="אפשר עד 500 תווים"
        counter={<CharacterCounter length={512} max={500} />}
      >
        {(control) => <Textarea {...control} />}
      </FormField>
    </div>
  ),
};

export const Required: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-4">
      <RequiredNote>שדות המסומנים ב־* הם שדות חובה</RequiredNote>
      <FormField id="story-req-title" label="שם המתכון" required>
        {(control) => <Input {...control} />}
      </FormField>
      <FormField id="story-req-desc" label="תיאור">
        {(control) => <Textarea {...control} />}
      </FormField>
      <FormField
        id="story-req-error"
        label="מספר מנות"
        required
        error="יש למלא את השדה"
      >
        {(control) => <Input {...control} />}
      </FormField>
    </div>
  ),
};
