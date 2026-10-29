/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the static build works from any path (GitHub Pages, file server, etc.)
  base: './',
  plugins: [react()],
  build: {
    // Mermaid and KaTeX are large; Mermaid is already loaded lazily.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'jsdom',
  },
});
