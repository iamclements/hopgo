import { resolve } from "node:path";
import { defineConfig } from "vite";

// Build the popup and options pages as separate HTML entries. manifest.json and
// any static assets live in public/ and are copied to dist/ verbatim. Load the
// unpacked extension from apps/extension/dist in chrome://extensions.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, "popup.html"),
        options: resolve(import.meta.dirname, "options.html"),
      },
    },
  },
});
