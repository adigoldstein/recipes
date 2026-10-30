import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoField, type PhotoFieldProps } from './photo-field';

const LABELS = {
  add: 'הוספת תמונה',
  replace: 'החלפה',
  remove: 'הסרה',
  uploading: 'מעלה תמונה',
};

function setup(props: Partial<PhotoFieldProps> = {}) {
  const onSelect = vi.fn();
  const onRemove = vi.fn();
  const { container } = render(
    <PhotoField
      id="recipe-photo"
      label="תמונה"
      hint="JPEG, PNG או WebP, עד 10 מ״ב"
      previewAlt="תצוגה מקדימה"
      accept="image/jpeg,image/png,image/webp"
      labels={LABELS}
      onSelect={onSelect}
      onRemove={onRemove}
      {...props}
    />,
  );
  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  return { onSelect, onRemove, input, container };
}

describe('PhotoField', () => {
  it('offers only "הוספת תמונה" before there is a photo, with the limits beside it', () => {
    setup();
    expect(screen.getByRole('button', { name: 'הוספת תמונה' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'הסרה' })).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('JPEG, PNG או WebP, עד 10 מ״ב')).toBeTruthy();
    const group = screen.getByRole('group', { name: 'תמונה' });
    expect(group.getAttribute('aria-describedby')).toContain(
      'recipe-photo-hint',
    );
  });

  it('accepts the three image types, with no camera capture, out of the tab order', () => {
    const { input } = setup();
    expect(input.getAttribute('accept')).toBe(
      'image/jpeg,image/png,image/webp',
    );
    expect(input.hasAttribute('capture')).toBe(false);
    expect(input.tabIndex).toBe(-1);
    expect(input.getAttribute('aria-hidden')).toBe('true');
  });

  it('opens the picker from the button and hands the chosen file to onSelect', async () => {
    const user = userEvent.setup();
    const { input, onSelect } = setup();
    const click = vi.spyOn(input, 'click');
    await user.click(screen.getByRole('button', { name: 'הוספת תמונה' }));
    expect(click).toHaveBeenCalledTimes(1);

    const file = new File(['x'], 'cake.jpg', { type: 'image/jpeg' });
    await user.upload(input, file);
    expect(onSelect).toHaveBeenCalledWith(file);
  });

  it('lets the same file be picked twice in a row', () => {
    const { input, onSelect } = setup();
    const file = new File(['x'], 'cake.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('ignores a pick with no file', () => {
    const { input, onSelect } = setup();
    fireEvent.change(input, { target: { files: [] } });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows the thumbnail with "החלפה" and "הסרה" when there is a photo', async () => {
    const user = userEvent.setup();
    const { onRemove } = setup({ previewUrl: '/media/photos/a-thumb.webp' });
    const photo = screen.getByRole('img', { name: 'תצוגה מקדימה' });
    expect(photo.getAttribute('src')).toBe('/media/photos/a-thumb.webp');
    expect(photo.getAttribute('width')).toBe('600');
    expect(screen.getByRole('button', { name: 'החלפה' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'הוספת תמונה' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'הסרה' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('shows a labelled progress bar and locks the buttons while uploading', () => {
    setup({ previewUrl: 'blob:preview', progress: 0.45 });
    const bar = screen.getByRole('progressbar', { name: 'מעלה תמונה' });
    expect(bar.getAttribute('value')).toBe('45');
    expect(bar.getAttribute('max')).toBe('100');
    expect(screen.getByText('מעלה תמונה 45%')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'החלפה' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'הסרה' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('offers to bring a removed photo back, only when told to', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const { container } = render(
      <PhotoField
        id="p"
        label="תמונה"
        hint="x"
        previewAlt="y"
        accept="image/webp"
        labels={{ ...LABELS, restore: 'החזרת התמונה' }}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onRestore={onRestore}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'החזרת התמונה' }));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('does not offer to bring a photo back while one is shown or uploading', () => {
    setup({ previewUrl: 'blob:preview' });
    expect(screen.queryByRole('button', { name: 'החזרת התמונה' })).toBeNull();
  });

  it('shows no progress bar when it is not uploading, and 0% at the start', () => {
    const { container } = setup({ previewUrl: 'blob:preview' });
    expect(container.querySelector('progress')).toBeNull();
    setup({ progress: 0 });
    expect(screen.getByText('מעלה תמונה 0%')).toBeTruthy();
  });

  it('shows the error and ties it to the group', () => {
    setup({ error: 'אפשר להעלות תמונה בפורמט JPEG, PNG או WebP' });
    expect(
      screen.getByText('אפשר להעלות תמונה בפורמט JPEG, PNG או WebP').id,
    ).toBe('recipe-photo-error');
    expect(
      screen
        .getByRole('group', { name: 'תמונה' })
        .getAttribute('aria-describedby'),
    ).toContain('recipe-photo-error');
  });
});
