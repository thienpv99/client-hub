// File picking for task actions: the native <input type="file"> stays hidden (its browser text is English) and is
// opened from an i18n Button. Picked files become UploadInput: data: URL when small, else an object URL.
import { useCallback, useRef } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import type { UploadInput } from '@/services/contract';
import { INLINE_UPLOAD_MAX_BYTES } from './taskHelpers';

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('read failed')));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

export async function toUploadInput(file: File): Promise<UploadInput> {
  const url = file.size <= INLINE_UPLOAD_MAX_BYTES ? await readAsDataUrl(file) : URL.createObjectURL(file);
  return { name: file.name, mime: file.type || 'application/octet-stream', size: file.size, url };
}

export function toUploadInputs(files: File[]): Promise<UploadInput[]> {
  return Promise.all(files.map(toUploadInput));
}

export interface FilePicker {
  /** opens the OS file picker */
  open(): void;
  /** the hidden input — render it once */
  input: ReactNode;
}

export function useFilePicker(opts: { multiple?: boolean; accept?: string; onPick: (files: File[]) => void }): FilePicker {
  const ref = useRef<HTMLInputElement | null>(null);
  const onPickRef = useRef(opts.onPick);
  onPickRef.current = opts.onPick;

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    // allow picking the same file again later
    e.target.value = '';
    if (list.length > 0) onPickRef.current(list);
  }, []);

  const open = useCallback(() => ref.current?.click(), []);

  const input = (
    <input
      ref={ref}
      type="file"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      multiple={opts.multiple}
      accept={opts.accept}
      onChange={onChange}
    />
  );
  return { open, input };
}
