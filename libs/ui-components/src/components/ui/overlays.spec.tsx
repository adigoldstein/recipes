import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { DirectionProvider } from './direction';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Toaster, toast } from './sonner';

describe('Dialog', () => {
  function renderDialog() {
    render(
      <DirectionProvider dir="rtl">
        <Dialog>
          <DialogTrigger>הוספת משתמש</DialogTrigger>
          <DialogContent closeLabel="סגירה">
            <DialogHeader>
              <DialogTitle>משתמש חדש</DialogTitle>
              <DialogDescription>פרטי המשתמש</DialogDescription>
            </DialogHeader>
            <input aria-label="שם" />
          </DialogContent>
        </Dialog>
      </DirectionProvider>,
    );
    return screen.getByRole('button', { name: 'הוספת משתמש' });
  }

  it('traps focus inside and restores it to the trigger on close', async () => {
    const trigger = renderDialog();
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'משתמש חדש' });
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('closes with the labelled corner button', async () => {
    fireEvent.click(renderDialog());
    fireEvent.click(await screen.findByRole('button', { name: 'סגירה' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('AlertDialog', () => {
  function renderAlert(onAction = vi.fn()) {
    render(
      <DirectionProvider dir="rtl">
        <AlertDialog>
          <AlertDialogTrigger>מחיקה</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>למחוק את המתכון?</AlertDialogTitle>
              <AlertDialogDescription>אי אפשר לבטל</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={onAction}>אישור</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DirectionProvider>,
    );
    return screen.getByRole('button', { name: 'מחיקה' });
  }

  it('focuses inside, closes on Escape and restores focus', async () => {
    const trigger = renderAlert();
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('alertdialog', {
      name: 'למחוק את המתכון?',
    });
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('runs the action and closes', async () => {
    const onAction = vi.fn();
    fireEvent.click(renderAlert(onAction));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: 'אישור' }));
    expect(onAction).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});

describe('DropdownMenu', () => {
  it('opens from the keyboard, lists items, and restores focus on Escape', async () => {
    render(
      <DirectionProvider dir="rtl">
        <DropdownMenu>
          <DropdownMenuTrigger>חשבון</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>יציאה</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DirectionProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'חשבון' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const menu = await screen.findByRole('menu');
    const item = screen.getByRole('menuitem', { name: 'יציאה' });
    expect(menu.contains(item)).toBe(true);

    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe('Toaster', () => {
  it('shows a toast and uses the theme the app passes in', async () => {
    render(<Toaster theme="dark" />);
    act(() => {
      toast('המתכון נשמר');
    });
    expect(await screen.findByText('המתכון נשמר')).toBeTruthy();
    expect(
      document
        .querySelector('[data-sonner-toaster]')
        ?.getAttribute('data-sonner-theme'),
    ).toBe('dark');
  });
});
