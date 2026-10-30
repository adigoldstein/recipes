import { fireEvent, render, screen } from '@testing-library/react';
import { DirectionProvider } from './ui/direction';
import { EmptyState } from './empty-state';
import { RecipeCard, RecipeCardSkeleton } from './recipe-card';
import { SearchField } from './search-field';
import { TagFilter } from './tag-filter';

const link = ({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) => (
  <a href="/recipes/1" className={className}>
    {children}
  </a>
);

describe('RecipeCard', () => {
  it('is one link holding the title, up to two tags, +N and the time', () => {
    render(
      <RecipeCard
        title="שקשוקה"
        tags={['בוקר', 'על האש', 'מסיבות', 'מהיר']}
        overflowLabel={(n) => `ועוד ${n} תגיות`}
        time="30 דק׳"
        renderLink={link}
      />,
    );
    const card = screen.getByRole('link');
    expect(card.getAttribute('href')).toBe('/recipes/1');
    expect(card.className).toContain('hover:scale-102');
    expect(card.className).toContain('active:scale-98');
    expect(screen.getByRole('heading', { name: 'שקשוקה' })).toBeTruthy();
    expect(screen.getByText('בוקר')).toBeTruthy();
    expect(screen.getByText('על האש')).toBeTruthy();
    expect(screen.queryByText('מסיבות')).toBeNull();
    expect(screen.getByLabelText('ועוד 2 תגיות').textContent).toBe('+2');
    expect(screen.getByText('30 דק׳')).toBeTruthy();
  });

  it('fills its grid cell, with the tags and time pinned to the bottom', () => {
    const { container } = render(
      <RecipeCard
        title="לזניה"
        tags={['ערב']}
        time="30 דק׳"
        renderLink={link}
      />,
    );
    expect(screen.getByRole('link').className).toContain('h-full');
    expect(
      container.querySelector('[data-slot="recipe-card"]')?.className,
    ).toContain('h-full');
    expect(container.querySelector('.text-label')?.className).toContain(
      'mt-auto',
    );
  });

  it('shows a lazy photo below the title, and the regular title size, when it has one', () => {
    const { container } = render(
      <RecipeCard
        title="לזניה"
        tags={[]}
        photoUrl="/media/lasagna.webp"
        renderLink={link}
      />,
    );
    const photo = container.querySelector('img');
    expect(photo?.getAttribute('src')).toBe('/media/lasagna.webp');
    expect(photo?.getAttribute('loading')).toBe('lazy');
    expect(photo?.getAttribute('alt')).toBe('');
    expect(photo?.getAttribute('width')).toBe('600');
    expect(photo?.getAttribute('height')).toBe('450');
    expect(screen.getByRole('heading').className).toContain('text-title');
    // The title comes first and the photo follows it.
    const title = screen.getByRole('heading');
    expect(
      title.compareDocumentPosition(photo as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('has no placeholder art and a larger title without a photo', () => {
    const { container } = render(
      <RecipeCard title="לזניה" tags={[]} renderLink={link} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('heading').className).toContain('text-display');
  });

  it('leaves out the time and the +N pill when there is nothing to show', () => {
    const { container } = render(
      <RecipeCard title="לזניה" tags={['ערב']} renderLink={link} />,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it('shows just the title when it has neither tags nor time', () => {
    const { container } = render(
      <RecipeCard title="לזניה" tags={[]} renderLink={link} />,
    );
    expect(container.querySelector('.text-label')).toBeNull();
  });

  it('renders +N without a label when none is given', () => {
    render(
      <RecipeCard title="לזניה" tags={['א', 'ב', 'ג']} renderLink={link} />,
    );
    expect(screen.getByText('+1').getAttribute('aria-label')).toBeNull();
  });
});

describe('RecipeCardSkeleton', () => {
  it('is hidden from assistive technology', () => {
    const { container } = render(<RecipeCardSkeleton />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});

describe('SearchField', () => {
  it('is a labelled search box that reports typing', () => {
    const onValueChange = vi.fn();
    render(
      <SearchField
        value=""
        onValueChange={onValueChange}
        label="חיפוש מתכונים"
        clearLabel="ניקוי"
      />,
    );
    fireEvent.change(screen.getByRole('searchbox', { name: 'חיפוש מתכונים' }), {
      target: { value: 'עוף' },
    });
    expect(onValueChange).toHaveBeenCalledWith('עוף');
    expect(screen.queryByRole('button', { name: 'ניקוי' })).toBeNull();
  });

  it('clears through the x button once it has text', () => {
    const onValueChange = vi.fn();
    render(
      <SearchField
        value="עוף"
        onValueChange={onValueChange}
        label="חיפוש מתכונים"
        clearLabel="ניקוי"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'ניקוי' }));
    expect(onValueChange).toHaveBeenCalledWith('');
  });
});

describe('TagFilter', () => {
  const options = [
    { id: 'a', label: 'בוקר' },
    { id: 'b', label: 'ערב' },
  ];

  function setup(selectedIds: string[] = [], fastPressed = false) {
    const onSelectedIdsChange = vi.fn();
    const onPressedChange = vi.fn();
    render(
      <DirectionProvider dir="rtl">
        <TagFilter
          label="תגיות"
          allLabel="הכל"
          options={options}
          selectedIds={selectedIds}
          onSelectedIdsChange={onSelectedIdsChange}
          fast={{
            label: 'עד 30 דקות',
            pressed: fastPressed,
            onPressedChange,
          }}
        />
      </DirectionProvider>,
    );
    return { onSelectedIdsChange, onPressedChange };
  }

  const pressed = (name: string) =>
    screen.getByRole('button', { name }).getAttribute('aria-pressed');

  it('starts with "הכל" pressed when nothing is selected', () => {
    setup();
    expect(pressed('הכל')).toBe('true');
    expect(pressed('בוקר')).toBe('false');
    expect(pressed('עד 30 דקות')).toBe('false');
    expect(screen.getByRole('toolbar', { name: 'תגיות' })).toBeTruthy();
  });

  it('adds a tag to the selection', () => {
    const { onSelectedIdsChange } = setup(['a']);
    expect(pressed('הכל')).toBe('false');
    expect(pressed('בוקר')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'ערב' }));
    expect(onSelectedIdsChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('removes a tag from the selection', () => {
    const { onSelectedIdsChange } = setup(['a', 'b']);
    fireEvent.click(screen.getByRole('button', { name: 'בוקר' }));
    expect(onSelectedIdsChange).toHaveBeenCalledWith(['b']);
  });

  it('clears the tags with "הכל"', () => {
    const { onSelectedIdsChange } = setup(['a', 'b']);
    fireEvent.click(screen.getByRole('button', { name: 'הכל' }));
    expect(onSelectedIdsChange).toHaveBeenCalledWith([]);
  });

  it('does nothing when "הכל" is pressed while already selected', () => {
    const { onSelectedIdsChange, onPressedChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'הכל' }));
    expect(onSelectedIdsChange).not.toHaveBeenCalled();
    expect(onPressedChange).not.toHaveBeenCalled();
  });

  it('toggles the quick chip on its own', () => {
    const { onSelectedIdsChange, onPressedChange } = setup(['a']);
    fireEvent.click(screen.getByRole('button', { name: 'עד 30 דקות' }));
    expect(onPressedChange).toHaveBeenCalledWith(true);
    expect(onSelectedIdsChange).not.toHaveBeenCalled();
  });

  it('turns the quick chip off', () => {
    const { onPressedChange } = setup([], true);
    expect(pressed('עד 30 דקות')).toBe('true');
    expect(pressed('הכל')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'עד 30 דקות' }));
    expect(onPressedChange).toHaveBeenCalledWith(false);
  });
});

describe('EmptyState', () => {
  it('shows a heading, text and actions', () => {
    render(
      <EmptyState
        title="עוד אין כאן מתכונים"
        description="אפשר לחזור מאוחר יותר"
        actions={<button type="button">רענון</button>}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'עוד אין כאן מתכונים' }),
    ).toBeTruthy();
    expect(screen.getByText('אפשר לחזור מאוחר יותר')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'רענון' })).toBeTruthy();
  });

  it('can be just a heading', () => {
    render(<EmptyState title="עוד אין כאן מתכונים" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('p')).toBeNull();
  });
});
