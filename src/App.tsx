import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import Editor, { type CursorInfo, type EditorHandle } from './components/Editor';
import Preview, { type PreviewHandle } from './components/Preview';
import StatusBar from './components/StatusBar';
import Icon from './components/Icon';
import { renderMarkdown } from './lib/markdown';
import { commands, type CommandName } from './lib/editorCommands';
import {
  downloadFile,
  ensureExtension,
  openFile,
  pickSaveLocation,
  supportsFileSystemAccess,
  writeToHandle,
} from './lib/fileAccess';
import { buildStandaloneHtml, htmlFileName } from './lib/exportHtml';
import { SAMPLE_DOCUMENT } from './lib/sample';
import {
  DEFAULT_PREFS,
  DRAFT_KEY,
  PREFS_KEY,
  loadJson,
  remove,
  saveJson,
  type Draft,
  type Prefs,
  type ResolvedTheme,
  type ThemePref,
  clampFontSize,
} from './lib/storage';

const UNTITLED = 'Untitled.md';

function useSystemDark(): boolean {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

export default function App() {
  const editorRef = useRef<EditorHandle>(null);
  const previewRef = useRef<PreviewHandle>(null);
  const mainRef = useRef<HTMLElement>(null);
  const handleRef = useRef<FileSystemFileHandle | null>(null);

  const [content, setContent] = useState(SAMPLE_DOCUMENT);
  // What's on disk; null means the document has never been saved (always "unsaved").
  const [savedContent, setSavedContent] = useState<string | null>(SAMPLE_DOCUMENT);
  const [fileName, setFileName] = useState(UNTITLED);
  const [savedFileName, setSavedFileName] = useState(UNTITLED);
  const [cursor, setCursor] = useState<CursorInfo>({ line: 1, col: 1 });
  const [html, setHtml] = useState(() => renderMarkdown(SAMPLE_DOCUMENT));
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const stored = { ...DEFAULT_PREFS, ...loadJson<Partial<Prefs>>(PREFS_KEY) };
    return { ...stored, editorFontSize: clampFontSize(Number(stored.editorFontSize) || DEFAULT_PREFS.editorFontSize) };
  });
  const [recovered, setRecovered] = useState<Draft | null>(() => loadJson<Draft>(DRAFT_KEY));
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const dirty = savedContent === null || content !== savedContent || fileName !== savedFileName;

  // Theme
  const systemDark = useSystemDark();
  const theme: ResolvedTheme = prefs.theme === 'system' ? (systemDark ? 'dark' : 'light') : prefs.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => saveJson(PREFS_KEY, prefs), [prefs]);
  const updatePrefs = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));

  // Live preview (debounced; longer for big documents such as ones with embedded images).
  useEffect(() => {
    const t = setTimeout(() => setHtml(renderMarkdown(content)), content.length > 100_000 ? 300 : 80);
    return () => clearTimeout(t);
  }, [content]);

  // Draft recovery: keep unsaved work in localStorage. Paused while the restore prompt is showing.
  useEffect(() => {
    if (recovered) return;
    const t = setTimeout(() => {
      if (dirty) saveJson(DRAFT_KEY, { content, fileName, savedAt: Date.now() } satisfies Draft);
      else remove(DRAFT_KEY);
    }, 400);
    return () => clearTimeout(t);
  }, [content, fileName, dirty, recovered]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    document.title = `${dirty ? '● ' : ''}${fileName} — MarkdownWeb`;
  }, [dirty, fileName]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  /** Load a document into the editor and mark it as the saved baseline. */
  const loadDocument = useCallback((text: string, name: string, baseline: string | null) => {
    editorRef.current?.setContent(text);
    setContent(text);
    setSavedContent(baseline);
    setFileName(name);
    setSavedFileName(name);
    setCursor({ line: 1, col: 1 });
  }, []);

  const confirmDiscard = () => !dirty || window.confirm('You have unsaved changes. Discard them?');

  const currentText = () => editorRef.current?.view?.state.doc.toString() ?? content;

  const markSaved = (text: string, name: string) => {
    setSavedContent(text);
    setSavedFileName(name);
    setFileName(name);
  };

  const saveAs = async () => {
    const text = currentText();
    const name = ensureExtension(fileName);
    try {
      if (supportsFileSystemAccess) {
        const handle = await pickSaveLocation(name);
        if (!handle) return;
        await writeToHandle(handle, text);
        handleRef.current = handle;
        markSaved(text, handle.name);
      } else {
        downloadFile(name, text);
        markSaved(text, name);
        setToast('Downloaded to your Downloads folder. This browser can’t overwrite files in place.');
      }
    } catch (err) {
      setToast(`Couldn’t save: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const save = async () => {
    const handle = handleRef.current;
    // Saving in place only makes sense if the file hasn't been renamed since it was opened/saved.
    if (handle && handle.name === fileName) {
      const text = currentText();
      try {
        await writeToHandle(handle, text);
        markSaved(text, fileName);
      } catch (err) {
        setToast(`Couldn’t save: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }
    await saveAs();
  };

  const open = async () => {
    if (!confirmDiscard()) return;
    try {
      const file = await openFile();
      if (!file) return;
      handleRef.current = file.handle;
      loadDocument(file.content, file.name, file.content);
      setRecovered(null);
    } catch (err) {
      setToast(`Couldn’t open file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const newDocument = () => {
    if (!confirmDiscard()) return;
    handleRef.current = null;
    loadDocument('', UNTITLED, '');
    setRecovered(null);
  };

  const rename = (name: string) => setFileName(ensureExtension(name));

  const exportHtml = () => {
    const body = previewRef.current?.getRenderedHtml() ?? renderMarkdown(content);
    const title = fileName.replace(/\.(md|markdown|mdown|txt)$/i, '');
    downloadFile(htmlFileName(fileName), buildStandaloneHtml(title, body, theme), 'text/html;charset=utf-8');
  };

  const print = () => {
    // Make sure the preview reflects the latest text before printing.
    setHtml(renderMarkdown(currentText()));
    setTimeout(() => window.print(), 50);
  };

  const restoreDraft = () => {
    if (!recovered) return;
    handleRef.current = null;
    loadDocument(recovered.content, recovered.fileName, null);
    setRecovered(null);
  };

  // Keyboard shortcuts that work anywhere in the app.
  const shortcuts = useRef({ save, saveAs, open });
  shortcuts.current = { save, saveAs, open };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        void (e.shiftKey ? shortcuts.current.saveAs() : shortcuts.current.save());
      } else if (key === 'o' && !e.shiftKey) {
        e.preventDefault();
        void shortcuts.current.open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const runCommand = (name: CommandName) => {
    const view = editorRef.current?.view;
    if (view) commands[name](view);
  };

  // Scroll sync
  const totalLines = useMemo(() => content.split('\n').length, [content]);
  const syncEnabled = prefs.scrollSync && prefs.view === 'split';
  const onEditorScroll = (line: number, fraction: number) => {
    if (syncEnabled) previewRef.current?.scrollToLine(line, fraction);
  };
  const onPreviewScroll = (line: number, fraction: number) => {
    if (syncEnabled) editorRef.current?.scrollToLine(line, fraction);
  };

  // Resizable divider
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const main = mainRef.current!;
    const rect = main.getBoundingClientRect();
    setDragging(true);
    const move = (ev: PointerEvent) => {
      const ratio = (ev.clientX - rect.left) / rect.width;
      updatePrefs({ split: Math.min(0.85, Math.max(0.15, ratio)) });
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const onDividerKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowLeft') updatePrefs({ split: Math.max(0.15, prefs.split - step) });
    else if (e.key === 'ArrowRight') updatePrefs({ split: Math.min(0.85, prefs.split + step) });
    else if (e.key === 'Home' || e.key === 'Enter') updatePrefs({ split: 0.5 });
    else return;
    e.preventDefault();
  };

  const setFontSize = (size: number) => updatePrefs({ editorFontSize: clampFontSize(size) });

  const cycleTheme = () => {
    const order: ThemePref[] = ['system', 'light', 'grey', 'dark'];
    updatePrefs({ theme: order[(order.indexOf(prefs.theme) + 1) % order.length] });
  };

  return (
    <div className={`app view-${prefs.view} ${dragging ? 'is-dragging' : ''}`}>
      <Header
        fileName={fileName}
        dirty={dirty}
        canSaveInPlace={supportsFileSystemAccess}
        theme={prefs.theme}
        view={prefs.view}
        scrollSync={prefs.scrollSync}
        onRename={rename}
        onNew={newDocument}
        onOpen={open}
        onSave={save}
        onSaveAs={saveAs}
        onExportHtml={exportHtml}
        onPrint={print}
        onTheme={cycleTheme}
        onView={(view) => updatePrefs({ view })}
        onScrollSync={() => updatePrefs({ scrollSync: !prefs.scrollSync })}
      />

      {recovered && (
        <div className="banner" role="alert">
          <span>
            Found unsaved changes to <strong>{recovered.fileName}</strong> from{' '}
            {new Date(recovered.savedAt).toLocaleString()}.
          </span>
          <button type="button" className="btn primary small" onClick={restoreDraft}>
            Restore
          </button>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              remove(DRAFT_KEY);
              setRecovered(null);
            }}
          >
            Discard
          </button>
        </div>
      )}

      <main className="workspace" ref={mainRef} style={{ '--split': prefs.split } as React.CSSProperties}>
        <section className="pane editor-pane" aria-label="Editor">
          <Toolbar
            onCommand={runCommand}
            onImages={(files) => void editorRef.current?.insertImages(files)}
            fontSize={prefs.editorFontSize}
            onFontSize={setFontSize}
          />
          <Editor
            ref={editorRef}
            initialContent={SAMPLE_DOCUMENT}
            onChange={setContent}
            onCursor={setCursor}
            onScroll={onEditorScroll}
            fontSize={prefs.editorFontSize}
            onZoom={(delta) => setFontSize(prefs.editorFontSize + delta)}
          />
        </section>

        <div
          className="divider"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and preview"
          aria-valuemin={15}
          aria-valuemax={85}
          aria-valuenow={Math.round(prefs.split * 100)}
          tabIndex={0}
          onPointerDown={startDrag}
          onDoubleClick={() => updatePrefs({ split: 0.5 })}
          onKeyDown={onDividerKey}
        />

        <section className="pane preview-pane" aria-label="Preview">
          <div className="pane-header">Preview</div>
          <Preview ref={previewRef} html={html} totalLines={totalLines} theme={theme} onScroll={onPreviewScroll} />
        </section>
      </main>

      <StatusBar content={content} cursor={cursor} canSaveInPlace={supportsFileSystemAccess} />

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setToast(null)}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
