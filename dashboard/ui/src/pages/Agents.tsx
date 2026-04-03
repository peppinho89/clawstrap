import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { DashboardAgent, WorkspaceData } from "@/lib/api";
import { createAgent, updateAgent, deleteAgent } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PlusIcon, Trash2Icon, CrownIcon, CpuIcon, ScanEyeIcon, BotIcon } from "lucide-react";

interface AgentsProps {
  data: WorkspaceData;
  onMutate: () => void;
}

const roleStyle: Record<string, { badge: string; badgeText: string; border: string; icon: typeof CrownIcon }> = {
  orchestrator: { badge: "bg-amber-500/15", badgeText: "text-amber-400", border: "border-l-amber-500/40", icon: CrownIcon },
  worker: { badge: "bg-blue-500/15", badgeText: "text-blue-400", border: "border-l-blue-500/40", icon: CpuIcon },
  reviewer: { badge: "bg-emerald-500/15", badgeText: "text-emerald-400", border: "border-l-emerald-500/40", icon: ScanEyeIcon },
};

export default function Agents({ data, onMutate }: AgentsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<DashboardAgent | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setShowAdd(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await createAgent({
        name: fd.get("name") as string,
        description: fd.get("description") as string,
        role: (fd.get("role") as DashboardAgent["role"]) || "worker",
      });
      onMutate();
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await updateAgent(selected.slug, {
        name: fd.get("name") as string,
        description: fd.get("description") as string,
        role: (fd.get("role") as DashboardAgent["role"]) || selected.role,
      });
      onMutate();
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update agent");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await deleteAgent(selected.slug);
      onMutate();
      setSelected(null);
      setShowDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Agents</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {data.agents.length} agent{data.agents.length !== 1 ? "s" : ""} in workspace
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-amber-500 text-black hover:bg-amber-400">
          <PlusIcon className="mr-1.5 size-4" /> Add Agent
        </Button>
      </div>

      {data.agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-20">
          <div className="rounded-full bg-white/[0.04] p-4">
            <BotIcon className="size-6 text-white/20" />
          </div>
          <p className="mt-3 text-[13px] text-muted-foreground">
            No agents yet.{" "}
            <button
              className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
              onClick={() => setShowAdd(true)}
            >
              Add one
            </button>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.agents.map((agent) => {
            const style = roleStyle[agent.role] ?? roleStyle.worker;
            const RoleIcon = style.icon;
            return (
              <Card
                key={agent.slug}
                className={`group cursor-pointer border-l-2 ${style.border} border-white/[0.06] transition-all duration-200 hover:border-white/10 hover:bg-white/[0.02]`}
                onClick={() => setSelected(agent)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-[14px] text-white">{agent.name}</CardTitle>
                      <CardDescription className="mt-1">
                        <Badge
                          variant="secondary"
                          className={`${style.badge} ${style.badgeText} border-0 text-[10px]`}
                        >
                          <RoleIcon className="mr-1 size-2.5" />
                          {agent.role}
                        </Badge>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                    {agent.purpose || agent.description}
                  </p>
                  {agent.skills && agent.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {agent.skills.map((s) => (
                        <Badge key={s} variant="outline" className="border-white/8 text-[10px] text-white/45">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Sheet */}
      <Sheet open={showAdd} onOpenChange={setShowAdd}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="text-white">Add Agent</SheetTitle>
            <SheetDescription>Create a new agent in the workspace.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="space-y-4 px-4">
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
            {error && <p className="text-[12px] text-red-400">{error}</p>}
            <SheetFooter>
              <Button type="submit" disabled={submitting} className="bg-amber-500 text-black hover:bg-amber-400">
                {submitting ? "Creating..." : "Create Agent"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Detail / Edit Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-white">{selected.name}</SheetTitle>
                <SheetDescription>Edit agent details</SheetDescription>
              </SheetHeader>
              <form onSubmit={handleUpdate} className="space-y-4 px-4">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-white/60">Name</label>
                  <Input name="name" required defaultValue={selected.name} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-white/60">Description</label>
                  <Textarea
                    name="description"
                    required
                    defaultValue={selected.description}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-white/60">Role</label>
                  <Select name="role" defaultValue={selected.role}>
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
                {error && <p className="text-[12px] text-red-400">{error}</p>}
                <SheetFooter className="flex-row justify-between">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDelete(true)}
                  >
                    <Trash2Icon className="mr-1 size-4" /> Delete
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-amber-500 text-black hover:bg-amber-400">
                    {submitting ? "Saving..." : "Save Changes"}
                  </Button>
                </SheetFooter>
              </form>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-white">Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{selected?.name}&rdquo;? This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
