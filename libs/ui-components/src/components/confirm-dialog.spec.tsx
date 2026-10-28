import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog, type ConfirmDialogProps } from './confirm-dialog';
import { DirectionProvider } from './ui/direction';

function renderDialog(props: Partial<ConfirmDialogProps> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <DirectionProvider dir="rtl">
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="לחסום את דנה?"
        description="דנה תנותק מיד"
        confirmLabel="חסימה"
        cancelLabel="ביטול"
        onConfirm={onConfirm}
        {...props}
      />
    </DirectionProvider>,
  );
  return { onConfirm, onOpenChange };
}

describe('ConfirmDialog', () => {
  it('names its subject and offers confirm and cancel', () => {
    renderDialog();

    const dialog = screen.getByRole('alertdialog', { name: 'לחסום את דנה?' });
    expect(dialog.textContent).toContain('דנה תנותק מיד');
    expect(screen.getByRole('button', { name: 'חסימה' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ביטול' })).toBeTruthy();
  });

  it('runs the action on confirm and stays open', async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'חסימה' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('asks to close on cancel without running the action', async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'ביטול' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cannot be cancelled or dismissed while pending', async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderDialog({ pending: true });

    const confirm = screen.getByRole('button', { name: 'חסימה' });
    const cancel = screen.getByRole('button', { name: 'ביטול' });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    expect(cancel.hasAttribute('disabled')).toBe(true);
    await user.keyboard('{Escape}');

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('closes on Escape when idle', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows a failure in an alert region', () => {
    renderDialog({ error: 'חייב להישאר מנהל אחד לפחות' });

    expect(screen.getByRole('alert').textContent).toBe(
      'חייב להישאר מנהל אחד לפחות',
    );
  });

  it('keeps the alert region present when there is no error', () => {
    renderDialog();

    expect(screen.getByRole('alert').textContent).toBe('');
  });

  it('styles the confirm button as destructive when asked', () => {
    renderDialog({ destructive: true });

    expect(
      screen
        .getByRole('button', { name: 'חסימה' })
        .getAttribute('data-variant'),
    ).toBe('destructive');
  });
});
