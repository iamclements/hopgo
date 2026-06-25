import { defineConfig } from "tsup";

// Bundle the app and all its deps (Hono, @hopgo/shared) into one ESM file so the
// production image needs nothing but Node and dist/. Node built-ins stay external.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  bundle: true,
  noExternal: [/.*/],
  clean: true,
  minify: false,
});
