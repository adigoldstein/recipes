import { fireEvent, render, screen } from '@testing-library/react';
import { IngredientBoard, RecipeDetailSkeleton } from './ingredient-board';
import { IngredientLine } from './ingredient-line';
import { StepItem } from './step-item';

const noop = () => undefined;

describe('IngredientLine', () => {
  it('wraps the amount in <bdi> and reads amount, unit, name and note', () => {
    const { container } = render(
      <ul>
        <IngredientLine
          quantity={{ amount: '2', unit: 'כוסות' }}
          name="קמח"
          note="מנופה"
          checked={false}
          onCheckedChange={noop}
        />
      </ul>,
    );
    expect(container.querySelector('bdi')?.textContent).toBe('2');
    expect(
      screen.getByRole('checkbox', { name: '2 כוסות קמח מנופה' }),
    ).toBeTruthy();
  });

  it('reads "name — to taste" without a quantity', () => {
    render(
      <ul>
        <IngredientLine
          name="מלח"
          toTasteLabel="לפי הטעם"
          checked={false}
          onCheckedChange={noop}
        />
      </ul>,
    );
    expect(
      screen.getByRole('checkbox', { name: 'מלח — לפי הטעם' }),
    ).toBeTruthy();
  });

  it('shows a bare count without a unit', () => {
    render(
      <ul>
        <IngredientLine
          quantity={{ amount: '3' }}
          name="ביצים"
          checked={false}
          onCheckedChange={noop}
        />
      </ul>,
    );
    expect(screen.getByRole('checkbox', { name: '3 ביצים' })).toBeTruthy();
  });

  it('shows the source value with the converted one in parentheses', () => {
    render(
      <ul>
        <IngredientLine
          quantity={{ amount: '227', unit: 'גרם' }}
          source={{ amount: '8', unit: 'oz' }}
          name="גבינה"
          checked={false}
          onCheckedChange={noop}
        />
      </ul>,
    );
    expect(
      screen.getByRole('checkbox', { name: '8 oz (227 גרם) גבינה' }),
    ).toBeTruthy();
  });

  it('links the hint to the checkbox', () => {
    render(
      <ul>
        <IngredientLine
          quantity={{ amount: '3' }}
          name="ביצים"
          originalHint="במקור 2 יחידות"
          checked={false}
          onCheckedChange={noop}
        />
      </ul>,
    );
    expect(screen.getByRole('checkbox').getAttribute('aria-describedby')).toBe(
      screen.getByText('במקור 2 יחידות').id,
    );
  });

  it('has no description without a hint, and reports ticks', () => {
    const onCheckedChange = vi.fn();
    render(
      <ul>
        <IngredientLine
          name="מלח"
          checked={false}
          onCheckedChange={onCheckedChange}
        />
      </ul>,
    );
    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('aria-describedby')).toBeNull();
    fireEvent.click(box);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('strikes a ticked line through', () => {
    render(
      <ul>
        <IngredientLine name="מלח" checked onCheckedChange={noop} />
      </ul>,
    );
    expect(screen.getByText('מלח').parentElement?.className).toContain(
      'line-through',
    );
  });
});

describe('StepItem', () => {
  it('shows its number, text and original text, and reports ticks', () => {
    const onCheckedChange = vi.fn();
    render(
      <ol>
        <StepItem
          number={2}
          text="אופים"
          originalText="במקור: Bake"
          checked={false}
          onCheckedChange={onCheckedChange}
        />
      </ol>,
    );
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('במקור: Bake')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('has no original line without one, and strikes a ticked step', () => {
    render(
      <ol>
        <StepItem number={1} text="אופים" checked onCheckedChange={noop} />
      </ol>,
    );
    expect(screen.getByText('אופים').parentElement?.className).toContain(
      'line-through',
    );
  });
});

describe('IngredientBoard', () => {
  it('holds a heading and a list of lines', () => {
    render(
      <IngredientBoard title="מצרכים">
        <IngredientLine name="מלח" checked={false} onCheckedChange={noop} />
      </IngredientBoard>,
    );
    expect(screen.getByRole('heading', { name: 'מצרכים' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('has a skeleton hidden from assistive tech', () => {
    const { container } = render(<RecipeDetailSkeleton />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});
