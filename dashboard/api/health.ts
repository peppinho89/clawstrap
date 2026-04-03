import fs from "node:fs";
import path from "node:path";
import type { ClawstrapConfig } from "../../src/schema.js";
import type { DashboardAgent, DashboardSkill, DashboardProject, DashboardRule } from "./scanner.js";

export interface HealthCheck {
  label: string;
  pass: boolean;
  detail: string;
}

export interface HealthResult {
  score: number;
  checks: HealthCheck[];
}

export function calculateHealth(
  rootDir: string,
  systemDir: string,
  config: ClawstrapConfig,
  agents: DashboardAgent[],
  skills: DashboardSkill[],
  projects: DashboardProject[],
  rules: DashboardRule[]
): HealthResult {
  const checks: HealthCheck[] = [];

  // Has governance file (CLAUDE.md): +20
  const governancePath = path.join(rootDir, "CLAUDE.md");
  const hasGovernance = fs.existsSync(governancePath);
  checks.push({
    label: "Governance file (CLAUDE.md)",
    pass: hasGovernance,
    detail: hasGovernance ? "CLAUDE.md found" : "Missing CLAUDE.md — run clawstrap init",
  });

  // Has >= 1 agent: +15
  const hasAgents = agents.length >= 1;
  checks.push({
    label: "At least one agent",
    pass: hasAgents,
    detail: hasAgents ? `${agents.length} agent(s) defined` : "No agents — add one with clawstrap add agent",
  });

  // Has >= 1 skill: +15
  const hasSkills = skills.length >= 1;
  checks.push({
    label: "At least one skill",
    pass: hasSkills,
    detail: hasSkills ? `${skills.length} skill(s) defined` : "No skills — add one with clawstrap add skill",
  });

  // Has >= 1 project: +15
  const hasProjects = projects.length >= 1;
  checks.push({
    label: "At least one project",
    pass: hasProjects,
    detail: hasProjects ? `${projects.length} project(s) defined` : "No projects — add one with clawstrap add project",
  });

  // Has quality gates rule: +10
  const hasQualityGates = rules.some(
    (r) => r.filename.includes("quality") || r.filename.includes("gates")
  );
  checks.push({
    label: "Quality gates rule",
    pass: hasQualityGates,
    detail: hasQualityGates ? "Quality gates rule found" : "No quality gates rule file",
  });

  // Has context discipline rule: +10
  const hasContextDiscipline = rules.some(
    (r) => r.filename.includes("context") || r.filename.includes("discipline")
  );
  checks.push({
    label: "Context discipline rule",
    pass: hasContextDiscipline,
    detail: hasContextDiscipline ? "Context discipline rule found" : "No context discipline rule file",
  });

  // Session handoff configured: +5
  const hasSessionHandoff = config.sessionHandoff === true;
  checks.push({
    label: "Session handoff configured",
    pass: hasSessionHandoff,
    detail: hasSessionHandoff ? "Session handoff enabled" : "Session handoff disabled",
  });

  // Has subagents when parallelAgents != "single": +5
  const needsSubagents = config.parallelAgents !== "single";
  const hasSubagents = needsSubagents ? agents.length >= 2 : true;
  checks.push({
    label: "Subagents for parallel mode",
    pass: hasSubagents,
    detail: needsSubagents
      ? hasSubagents
        ? `${agents.length} agents for ${config.parallelAgents} mode`
        : `Only ${agents.length} agent(s) for ${config.parallelAgents} mode — add more`
      : "Single-agent mode — subagents not required",
  });

  // No template placeholders in agent files: +5
  const placeholderPattern = /\*\(Define this|^\*\(.*\)\*$/m;
  const hasPlaceholders = agents.some((a) => placeholderPattern.test(a.rawMarkdown));
  checks.push({
    label: "No template placeholders in agents",
    pass: !hasPlaceholders,
    detail: hasPlaceholders
      ? "Some agents still have template placeholders — customize them"
      : "All agent files customized",
  });

  // Calculate score
  const weights = [20, 15, 15, 15, 10, 10, 5, 5, 5];
  let score = 0;
  for (let i = 0; i < checks.length; i++) {
    if (checks[i].pass) {
      score += weights[i];
    }
  }

  return { score, checks };
}
