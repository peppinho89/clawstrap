import { Hono } from "hono";
import { scanWorkspace } from "../scanner.js";
import { createAgent, updateAgent, deleteAgent } from "../writer.js";

export const agentsRoutes = new Hono<{ Variables: { rootDir: string } }>();

agentsRoutes.get("/api/agents", (c) => {
  try {
    const rootDir = c.get("rootDir");
    const workspace = scanWorkspace(rootDir);
    return c.json(workspace.agents);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list agents";
    return c.json({ error: message }, 500);
  }
});

agentsRoutes.get("/api/agent/:slug", (c) => {
  try {
    const rootDir = c.get("rootDir");
    const slug = c.req.param("slug");
    const workspace = scanWorkspace(rootDir);
    const agent = workspace.agents.find((a) => a.slug === slug);
    if (!agent) {
      return c.json({ error: `Agent "${slug}" not found` }, 404);
    }
    return c.json(agent);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get agent";
    return c.json({ error: message }, 500);
  }
});

agentsRoutes.post("/api/agent", async (c) => {
  try {
    const rootDir = c.get("rootDir");
    const body = await c.req.json<{ name: string; description: string; role: string }>();

    if (!body.name || !body.description || !body.role) {
      return c.json({ error: "name, description, and role are required" }, 400);
    }

    createAgent(rootDir, body.name, body.description, body.role);
    return c.json({ ok: true, slug: body.name }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create agent";
    const status = message.includes("already exists") ? 409 : 500;
    return c.json({ error: message }, status);
  }
});

agentsRoutes.put("/api/agent/:slug", async (c) => {
  try {
    const rootDir = c.get("rootDir");
    const slug = c.req.param("slug");
    const body = await c.req.json<{ description?: string; role?: string; rawMarkdown?: string }>();

    updateAgent(rootDir, slug, body);
    return c.json({ ok: true, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update agent";
    const status = message.includes("not found") ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

agentsRoutes.delete("/api/agent/:slug", (c) => {
  try {
    const rootDir = c.get("rootDir");
    const slug = c.req.param("slug");

    deleteAgent(rootDir, slug);
    return c.json({ ok: true, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete agent";
    const status = message.includes("not found") ? 404 : 500;
    return c.json({ error: message }, status);
  }
});
