import katex from 'katex';
import markdownCss from '../styles/markdown.css?raw';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Build a standalone HTML document from the rendered preview. */
export function buildStandaloneHtml(title: string, bodyHtml: string, theme: 'light' | 'dark'): string {
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${katex.version}/dist/katex.min.css">
<style>
${markdownCss}
html { background: var(--md-bg); }
body { margin: 0; padding: 32px 24px 64px; }
</style>
</head>
<body>
<article class="markdown-body">
${bodyHtml}
</article>
</body>
</html>
`;
}

export function htmlFileName(markdownName: string): string {
  return markdownName.replace(/\.(md|markdown|mdown|txt)$/i, '') + '.html';
}
