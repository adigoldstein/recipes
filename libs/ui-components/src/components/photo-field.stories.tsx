import type { Meta, StoryObj } from '@storybook/react-vite';
import { PhotoField } from './photo-field';

// A plain colour stands in for a photo, so the story needs no image file.
const PICTURE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='450'><rect width='100%' height='100%' fill='%23b8742f'/></svg>";

const meta = {
  title: 'Forms/PhotoField',
  component: PhotoField,
  args: {
    id: 'recipe-photo',
    label: 'תמונה',
    hint: 'JPEG, PNG או WebP, עד 10 מ״ב',
    previewAlt: 'תצוגה מקדימה של התמונה',
    accept: 'image/jpeg,image/png,image/webp',
    labels: {
      add: 'הוספת תמונה',
      replace: 'החלפה',
      remove: 'הסרה',
      uploading: 'מעלה תמונה',
    },
    onSelect: () => undefined,
    onRemove: () => undefined,
  },
} satisfies Meta<typeof PhotoField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const WithPhoto: Story = { args: { previewUrl: PICTURE } };
export const Uploading: Story = {
  args: { previewUrl: PICTURE, progress: 0.45 },
};
export const WithError: Story = {
  args: { error: 'אפשר להעלות תמונה בפורמט JPEG, PNG או WebP' },
};
