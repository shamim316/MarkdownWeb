import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../lib/markdown';

describe('renderMarkdown', () => {
  it('renders GFM tables and task lists', () => {
    const html = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n- [ ] todo');
    expect(html).toContain('<table');
    expect(html).toContain('<td>1</td>');
    expect(html).toMatch(/<input class="task-list-item-checkbox" checked=""[^>]*type="checkbox">/);
  });

  it('tags top-level blocks with source lines for scroll sync', () => {
    const html = renderMarkdown('# Title\n\nPara\n\n```js\nx\n```');
    expect(html).toContain('<h1 data-line="0">');
    expect(html).toContain('<p data-line="2">');
    expect(html).toContain('<pre data-line="4" class="hljs">');
  });

  it('highlights fenced code', () => {
    expect(renderMarkdown('```js\nconst a = 1;\n```')).toContain('hljs-keyword');
  });

  it('renders math with KaTeX', () => {
    expect(renderMarkdown('Inline $x^2$ math')).toContain('class="katex"');
    expect(renderMarkdown('$$\n\\frac{1}{2}\n$$')).toContain('katex-display');
  });

  it('emits a placeholder for mermaid diagrams', () => {
    const html = renderMarkdown('```mermaid\ngraph TD; A-->B\n```');
    expect(html).toContain('class="mermaid-block"');
    expect(html).toContain(`data-mermaid="${encodeURIComponent('graph TD; A-->B\n')}"`);
  });

  it('allows embedded base64 images', () => {
    expect(renderMarkdown('![x](data:image/png;base64,iVBORw0KGgo=)')).toContain(
      'src="data:image/png;base64,iVBORw0KGgo="',
    );
  });

  it('sanitizes scripts and event handlers', () => {
    const html = renderMarkdown('<script>alert(1)</script><img src=x onerror="alert(1)"> [a](javascript:alert(1))');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toMatch(/href="javascript:/);
  });
});
