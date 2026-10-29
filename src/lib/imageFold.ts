import { Decoration, EditorView, MatchDecorator, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';

/**
 * Collapses long base64 `data:image/...` URLs in the editor into a compact chip so the
 * markdown source stays readable. The underlying text is untouched.
 */
class DataUrlWidget extends WidgetType {
  constructor(
    readonly mime: string,
    readonly bytes: number,
  ) {
    super();
  }

  eq(other: DataUrlWidget): boolean {
    return other.mime === this.mime && other.bytes === this.bytes;
  }

  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-data-url';
    el.textContent = `${this.mime.replace('image/', '')} image · ${formatBytes(this.bytes)}`;
    el.title = 'Embedded image (base64)';
    return el;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const matcher = new MatchDecorator({
  regexp: /data:(image\/[\w.+-]+);base64,[A-Za-z0-9+/=]{64,}/g,
  decoration: (match) => {
    const base64Length = match[0].length - match[0].indexOf(',') - 1;
    return Decoration.replace({ widget: new DataUrlWidget(match[1], Math.floor((base64Length * 3) / 4)) });
  },
});

export const imageFold = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = matcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = matcher.updateDeco(update, this.decorations);
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  },
);
