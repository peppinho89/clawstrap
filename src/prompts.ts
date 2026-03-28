import { select, input, confirm } from "@inquirer/prompts";
import type { WorkloadType, ParallelAgents, QualityLevel } from "./schema.js";
import path from "node:path";

export interface PromptAnswers {
  workspaceName: string;
  workloadType: WorkloadType;
  parallelAgents: ParallelAgents;
  qualityLevel: QualityLevel;
  sessionHandoff: boolean;
}

export async function runPrompts(): Promise<PromptAnswers> {
  console.log("\nWelcome to Clawstrap \u{1f528}");
  console.log("Scaffold a production-ready AI agent workspace.\n");

  const workspaceName = await input({
    message: "Workspace name:",
    default: path.basename(process.cwd()),
    validate: (v) => v.length > 0 || "Name is required",
  });

  const workloadType = await select<WorkloadType>({
    message: "What kind of work will this workspace handle?",
    choices: [
      {
        name: "Research & analysis pipeline",
        value: "research",
      },
      {
        name: "Content & writing system",
        value: "content",
      },
      {
        name: "Data processing workflow",
        value: "data-processing",
      },
      {
        name: "Custom / general purpose",
        value: "custom",
      },
    ],
  });

  const parallelAgents = await select<ParallelAgents>({
    message: "How many AI agents will work in parallel?",
    choices: [
      {
        name: "Just me \u2014 single agent",
        value: "single",
      },
      {
        name: "Small team \u2014 2 to 5 agents",
        value: "small-team",
      },
      {
        name: "Production \u2014 5+ agents, orchestrator pattern",
        value: "production",
      },
    ],
  });

  const qualityLevel = await select<QualityLevel>({
    message: "What quality controls do you need?",
    choices: [
      {
        name: "Solo \u2014 lightweight checks, fast iteration",
        value: "solo",
      },
      {
        name: "Team \u2014 structured QC gates, review steps",
        value: "team",
      },
      {
        name: "Production \u2014 full QC pipeline, batch monitoring",
        value: "production",
      },
    ],
  });

  const sessionHandoff = await confirm({
    message:
      "Enable session handoff checklists? (for multi-session work)",
    default: true,
  });

  return {
    workspaceName,
    workloadType,
    parallelAgents,
    qualityLevel,
    sessionHandoff,
  };
}

export function getDefaults(targetDir?: string): PromptAnswers {
  const name = targetDir
    ? path.basename(path.resolve(targetDir))
    : path.basename(process.cwd());

  return {
    workspaceName: name,
    workloadType: "custom",
    parallelAgents: "single",
    qualityLevel: "solo",
    sessionHandoff: true,
  };
}
