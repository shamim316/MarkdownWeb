import { useMemo } from 'react';
import type { CursorInfo } from './Editor';

interface StatusBarProps {
  content: string;
  cursor: CursorInfo;
  canSaveInPlace: boolean;
}

export function countWords(text: string): number {
  // Ignore embedded image data so a pasted screenshot doesn't count as a "word".
  const stripped = text.replace(/data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+/g, '');
  const words = stripped.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu);
  return words ? words.length : 0;
}

export default function StatusBar({ content, cursor, canSaveInPlace }: StatusBarProps) {
  const words = useMemo(() => countWords(content), [content]);
  const minutes = Math.max(1, Math.round(words / 230));

  return (
    <footer className="status-bar">
      <span>
        {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
      </span>
      <span>{content.length.toLocaleString()} characters</span>
      <span className="hide-narrow">{minutes} min read</span>
      <span className="spacer" />
      <span className="hide-narrow" title={canSaveInPlace ? undefined : 'Use Chrome or Edge to save files in place'}>
        {canSaveInPlace ? 'Saves to disk' : 'Saves as download'}
      </span>
      <span>
        Ln {cursor.line}, Col {cursor.col}
      </span>
      <span className="hide-narrow">Markdown</span>
    </footer>
  );
}
