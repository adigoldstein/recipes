import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IngredientBoard, RecipeDetailSkeleton } from './ingredient-board';
import { IngredientLine } from './ingredient-line';
import { StepItem } from './step-item';

const meta = { title: 'Detail/Pieces' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;

export const IngredientLines: Story = {
  name: 'IngredientLine',
  render: () => (
    <IngredientBoard title="מצרכים">
      <IngredientLine
        quantity={{ amount: '2', unit: 'כוסות' }}
        name="קמח"
        note="מנופה"
        checked={false}
        onCheckedChange={noop}
      />
      <IngredientLine
        quantity={{ amount: '227', unit: 'גרם' }}
        source={{ amount: '8', unit: 'oz' }}
        name="גבינת שמנת"
        checked={false}
        onCheckedChange={noop}
      />
      <IngredientLine
        quantity={{ amount: '3' }}
        name="ביצים"
        originalHint="במקור 2 יחידות"
        checked
        onCheckedChange={noop}
      />
      <IngredientLine
        name="מלח"
        toTasteLabel="לפי הטעם"
        checked={false}
        onCheckedChange={noop}
      />
    </IngredientBoard>
  ),
};

export const StepItems: Story = {
  name: 'StepItem',
  render: function Render() {
    const [done, setDone] = useState(false);
    return (
      <ol className="max-w-detail">
        <StepItem
          number={1}
          text="מחממים תנור ל־180 מעלות."
          originalText="במקור: Preheat oven to 350°F."
          checked={done}
          onCheckedChange={setDone}
        />
        <StepItem
          number={2}
          text="מערבבים את כל החומרים."
          checked={false}
          onCheckedChange={noop}
        />
      </ol>
    );
  },
};

export const DetailSkeleton: Story = {
  name: 'RecipeDetailSkeleton',
  render: () => <RecipeDetailSkeleton />,
};
