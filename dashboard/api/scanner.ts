import fs from "node:fs";
import path from "node:path";
import { ClawstrapConfigSchema, type ClawstrapConfig, type QualityLevel } from "../../src/schema.js";
import { deriveTemplateVars } from "../../src/derive-vars.js";
import { translateAgents, type PaperclipAgent } from "../../src/export-paperclip/translate-agents.js";
import { translateSkills, type PaperclipSkill } from "../../src/export-paperclip/translate-skills.js";
import { translateGoals } from "../../src/export-paperclip/translate-goals.js";
import { getGovernanceConfig } from "../../src/export-paperclip/translate-governance.js";
import { calculateHealth } from "./health.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DashboardAgent {
  name: string;
  slug: string;
  role: "orchestrator" | "worker" | "reviewer";
  purpose: string;
  reportsTo: string | null;
  skills: string[];
  rawMarkdown: string;
}

export interface DashboardSkill {
  name: string;
  description: string;
  triggers: string;
  rawMarkdown: string;
}

export interface DashboardProject {
  name: string;
  description: string;
  rawMarkdown: string;
}

export interface DashboardRule {
  name: string;
  filename: string;
  rawMarkdown: string;
}

export interface DashboardGovernance {
  tier: string;
  requiresApproval: boolean;
  approvalGates: string[];
  qualityCheckInterval: number;
  minQualityGrade: string;
}

export interface DashboardWorkspace {
  config: ClawstrapConfig;
  governance: DashboardGovernance;
  agents: DashboardAgent[];
  skills: DashboardSkill[];
  projects: DashboardProject[];
  rules: DashboardRule[];
  counts: { agents: number; skills: number; projects: number; rules: number };
  health: { score: number; checks: Array<{ label: string; pass: boolean; detail: string }> };
  lastExport?: { format: string; exportedAt: string; outputDir: string };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function detectRole(rawBody: string, slug: string): "orchestrator" | "worker" | "reviewer" {
  const combined = (rawBody + " " + slug).toLowerCase();
  if (combined.includes("orchestrat") || combined.includes("primary-agent") || combined.includes("coordinator")) {
    return "orchestrator";
  }
  if (
    combined.includes("review") ||
    combined.includes("qa") ||
    combined.includes("qc") ||
    combined.includes("quality")
  ) {
    return "reviewer";
  }
  return "worker";
}

// ── Load config (non-exiting version for API use) ──────────────────────────────

export function loadConfig(rootDir: string): ClawstrapConfig {
  const configPath = path.join(rootDir, ".clawstrap.json");
  if (!fs.existsSync(configPath)) {
    throw new Error("No .clawstrap.json found. Run `clawstrap init` first.");
  }
  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  return ClawstrapConfigSchema.parse(raw);
}

// ── Scan agents directly from disk ─────────────────────────────────────────────

function scanAgents(rootDir: string, systemDir: string): DashboardAgent[] {
  const agentsDir = path.join(rootDir, systemDir, "agents");
  const agents: DashboardAgent[] = [];

  if (!fs.existsSync(agentsDir)) return agents;

  for (const entry of fs.readdirSync(agentsDir)) {
    if (entry === "_template.md" || entry.startsWith(".") || !entry.endsWith(".md")) {
      continue;
    }

    const slug = entry.replace(/\.md$/, "");
    const filePath = path.join(agentsDir, entry);
    const rawMarkdown = fs.readFileSync(filePath, "utf-8");

    const purposeMatch = rawMarkdown.match(/^>\s*\*\*Purpose\*\*:\s*(.+)/m);
    const purpose = purposeMatch ? purposeMatch[1].trim() : "";

    const role = detectRole(rawMarkdown, slug);

    // Extract skill references from markdown (look for skill mentions)
    const skillRefs: string[] = [];
    const skillMatches = rawMarkdown.matchAll(/skills?\/(\S+?)(?:\/|\s|$)/gi);
    for (const m of skillMatches) {
      skillRefs.push(m[1]);
    }

    agents.push({
      name: slugToName(slug),
      slug,
      role,
      purpose,
      reportsTo: slug === "primary-agent" ? null : "primary-agent",
      skills: skillRefs,
      rawMarkdown,
    });
  }

  return agents;
}

// ── Scan skills directly from disk ─────────────────────────────────────────────

function scanSkills(rootDir: string, systemDir: string): DashboardSkill[] {
  const skillsDir = path.join(rootDir, systemDir, "skills");
  const skills: DashboardSkill[] = [];

  if (!fs.existsSync(skillsDir)) return skills;

  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) continue;

    const rawMarkdown = fs.readFileSync(skillMdPath, "utf-8");

    // Extract description from first blockquote line
    const descMatch = rawMarkdown.match(/^>\s*(.+)/m);
    const description = descMatch ? descMatch[1].replace(/\*\*/g, "").trim() : "";

    // Extract triggers
    const triggerMatch = rawMarkdown.match(/\*\*Triggers?\*\*:\s*(.+)/i);
    const triggers = triggerMatch ? triggerMatch[1].trim() : "";

    skills.push({
      name: entry.name,
      description,
      triggers,
      rawMarkdown,
    });
  }

  return skills;
}

// ── Scan projects directly from disk ───────────────────────────────────────────

function scanProjects(rootDir: string): DashboardProject[] {
  const projectsDir = path.join(rootDir, "projects");
  const projects: DashboardProject[] = [];

  if (!fs.existsSync(projectsDir)) return projects;

  for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "_template" || entry.name.startsWith(".")) {
      continue;
    }

    const readmePath = path.join(projectsDir, entry.name, "README.md");
    if (!fs.existsSync(readmePath)) continue;

    const rawMarkdown = fs.readFileSync(readmePath, "utf-8");

    // Reuse the same extraction logic as translate-goals
    const descMatch = rawMarkdown.match(/## What This Project Is\s*\n+([\s\S]*?)(?=\n---|\n##|$)/);
    const description = descMatch ? descMatch[1].trim() : `Project: ${entry.name}`;

    projects.push({
      name: entry.name,
      description,
      rawMarkdown,
    });
  }

  return projects;
}

// ── Scan rules directly from disk ──────────────────────────────────────────────

function scanRules(rootDir: string, systemDir: string): DashboardRule[] {
  const rulesDir = path.join(rootDir, systemDir, "rules");
  const rules: DashboardRule[] = [];

  if (!fs.existsSync(rulesDir)) return rules;

  for (const entry of fs.readdirSync(rulesDir).sort()) {
    if (!entry.endsWith(".md") || entry.startsWith(".")) continue;

    const filePath = path.join(rulesDir, entry);
    const rawMarkdown = fs.readFileSync(filePath, "utf-8");

    // Extract name from first heading or filename
    const headingMatch = rawMarkdown.match(/^#\s+(?:Rule:\s*)?(.+)/m);
    const name = headingMatch ? headingMatch[1].trim() : entry.replace(/\.md$/, "");

    rules.push({
      name,
      filename: entry,
      rawMarkdown,
    });
  }

  return rules;
}

// ── Main scanner ───────────────────────────────────────────────────────────────

export function scanWorkspace(rootDir: string): DashboardWorkspace {
  const config = loadConfig(rootDir);
  const vars = deriveTemplateVars(config);
  const systemDir = String(vars.systemDir);

  const governance = getGovernanceConfig(config.qualityLevel);
  const agents = scanAgents(rootDir, systemDir);
  const skills = scanSkills(rootDir, systemDir);
  const projects = scanProjects(rootDir);
  const rules = scanRules(rootDir, systemDir);

  const counts = {
    agents: agents.length,
    skills: skills.length,
    projects: projects.length,
    rules: rules.length,
  };

  const health = calculateHealth(rootDir, systemDir, config, agents, skills, projects, rules);

  return {
    config,
    governance,
    agents,
    skills,
    projects,
    rules,
    counts,
    health,
    lastExport: config.lastExport,
  };
}
