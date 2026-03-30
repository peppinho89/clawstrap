import fs from "node:fs";
import path from "node:path";

export interface PaperclipAgent {
  name: string;
  role: string;
  title: string;
  reportsTo: string | null;
  body: string;
  filename: string;
}

export function translateAgents(
  rootDir: string,
  systemDir: string,
  workspaceName: string
): PaperclipAgent[] {
  const agentsDir = path.join(rootDir, systemDir, "agents");
  const agents: PaperclipAgent[] = [];

  // Always create a CEO from primary-agent or workspace config
  const primaryPath = path.join(agentsDir, "primary-agent.md");
  if (fs.existsSync(primaryPath)) {
    agents.push({
      name: "ceo",
      role: "Primary Orchestrator",
      title: "CEO",
      reportsTo: null,
      body: fs.readFileSync(primaryPath, "utf-8"),
      filename: "ceo.md",
    });
  } else {
    // Single-agent workspace: generate a CEO from workspace config
    agents.push({
      name: "ceo",
      role: "Primary Orchestrator",
      title: "CEO",
      reportsTo: null,
      body: `# Agent: CEO\n> Primary orchestrator for ${workspaceName}\n\nThis agent manages all work in the ${workspaceName} workspace.`,
      filename: "ceo.md",
    });
  }

  // Translate other agents as workers reporting to CEO
  if (fs.existsSync(agentsDir)) {
    for (const entry of fs.readdirSync(agentsDir)) {
      if (
        entry === "primary-agent.md" ||
        entry === "_template.md" ||
        entry.startsWith(".") ||
        !entry.endsWith(".md")
      ) {
        continue;
      }

      const name = entry.replace(/\.md$/, "");
      const body = fs.readFileSync(path.join(agentsDir, entry), "utf-8");

      // Try to extract role from the file (first line after "# Agent:")
      const roleMatch = body.match(/^>\s*\*\*Purpose\*\*:\s*(.+)/m);
      const role = roleMatch ? roleMatch[1].trim() : `${name} Agent`;

      agents.push({
        name,
        role,
        title: name,
        reportsTo: "ceo",
        body,
        filename: `${name}.md`,
      });
    }
  }

  return agents;
}
