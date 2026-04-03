import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BotIcon,
  WrenchIcon,
  FolderOpenIcon,
  FileTextIcon,
  CheckCircle2Icon,
  XCircleIcon,
  PackageIcon,
  ActivityIcon,
  ArrowUpRightIcon,
} from "lucide-react";
import type { WorkspaceData } from "@/lib/api";

interface HomeProps {
  data: WorkspaceData;
}

const tierConfig: Record<string, { color: string; bg: string; border: string }> = {
  light: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  standard: {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  strict: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
};

export default function Home({ data }: HomeProps) {
  const stats = [
    {
      label: "Agents",
      value: data.agents.length,
      icon: BotIcon,
      accent: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/10",
    },
    {
      label: "Skills",
      value: data.skills.length,
      icon: WrenchIcon,
      accent: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/10",
    },
    {
      label: "Projects",
      value: data.projects.length,
      icon: FolderOpenIcon,
      accent: "text-violet-400",
      bg: "bg-violet-500/10",
      border: "border-violet-500/10",
    },
    {
      label: "Rules",
      value: data.rules.length,
      icon: FileTextIcon,
      accent: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/10",
    },
  ];

  const healthScore = data.health.score;
  const tier = data.governance.tier;
  const tc = tierConfig[tier] ?? tierConfig.standard;

  // Calculate circumference for circular progress
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {data.config.workspaceName}
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <Badge
              className={`${tc.bg} ${tc.color} ${tc.border} border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide`}
              variant="secondary"
            >
              {tier} governance
            </Badge>
            <span className="text-[13px] text-muted-foreground">
              Created {new Date(data.config.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards + Health score row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_220px]">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <Card
              key={s.label}
              className={`group relative overflow-hidden border ${s.border} bg-card transition-all duration-200 hover:border-white/10`}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className={`rounded-lg p-2 ${s.bg}`}>
                    <s.icon className={`size-4 ${s.accent}`} />
                  </div>
                  <ArrowUpRightIcon className="size-3.5 text-white/10 transition-colors group-hover:text-white/25" />
                </div>
                <p className="mt-3 text-3xl font-bold tabular-nums text-white">{s.value}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Health score circle */}
        <Card className="flex flex-col items-center justify-center border-white/[0.06] py-6">
          <div className="relative flex items-center justify-center">
            <svg className="size-[130px] -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-white/[0.04]"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={`transition-all duration-1000 ${
                  healthScore >= 80 ? "text-emerald-400" : healthScore >= 50 ? "text-amber-400" : "text-red-400"
                }`}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={`text-2xl font-bold tabular-nums ${
                healthScore >= 80 ? "text-emerald-400" : healthScore >= 50 ? "text-amber-400" : "text-red-400"
              }`}>
                {healthScore}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Health
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Health checks */}
      <Card className="border-white/[0.06]">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-amber-500/10 p-1.5">
              <ActivityIcon className="size-4 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-[15px]">Health Checks</CardTitle>
              <CardDescription className="text-[12px]">
                {data.health.checks.filter(c => c.pass).length} of {data.health.checks.length} checks passing
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.health.checks.map((c) => (
              <div
                key={c.label}
                className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ${
                  c.pass
                    ? "border-emerald-500/10 bg-emerald-500/[0.03]"
                    : "border-red-500/15 bg-red-500/[0.04]"
                }`}
              >
                {c.pass ? (
                  <CheckCircle2Icon className="size-4 shrink-0 text-emerald-400" />
                ) : (
                  <XCircleIcon className="size-4 shrink-0 text-red-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-medium ${c.pass ? "text-white/80" : "text-red-300"}`}>
                    {c.label}
                  </p>
                  {c.detail && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {c.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Last export */}
      {data.lastExport && (
        <Card className="border-white/[0.06]">
          <CardHeader className="flex-row items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <PackageIcon className="size-4 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-[15px]">Last Export</CardTitle>
              <CardDescription className="text-[12px]">
                {data.lastExport.format} &middot;{" "}
                {new Date(data.lastExport.exportedAt).toLocaleString()}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-[13px] text-muted-foreground">
              Output:{" "}
              <code className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[12px] text-amber-400/80">
                {data.lastExport.outputDir}
              </code>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
