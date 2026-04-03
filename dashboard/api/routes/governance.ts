import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { scanWorkspace, loadConfig } from "../scanner.js";
import { updateRule } from "../writer.js";
import { ClawstrapConfigSchema } from "../../../src/schema.js";
import { deriveTemplateVars } from "../../../src/derive-vars.js";
import { getGovernanceConfig } from "../../../src/export-paperclip/translate-governance.js";
import type { QualityLevel } from "../../../src/schema.js";

export const governanceRoutes = new Hono<{ Variables: { rootDir: string } }>();

governanceRoutes.get("/api/governance", (c) => {
  try {
    const rootDir = c.get("rootDir");
    const workspace = scanWorkspace(rootDir);
    return c.json({
      governance: workspace.governance,
      rules: workspace.rules,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get governance";
    return c.json({ error: message }, 500);
  }
});

governanceRoutes.put("/api/governance/tier", async (c) => {
  try {
    const rootDir = c.get("rootDir");
    const body = await c.req.json<{ tier: string }>();

    const validTiers = ["solo", "team", "production"];
    const tierToQuality: Record<string, QualityLevel> = {
      light: "solo",
      standard: "team",
      strict: "production",
      solo: "solo",
      team: "team",
      production: "production",
    };

    const qualityLevel = tierToQuality[body.tier];
    if (!qualityLevel) {
      return c.json({ error: `Invalid tier. Use: ${validTiers.join(", ")}` }, 400);
    }

    // Update .clawstrap.json
    const configPath = path.join(rootDir, ".clawstrap.json");
    const config = loadConfig(rootDir);
    const updatedConfig = { ...config, qualityLevel };
    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2) + "\n", "utf-8");

    // Add or remove quality-gates.md rule file based on new tier
    const vars = deriveTemplateVars(updatedConfig);
    const systemDir = String(vars.systemDir);
    const qualityGatesPath = path.join(rootDir, systemDir, "rules", "quality-gates.md");

    if (qualityLevel === "solo") {
      // Remove quality gates file if it exists
      if (fs.existsSync(qualityGatesPath)) {
        fs.unlinkSync(qualityGatesPath);
      }
    } else {
      // Create quality gates file if it doesn't exist
      if (!fs.existsSync(qualityGatesPath)) {
        const content = `# Rule: Quality Gates
> **Scope**: All sessions

## Core Principle

Quality is a structural gate in the execution loop, not a phase run at the end.

## Gates

### Checkpoint Reviews (Ralph Loop)
- Every 5 outputs: stop and review the most complex item in the batch
- If quality grade is below B: fix the issue and rerun before proceeding
- This is mandatory — not optional, not skippable

### Human Review
- Human review is the final gate — all results surface to the user
- No output is marked "complete" without human confirmation
- Low-confidence results must be flagged, never silently passed through
`;
        fs.writeFileSync(qualityGatesPath, content, "utf-8");
      }
    }

    const govConfig = getGovernanceConfig(qualityLevel);
    return c.json(govConfig);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update tier";
    return c.json({ error: message }, 500);
  }
});

governanceRoutes.put("/api/governance/rule/:filename", async (c) => {
  try {
    const rootDir = c.get("rootDir");
    const filename = c.req.param("filename");
    const body = await c.req.json<{ content: string }>();

    if (!body.content) {
      return c.json({ error: "content is required" }, 400);
    }

    // Sanitize filename — only allow .md files, no path traversal
    if (!filename.endsWith(".md") || filename.includes("/") || filename.includes("..")) {
      return c.json({ error: "Invalid filename — must be a .md file without path separators" }, 400);
    }

    updateRule(rootDir, filename, body.content);
    return c.json({ ok: true, filename });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update rule";
    return c.json({ error: message }, 500);
  }
});
