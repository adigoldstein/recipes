import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Input } from './input';
import { Label } from './label';
import { Toaster, toast } from './sonner';

const meta = { title: 'UI kit/Overlays' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AccountMenu: Story = {
  name: 'DropdownMenu',
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">עדי</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>עדי</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>משתמשים</DropdownMenuItem>
        <DropdownMenuItem>תגיות</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">יציאה</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const AddUserDialog: Story = {
  name: 'Dialog',
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>הוספת משתמש</Button>
      </DialogTrigger>
      <DialogContent closeLabel="סגירה">
        <DialogHeader>
          <DialogTitle>משתמש חדש</DialogTitle>
          <DialogDescription>פרטי המשתמש לכניסה לאפליקציה</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="dialog-email">אימייל</Label>
          <Input id="dialog-email" type="email" dir="ltr" />
        </div>
        <DialogFooter>
          <Button>הוספה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const DeleteConfirm: Story = {
  name: 'AlertDialog',
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">מחיקת מתכון</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>למחוק את המתכון?</AlertDialogTitle>
          <AlertDialogDescription>
            אי אפשר לשחזר מתכון שנמחק
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction>מחיקה</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const Toasts: Story = {
  name: 'Sonner (Toaster)',
  render: () => (
    <>
      <Toaster />
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => toast('המתכון נשמר')}>הודעה</Button>
        <Button variant="outline" onClick={() => toast.success('המתכון נמחק')}>
          הצלחה
        </Button>
        <Button variant="outline" onClick={() => toast.error('השמירה נכשלה')}>
          שגיאה
        </Button>
      </div>
    </>
  ),
};
