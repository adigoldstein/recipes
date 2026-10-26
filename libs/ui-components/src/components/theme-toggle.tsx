import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';

export type ThemeMode = 'system' | 'light' | 'dark';

const ORDER: readonly ThemeMode[] = ['system', 'light', 'dark'];

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
}

export interface ThemeToggleProps {
  value: ThemeMode;
  onValueChange: (mode: ThemeMode) => void;
  /** Accessible name; it should say which mode is active. */
  label: string;
}

/** Icon button that cycles system → light → dark and shows the active mode. */
export function ThemeToggle({ value, onValueChange, label }: ThemeToggleProps) {
  const Icon = ICONS[value];
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => onValueChange(nextThemeMode(value))}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
