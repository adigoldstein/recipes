import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './ui/button';
import { ConfirmDialog } from './confirm-dialog';

const meta = { title: 'UI kit/ConfirmDialog' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Demo({
  destructive,
  error,
}: {
  destructive?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        חסימת דנה
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="לחסום את דנה?"
        description="דנה תנותק מיד ולא תוכל להיכנס עד שתבטלו את החסימה."
        confirmLabel="חסימה"
        cancelLabel="ביטול"
        destructive={destructive}
        error={error}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}

export const Default: Story = { render: () => <Demo /> };

export const Destructive: Story = { render: () => <Demo destructive /> };

export const WithError: Story = {
  render: () => <Demo destructive error="חייב להישאר מנהל אחד לפחות" />,
};
