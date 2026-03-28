import fs from "node:fs";
import path from "node:path";
import { render } from "./template-engine.js";
import { OUTPUT_MANIFEST, EMPTY_DIRS } from "./manifest.js";
import { templates } from "./templates/index.js";
import type { TemplateVars } from "./derive-vars.js";
import type { ClawstrapConfig } from "./schema.js";

export interface WriteResult {
  filesWritten: string[];
  dirsCreated: string[];
}

export function writeWorkspace(
  targetDir: string,
  vars: TemplateVars,
  config: ClawstrapConfig
): WriteResult {
  const filesWritten: string[] = [];
  const dirsCreated: string[] = [];

  try {
    // Write templated files
    for (const entry of OUTPUT_MANIFEST) {
      // Skip if condition is not met
      if (entry.condition && !vars[entry.condition]) {
        continue;
      }

      const template = templates[entry.templateKey];
      if (!template) {
        throw new Error(`Template not found: ${entry.templateKey}`);
      }

      // Resolve output path (may contain {%variables%})
      const resolvedPath = render(entry.outputPath, vars);
      const fullPath = path.join(targetDir, resolvedPath);

      // Ensure parent directory exists
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });

      // Render and write
      const content = render(template, vars);
      fs.writeFileSync(fullPath, content, "utf-8");
      filesWritten.push(resolvedPath);
    }

    // Create empty directories with .gitkeep
    for (const dir of EMPTY_DIRS) {
      const fullDir = path.join(targetDir, dir);
      fs.mkdirSync(fullDir, { recursive: true });
      dirsCreated.push(dir);

      // tmp gets a special .gitignore
      if (dir === "tmp") {
        fs.writeFileSync(
          path.join(fullDir, ".gitignore"),
          "*\n!.gitignore\n",
          "utf-8"
        );
      } else {
        fs.writeFileSync(path.join(fullDir, ".gitkeep"), "", "utf-8");
      }
    }

    // Write .clawstrap.json
    const configPath = path.join(targetDir, ".clawstrap.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify(config, null, 2) + "\n",
      "utf-8"
    );
    filesWritten.push(".clawstrap.json");
  } catch (error) {
    // Report what was written before the failure
    if (filesWritten.length > 0) {
      console.error(
        `\nError during workspace generation. ${filesWritten.length} file(s) were written before failure:`
      );
      for (const f of filesWritten) {
        console.error(`  - ${f}`);
      }
    }
    throw error;
  }

  return { filesWritten, dirsCreated };
}
