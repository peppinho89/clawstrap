import type { PaperclipAgent } from "./translate-agents.js";
import type { PaperclipSkill } from "./translate-skills.js";

export interface PaperclipManifest {
  apiVersion: string;
  version: string;
  displayName: string;
  description: string;
  source: string;
  clawstrapVersion: string;
  exportedAt: string;
  company: string;
  governance: string;
  agents: string[];
  skills: string[];
  goals: string;
}

export function buildManifest(
  companyName: string,
  clawstrapVersion: string,
  agents: PaperclipAgent[],
  skills: PaperclipSkill[]
): PaperclipManifest {
  return {
    apiVersion: "1",
    version: "1.0.0",
    displayName: companyName,
    description: `Exported from Clawstrap workspace`,
    source: "clawstrap",
    clawstrapVersion,
    exportedAt: new Date().toISOString(),
    company: "company.json",
    governance: "governance.md",
    agents: agents.map((a) => `agents/${a.filename}`),
    skills: skills.map((s) => `skills/${s.name}/SKILL.md`),
    goals: "goals/README.md",
  };
}
