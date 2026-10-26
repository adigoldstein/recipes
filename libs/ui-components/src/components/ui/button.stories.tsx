import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus } from 'lucide-react';
import { Button } from './button';

const meta = {
  title: 'UI kit/Button',
  component: Button,
  args: { children: 'שמירה' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>ראשי</Button>
      <Button variant="secondary">משני</Button>
      <Button variant="outline">מסגרת</Button>
      <Button variant="ghost">שקוף</Button>
      <Button variant="destructive">מחיקה</Button>
      <Button variant="link">קישור</Button>
      <Button size="lg">גדול</Button>
      <Button size="icon" aria-label="הוספה">
        <Plus aria-hidden="true" />
      </Button>
      <Button disabled>מושבת</Button>
    </div>
  ),
};
