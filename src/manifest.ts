export interface ManifestEntry {
  templateKey: string;
  outputPath: string;
  condition?: string;
}

export const OUTPUT_MANIFEST: ManifestEntry[] = [
  // Always generated
  {
    templateKey: "governanceFile",
    outputPath: "{%governanceFile%}",
  },
  {
    templateKey: "gettingStarted",
    outputPath: "GETTING_STARTED.md",
  },
  {
    templateKey: "gitignore",
    outputPath: ".gitignore",
  },
  {
    templateKey: "contextDiscipline",
    outputPath: "{%systemDir%}/rules/context-discipline.md",
  },
  {
    templateKey: "approvalFirst",
    outputPath: "{%systemDir%}/rules/approval-first.md",
  },
  {
    templateKey: "skillRegistry",
    outputPath: "{%systemDir%}/skills/SKILL_REGISTRY.md",
  },
  {
    templateKey: "gotchaLog",
    outputPath: "{%systemDir%}/gotcha-log.md",
  },
  {
    templateKey: "futureConsiderations",
    outputPath: "{%systemDir%}/future-considerations.md",
  },
  {
    templateKey: "projectProcess",
    outputPath: "projects/_template/process.md",
  },
  {
    templateKey: "projectReadme",
    outputPath: "projects/_template/README.md",
  },

  // Conditional
  {
    templateKey: "qualityGates",
    outputPath: "{%systemDir%}/rules/quality-gates.md",
    condition: "hasQualityGates",
  },
  {
    templateKey: "primaryAgent",
    outputPath: "{%systemDir%}/agents/primary-agent.md",
    condition: "hasSubagents",
  },
  {
    templateKey: "agentTemplate",
    outputPath: "{%systemDir%}/agents/_template.md",
    condition: "hasSubagents",
  },
  {
    templateKey: "subagentBootstrap",
    outputPath: "{%systemDir%}/subagent-bootstrap.md",
    condition: "hasSubagents",
  },
  {
    templateKey: "memoryIndex",
    outputPath: "{%systemDir%}/memory/MEMORY.md",
    condition: "sessionHandoff",
  },
];

export const EMPTY_DIRS = ["tmp", "research", "context", "artifacts"];
