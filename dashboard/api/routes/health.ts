import { Hono } from "hono";
import { scanWorkspace } from "../scanner.js";

export const healthRoutes = new Hono<{ Variables: { rootDir: string } }>();

healthRoutes.get("/api/health", (c) => {
  try {
    const rootDir = c.get("rootDir");
    const workspace = scanWorkspace(rootDir);
    return c.json(workspace.health);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to calculate health";
    return c.json({ error: message }, 500);
  }
});

healthRoutes.post("/api/health/fix", async (c) => {
  try {
    const rootDir = c.get("rootDir");
    const workspace = scanWorkspace(rootDir);
    const failingChecks = workspace.health.checks.filter((ch) => !ch.pass);

    // Return the list of failing checks with suggested fixes
    const suggestions = failingChecks.map((check) => ({
      label: check.label,
      detail: check.detail,
      autoFixable: false,
    }));

    return c.json({
      score: workspace.health.score,
      failingChecks: suggestions.length,
      suggestions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to analyze health";
    return c.json({ error: message }, 500);
  }
});
