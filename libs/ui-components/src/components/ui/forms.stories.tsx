import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './input';
import { Label } from './label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Skeleton } from './skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

const meta = { title: 'UI kit/Form and data' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const InputWithLabel: Story = {
  name: 'Input + Label',
  render: () => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="story-name">שם המתכון</Label>
      <Input id="story-name" placeholder="שקשוקה" />
      <Label htmlFor="story-disabled">שדה מושבת</Label>
      <Input id="story-disabled" disabled placeholder="לא זמין" />
      <Label htmlFor="story-invalid">שדה שגוי</Label>
      <Input id="story-invalid" aria-invalid defaultValue="???" />
    </div>
  ),
};

export const SkeletonCards: Story = {
  name: 'Skeleton',
  render: () => (
    <div className="grid max-w-sm gap-3">
      <Skeleton className="h-40 w-full rounded-board" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
    </div>
  ),
};

export const MealTypeChips: Story = {
  name: 'ToggleGroup',
  render: () => (
    <ToggleGroup type="single" defaultValue="all" aria-label="סוג ארוחה">
      <ToggleGroupItem value="all">הכל</ToggleGroupItem>
      <ToggleGroupItem value="breakfast">בוקר</ToggleGroupItem>
      <ToggleGroupItem value="lunch">צהריים</ToggleGroupItem>
      <ToggleGroupItem value="dinner">ערב</ToggleGroupItem>
      <ToggleGroupItem value="dessert">קינוח</ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const RoleSelect: Story = {
  name: 'Select',
  render: () => (
    <Select defaultValue="viewer">
      <SelectTrigger aria-label="תפקיד" className="w-48">
        <SelectValue placeholder="בחירת תפקיד" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">מנהל</SelectItem>
        <SelectItem value="editor">עורך</SelectItem>
        <SelectItem value="viewer">צופה</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const UsersTable: Story = {
  name: 'Table',
  render: () => (
    <Table className="max-w-detail">
      <TableHeader>
        <TableRow>
          <TableHead>שם</TableHead>
          <TableHead>תפקיד</TableHead>
          <TableHead>סטטוס</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>עדי</TableCell>
          <TableCell>מנהל</TableCell>
          <TableCell>פעיל</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>נועה</TableCell>
          <TableCell>צופה</TableCell>
          <TableCell>חסום</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
