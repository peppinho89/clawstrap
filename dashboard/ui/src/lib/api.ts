// ---------------------------------------------------------------------------
// Typed API client – all endpoints proxy through Vite to localhost:4200
// Types match the API's camelCase response format (from dashboard/api/scanner.ts)
// ---------------------------------------------------------------------------

// ---- Domain types (match API response shapes) -----------------------------

export interface DashboardAgent {
  name: string;
  slug: string;
  role: "orchestrator" | "worker" | "reviewer";
  purpose: string;
  reportsTo: string | null;
  skills: string[];
  rawMarkdown: string;
}

export interface DashboardSkill {
  name: string;
  description: string;
  triggers: string;
  rawMarkdown: string;
}

export interface DashboardProject {
  name: string;
  description: string;
  rawMarkdown: string;
}

export interface DashboardRule {
  name: string;
  filename: string;
  rawMarkdown: string;
}

export interface HealthCheck {
  label: string;
  pass: boolean;
  detail: string;
}

export interface GovernanceConfig {
  tier: string;
  requiresApproval: boolean;
  approvalGates: string[];
  qualityCheckInterval: number;
  minQualityGrade: string;
}

export interface ClawstrapConfig {
  version: string;
  createdAt: string;
  workspaceName: string;
  targetDirectory: string;
  aiSystem: string;
  workloadType: string;
  parallelAgents: string;
  qualityLevel: string;
  sessionHandoff: boolean;
  lastExport?: {
    format: string;
    exportedAt: string;
    outputDir: string;
  };
}

export interface WorkspaceData {
  config: ClawstrapConfig;
  governance: GovernanceConfig;
  agents: DashboardAgent[];
  skills: DashboardSkill[];
  projects: DashboardProject[];
  rules: DashboardRule[];
  counts: { agents: number; skills: number; projects: number; rules: number };
  health: { score: number; checks: HealthCheck[] };
  lastExport?: { format: string; exportedAt: string; outputDir: string };
}

// ---- Fetch helpers --------------------------------------------------------

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }
  return res.json() as Promise<T>;
}

// ---- Workspace ------------------------------------------------------------

export function fetchWorkspace(): Promise<WorkspaceData> {
  return request<WorkspaceData>("/api/workspace");
}

// ---- Agents ---------------------------------------------------------------

export function createAgent(body: {
  name: string;
  description: string;
  role: string;
}): Promise<{ ok: boolean; slug: string }> {
  return request("/api/agent", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAgent(
  slug: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  return request(`/api/agent/${slug}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteAgent(slug: string): Promise<void> {
  return request<void>(`/api/agent/${slug}`, { method: "DELETE" });
}

// ---- Skills ---------------------------------------------------------------

export function createSkill(body: {
  name: string;
  description: string;
  triggers: string;
}): Promise<{ ok: boolean; name: string }> {
  return request("/api/skill", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteSkill(name: string): Promise<void> {
  return request<void>(`/api/skill/${name}`, { method: "DELETE" });
}

export interface SkillPreview {
  name: string;
  description: string;
  triggers: string;
  source: string;
  preview: string;
  hasReferences: boolean;
}

export function previewSkill(url: string): Promise<SkillPreview> {
  return request<SkillPreview>("/api/skill/preview", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function importSkill(url: string): Promise<{ ok: boolean; name: string; source: string }> {
  return request("/api/skill/import", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

// ---- Projects -------------------------------------------------------------

export function createProject(body: {
  name: string;
  description: string;
}): Promise<{ ok: boolean; name: string }> {
  return request("/api/project", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteProject(name: string): Promise<void> {
  return request<void>(`/api/project/${name}`, { method: "DELETE" });
}

// ---- Governance -----------------------------------------------------------

export function updateGovernanceTier(
  tier: string,
): Promise<GovernanceConfig> {
  return request<GovernanceConfig>("/api/governance/tier", {
    method: "PUT",
    body: JSON.stringify({ tier }),
  });
}

// ---- Export ---------------------------------------------------------------

export function exportPaperclip(body: {
  name: string;
  mission: string;
}): Promise<{ ok: boolean; outputDir: string }> {
  return request("/api/export/paperclip", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---- Health ---------------------------------------------------------------

export function fetchHealth(): Promise<{ score: number; checks: HealthCheck[] }> {
  return request("/api/health");
}

export function fixHealth(): Promise<{ fixed: string[] }> {
  return request<{ fixed: string[] }>("/api/health/fix", {
    method: "POST",
  });
}
