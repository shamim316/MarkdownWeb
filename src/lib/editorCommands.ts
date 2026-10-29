import { EditorSelection, type ChangeSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/** Toggle an inline wrapper (e.g. ** for bold) around each selection. */
export function toggleWrap(view: EditorView, marker: string, placeholder = 'text'): boolean {
  const { state } = view;
  const tr = state.changeByRange((range) => {
    const len = marker.length;
    const before = state.sliceDoc(range.from - len, range.from);
    const after = state.sliceDoc(range.to, range.to + len);
    if (before === marker && after === marker) {
      return {
        changes: [
          { from: range.from - len, to: range.from },
          { from: range.to, to: range.to + len },
        ],
        range: EditorSelection.range(range.from - len, range.to - len),
      };
    }
    const selected = state.sliceDoc(range.from, range.to);
    if (selected.length >= len * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
      const inner = selected.slice(len, -len);
      return {
        changes: { from: range.from, to: range.to, insert: inner },
        range: EditorSelection.range(range.from, range.from + inner.length),
      };
    }
    const text = selected || placeholder;
    return {
      changes: { from: range.from, to: range.to, insert: marker + text + marker },
      range: EditorSelection.range(range.from + len, range.from + len + text.length),
    };
  });
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: 'input' }));
  view.focus();
  return true;
}

const BLOCK_PREFIX = /^(\s*)(#{1,6}\s|>\s?|[-*+]\s\[[ xX]\]\s|[-*+]\s|\d+[.)]\s)?/;

/**
 * Set or toggle a line prefix (heading, quote, list) on every selected line.
 * `prefix` may contain `{n}` for ordered-list numbering.
 */
export function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  const { state } = view;
  const lines = new Set<number>();
  for (const r of state.selection.ranges) {
    for (let pos = r.from; pos <= r.to; ) {
      const line = state.doc.lineAt(pos);
      lines.add(line.number);
      pos = line.to + 1;
    }
  }
  const numbers = [...lines].sort((a, b) => a - b);
  const prefixes = numbers.map((_n, i) => prefix.replace('{n}', String(i + 1)));
  const allHave = numbers.every((n) => {
    const m = BLOCK_PREFIX.exec(state.doc.line(n).text);
    return m?.[2] !== undefined && normalize(m[2]) === normalize(prefix);
  });
  const changes: ChangeSpec[] = numbers.map((n, i) => {
    const line = state.doc.line(n);
    const m = BLOCK_PREFIX.exec(line.text)!;
    const from = line.from + m[1].length;
    const to = from + (m[2]?.length ?? 0);
    return { from, to, insert: allHave ? '' : prefixes[i] };
  });
  view.dispatch({ changes, scrollIntoView: true, userEvent: 'input' });
  view.focus();
  return true;
}

function normalize(prefix: string): string {
  return prefix.trim().replace(/\d+/, 'N').replace('{n}', 'N').replace(/\[[xX]\]/, '[ ]');
}

/** Insert a block of text on its own line(s), replacing the selection. */
export function insertBlock(view: EditorView, text: string, cursorOffset?: number): boolean {
  const { state } = view;
  const range = state.selection.main;
  const line = state.doc.lineAt(range.from);
  const needsLeadingBreak = range.from > line.from || line.text.trim() !== '';
  const lead = needsLeadingBreak ? (range.from === line.to ? '\n\n' : '\n') : '';
  const insert = lead + text + '\n';
  const anchor = range.from + lead.length + (cursorOffset ?? text.length);
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor },
    scrollIntoView: true,
    userEvent: 'input',
  });
  view.focus();
  return true;
}

/** Insert inline text at the cursor, optionally selecting a sub-range of it. */
export function insertInline(view: EditorView, text: string, selectFrom?: number, selectTo?: number): boolean {
  const range = view.state.selection.main;
  const base = range.from;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection:
      selectFrom !== undefined
        ? { anchor: base + selectFrom, head: base + (selectTo ?? selectFrom) }
        : { anchor: base + text.length },
    scrollIntoView: true,
    userEvent: 'input',
  });
  view.focus();
  return true;
}

export function insertLink(view: EditorView): boolean {
  const range = view.state.selection.main;
  const label = view.state.sliceDoc(range.from, range.to) || 'link text';
  const text = `[${label}](https://)`;
  const urlStart = label.length + 3;
  return insertInline(view, text, urlStart, urlStart + 8);
}

export function insertImageMarkdown(view: EditorView, alt: string, src: string): boolean {
  const safeAlt = alt.replace(/[[\]]/g, '');
  return insertInline(view, `![${safeAlt}](${src})`);
}

export function insertCodeBlock(view: EditorView): boolean {
  const range = view.state.selection.main;
  const selected = view.state.sliceDoc(range.from, range.to);
  return insertBlock(view, '```\n' + selected + '\n```', 4 + selected.length);
}

export const TABLE_TEMPLATE = '| Column 1 | Column 2 |\n| -------- | -------- |\n| Cell     | Cell     |';

export const commands = {
  bold: (v: EditorView) => toggleWrap(v, '**', 'bold text'),
  italic: (v: EditorView) => toggleWrap(v, '*', 'italic text'),
  strike: (v: EditorView) => toggleWrap(v, '~~', 'struck text'),
  code: (v: EditorView) => toggleWrap(v, '`', 'code'),
  h1: (v: EditorView) => toggleLinePrefix(v, '# '),
  h2: (v: EditorView) => toggleLinePrefix(v, '## '),
  h3: (v: EditorView) => toggleLinePrefix(v, '### '),
  quote: (v: EditorView) => toggleLinePrefix(v, '> '),
  bullet: (v: EditorView) => toggleLinePrefix(v, '- '),
  ordered: (v: EditorView) => toggleLinePrefix(v, '{n}. '),
  task: (v: EditorView) => toggleLinePrefix(v, '- [ ] '),
  link: insertLink,
  codeBlock: insertCodeBlock,
  table: (v: EditorView) => insertBlock(v, TABLE_TEMPLATE, 2),
  hr: (v: EditorView) => insertBlock(v, '---'),
};

export type CommandName = keyof typeof commands;
