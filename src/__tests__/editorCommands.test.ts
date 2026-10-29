import { afterEach, describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { commands } from '../lib/editorCommands';
import { countWords } from '../components/StatusBar';

let view: EditorView | null = null;
function setup(doc: string, from: number, to = from): EditorView {
  view = new EditorView({ state: EditorState.create({ doc, selection: { anchor: from, head: to } }) });
  return view;
}
afterEach(() => view?.destroy());

const text = (v: EditorView) => v.state.doc.toString();

describe('editor commands', () => {
  it('toggles bold around a selection', () => {
    const v = setup('hello world', 0, 5);
    commands.bold(v);
    expect(text(v)).toBe('**hello** world');
    commands.bold(v);
    expect(text(v)).toBe('hello world');
  });

  it('inserts placeholder text when nothing is selected', () => {
    const v = setup('', 0);
    commands.italic(v);
    expect(text(v)).toBe('*italic text*');
  });

  it('sets, switches and removes headings', () => {
    const v = setup('Title', 2);
    commands.h1(v);
    expect(text(v)).toBe('# Title');
    commands.h2(v);
    expect(text(v)).toBe('## Title');
    commands.h2(v);
    expect(text(v)).toBe('Title');
  });

  it('numbers ordered lists across selected lines', () => {
    const v = setup('a\nb\nc', 0, 5);
    commands.ordered(v);
    expect(text(v)).toBe('1. a\n2. b\n3. c');
    commands.ordered(v);
    expect(text(v)).toBe('a\nb\nc');
  });

  it('converts a bullet into a task item', () => {
    const v = setup('- item', 3);
    commands.task(v);
    expect(text(v)).toBe('- [ ] item');
  });

  it('inserts a table on its own line', () => {
    const v = setup('text', 4);
    commands.table(v);
    expect(text(v).startsWith('text\n\n| Column 1')).toBe(true);
  });
});

describe('countWords', () => {
  it('counts words and ignores embedded image data', () => {
    expect(countWords('Hello, world! It’s **bold**.')).toBe(4);
    expect(countWords('![pic](data:image/png;base64,AAAA+/BBBB==) caption')).toBe(2);
  });
});
