import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './ui/button';
import { EmptyState } from './empty-state';
import { RecipeCard, RecipeCardSkeleton } from './recipe-card';
import { SearchField } from './search-field';
import { TagFilter } from './tag-filter';

const meta = { title: 'Library/Pieces' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const link = ({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) => (
  <a href="#recipe" className={className}>
    {children}
  </a>
);

// A flat grey 4:3 stand-in, so the story needs no network.
const PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='450'%3E%3Crect width='600' height='450' fill='gray'/%3E%3C/svg%3E";

const overflowLabel = (hidden: number) => `ועוד ${hidden} תגיות`;

export const RecipeCards: Story = {
  name: 'RecipeCard',
  render: () => (
    <div className="grid max-w-library gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RecipeCard
        title="שקשוקה"
        tags={['בוקר', 'על האש', 'מסיבות', 'פינגר פוד']}
        overflowLabel={overflowLabel}
        time="30 דק׳"
        photoUrl={PHOTO}
        renderLink={link}
      />
      <RecipeCard
        title="עוגת שוקולד מרירה"
        tags={['קינוח']}
        time="1 שע׳ 15 דק׳"
        renderLink={link}
      />
      <RecipeCard title="מרק עדשים" tags={[]} renderLink={link} />
    </div>
  ),
};

export const RecipeCardSkeletons: Story = {
  name: 'RecipeCardSkeleton',
  render: () => (
    <div className="grid max-w-library gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, n) => (
        <RecipeCardSkeleton key={n} />
      ))}
    </div>
  ),
};

export const SearchFields: Story = {
  name: 'SearchField',
  render: function Render() {
    const [value, setValue] = useState('לזניה');
    return (
      <SearchField
        className="max-w-md"
        value={value}
        onValueChange={setValue}
        label="חיפוש מתכונים"
        clearLabel="ניקוי החיפוש"
        placeholder="חיפוש מתכונים"
      />
    );
  },
};

const TAGS = [
  'בוקר',
  'בראנץ׳',
  'צהריים',
  'ערב',
  'נשנוש',
  'עיקרית',
  'תוספת',
  'מרק',
  'קינוח',
].map((label) => ({ id: label, label }));

export const TagFilters: Story = {
  name: 'TagFilter',
  render: function Render() {
    const [ids, setIds] = useState<string[]>(['ערב']);
    const [fast, setFast] = useState(false);
    return (
      <TagFilter
        label="סינון לפי תגיות"
        allLabel="הכל"
        options={TAGS}
        selectedIds={ids}
        onSelectedIdsChange={setIds}
        fast={{ label: 'עד 30 דקות', pressed: fast, onPressedChange: setFast }}
      />
    );
  },
};

export const EmptyStates: Story = {
  name: 'EmptyState',
  render: () => (
    <div className="grid gap-8">
      <EmptyState title="עוד אין כאן מתכונים" />
      <EmptyState
        title="לא נמצאו מתכונים ל־'פיצה'"
        actions={<Button variant="secondary">ניקוי החיפוש</Button>}
      />
    </div>
  ),
};
