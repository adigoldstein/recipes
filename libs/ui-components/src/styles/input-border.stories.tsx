import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';

const meta = {
  title: 'Foundations/Input border (for approval)',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Story 1.5 approval preview. Switch Light/Dark in the toolbar. "Before" is the
 * old `--input` (= `--border`, about 1.25:1); "After" is the new stronger
 * `--input` (>= 3:1 on background, card and popover; see theme-contrast.spec.ts).
 */
export const BeforeAndAfter: Story = {
  render: () => (
    <div className="grid max-w-detail gap-8 md:grid-cols-2">
      <section className="grid content-start gap-4">
        <h2 className="text-heading">לפני (הגבול העדין, --border)</h2>
        <Label htmlFor="before-input">שם המתכון</Label>
        <Input
          id="before-input"
          className="border-border"
          placeholder="שקשוקה"
        />
        <Select>
          <SelectTrigger aria-label="תפקיד לפני" className="w-48 border-border">
            <SelectValue placeholder="בחירת תפקיד" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">צופה</SelectItem>
          </SelectContent>
        </Select>
      </section>
      <section className="grid content-start gap-4">
        <h2 className="text-heading">אחרי (--input החדש)</h2>
        <Label htmlFor="after-input">שם המתכון</Label>
        <Input id="after-input" placeholder="שקשוקה" />
        <Select>
          <SelectTrigger aria-label="תפקיד אחרי" className="w-48">
            <SelectValue placeholder="בחירת תפקיד" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">צופה</SelectItem>
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          variant="outline"
          aria-label="סוג ארוחה"
          defaultValue="dinner"
        >
          <ToggleGroupItem value="lunch">צהריים</ToggleGroupItem>
          <ToggleGroupItem value="dinner">ערב</ToggleGroupItem>
        </ToggleGroup>
      </section>
    </div>
  ),
};
