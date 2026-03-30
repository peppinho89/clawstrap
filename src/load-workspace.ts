import fs from "node:fs";
import path from "node:path";
import { ClawstrapConfigSchema, type ClawstrapConfig } from "./schema.js";
import { deriveTemplateVars, type TemplateVars } from "./derive-vars.js";
import { ZodError } from "zod";

export interface Workspace {
  config: ClawstrapConfig;
  vars: TemplateVars;
  rootDir: string;
}

export function loadWorkspace(fromDir?: string): Workspace {
  const dir = fromDir ? path.resolve(fromDir) : process.cwd();
  const configPath = path.join(dir, ".clawstrap.json");

  if (!fs.existsSync(configPath)) {
    console.error(
      "\nError: .clawstrap.json not found. Run `clawstrap init` first.\n"
    );
    process.exit(1);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    console.error(
      "\nError: .clawstrap.json contains invalid JSON. Fix or delete it and run `clawstrap init`.\n"
    );
    process.exit(1);
  }

  let config: ClawstrapConfig;
  try {
    config = ClawstrapConfigSchema.parse(raw);
  } catch (err) {
    console.error("\nError: .clawstrap.json has an invalid schema.");
    if (err instanceof ZodError) {
      for (const issue of err.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
    }
    console.error("\nFix the file or delete it and run `clawstrap init`.\n");
    process.exit(1);
  }

  const vars = deriveTemplateVars(config);
  return { config, vars, rootDir: dir };
}
