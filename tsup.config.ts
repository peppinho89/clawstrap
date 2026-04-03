import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  outExtension: () => ({ js: ".cjs" }),
  target: "node18",
  clean: true,
  sourcemap: false,
  banner: { js: "#!/usr/bin/env node" },
  loader: { ".tmpl": "text" },
  external: ["../dashboard/api/index.js"],
});
