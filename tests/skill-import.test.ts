import { describe, it, expect } from "vitest";
import { resolveSkillUrl } from "../src/skill-import.js";

describe("resolveSkillUrl", () => {
  it("resolves skills.sh URL", () => {
    const result = resolveSkillUrl(
      "https://skills.sh/anthropics/skills/frontend-design"
    );
    expect(result.rawUrl).toBe(
      "https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md"
    );
    expect(result.repoUrl).toBe("https://github.com/anthropics/skills");
    expect(result.skillName).toBe("frontend-design");
  });

  it("resolves skills.sh URL without protocol", () => {
    const result = resolveSkillUrl(
      "skills.sh/vercel-labs/agent-skills/react-best-practices"
    );
    expect(result.rawUrl).toBe(
      "https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/react-best-practices/SKILL.md"
    );
    expect(result.skillName).toBe("react-best-practices");
  });

  it("resolves GitHub tree URL", () => {
    const result = resolveSkillUrl(
      "https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices"
    );
    expect(result.rawUrl).toBe(
      "https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/react-best-practices/SKILL.md"
    );
    expect(result.repoUrl).toBe(
      "https://github.com/vercel-labs/agent-skills"
    );
    expect(result.skillName).toBe("react-best-practices");
  });

  it("resolves GitHub tree URL with custom branch", () => {
    const result = resolveSkillUrl(
      "https://github.com/org/repo/tree/develop/my-skills/cool-skill"
    );
    expect(result.rawUrl).toBe(
      "https://raw.githubusercontent.com/org/repo/develop/my-skills/cool-skill/SKILL.md"
    );
  });

  it("resolves raw GitHub URL with SKILL.md", () => {
    const result = resolveSkillUrl(
      "https://raw.githubusercontent.com/anthropics/skills/main/skills/pdf/SKILL.md"
    );
    expect(result.rawUrl).toBe(
      "https://raw.githubusercontent.com/anthropics/skills/main/skills/pdf/SKILL.md"
    );
    expect(result.skillName).toBe("pdf");
  });

  it("resolves raw GitHub URL without SKILL.md suffix", () => {
    const result = resolveSkillUrl(
      "https://raw.githubusercontent.com/org/repo/main/skills/my-skill"
    );
    expect(result.rawUrl).toBe(
      "https://raw.githubusercontent.com/org/repo/main/skills/my-skill/SKILL.md"
    );
    expect(result.skillName).toBe("my-skill");
  });

  it("resolves shorthand org/repo/skill", () => {
    const result = resolveSkillUrl("anthropics/skills/frontend-design");
    expect(result.rawUrl).toBe(
      "https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md"
    );
    expect(result.repoUrl).toBe("https://github.com/anthropics/skills");
    expect(result.skillName).toBe("frontend-design");
  });

  it("throws on bare GitHub repo URL without path", () => {
    expect(() =>
      resolveSkillUrl("https://github.com/org/repo")
    ).toThrow("must include skill path");
  });

  it("throws on unrecognized format", () => {
    expect(() => resolveSkillUrl("just-a-word")).toThrow(
      "Cannot resolve skill URL"
    );
  });
});
