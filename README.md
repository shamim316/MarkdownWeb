# MarkdownWeb

A browser-based markdown editor with a live preview. Write markdown on the left, see the rendered result on the right, and save straight to your computer.

## Features

- **Split editor / preview** with a draggable divider (double-click to reset), editor-only and preview-only modes, and scroll sync.
- **Markdown editor** (CodeMirror 6) with syntax highlighting, a formatting toolbar and keyboard shortcuts.
- **Preview** with GitHub-flavored markdown (tables, task lists, strikethrough, autolinks), code highlighting, KaTeX math (`$…$`, `$$…$$`) and Mermaid diagrams (```` ```mermaid ````). Output is sanitized with DOMPurify.
- **Images**: paste or drag an image into the editor (or use the toolbar) to embed it as base64. Long data URLs are folded into a compact chip in the editor.
- **Saving**
  - Chrome, Edge, Opera: Open/Save work on the real file via the File System Access API; `Ctrl/⌘+S` overwrites it.
  - Firefox, Safari: Save downloads a `.md` file.
- **Save status** next to the file name: a green check when everything is saved, a glowing yellow dot when there are unsaved changes.
- **Draft recovery**: unsaved work is kept in browser storage and offered back after a crash or accidental close; you're warned before leaving with unsaved changes.
- **Rename** by clicking the file name (in Chrome/Edge the next save asks where to save the renamed file).
- **Export** standalone HTML, or print / save as PDF (prints only the rendered document).
- **Editor text size**: A− / A+ buttons, a slider, or `Ctrl/⌘` + scroll wheel over the editor (10–32px; click the size to reset). Remembered between visits.
- Light / dark / system theme, word count, reading time and cursor position.

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Save / Save as | `Ctrl/⌘+S` / `Ctrl/⌘+Shift+S` |
| Open | `Ctrl/⌘+O` |
| Bold / Italic / Inline code | `Ctrl/⌘+B` / `Ctrl/⌘+I` / `Ctrl/⌘+E` |
| Strikethrough | `Ctrl/⌘+Shift+X` |
| Link | `Ctrl/⌘+K` |
| Heading 1–3 | `Ctrl/⌘+Alt+1…3` |
| Bulleted / numbered / task list | `Ctrl/⌘+Shift+8` / `7` / `9` |
| Find / replace | `Ctrl/⌘+F` |

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # static build in dist/
```

The build is fully static and uses relative paths, so `dist/` can be hosted anywhere (GitHub Pages, Netlify, any file server). The File System Access API requires a secure context (HTTPS or `localhost`).

## Deployment

`.github/workflows/deploy.yml` tests and builds every pull request, and deploys `main` to GitHub Pages. One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. The site is then served at `https://<owner>.github.io/<repo>/`.
