import fs from "node:fs";
import path from "node:path";
import { loadWorkspace } from "./load-workspace.js";
import { isDaemonRunning } from "./watch/pid.js";
import { countPendingRules } from "./watch/promote.js";

const WORKLOAD_LABELS: Record<string, string> = {
  research: "Research & Analysis",
  content: "Content & Writing",
  "data-processing": "Data Processing",
  custom: "General Purpose",
};

function countEntries(dir: string, exclude: string[] = []): number {
  if (!fs.existsSync(dir)) return 0;
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => !exclude.includes(e.name) && !e.name.startsWith("."))
    .length;
}

function countSkills(skillsDir: string): number {
  if (!fs.existsSync(skillsDir)) return 0;
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() &&
        fs.existsSync(path.join(skillsDir, e.name, "SKILL.md"))
    ).length;
}

export async function showStatus(): Promise<void> {
  const { config, vars, rootDir } = loadWorkspace();
  const systemDir = String(vars.systemDir);

  const agentsDir = path.join(rootDir, systemDir, "agents");
  const skillsDir = path.join(rootDir, systemDir, "skills");
  const rulesDir = path.join(rootDir, systemDir, "rules");
  const projectsDir = path.join(rootDir, "projects");

  const agentCount = countEntries(agentsDir, ["_template.md"]);
  const skillCount = countSkills(skillsDir);
  const projectCount = countEntries(projectsDir, ["_template"]);
  const ruleCount = countEntries(rulesDir);

  const date = config.createdAt.split("T")[0];
  const pendingRules = countPendingRules(rootDir);

  console.log(`\nClawstrap Workspace: ${config.workspaceName}`);
  console.log(`Created: ${date} | Version: ${config.version}`);

  console.log(`\nConfiguration:`);
  console.log(
    `  Workload:        ${WORKLOAD_LABELS[config.workloadType] ?? config.workloadType}`
  );
  console.log(`  Parallel agents: ${config.parallelAgents}`);
  console.log(`  Quality level:   ${config.qualityLevel}`);
  console.log(
    `  Session handoff: ${config.sessionHandoff ? "yes" : "no"}`
  );
  console.log(`  Spec-driven dev: ${config.sdd ? "yes" : "no"}`);

  console.log(`\nStructure:`);
  console.log(`  Agents:   ${agentCount} (${systemDir}/agents/)`);
  console.log(`  Skills:   ${skillCount} (${systemDir}/skills/)`);
  console.log(`  Projects: ${projectCount} (projects/)`);
  console.log(`  Rules:    ${ruleCount} (${systemDir}/rules/)`);
  if (pendingRules > 0) {
    console.log(`  Pending rules: ${pendingRules}  (.claude/rules/ — review *-auto.md files)`);
  }

  if (config.lastExport) {
    const exportDate = config.lastExport.exportedAt.split("T")[0];
    console.log(`\nLast Export:`);
    console.log(`  Format:    ${config.lastExport.format}`);
    console.log(`  Date:      ${exportDate}`);
    console.log(`  Output:    ${config.lastExport.outputDir}`);
  }

  // Watch status
  const watchRunning = isDaemonRunning(rootDir);

  console.log(`\nWatch:`);
  console.log(`  Status:    ${watchRunning ? "running" : "stopped"}`);
  if (config.watch) {
    console.log(`  Adapter:   ${config.watch.adapter}`);
  }
  if (config.watchState?.lastGitCommit) {
    console.log(`  Last git:  ${config.watchState.lastGitCommit.slice(0, 8)}`);
  }
  if (config.watchState?.lastScanAt) {
    console.log(`  Last scan: ${config.watchState.lastScanAt.split("T")[0]}`);
  }
  if (config.watchState?.lastTranscriptAt) {
    console.log(`  Last transcript: ${config.watchState.lastTranscriptAt.replace("T", " ").slice(0, 16)}`);
  }

  console.log();
}
