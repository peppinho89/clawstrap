import type { ClawstrapConfig, AiSystem, WorkloadType } from "./schema.js";

export type TemplateVars = Record<string, string | boolean>;

const SYSTEM_DIR: Record<AiSystem, string> = {
  "claude-code": ".claude",
};

const GOVERNANCE_FILE: Record<AiSystem, string> = {
  "claude-code": "CLAUDE.md",
};

const WORKLOAD_LABELS: Record<WorkloadType, string> = {
  research: "Research & Analysis",
  content: "Content & Writing",
  "data-processing": "Data Processing",
  custom: "General Purpose",
};

const FLUSH_CADENCES: Record<WorkloadType, string> = {
  research: "every 3 findings",
  content: "every draft iteration",
  "data-processing": "every 5 batch items",
  custom: "every 5 operations",
};

export function deriveTemplateVars(config: ClawstrapConfig): TemplateVars {
  return {
    // Metadata
    workspaceName: config.workspaceName,
    generatedDate: config.createdAt.split("T")[0],
    clawstrapVersion: config.version,

    // AI system (v1: always claude-code, v2: user-selectable)
    systemDir: SYSTEM_DIR[config.aiSystem],
    governanceFile: GOVERNANCE_FILE[config.aiSystem],

    // Direct values
    workloadType: config.workloadType,
    workloadLabel: WORKLOAD_LABELS[config.workloadType],
    flushCadence: FLUSH_CADENCES[config.workloadType],

    // Workload booleans
    isResearch: config.workloadType === "research",
    isContent: config.workloadType === "content",
    isDataProcessing: config.workloadType === "data-processing",
    isCustom: config.workloadType === "custom",

    // Agent booleans
    hasSubagents: config.parallelAgents !== "single",
    isProductionAgents: config.parallelAgents === "production",

    // Quality booleans
    hasQualityGates: config.qualityLevel !== "solo",
    isProductionQuality: config.qualityLevel === "production",

    // Session handoff
    sessionHandoff: config.sessionHandoff,

    // Spec-Driven Development
    sddEnabled: config.sdd,
  };
}
