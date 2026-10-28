import type { Meta, StoryObj } from '@storybook/react-vite';
import { BackLink } from './back-link';

const meta = { title: 'Shell/BackLink' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <BackLink
      label="חזרה למתכונים"
      link={(children) => <a href="#library">{children}</a>}
    />
  ),
};
