import type { Meta, StoryObj } from '@storybook/react-vite';
import { RecipePhoto } from './recipe-photo';

// A plain colour stands in for a photo, so the story needs no image file.
const PICTURE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='1200'><rect width='100%' height='100%' fill='%23b8742f'/></svg>";

const meta = {
  title: 'Recipe/RecipePhoto',
  component: RecipePhoto,
  args: { src: PICTURE, alt: 'תמונה של לזניה' },
} satisfies Meta<typeof RecipePhoto>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCredit: Story = {
  args: { credit: 'מקור: commons.wikimedia.org' },
};
