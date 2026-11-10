import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PendingButton, SlowNote } from './pending-button';

const meta = { title: 'UI kit/PendingButton' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing is running. */
export const Idle: Story = {
  render: () => (
    <PendingButton pending={false} pendingLabel="שומרים">
      שמירה
    </PendingButton>
  ),
};

/**
 * The action is taking a while: the button is disabled, with a spinner and the
 * "working" label, at the same width. The 0.3 s delay is 0 here, so it shows at once.
 */
export const Working: Story = {
  render: () => (
    <PendingButton pending delayMs={0} pendingLabel="שומרים">
      שמירה
    </PendingButton>
  ),
};

/** Disabled right away, but with no spinner yet. This is how a fast action looks. */
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

/**
 * Click it to see the real timing: a spinner after 0.3 s, and here the "slow" note
 * after 3 s.
 */
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
