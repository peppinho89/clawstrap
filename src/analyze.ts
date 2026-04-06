import fs from "node:fs";
import path from "node:path";
import { loadWorkspace } from "./load-workspace.js";
import { runScan } from "./watch/scan.js";
import { writeConventions } from "./watch/writers.js";

export async function analyze(): Promise<void> {
  const { rootDir } = loadWorkspace();

  console.log("\nScanning codebase conventions...\n");
  const sections = await runScan(rootDir);
  writeConventions(rootDir, sections);

  // Update watchState.lastScanAt
  const configPath = path.join(rootDir, ".clawstrap.json");
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    raw["watchState"] = { ...(raw["watchState"] as Record<string, unknown> ?? {}), lastScanAt: new Date().toISOString() };
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2) + "\n", "utf-8");
  } catch {
    // best-effort
  }

  console.log("  ✓ .claude/rules/conventions.md updated\n");
}
