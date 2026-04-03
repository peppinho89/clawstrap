import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { scanWorkspace } from "../scanner.js";
import { createProject } from "../writer.js";

export const projectsRoutes = new Hono<{ Variables: { rootDir: string } }>();

projectsRoutes.get("/api/projects", (c) => {
  try {
    const rootDir = c.get("rootDir");
    const workspace = scanWorkspace(rootDir);
    return c.json(workspace.projects);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list projects";
    return c.json({ error: message }, 500);
  }
});

projectsRoutes.get("/api/project/:name", (c) => {
  try {
    const rootDir = c.get("rootDir");
    const name = c.req.param("name");
    const workspace = scanWorkspace(rootDir);
    const project = workspace.projects.find((p) => p.name === name);
    if (!project) {
      return c.json({ error: `Project "${name}" not found` }, 404);
    }
    return c.json(project);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get project";
    return c.json({ error: message }, 500);
  }
});

projectsRoutes.post("/api/project", async (c) => {
  try {
    const rootDir = c.get("rootDir");
    const body = await c.req.json<{ name: string; description: string }>();

    if (!body.name || !body.description) {
      return c.json({ error: "name and description are required" }, 400);
    }

    createProject(rootDir, body.name, body.description);
    return c.json({ ok: true, name: body.name }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create project";
    const status = message.includes("already exists") ? 409 : 500;
    return c.json({ error: message }, status);
  }
});

projectsRoutes.delete("/api/project/:name", (c) => {
  try {
    const rootDir = c.get("rootDir");
    const name = c.req.param("name");

    const projectDir = path.join(rootDir, "projects", name);
    if (!fs.existsSync(projectDir)) {
      return c.json({ error: `Project "${name}" not found` }, 404);
    }

    fs.rmSync(projectDir, { recursive: true, force: true });
    return c.json({ ok: true, name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete project";
    return c.json({ error: message }, 500);
  }
});
