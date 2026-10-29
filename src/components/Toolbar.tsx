import { useRef } from 'react';
import Icon, { type IconName } from './Icon';
import type { CommandName } from '../lib/editorCommands';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';
const ALT = isMac ? '⌥' : 'Alt';

interface ToolButton {
  command: CommandName;
  label: string;
  icon?: IconName;
  text?: string;
  shortcut?: string;
}

const GROUPS: ToolButton[][] = [
  [
    { command: 'h1', label: 'Heading 1', text: 'H1', shortcut: `${MOD}+${ALT}+1` },
    { command: 'h2', label: 'Heading 2', text: 'H2', shortcut: `${MOD}+${ALT}+2` },
    { command: 'h3', label: 'Heading 3', text: 'H3', shortcut: `${MOD}+${ALT}+3` },
  ],
  [
    { command: 'bold', label: 'Bold', icon: 'bold', shortcut: `${MOD}+B` },
    { command: 'italic', label: 'Italic', icon: 'italic', shortcut: `${MOD}+I` },
    { command: 'strike', label: 'Strikethrough', icon: 'strike', shortcut: `${MOD}+Shift+X` },
    { command: 'code', label: 'Inline code', icon: 'code', shortcut: `${MOD}+E` },
  ],
  [
    { command: 'bullet', label: 'Bulleted list', icon: 'bullet', shortcut: `${MOD}+Shift+8` },
    { command: 'ordered', label: 'Numbered list', icon: 'ordered', shortcut: `${MOD}+Shift+7` },
    { command: 'task', label: 'Task list', icon: 'task', shortcut: `${MOD}+Shift+9` },
    { command: 'quote', label: 'Quote', icon: 'quote' },
  ],
  [
    { command: 'link', label: 'Link', icon: 'link', shortcut: `${MOD}+K` },
    { command: 'codeBlock', label: 'Code block', icon: 'codeBlock' },
    { command: 'table', label: 'Table', icon: 'table' },
    { command: 'hr', label: 'Horizontal rule', icon: 'hr' },
  ],
];

interface ToolbarProps {
  onCommand: (command: CommandName) => void;
  onImages: (files: File[]) => void;
}

export default function Toolbar({ onCommand, onImages }: ToolbarProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {GROUPS.map((group, i) => (
        <div className="toolbar-group" key={i}>
          {group.map((b) => (
            <button
              key={b.command}
              type="button"
              className="tool-btn"
              title={b.shortcut ? `${b.label} (${b.shortcut})` : b.label}
              aria-label={b.label}
              // Keep focus (and the selection) in the editor.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onCommand(b.command)}
            >
              {b.icon ? <Icon name={b.icon} /> : <span className="tool-text">{b.text}</span>}
            </button>
          ))}
          {i === GROUPS.length - 1 && (
            <button
              type="button"
              className="tool-btn"
              title="Insert image (or paste / drop one into the editor)"
              aria-label="Insert image"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fileInput.current?.click()}
            >
              <Icon name="image" />
            </button>
          )}
        </div>
      ))}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onImages(files);
        }}
      />
    </div>
  );
}
