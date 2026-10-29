import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { MOD } from './Toolbar';
import type { ThemePref, ViewMode } from '../lib/storage';

interface HeaderProps {
  fileName: string;
  dirty: boolean;
  canSaveInPlace: boolean;
  theme: ThemePref;
  view: ViewMode;
  scrollSync: boolean;
  onRename: (name: string) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportHtml: () => void;
  onPrint: () => void;
  onTheme: () => void;
  onView: (view: ViewMode) => void;
  onScrollSync: () => void;
}

const THEME_LABEL: Record<ThemePref, string> = {
  system: 'System theme',
  light: 'Light theme',
  grey: 'Grey theme',
  dark: 'Dark theme',
};
const THEME_ICON = { system: 'monitor', light: 'sun', grey: 'contrast', dark: 'moon' } as const;

export function SaveStatus({ dirty }: { dirty: boolean }) {
  return dirty ? (
    <span className="save-status unsaved" role="status" title="Unsaved changes" aria-label="Unsaved changes">
      <span className="unsaved-dot" />
    </span>
  ) : (
    <span className="save-status saved" role="status" title="All changes saved" aria-label="All changes saved">
      <Icon name="check" size={14} />
    </span>
  );
}

function FileName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      const el = input.current!;
      el.focus();
      // Select the base name, not the extension.
      const dot = el.value.lastIndexOf('.');
      el.setSelectionRange(0, dot > 0 ? dot : el.value.length);
    }
  }, [editing]);

  if (editing) {
    const commit = () => {
      setEditing(false);
      if (draft.trim() && draft.trim() !== name) onRename(draft.trim());
    };
    return (
      <input
        ref={input}
        className="filename-input"
        value={draft}
        aria-label="File name"
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className="filename"
      title="Click to rename"
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
    >
      <span className="filename-text">{name}</span>
      <Icon name="pencil" size={13} />
    </button>
  );
}

export default function Header(props: HeaderProps) {
  const { fileName, dirty, canSaveInPlace, theme, view, scrollSync } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  const menuAction = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <span className="logo" aria-hidden="true">
          <Icon name="file" size={18} />
        </span>
        <FileName name={fileName} onRename={props.onRename} />
        <SaveStatus dirty={dirty} />
      </div>

      <div className="header-right">
        <div className="segmented" role="group" aria-label="Layout">
          {(
            [
              ['editor', 'editorOnly', 'Editor only'],
              ['split', 'columns', 'Editor and preview'],
              ['preview', 'previewOnly', 'Preview only'],
            ] as const
          ).map(([mode, icon, label]) => (
            <button
              key={mode}
              type="button"
              className={view === mode ? 'active' : ''}
              aria-pressed={view === mode}
              title={label}
              aria-label={label}
              onClick={() => props.onView(mode)}
            >
              <Icon name={icon} size={16} />
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`icon-btn wide-only ${scrollSync ? 'toggled' : ''}`}
          aria-pressed={scrollSync}
          title={scrollSync ? 'Scroll sync on' : 'Scroll sync off'}
          aria-label="Scroll sync"
          onClick={props.onScrollSync}
        >
          <Icon name="sync" />
        </button>

        <button
          type="button"
          className="icon-btn"
          title={`${THEME_LABEL[theme]} (click to change)`}
          aria-label={THEME_LABEL[theme]}
          onClick={props.onTheme}
        >
          <Icon name={THEME_ICON[theme]} />
        </button>

        <span className="header-divider" />

        <button type="button" className="btn ghost wide-only" onClick={props.onNew} title="New document">
          <Icon name="filePlus" size={16} />
          <span className="btn-label">New</span>
        </button>
        <button type="button" className="btn ghost wide-only" onClick={props.onOpen} title={`Open file (${MOD}+O)`}>
          <Icon name="folderOpen" size={16} />
          <span className="btn-label">Open</span>
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={props.onSave}
          title={
            canSaveInPlace ? `Save (${MOD}+S)` : `Save — downloads a .md file in this browser (${MOD}+S)`
          }
        >
          <Icon name="save" size={16} />
          <span className="btn-label">Save</span>
        </button>

        <div className="menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="icon-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="More actions"
            title="More actions"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Icon name="more" />
          </button>
          {menuOpen && (
            <div className="menu" role="menu">
              <button type="button" role="menuitem" className="narrow-only" onClick={menuAction(props.onNew)}>
                <Icon name="filePlus" size={16} />
                New document
              </button>
              <button type="button" role="menuitem" className="narrow-only" onClick={menuAction(props.onOpen)}>
                <Icon name="folderOpen" size={16} />
                Open…
                <kbd>{MOD}+O</kbd>
              </button>
              <button type="button" role="menuitem" className="narrow-only" onClick={menuAction(props.onScrollSync)}>
                <Icon name="sync" size={16} />
                Scroll sync: {scrollSync ? 'on' : 'off'}
              </button>
              <button type="button" role="menuitem" onClick={menuAction(props.onSaveAs)}>
                <Icon name="save" size={16} />
                Save as…
                <kbd>{MOD}+Shift+S</kbd>
              </button>
              <button type="button" role="menuitem" onClick={menuAction(props.onExportHtml)}>
                <Icon name="download" size={16} />
                Export HTML
              </button>
              <button type="button" role="menuitem" onClick={menuAction(props.onPrint)}>
                <Icon name="printer" size={16} />
                Print / Save as PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
