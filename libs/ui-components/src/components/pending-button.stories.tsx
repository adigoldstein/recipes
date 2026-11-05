import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PendingButton, SlowNote } from './pending-button';

const meta = { title: 'UI kit/PendingButton' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing is happening. */
export const Idle: Story = {
  render: () => (
    <PendingButton pending={false} pendingLabel="שומרים">
      שמירה
    </PendingButton>
  ),
};

/**
 * The wait has been noticeable (the 0.3 s delay is set to 0 here so it can be seen
 * at once): disabled, with a spinner and the present-tense label, at the same width.
 */
export const Working: Story = {
  render: () => (
    <PendingButton pending delayMs={0} pendingLabel="שומרים">
      שמירה
    </PendingButton>
  ),
};

/** Disabled at once but not yet showing a spinner: what a fast action looks like. */
export const JustStarted: Story = {
  render: () => (
    <PendingButton pending delayMs={60_000} pendingLabel="שומרים">
      שמירה
    </PendingButton>
  ),
};

export const Destructive: Story = {
  render: () => (
    <PendingButton
      pending
      delayMs={0}
      variant="destructive"
      pendingLabel="מוחקים"
    >
      מחיקה
    </PendingButton>
  ),
};

/** Press it to see the real timing: spinner after 0.3 s, slow note after 3 s here. */
export const Interactive: Story = {
  render: function Demo() {
    const [pending, setPending] = useState(false);
    const run = () => {
      setPending(true);
      setTimeout(() => setPending(false), 5_000);
    };
    return (
      <div className="flex flex-col gap-2">
        <PendingButton
          type="button"
          pending={pending}
          pendingLabel="שומרים"
          onClick={run}
        >
          שמירה
        </PendingButton>
        <SlowNote pending={pending} afterMs={3_000}>
          זה לוקח יותר זמן מהרגיל. אפשר להמתין עוד קצת.
        </SlowNote>
      </div>
    );
  },
};
