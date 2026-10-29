import { useEffect, useImperativeHandle, useRef, type CSSProperties, type Ref } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  placeholder,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { HighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { commands, insertImageMarkdown } from '../lib/editorCommands';
import { imageFold } from '../lib/imageFold';
import { readAsDataUrl } from '../lib/fileAccess';

export interface EditorHandle {
  view: EditorView | null;
  /** Replace the whole document (clears undo history). */
  setContent: (text: string) => void;
  scrollToLine: (line: number, fraction: number) => void;
  insertImages: (files: File[]) => Promise<void>;
}

export interface CursorInfo {
  line: number;
  col: number;
}

interface EditorProps {
  ref?: Ref<EditorHandle>;
  initialContent: string;
  onChange: (content: string) => void;
  onCursor: (cursor: CursorInfo) => void;
  /** Reports the top visible source line (0-based) plus how far into that line we are (0..1). */
  onScroll: (line: number, fraction: number) => void;
  fontSize: number;
  /** Ctrl/⌘ + mouse wheel over the editor; delta is +1 (bigger) or -1 (smaller). */
  onZoom: (delta: number) => void;
}

// Colours come from CSS variables so light/dark switching needs no reconfiguration.
const editorTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--editor-bg)', color: 'var(--text)' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--editor-font-size, 14px)',
    lineHeight: '1.65',
  },
  '.cm-content': { padding: '16px 0', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0 20px 0 12px' },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--text-faint)',
    border: 'none',
    paddingLeft: '8px',
  },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-muted)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--editor-selection) !important',
  },
  '.cm-selectionMatch': { backgroundColor: 'var(--editor-match)' },
  '.cm-placeholder': { color: 'var(--text-faint)' },
  '.cm-panels': { backgroundColor: 'var(--surface)', color: 'var(--text)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--border)' },
  '.cm-searchMatch': { backgroundColor: 'var(--editor-match)', outline: '1px solid var(--accent-soft)' },
  '.cm-textfield': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
  },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: 'var(--surface-2)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
  },
});

const markdownHighlight = HighlightStyle.define([
  { tag: t.heading1, fontWeight: '700', fontSize: '1.3em', color: 'var(--syn-heading)' },
  { tag: t.heading2, fontWeight: '700', fontSize: '1.15em', color: 'var(--syn-heading)' },
  { tag: [t.heading3, t.heading4, t.heading5, t.heading6], fontWeight: '700', color: 'var(--syn-heading)' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: 'var(--syn-link)' },
  { tag: t.monospace, color: 'var(--syn-code)' },
  { tag: t.quote, color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.contentSeparator, t.labelName], color: 'var(--syn-mark)' },
  { tag: t.list, color: 'var(--syn-mark)' },
  { tag: t.meta, color: 'var(--syn-mark)' },
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: 'var(--syn-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--syn-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--text-faint)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--syn-function)' },
  { tag: [t.typeName, t.className, t.tagName], color: 'var(--syn-type)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--syn-property)' },
]);

const formattingKeymap = keymap.of([
  { key: 'Mod-b', run: commands.bold },
  { key: 'Mod-i', run: commands.italic },
  { key: 'Mod-k', run: commands.link },
  { key: 'Mod-Shift-x', run: commands.strike },
  { key: 'Mod-e', run: commands.code },
  { key: 'Mod-Alt-1', run: commands.h1 },
  { key: 'Mod-Alt-2', run: commands.h2 },
  { key: 'Mod-Alt-3', run: commands.h3 },
  { key: 'Mod-Shift-8', run: commands.bullet },
  { key: 'Mod-Shift-7', run: commands.ordered },
  { key: 'Mod-Shift-9', run: commands.task },
]);

function imageFiles(list: FileList | null | undefined): File[] {
  return list ? [...list].filter((f) => f.type.startsWith('image/')) : [];
}

export default function Editor({ ref, initialContent, onChange, onCursor, onScroll, fontSize, onZoom }: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onCursor, onScroll, onZoom });
  callbacks.current = { onChange, onCursor, onScroll, onZoom };
  // Set while we scroll the editor programmatically, so it doesn't echo back to the preview.
  const suppressScroll = useRef(0);
  const extensionsRef = useRef<Extension[]>([]);

  const insertImages = async (files: File[]) => {
    const view = viewRef.current;
    if (!view) return;
    for (const file of files) {
      const dataUrl = await readAsDataUrl(file);
      const alt = file.name.replace(/\.[^.]+$/, '') || 'image';
      insertImageMarkdown(view, alt, dataUrl);
    }
  };
  const insertImagesRef = useRef(insertImages);
  insertImagesRef.current = insertImages;

  useEffect(() => {
    const extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      highlightSelectionMatches(),
      EditorView.lineWrapping,
      placeholder('Start writing markdown…'),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(markdownHighlight),
      editorTheme,
      imageFold,
      formattingKeymap,
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
        if (update.docChanged || update.selectionSet) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          callbacks.current.onCursor({ line: line.number, col: head - line.from + 1 });
        }
      }),
      EditorView.domEventHandlers({
        paste(event) {
          const files = imageFiles(event.clipboardData?.files);
          if (!files.length) return false;
          event.preventDefault();
          void insertImagesRef.current(files);
          return true;
        },
        drop(event, view) {
          const files = imageFiles(event.dataTransfer?.files);
          if (!files.length) return false;
          event.preventDefault();
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos !== null) view.dispatch({ selection: { anchor: pos } });
          void insertImagesRef.current(files);
          return true;
        },
        wheel(event) {
          if (!(event.ctrlKey || event.metaKey) || event.deltaY === 0) return false;
          event.preventDefault();
          callbacks.current.onZoom(event.deltaY < 0 ? 1 : -1);
          return true;
        },
        scroll(_event, view) {
          if (Date.now() < suppressScroll.current) return false;
          const top = view.scrollDOM.scrollTop;
          const block = view.lineBlockAtHeight(top);
          const line = view.state.doc.lineAt(block.from).number - 1;
          const fraction = block.height > 0 ? Math.min(1, Math.max(0, (top - block.top) / block.height)) : 0;
          // At the very bottom, report the end so the preview reaches its end too.
          const atEnd = top + view.scrollDOM.clientHeight >= view.scrollDOM.scrollHeight - 2;
          callbacks.current.onScroll(atEnd ? Number.POSITIVE_INFINITY : line, fraction);
          return false;
        },
      }),
    ];

    extensionsRef.current = extensions;
    const view = new EditorView({
      state: EditorState.create({ doc: initialContent, extensions }),
      parent: hostRef.current!,
    });
    viewRef.current = view;
    view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The editor is created once; later content changes go through setContent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      get view() {
        return viewRef.current;
      },
      setContent(text: string) {
        const view = viewRef.current;
        if (!view) return;
        // A fresh state resets undo history so you can't undo into the previous document.
        // Note: setState does not run update listeners, so the caller tracks the new content itself.
        view.setState(EditorState.create({ doc: text, extensions: extensionsRef.current }));
        view.focus();
      },
      scrollToLine(line: number, fraction: number) {
        const view = viewRef.current;
        if (!view) return;
        const doc = view.state.doc;
        const scroller = view.scrollDOM;
        let target: number;
        if (line >= doc.lines) {
          target = scroller.scrollHeight;
        } else {
          const block = view.lineBlockAt(doc.line(Math.max(1, line + 1)).from);
          target = block.top + block.height * fraction;
        }
        suppressScroll.current = Date.now() + 100;
        scroller.scrollTop = target;
      },
      insertImages,
    }),
  );

  // Line heights change with the font size, so CodeMirror must re-measure.
  useEffect(() => {
    viewRef.current?.requestMeasure();
  }, [fontSize]);

  return (
    <div
      className="editor-host"
      ref={hostRef}
      style={{ '--editor-font-size': `${fontSize}px` } as CSSProperties}
    />
  );
}
