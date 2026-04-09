import fs from "node:fs";
import path from "node:path";
import { confirm } from "@inquirer/prompts";
import { ClawstrapConfigSchema, type ClawstrapConfig } from "./schema.js";
import { deriveTemplateVars } from "./derive-vars.js";
import { writeWorkspace } from "./writer.js";
import { runPrompts, getDefaults } from "./prompts.js";

const WORKLOAD_LABELS: Record<string, string> = {
  research: "Research & Analysis",
  content: "Content & Writing",
  "data-processing": "Data Processing",
  custom: "General Purpose",
};

export async function init(
  directory: string,
  options: { yes?: boolean; sdd?: boolean }
): Promise<void> {
  // Gather answers first (we need workspace name to determine target directory)
  const answers = options.yes
    ? getDefaults(directory)
    : await runPrompts();

  // When no explicit directory is given, use workspace name as the folder
  const targetDir = directory === "."
    ? path.resolve(answers.workspaceName)
    : path.resolve(directory);

  // Safety check: overwrite protection
  if (fs.existsSync(targetDir)) {
    const hasClawstrap = fs.existsSync(
      path.join(targetDir, ".clawstrap.json")
    );
    if (hasClawstrap) {
      if (options.yes) {
        console.error(
          "\nError: directory already has .clawstrap.json. Use interactive mode to confirm overwrite.\n"
        );
        process.exit(1);
      }
      const proceed = await confirm({
        message:
          "This directory already has a .clawstrap.json. Overwrite generated files?",
        default: false,
      });
      if (!proceed) {
        console.log("Aborted.\n");
        return;
      }
    }
  } else {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Build config
  const config: ClawstrapConfig = ClawstrapConfigSchema.parse({
    version: "1.5.1",
    createdAt: new Date().toISOString(),
    workspaceName: answers.workspaceName,
    targetDirectory: directory,
    aiSystem: "claude-code",
    workloadType: answers.workloadType,
    parallelAgents: answers.parallelAgents,
    qualityLevel: answers.qualityLevel,
    sessionHandoff: answers.sessionHandoff,
    sdd: options.sdd ?? answers.sdd,
  });

  // Print config summary (both interactive and --yes)
  console.log("\nConfiguration:");
  console.log(`  Workspace:      ${config.workspaceName}`);
  console.log(`  Workload:       ${WORKLOAD_LABELS[config.workloadType]}`);
  console.log(`  Parallel agents: ${config.parallelAgents}`);
  console.log(`  Quality level:  ${config.qualityLevel}`);
  console.log(
    `  Session handoff: ${config.sessionHandoff ? "yes" : "no"}`
  );
  console.log(`  Spec-driven dev: ${config.sdd ? "yes" : "no"}`);

  // Derive template variables
  const vars = deriveTemplateVars(config);

  // Write workspace
  console.log("\nGenerating your workspace...\n");
  const result = writeWorkspace(targetDir, vars, config);

  // Print summary
  for (const file of result.filesWritten) {
    console.log(`  \u2713 ${file}`);
  }
  for (const dir of result.dirsCreated) {
    console.log(`  \u2713 ${dir}/`);
  }

  const folderName = path.basename(targetDir);
  if (directory === ".") {
    console.log(`\nDone. Run \`cd ${folderName}\` and open GETTING_STARTED.md to begin.\n`);
  } else {
    console.log(`\nDone. Open GETTING_STARTED.md to begin.\n`);
  }
}
