import { useState } from "react";
import Markdown from "react-markdown";
import type { WorkspaceData, GovernanceConfig } from "@/lib/api";
import { updateGovernanceTier } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LockIcon,
  ShieldCheckIcon,
  ArrowUpDown,
  GaugeIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  ShieldAlertIcon,
  FileTextIcon,
} from "lucide-react";

interface GovernanceProps {
  data: WorkspaceData;
  onMutate: () => void;
}

const tiers: GovernanceConfig["tier"][] = ["light", "standard", "strict"];

const tierMeta: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2Icon; desc: string }
> = {
  light: {
    label: "Light",
    color: "text-emerald-400",
    bg: "bg-emerald-500",
    border: "border-emerald-500/20",
    icon: CheckCircle2Icon,
    desc: "Minimal gates. Fast iteration, lower guardrails.",
  },
  standard: {
    label: "Standard",
    color: "text-amber-400",
    bg: "bg-amber-500",
    border: "border-amber-500/20",
    icon: AlertTriangleIcon,
    desc: "Balanced approval gates and quality checks.",
  },
  strict: {
    label: "Strict",
    color: "text-red-400",
    bg: "bg-red-500",
    border: "border-red-500/20",
    icon: ShieldAlertIcon,
    desc: "Maximum oversight. Every action requires approval.",
  },
};

export default function Governance({ data, onMutate }: GovernanceProps) {
  const gov = data.governance;
  const [showTierDialog, setShowTierDialog] = useState(false);
  const [pendingTier, setPendingTier] = useState<GovernanceConfig["tier"] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function confirmTierChange() {
    if (!pendingTier) return;
    setSubmitting(true);
    try {
      await updateGovernanceTier(pendingTier);
      onMutate();
      setShowTierDialog(false);
    } finally {
      setSubmitting(false);
      setPendingTier(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Governance</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Security tiers, approval gates, and rules</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-5">
          {/* Tier visualization */}
          <Card className="border-white/[0.06]">
            <CardHeader className="flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-amber-500/10 p-1.5">
                  <GaugeIcon className="size-4 text-amber-400" />
                </div>
                <CardTitle className="text-[15px] text-white">Governance Tier</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTierDialog(true)}
                className="border-white/10 text-[12px] hover:bg-white/[0.04]"
              >
                <ArrowUpDown className="mr-1 size-3" /> Change
              </Button>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {tiers.map((t) => {
                const meta = tierMeta[t];
                const isCurrent = t === gov.tier;
                const TierIcon = meta.icon;
                return (
                  <div
                    key={t}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-200 ${
                      isCurrent
                        ? `${meta.border} bg-white/[0.03]`
                        : "border-transparent opacity-40"
                    }`}
                  >
                    <div className={`rounded-full p-1.5 ${isCurrent ? `${meta.bg}/15` : "bg-white/[0.04]"}`}>
                      <TierIcon className={`size-3.5 ${isCurrent ? meta.color : "text-white/30"}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-[13px] font-semibold ${isCurrent ? meta.color : "text-white/40"}`}>
                        {meta.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{meta.desc}</p>
                    </div>
                    {isCurrent && (
                      <Badge variant="secondary" className={`${meta.bg}/10 ${meta.color} border-0 text-[10px]`}>
                        Active
                      </Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Approval gates */}
          <Card className="border-white/[0.06]">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-amber-500/10 p-1.5">
                  <LockIcon className="size-4 text-amber-400" />
                </div>
                <CardTitle className="text-[15px] text-white">Approval Gates</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {gov.approvalGates.length === 0 ? (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-white/10 py-8">
                  <p className="text-[12px] text-muted-foreground">
                    No approval gates configured.
                  </p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {gov.approvalGates.map((gate) => (
                    <li
                      key={gate}
                      className="flex items-center gap-2.5 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-[13px] text-white/70"
                    >
                      <div className="rounded bg-amber-500/10 p-1">
                        <LockIcon className="size-3 text-amber-400" />
                      </div>
                      {gate}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Quality settings */}
          <Card className="border-white/[0.06]">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-emerald-500/10 p-1.5">
                  <ShieldCheckIcon className="size-4 text-emerald-400" />
                </div>
                <CardTitle className="text-[15px] text-white">Quality Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Check interval</span>
                <span className="font-medium text-white/80">
                  Every {gov.qualityCheckInterval} item(s)
                </span>
              </div>
              <Separator className="bg-white/[0.06]" />
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Min grade</span>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-0 text-[11px]">
                  {gov.minQualityGrade}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Rules */}
        <Card className="border-white/[0.06] lg:row-span-3">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-amber-500/10 p-1.5">
                <FileTextIcon className="size-4 text-amber-400" />
              </div>
              <CardTitle className="text-[15px] text-white">Rules</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.rules.length === 0 ? (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-white/10 py-10">
                <p className="text-[12px] text-muted-foreground">No rules defined.</p>
              </div>
            ) : (
              <Tabs defaultValue={data.rules[0]?.filename}>
                <TabsList className="mb-4 flex-wrap">
                  {data.rules.map((r) => (
                    <TabsTrigger key={r.filename} value={r.filename} className="text-[12px]">
                      {r.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {data.rules.map((r) => (
                  <TabsContent key={r.filename} value={r.filename}>
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5">
                      <article className="prose prose-sm max-w-none">
                        <Markdown>{r.rawMarkdown}</Markdown>
                      </article>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Change tier dialog */}
      <Dialog open={showTierDialog} onOpenChange={setShowTierDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-white">Change Governance Tier</DialogTitle>
            <DialogDescription>
              Select a new governance tier. This affects approval gates and quality
              requirements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {tiers.map((t) => {
              const meta = tierMeta[t];
              const isSelected = t === (pendingTier ?? gov.tier);
              const TierIcon = meta.icon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPendingTier(t)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
                    isSelected
                      ? `${meta.border} bg-white/[0.04]`
                      : "border-white/[0.06] hover:bg-white/[0.02]"
                  }`}
                >
                  <div className={`rounded-full p-1.5 ${isSelected ? `${meta.bg}/15` : "bg-white/[0.04]"}`}>
                    <TierIcon className={`size-3.5 ${isSelected ? meta.color : "text-white/30"}`} />
                  </div>
                  <div>
                    <p className={`text-[13px] font-semibold ${isSelected ? meta.color : "text-white/60"}`}>
                      {meta.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{meta.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTierDialog(false)} className="border-white/10">
              Cancel
            </Button>
            <Button
              onClick={confirmTierChange}
              disabled={submitting || !pendingTier || pendingTier === gov.tier}
              className="bg-amber-500 text-black hover:bg-amber-400"
            >
              {submitting ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
