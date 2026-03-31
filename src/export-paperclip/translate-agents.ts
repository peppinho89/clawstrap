import fs from "node:fs";
import path from "node:path";

export interface PaperclipAgent {
  slug: string;
  name: string;
  title: string;
  reportsTo: string | null;
  skills: string[];
  body: string;
}

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function translateAgents(
  rootDir: string,
  systemDir: string,
  workspaceName: string,
  skillSlugs: string[]
): PaperclipAgent[] {
  const agentsDir = path.join(rootDir, systemDir, "agents");
  const agents: PaperclipAgent[] = [];

  // Build the list of non-CEO agent names for the CEO handoff section
  const workerNames: string[] = [];

  // Collect non-CEO agents first to know who the CEO manages
  const workerAgents: PaperclipAgent[] = [];

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

      const slug = entry.replace(/\.md$/, "");
      const rawBody = fs.readFileSync(path.join(agentsDir, entry), "utf-8");

      const roleMatch = rawBody.match(/^>\s*\*\*Purpose\*\*:\s*(.+)/m);
      const description = roleMatch ? roleMatch[1].trim() : "";
      const name = slugToName(slug);
      const title = description || `${name} Agent`;

      // Detect role type from the raw body and slug
      const combined = (rawBody + " " + slug).toLowerCase();
      const isReviewer =
        combined.includes("review") ||
        combined.includes("qa") ||
        combined.includes("qc") ||
        combined.includes("quality");
      const roleType = isReviewer ? "reviewer" : "worker";

      workerAgents.push({
        slug,
        name,
        title,
        reportsTo: "ceo",
        skills: skillSlugs,
        body: buildWorkerBody(name, title, workspaceName, roleType),
      });

      workerNames.push(`**${name}**`);
    }
  }

  // Build CEO
  agents.push({
    slug: "ceo",
    name: "CEO",
    title: "Chief Executive Officer",
    reportsTo: null,
    skills: [],
    body: buildCeoBody(workspaceName, workerNames),
  });

  // Add workers after CEO
  agents.push(...workerAgents);

  return agents;
}

function buildCeoBody(
  workspaceName: string,
  workerNames: string[]
): string {
  const handoff =
    workerNames.length > 0
      ? `Route work to the appropriate team member: ${workerNames.join(", ")}.`
      : "The appropriate specialist for the task.";

  return `You are the CEO of ${workspaceName}. You set direction, scope work, and ensure every task starts with clear requirements before engineering begins.

## What triggers you

You are activated when new work arrives — a feature request, a bug report, a project that needs scoping, or a decision that needs product-level thinking.

## What you do

Your job is to turn incoming requests into clear, actionable plans. You decide what to build, why it matters, and who should build it.

You operate in three modes:
- **Scope and plan** — break down work into clear tasks with owners and acceptance criteria
- **Review and approve** — check completed work meets quality standards before sign-off
- **Prioritize** — when multiple tasks compete, decide what ships first and what waits

You enforce the approval-first principle: no work starts without a plan, no plan ships without review.

## What you produce

A scoped plan with task assignments, priorities, and acceptance criteria. Not implementation details — that's the team's job.

## Who you hand off to

${handoff}`;
}

function buildWorkerBody(
  name: string,
  title: string,
  workspaceName: string,
  roleType: "worker" | "reviewer"
): string {
  if (roleType === "reviewer") {
    return `You are the ${name} at ${workspaceName}. You operate in quality gate mode.

## What triggers you

You are activated when work is ready for review — a PR needs checking, output needs validation, or quality needs to be verified before shipping.

## What you do

You review work for correctness, security, and adherence to standards. You are not a rubber stamp — you catch the issues that would hurt in production.

You look for:
- Logic errors and edge cases
- Security vulnerabilities
- Style and convention violations
- Missing tests or insufficient coverage
- Assumptions that should be explicit

## What you produce

A review verdict: approved, or a specific list of issues that must be fixed. Every issue includes what's wrong and how to fix it.

## Who you hand off to

If approved, hand back to the **CEO** for final sign-off. If issues found, send back to the original author with specific fixes needed.`;
  }

  return `You are the ${name} at ${workspaceName}. Your specialty: ${title.toLowerCase()}.

## What triggers you

You are activated when the CEO assigns you a task that matches your expertise, or when a project needs your specific skills.

## What you do

You take scoped, assigned tasks and execute them. You write code, build features, and solve problems within your domain. You follow the plan — if the plan is unclear, you escalate to the CEO rather than guessing.

You work with discipline:
- Read the task requirements fully before starting
- Break complex tasks into smaller steps
- Test your work before marking it complete
- Document decisions that aren't obvious from the code

## What you produce

Working code, tested and ready for review. You hand off a clean branch or deliverable, not a work in progress.

## Who you hand off to

When your work is complete, hand off to the **CEO** for review routing. If a reviewer is available, the CEO will route it there.`;
}
