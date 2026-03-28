// Template imports — tsup bundles .tmpl files as text strings
// @ts-expect-error .tmpl files imported as text via tsup loader
import governanceFile from "./governance-file.md.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import gettingStarted from "./getting-started.md.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import gitignore from "./gitignore.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import contextDiscipline from "./rules/context-discipline.md.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import approvalFirst from "./rules/approval-first.md.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import qualityGates from "./rules/quality-gates.md.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import skillRegistry from "./skills/SKILL_REGISTRY.md.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import primaryAgent from "./agents/primary-agent.md.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import agentTemplate from "./agents/agent-template.md.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import subagentBootstrap from "./subagent-bootstrap.md.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import gotchaLog from "./gotcha-log.md.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import futureConsiderations from "./future-considerations.md.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import memoryIndex from "./memory/MEMORY.md.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import projectReadme from "./projects/project-readme.md.tmpl";
// @ts-expect-error .tmpl files imported as text via tsup loader
import projectProcess from "./projects/project-process.md.tmpl";

export const templates: Record<string, string> = {
  governanceFile,
  gettingStarted,
  gitignore,
  contextDiscipline,
  approvalFirst,
  qualityGates,
  skillRegistry,
  primaryAgent,
  agentTemplate,
  subagentBootstrap,
  gotchaLog,
  futureConsiderations,
  memoryIndex,
  projectReadme,
  projectProcess,
};
