import fs from "node:fs";
import path from "node:path";
import type { QualityLevel } from "../schema.js";

export interface GovernanceConfig {
  tier: string;
  requiresApproval: boolean;
  approvalGates: string[];
  qualityCheckInterval: number;
  minQualityGrade: string;
}

const GOVERNANCE_TIERS: Record<QualityLevel, GovernanceConfig> = {
  solo: {
    tier: "light",
    requiresApproval: false,
    approvalGates: [],
    qualityCheckInterval: 10,
    minQualityGrade: "C",
  },
  team: {
    tier: "standard",
    requiresApproval: true,
    approvalGates: ["strategy", "budget-change"],
    qualityCheckInterval: 5,
    minQualityGrade: "B",
  },
  production: {
    tier: "strict",
    requiresApproval: true,
    approvalGates: [
      "strategy",
      "agent-hire",
      "budget-change",
      "task-transition",
    ],
    qualityCheckInterval: 5,
    minQualityGrade: "A",
  },
};

export function getGovernanceConfig(
  qualityLevel: QualityLevel
): GovernanceConfig {
  return GOVERNANCE_TIERS[qualityLevel];
}

export function buildGovernanceDoc(
  rootDir: string,
  systemDir: string,
  qualityLevel: QualityLevel
): string {
  const gov = GOVERNANCE_TIERS[qualityLevel];
  const sections: string[] = [];

  sections.push("# Governance Rules");
  sections.push(`> Tier: ${gov.tier} | Quality check every ${gov.qualityCheckInterval} tasks | Min grade: ${gov.minQualityGrade}`);
  sections.push(`> Exported from Clawstrap workspace`);
  sections.push("");

  // Read each rule file and include it
  const rulesDir = path.join(rootDir, systemDir, "rules");
  if (fs.existsSync(rulesDir)) {
    for (const entry of fs.readdirSync(rulesDir).sort()) {
      if (!entry.endsWith(".md")) continue;
      const content = fs.readFileSync(path.join(rulesDir, entry), "utf-8");
      sections.push(content);
      sections.push("---\n");
    }
  }

  if (gov.requiresApproval) {
    sections.push("## Approval Gates\n");
    sections.push(
      "The following actions require board approval before execution:\n"
    );
    for (const gate of gov.approvalGates) {
      sections.push(`- ${gate}`);
    }
    sections.push("");
  }

  return sections.join("\n");
}
