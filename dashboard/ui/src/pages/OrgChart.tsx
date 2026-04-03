import { useState, useRef, useEffect, useCallback } from "react";
import type { DashboardAgent, WorkspaceData } from "@/lib/api";
import { createAgent } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon, CrownIcon, CpuIcon, ScanEyeIcon } from "lucide-react";

interface OrgChartProps {
  data: WorkspaceData;
  onMutate: () => void;
}

const roleConfig: Record<string, { border: string; bg: string; glow: string; badge: string; badgeText: string; icon: typeof CrownIcon }> = {
  orchestrator: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/[0.06]",
    glow: "shadow-amber-500/5",
    badge: "bg-amber-500/15",
    badgeText: "text-amber-400",
    icon: CrownIcon,
  },
  worker: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/[0.06]",
    glow: "shadow-blue-500/5",
    badge: "bg-blue-500/15",
    badgeText: "text-blue-400",
    icon: CpuIcon,
  },
  reviewer: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/[0.06]",
    glow: "shadow-emerald-500/5",
    badge: "bg-emerald-500/15",
    badgeText: "text-emerald-400",
    icon: ScanEyeIcon,
  },
};

interface TreeNode {
  agent: DashboardAgent;
  children: TreeNode[];
}

function buildTree(agents: DashboardAgent[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const a of agents) {
    map.set(a.slug, { agent: a, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const a of agents) {
    const node = map.get(a.slug)!;
    if (a.reportsTo && map.has(a.reportsTo)) {
      map.get(a.reportsTo)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function OrgNode({
  node,
  onSelect,
}: {
  node: TreeNode;
  onSelect: (a: DashboardAgent) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const childrenRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

  const updateLines = useCallback(() => {
    if (!parentRef.current || !childrenRef.current) return;
    const parentRect = parentRef.current.getBoundingClientRect();
    const containerRect = parentRef.current.closest("[data-org-tree]")?.getBoundingClientRect();
    if (!containerRect) return;

    const px = parentRect.left + parentRect.width / 2 - containerRect.left;
    const py = parentRect.bottom - containerRect.top;

    const childNodes = childrenRef.current.children;
    const newLines: typeof lines = [];
    for (let i = 0; i < childNodes.length; i++) {
      const childCard = childNodes[i]?.querySelector("[data-org-node]");
      if (!childCard) continue;
      const cr = childCard.getBoundingClientRect();
      const cx = cr.left + cr.width / 2 - containerRect.left;
      const cy = cr.top - containerRect.top;
      newLines.push({ x1: px, y1: py, x2: cx, y2: cy });
    }
    setLines(newLines);
  }, []);

  useEffect(() => {
    updateLines();
    window.addEventListener("resize", updateLines);
    return () => window.removeEventListener("resize", updateLines);
  }, [updateLines, node.children.length]);

  const role = node.agent.role;
  const config = roleConfig[role] ?? roleConfig.worker;
  const RoleIcon = config.icon;

  return (
    <div className="flex flex-col items-center">
      <div
        ref={parentRef}
        data-org-node
        onClick={() => onSelect(node.agent)}
        className={`group cursor-pointer rounded-xl border ${config.border} ${config.bg} px-5 py-3.5 text-center shadow-lg ${config.glow} transition-all duration-200 hover:scale-[1.02] hover:shadow-xl`}
      >
        <div className="mb-2 flex justify-center">
          <div className={`rounded-full ${config.badge} p-2`}>
            <RoleIcon className={`size-4 ${config.badgeText}`} />
          </div>
        </div>
        <p className="text-[13px] font-semibold text-white">{node.agent.name}</p>
        <Badge
          variant="secondary"
          className={`mt-1.5 text-[10px] ${config.badge} ${config.badgeText} border-0`}
        >
          {role}
        </Badge>
      </div>

      {node.children.length > 0 && (
        <>
          <svg className="pointer-events-none absolute inset-0 size-full" style={{ zIndex: 0 }}>
            {lines.map((l, i) => (
              <path
                key={i}
                d={`M${l.x1},${l.y1} C${l.x1},${(l.y1 + l.y2) / 2} ${l.x2},${(l.y1 + l.y2) / 2} ${l.x2},${l.y2}`}
                fill="none"
                stroke="rgba(245,158,11,0.2)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            ))}
          </svg>
          <div ref={childrenRef} className="mt-10 flex gap-8">
            {node.children.map((child) => (
              <OrgNode key={child.agent.slug} node={child} onSelect={onSelect} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function OrgChart({ data, onMutate }: OrgChartProps) {
  const [selected, setSelected] = useState<DashboardAgent | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const trees = buildTree(data.agents);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setAdding(true);
    try {
      await createAgent({
        name: fd.get("name") as string,
        description: fd.get("description") as string,
        role: (fd.get("role") as DashboardAgent["role"]) || "worker",
      });
      onMutate();
      setShowAdd(false);
    } finally {
      setAdding(false);
    }
  }

  if (data.agents.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Org Chart</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">Agent reporting hierarchy</p>
          </div>
          <Button onClick={() => setShowAdd(true)} className="bg-amber-500 text-black hover:bg-amber-400">
            <PlusIcon className="mr-1.5 size-4" /> Add Agent
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-20">
          <div className="rounded-full bg-white/[0.04] p-4">
            <CpuIcon className="size-6 text-white/20" />
          </div>
          <p className="mt-3 text-[13px] text-muted-foreground">No agents yet. Add one to see the org chart.</p>
        </div>
        <AddAgentDialog
          open={showAdd}
          onOpenChange={setShowAdd}
          agents={data.agents}
          onSubmit={handleAdd}
          loading={adding}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Org Chart</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Agent reporting hierarchy</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-amber-500 text-black hover:bg-amber-400">
          <PlusIcon className="mr-1.5 size-4" /> Add Agent
        </Button>
      </div>

      {/* Role legend */}
      <div className="flex gap-4">
        {Object.entries(roleConfig).map(([role, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={role} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Icon className={`size-3 ${cfg.badgeText}`} />
              <span className="capitalize">{role}</span>
            </div>
          );
        })}
      </div>

      <div
        data-org-tree
        className="relative overflow-auto rounded-xl border border-white/[0.06] bg-white/[0.015] p-10"
      >
        <div className="flex justify-center gap-12">
          {trees.map((t) => (
            <OrgNode key={t.agent.slug} node={t} onSelect={setSelected} />
          ))}
        </div>
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-white">{selected.name}</SheetTitle>
                <SheetDescription>
                  <Badge
                    variant="secondary"
                    className={`${roleConfig[selected.role]?.badge} ${roleConfig[selected.role]?.badgeText} border-0 text-[10px]`}
                  >
                    {selected.role}
                  </Badge>
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 py-2">
                {selected.purpose && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Purpose
                    </p>
                    <p className="mt-1.5 text-[13px] text-white/80">{selected.purpose}</p>
                  </div>
                )}
                {selected.reportsTo && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Reports to
                    </p>
                    <p className="mt-1.5 text-[13px] text-white/80">{selected.reportsTo}</p>
                  </div>
                )}
                {selected.skills && selected.skills.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.skills.map((s) => (
                        <Badge key={s} variant="outline" className="border-white/10 text-[11px] text-white/60">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selected.model && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Model
                    </p>
                    <code className="mt-1.5 block rounded bg-white/[0.04] px-2 py-1 text-[12px] text-amber-400/80">
                      {selected.model}
                    </code>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AddAgentDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        agents={data.agents}
        onSubmit={handleAdd}
        loading={adding}
      />
    </div>
  );
}

function AddAgentDialog({
  open,
  onOpenChange,
  agents,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  agents: DashboardAgent[];
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Add Agent</DialogTitle>
          <DialogDescription>Create a new agent in the workspace.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-white/60">Name</label>
            <Input name="name" required placeholder="e.g. research-agent" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-white/60">Description</label>
            <Textarea name="description" required placeholder="What does this agent do?" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-white/60">Role</label>
            <Select name="role" defaultValue="worker">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orchestrator">Orchestrator</SelectItem>
                <SelectItem value="worker">Worker</SelectItem>
                <SelectItem value="reviewer">Reviewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-white/60">Reports to</label>
            <Select name="reports_to" defaultValue="">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None (root)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None (root)</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.slug} value={a.slug}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-amber-500 text-black hover:bg-amber-400">
              {loading ? "Creating..." : "Create Agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
