import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react';
import type { ResolvedTheme } from '../lib/storage';

export interface PreviewHandle {
  scrollToLine: (line: number, fraction: number) => void;
  /** The rendered HTML, including generated diagram SVGs. */
  getRenderedHtml: () => string;
}

interface PreviewProps {
  ref?: Ref<PreviewHandle>;
  html: string;
  totalLines: number;
  theme: ResolvedTheme;
  onScroll: (line: number, fraction: number) => void;
}

type MermaidApi = typeof import('mermaid').default;
let mermaidPromise: Promise<MermaidApi> | null = null;
let mermaidTheme: string | null = null;
let diagramCounter = 0;
const svgCache = new Map<string, string>();

type MermaidConfig = Parameters<MermaidApi['initialize']>[0];

const MERMAID_THEMES: Record<ResolvedTheme, MermaidConfig> = {
  light: { theme: 'default' },
  dark: { theme: 'dark' },
  // Mermaid has no mid-grey theme; derive one from its base theme to match the grey palette.
  grey: {
    theme: 'base',
    themeVariables: {
      darkMode: true,
      background: '#3a3f46',
      mainBkg: '#4a5058',
      primaryColor: '#4a5058',
      primaryTextColor: '#eceff3',
      primaryBorderColor: '#9aa3ad',
      secondaryColor: '#454b53',
      tertiaryColor: '#42474f',
      lineColor: '#c0c7cf',
      textColor: '#eceff3',
    },
  },
};

async function getMermaid(theme: ResolvedTheme): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then((m) => m.default);
  const mermaid = await mermaidPromise;
  if (mermaidTheme !== theme) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', fontFamily: 'inherit', ...MERMAID_THEMES[theme] });
    mermaidTheme = theme;
  }
  return mermaid;
}

function diagramSource(block: HTMLElement): string {
  try {
    return decodeURIComponent(block.dataset.mermaid ?? '');
  } catch {
    return '';
  }
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

async function renderDiagrams(root: HTMLElement, theme: ResolvedTheme): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>('.mermaid-block')];
  const pending: HTMLElement[] = [];
  for (const block of blocks) {
    const cached = svgCache.get(`${theme}:${diagramSource(block)}`);
    if (cached !== undefined) block.innerHTML = cached;
    else pending.push(block);
  }
  if (!pending.length) return;
  const mermaid = await getMermaid(theme);
  for (const block of pending) {
    const source = diagramSource(block);
    const key = `${theme}:${source}`;
    let html = svgCache.get(key);
    if (html === undefined) {
      const id = `mermaid-${++diagramCounter}`;
      try {
        html = (await mermaid.render(id, source)).svg;
      } catch (err) {
        html = `<pre class="mermaid-error">Diagram error: ${escapeText(err instanceof Error ? err.message : String(err))}</pre>`;
        // Mermaid can leave its temporary render container behind on failure.
        document.getElementById(`d${id}`)?.remove();
      }
      if (svgCache.size > 200) svgCache.clear();
      svgCache.set(key, html);
    }
    if (block.isConnected) block.innerHTML = html;
  }
}

interface Anchor {
  line: number;
  top: number;
}

export default function Preview({ ref, html, totalLines, theme, onScroll }: PreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const suppressScroll = useRef(0);

  useLayoutEffect(() => {
    const el = contentRef.current!;
    el.innerHTML = html;
    void renderDiagrams(el, theme);
  }, [html, theme]);

  const anchors = (): Anchor[] => {
    const content = contentRef.current;
    if (!content) return [];
    const result: Anchor[] = [];
    for (const child of content.children) {
      const line = (child as HTMLElement).dataset.line;
      if (line !== undefined) result.push({ line: Number(line), top: (child as HTMLElement).offsetTop });
    }
    return result;
  };

  useImperativeHandle(ref, () => ({
    scrollToLine(line, fraction) {
      const scroller = scrollRef.current;
      if (!scroller) return;
      let target: number;
      if (!Number.isFinite(line)) {
        target = scroller.scrollHeight;
      } else {
        const list = anchors();
        const pos = line + fraction;
        let prev: Anchor = { line: 0, top: 0 };
        let next: Anchor = { line: totalLines, top: scroller.scrollHeight - scroller.clientHeight };
        for (const a of list) {
          if (a.line <= line) prev = a;
          else {
            next = a;
            break;
          }
        }
        const span = next.line - prev.line;
        const ratio = span > 0 ? Math.min(1, Math.max(0, (pos - prev.line) / span)) : 0;
        target = prev.top + (next.top - prev.top) * ratio;
      }
      suppressScroll.current = Date.now() + 100;
      scroller.scrollTop = target;
    },
    getRenderedHtml() {
      return contentRef.current?.innerHTML ?? '';
    },
  }));

  const handleScroll = () => {
    if (Date.now() < suppressScroll.current) return;
    const scroller = scrollRef.current!;
    const top = scroller.scrollTop;
    if (top + scroller.clientHeight >= scroller.scrollHeight - 2) {
      onScroll(Number.POSITIVE_INFINITY, 0);
      return;
    }
    const list = anchors();
    let prev: Anchor = { line: 0, top: 0 };
    let next: Anchor = { line: totalLines, top: scroller.scrollHeight - scroller.clientHeight };
    for (const a of list) {
      if (a.top <= top) prev = a;
      else {
        next = a;
        break;
      }
    }
    const span = next.top - prev.top;
    const pos = prev.line + (span > 0 ? ((top - prev.top) / span) * (next.line - prev.line) : 0);
    onScroll(Math.floor(pos), pos - Math.floor(pos));
  };

  return (
    <div className="preview-scroll" ref={scrollRef} onScroll={handleScroll}>
      <article className="markdown-body" ref={contentRef} />
    </div>
  );
}
