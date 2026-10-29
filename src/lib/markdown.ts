import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import hljs from 'highlight.js/lib/common';
import DOMPurify from 'dompurify';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code class="language-${escapeHtml(lang)}">${
          hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
        }</code></pre>`;
      } catch {
        // fall through to plain rendering
      }
    }
    return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`;
  },
});

md.use(taskLists, { enabled: false, label: true });
md.use(texmath, { engine: katex, delimiters: 'dollars', katexOptions: { throwOnError: false } });

// Tag top-level block tokens with their source line so the preview can scroll in sync with the editor.
md.core.ruler.push('source_lines', (state) => {
  for (const token of state.tokens) {
    if (token.map && token.nesting !== -1 && token.level === 0) {
      token.attrSet('data-line', String(token.map[0]));
    }
  }
});

const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const lang = token.info.trim().split(/\s+/)[0];
  const line = token.map ? ` data-line="${token.map[0]}"` : '';
  if (lang === 'mermaid') {
    // Rendered into SVG after the HTML is inserted (see Preview). URI-encoded because the
    // sanitizer drops attribute values containing `-->`, which most flowcharts use.
    return `<div class="mermaid-block"${line} data-mermaid="${encodeURIComponent(token.content)}"></div>`;
  }
  const html = defaultFence(tokens, idx, options, env, self);
  return line ? html.replace(/^<pre/, `<pre${line}`) : html;
};

const defaultLinkOpen =
  md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href') ?? '';
  if (/^https?:/i.test(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

/** Render markdown to sanitized HTML. */
export function renderMarkdown(source: string): string {
  const raw = md.render(source);
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target', 'data-mermaid'],
    ADD_TAGS: ['semantics', 'annotation'],
  });
}
