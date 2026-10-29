/**
 * Local file open/save. Uses the File System Access API where available (Chrome, Edge, Opera)
 * so saves overwrite the real file; elsewhere falls back to <input type=file> and downloads.
 */

export const supportsFileSystemAccess =
  typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';

const MARKDOWN_TYPES: FilePickerAcceptType[] = [
  { description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.txt'] } },
];

export interface OpenedFile {
  name: string;
  content: string;
  handle: FileSystemFileHandle | null;
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export async function openFile(): Promise<OpenedFile | null> {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({ types: MARKDOWN_TYPES, multiple: false });
      const file = await handle.getFile();
      return { name: file.name, content: await file.text(), handle };
    } catch (err) {
      if (isAbortError(err)) return null;
      throw err;
    }
  }
  return openWithInput();
}

function openWithInput(): Promise<OpenedFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.mdown,.txt,text/markdown,text/plain';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then((content) => resolve({ name: file.name, content, handle: null }), reject);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export async function writeToHandle(handle: FileSystemFileHandle, content: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

/** Ask the user where to save. Returns null if they cancel. */
export async function pickSaveLocation(suggestedName: string): Promise<FileSystemFileHandle | null> {
  if (!window.showSaveFilePicker) return null;
  try {
    return await window.showSaveFilePicker({ suggestedName, types: MARKDOWN_TYPES });
  } catch (err) {
    if (isAbortError(err)) return null;
    throw err;
  }
}

export function downloadFile(name: string, content: string, mime = 'text/markdown;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ensureExtension(name: string, ext = '.md'): string {
  const trimmed = name.trim() || 'Untitled';
  return /\.(md|markdown|mdown|txt)$/i.test(trimmed) ? trimmed : trimmed + ext;
}

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
