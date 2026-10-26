import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Board } from './board';
import { ThemeToggle, type ThemeMode } from './theme-toggle';
import { TopBar, Wordmark } from './top-bar';

const LABELS: Record<ThemeMode, string> = {
  system: 'צבעים: לפי המכשיר',
  light: 'צבעים: בהיר',
  dark: 'צבעים: כהה',
};

const meta = {
  title: 'Shell/Shared pieces',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TopBarWithThemeToggle: Story = {
  name: 'TopBar + ThemeToggle',
  render: function Render() {
    const [mode, setMode] = useState<ThemeMode>('system');
    return (
      <TopBar
        brand={<Wordmark href="/">ביס & סיר</Wordmark>}
        actions={
          <ThemeToggle
            value={mode}
            onValueChange={setMode}
            label={LABELS[mode]}
          />
        }
      />
    );
  },
};

export const ThemeToggleStates: Story = {
  render: () => (
    <div className="flex gap-3">
      {(['system', 'light', 'dark'] as const).map((mode) => (
        <ThemeToggle
          key={mode}
          value={mode}
          onValueChange={() => undefined}
          label={LABELS[mode]}
        />
      ))}
    </div>
  ),
};

export const BoardSlab: Story = {
  name: 'Board',
  render: () => (
    <Board className="max-w-detail">
      <h2 className="text-title">שקשוקה</h2>
      <p className="text-body">ארוחת בוקר, 4 מנות</p>
    </Board>
  ),
};
