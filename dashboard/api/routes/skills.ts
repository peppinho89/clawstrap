import { Hono } from "hono";
import { scanWorkspace } from "../scanner.js";
import { createSkill, deleteSkill } from "../writer.js";
import { fetchSkill, importSkillToWorkspace } from "../../../src/skill-import.js";
import { deriveTemplateVars } from "../../../src/derive-vars.js";
import { loadConfig } from "../scanner.js";

export const skillsRoutes = new Hono<{ Variables: { rootDir: string } }>();

skillsRoutes.get("/api/skills", (c) => {
  try {
    const rootDir = c.get("rootDir");
    const workspace = scanWorkspace(rootDir);
    return c.json(workspace.skills);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list skills";
    return c.json({ error: message }, 500);
  }
});

skillsRoutes.get("/api/skill/:name", (c) => {
  try {
    const rootDir = c.get("rootDir");
    const name = c.req.param("name");
    const workspace = scanWorkspace(rootDir);
    const skill = workspace.skills.find((s) => s.name === name);
    if (!skill) {
      return c.json({ error: `Skill "${name}" not found` }, 404);
    }
    return c.json(skill);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get skill";
    return c.json({ error: message }, 500);
  }
});

skillsRoutes.post("/api/skill", async (c) => {
  try {
    const rootDir = c.get("rootDir");
    const body = await c.req.json<{ name: string; description: string; triggers: string }>();

    if (!body.name || !body.description || !body.triggers) {
      return c.json({ error: "name, description, and triggers are required" }, 400);
    }

    createSkill(rootDir, body.name, body.description, body.triggers);
    return c.json({ ok: true, name: body.name }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create skill";
    const status = message.includes("already exists") ? 409 : 500;
    return c.json({ error: message }, status);
  }
});

// Preview a skill from URL (no save)
skillsRoutes.post("/api/skill/preview", async (c) => {
  try {
    const body = await c.req.json<{ url: string }>();
    if (!body.url) {
      return c.json({ error: "url is required" }, 400);
    }
    const skill = await fetchSkill(body.url);
    return c.json({
      name: skill.name,
      description: skill.description,
      triggers: skill.triggers,
      source: skill.source,
      preview: skill.content.slice(0, 2000),
      hasReferences: skill.references.length > 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch skill";
    return c.json({ error: message }, 400);
  }
});

// Import a skill from URL (fetch + save)
skillsRoutes.post("/api/skill/import", async (c) => {
  try {
    const rootDir = c.get("rootDir");
    const body = await c.req.json<{ url: string }>();
    if (!body.url) {
      return c.json({ error: "url is required" }, 400);
    }
    const config = loadConfig(rootDir);
    const vars = deriveTemplateVars(config);
    const systemDir = String(vars.systemDir);

    const skill = await importSkillToWorkspace(rootDir, systemDir, body.url);
    return c.json({
      ok: true,
      name: skill.name,
      source: skill.source,
      references: skill.references.length,
    }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to import skill";
    const status = message.includes("already exists") ? 409 : 500;
    return c.json({ error: message }, status);
  }
});

skillsRoutes.delete("/api/skill/:name", (c) => {
  try {
    const rootDir = c.get("rootDir");
    const name = c.req.param("name");

    deleteSkill(rootDir, name);
    return c.json({ ok: true, name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete skill";
    const status = message.includes("not found") ? 404 : 500;
    return c.json({ error: message }, status);
  }
});
