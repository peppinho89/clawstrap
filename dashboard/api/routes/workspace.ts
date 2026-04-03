import { Hono } from "hono";
import { scanWorkspace } from "../scanner.js";

export const workspaceRoutes = new Hono<{ Variables: { rootDir: string } }>();

workspaceRoutes.get("/api/workspace", (c) => {
  try {
    const rootDir = c.get("rootDir");
    const workspace = scanWorkspace(rootDir);
    return c.json(workspace);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to scan workspace";
    return c.json({ error: message }, 500);
  }
});
