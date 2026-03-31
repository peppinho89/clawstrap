import fs from "node:fs";
import path from "node:path";

export interface PaperclipGoal {
  name: string;
  description: string;
}

export function translateGoals(rootDir: string): PaperclipGoal[] {
  const projectsDir = path.join(rootDir, "projects");
  const goals: PaperclipGoal[] = [];

  if (!fs.existsSync(projectsDir)) return goals;

  for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "_template" || entry.name.startsWith(".")) {
      continue;
    }

    const readmePath = path.join(projectsDir, entry.name, "README.md");
    if (!fs.existsSync(readmePath)) continue;

    const content = fs.readFileSync(readmePath, "utf-8");

    // Extract description from "## What This Project Is" section
    const descMatch = content.match(
      /## What This Project Is\s*\n+([\s\S]*?)(?=\n---|\n##|$)/
    );
    const description = descMatch
      ? descMatch[1].trim()
      : `Project: ${entry.name}`;

    goals.push({ name: entry.name, description });
  }

  return goals;
}
