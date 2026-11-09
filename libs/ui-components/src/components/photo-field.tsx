import { useRef } from 'react';
import { ImagePlus, Trash2, Undo2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { FormField } from './form-field';

export interface PhotoFieldProps {
  id: string;
  label: string;
  /** The limits, shown under the field (for example "JPEG, PNG או WebP, עד 10 מ״ב"). */
  hint: string;
  /**
   * The picture to show: the saved photo's thumbnail, or a preview of the chosen
   * file.
   */
  previewUrl?: string;
  previewAlt: string;
  /** How much was uploaded so far (0 to 1) while a file uploads. Otherwise undefined. */
  progress?: number;
  /** Why the last choice or upload failed. */
  error?: string;
  /** The file types the file picker accepts (`accept`). */
  accept: string;
  labels: {
    add: string;
    replace: string;
    remove: string;
    /** The progress bar's name. The percentage is shown after it. */
    uploading: string;
    /**
     * The text of the button that brings back a removed saved photo. Needed only
     * with `onRestore`.
     */
    restore?: string;
  };
  onSelect: (file: File) => void;
  onRemove: () => void;
  /**
   * Passed when a saved photo was removed but the recipe was not saved yet. Shows a
   * button to bring the photo back.
   */
  onRestore?: () => void;
  className?: string;
}

/**
 * The photo field of the recipe form (UX-DR12): "הוספת תמונה" when there is no photo,
 * and then the thumbnail with "החלפה" and "הסרה". A chosen file is passed to
 * `onSelect` right away. The parent uploads it and passes `progress`.
 */
export function PhotoField({
  id,
  label,
  hint,
  previewUrl,
  previewAlt,
  progress,
  error,
  accept,
  labels,
  onSelect,
  onRemove,
  onRestore,
  className,
}: PhotoFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const uploading = progress !== undefined;
  const percent = Math.round((progress ?? 0) * 100);
  return (
    <FormField
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={className}
    >
      {(control) => (
        <div
          role="group"
          aria-label={label}
          aria-describedby={control['aria-describedby']}
          className="flex flex-col gap-3"
        >
          {/* The real file input is hidden from the keyboard and screen readers. The
              buttons are the control, and clicking them opens the file picker. */}
          <input
            ref={input}
            id={id}
            type="file"
            accept={accept}
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Clear the input, so choosing the same file again still counts as a
              // change.
              event.target.value = '';
              if (file) onSelect(file);
            }}
          />
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={previewAlt}
              width={600}
              height={450}
              className={cn(
                'aspect-4/3 w-full max-w-xs rounded-md object-cover',
                uploading && 'opacity-60',
              )}
            />
          ) : null}
          {uploading ? (
            <div className="flex max-w-xs flex-col gap-1 text-sm">
              <progress
                aria-label={labels.uploading}
                value={percent}
                max={100}
                className="h-2 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
              />
              <span className="text-muted-foreground" aria-hidden="true">
                {labels.uploading} {percent}%
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              <ImagePlus aria-hidden="true" />
              {previewUrl ? labels.replace : labels.add}
            </Button>
            {previewUrl ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={uploading}
                onClick={onRemove}
              >
                <Trash2 aria-hidden="true" />
                {labels.remove}
              </Button>
            ) : null}
            {!previewUrl && !uploading && onRestore ? (
              <Button type="button" variant="ghost" onClick={onRestore}>
                <Undo2 aria-hidden="true" />
                {labels.restore}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </FormField>
  );
}
