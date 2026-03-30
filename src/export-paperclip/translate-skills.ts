import fs from "node:fs";
import path from "node:path";

export interface PaperclipSkill {
  name: string;
  sourcePath: string;
  content: string;
}

export function translateSkills(
  rootDir: string,
  systemDir: string
): PaperclipSkill[] {
  const skillsDir = path.join(rootDir, systemDir, "skills");
  const skills: PaperclipSkill[] = [];

  if (!fs.existsSync(skillsDir)) return skills;

  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) continue;

    skills.push({
      name: entry.name,
      sourcePath: `${systemDir}/skills/${entry.name}/SKILL.md`,
      content: fs.readFileSync(skillMdPath, "utf-8"),
    });
  }

  return skills;
}
