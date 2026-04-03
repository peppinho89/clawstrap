import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { loadConfig } from "../scanner.js";
import { deriveTemplateVars } from "../../../src/derive-vars.js";
import { translateAgents } from "../../../src/export-paperclip/translate-agents.js";
import { translateSkills } from "../../../src/export-paperclip/translate-skills.js";
import { translateGoals } from "../../../src/export-paperclip/translate-goals.js";
import { buildGovernanceDoc } from "../../../src/export-paperclip/translate-governance.js";

export const exportRoutes = new Hono<{ Variables: { rootDir: string } }>();

exportRoutes.post("/api/export/paperclip", async (c) => {
  try {
    const rootDir = c.get("rootDir");
    const config = loadConfig(rootDir);
    const vars = deriveTemplateVars(config);
    const systemDir = String(vars.systemDir);

    // Translate workspace into Paperclip format using existing functions
    const skills = translateSkills(rootDir, systemDir);
    const skillSlugs = skills.map((s) => s.name);
    const agents = translateAgents(rootDir, systemDir, config.workspaceName, skillSlugs);
    const goals = translateGoals(rootDir);
    const governance = buildGovernanceDoc(rootDir, systemDir, config.qualityLevel);

    // Write output files
    const outputDir = path.join(rootDir, "exports", "paperclip");
    fs.mkdirSync(outputDir, { recursive: true });

    // Write agents
    for (const agent of agents) {
      const agentDir = path.join(outputDir, "agents");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, `${agent.slug}.md`), agent.body, "utf-8");
    }

    // Write skills
    for (const skill of skills) {
      const skillDir = path.join(outputDir, "skills");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, `${skill.name}.md`), skill.content, "utf-8");
    }

    // Write governance
    fs.writeFileSync(path.join(outputDir, "governance.md"), governance, "utf-8");

    // Write goals
    if (goals.length > 0) {
      const goalsContent = goals
        .map((g) => `## ${g.name}\n\n${g.description}`)
        .join("\n\n---\n\n");
      fs.writeFileSync(path.join(outputDir, "goals.md"), goalsContent, "utf-8");
    }

    // Update lastExport in .clawstrap.json
    const configPath = path.join(rootDir, ".clawstrap.json");
    const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    rawConfig.lastExport = {
      format: "paperclip",
      exportedAt: new Date().toISOString(),
      outputDir: "exports/paperclip",
    };
    fs.writeFileSync(configPath, JSON.stringify(rawConfig, null, 2) + "\n", "utf-8");

    return c.json({
      ok: true,
      outputDir: "exports/paperclip",
      agents: agents.length,
      skills: skills.length,
      goals: goals.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export";
    return c.json({ error: message }, 500);
  }
});
