import { defineConfig } from "vitest/config";
import fs from "node:fs";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
  plugins: [
    {
      name: "tmpl-loader",
      transform(code, id) {
        if (id.endsWith(".tmpl")) {
          const content = fs.readFileSync(id, "utf-8");
          return {
            code: `export default ${JSON.stringify(content)}`,
            map: null,
          };
        }
      },
    },
  ],
});
