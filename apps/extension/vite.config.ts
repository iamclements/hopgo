import { resolve } from "node:path";
import { defineConfig } from "vite";

// Build the popup and options pages plus the background service worker. manifest.json
// and static assets live in public/ and are copied to dist/ verbatim. The service
// worker needs a stable filename (background.js) so the manifest can reference it.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, "popup.html"),
        options: resolve(import.meta.dirname, "options.html"),
        background: resolve(import.meta.dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
      },
    },
  },
});
