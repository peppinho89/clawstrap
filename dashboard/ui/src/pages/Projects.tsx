import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Markdown from "react-markdown";
import type { DashboardProject, WorkspaceData } from "@/lib/api";
import { createProject, deleteProject } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { PlusIcon, Trash2Icon, FolderOpenIcon, GitBranchIcon } from "lucide-react";

interface ProjectsProps {
  data: WorkspaceData;
  onMutate: () => void;
}

export default function Projects({ data, onMutate }: ProjectsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<DashboardProject | null>(null);
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
      await createProject({
        name: fd.get("name") as string,
        description: fd.get("description") as string,
        path: (fd.get("path") as string) || undefined,
      });
      onMutate();
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await deleteProject(selected.slug);
      onMutate();
      setSelected(null);
      setShowDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Projects</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {data.projects.length} project{data.projects.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-amber-500 text-black hover:bg-amber-400">
          <PlusIcon className="mr-1.5 size-4" /> Add Project
        </Button>
      </div>

      {data.projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-20">
          <div className="rounded-full bg-white/[0.04] p-4">
            <FolderOpenIcon className="size-6 text-white/20" />
          </div>
          <p className="mt-3 text-[13px] text-muted-foreground">
            No projects yet.{" "}
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
          {data.projects.map((project) => (
            <Card
              key={project.slug}
              className="group cursor-pointer border-white/[0.06] transition-all duration-200 hover:border-white/10 hover:bg-white/[0.02]"
              onClick={() => setSelected(project)}
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-violet-500/10 p-2">
                    <FolderOpenIcon className="size-3.5 text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-[14px] text-white">{project.name}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2 text-[12px]">
                      {project.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {project.path && (
                <CardContent>
                  <div className="flex items-center gap-1.5 rounded-md bg-white/[0.03] px-2.5 py-1.5">
                    <GitBranchIcon className="size-3 text-white/20" />
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {project.path}
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add Sheet */}
      <Sheet open={showAdd} onOpenChange={setShowAdd}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="text-white">Add Project</SheetTitle>
            <SheetDescription>Register a new project.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="space-y-4 px-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-white/60">Name</label>
              <Input name="name" required placeholder="e.g. my-service" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-white/60">Description</label>
              <Textarea name="description" required placeholder="What is this project?" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-white/60">Path (optional)</label>
              <Input name="path" placeholder="projects/my-service" />
            </div>
            {error && <p className="text-[12px] text-red-400">{error}</p>}
            <SheetFooter>
              <Button type="submit" disabled={submitting} className="bg-amber-500 text-black hover:bg-amber-400">
                {submitting ? "Creating..." : "Create Project"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-white">{selected.name}</SheetTitle>
                <SheetDescription>{selected.description}</SheetDescription>
              </SheetHeader>
              <div className="px-4">
                {selected.readme ? (
                  <article className="prose prose-sm max-w-none">
                    <Markdown>{selected.readme}</Markdown>
                  </article>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 py-10">
                    <p className="text-[12px] text-muted-foreground">
                      No README available for this project.
                    </p>
                  </div>
                )}
              </div>
              <SheetFooter>
                <Button
                  variant="destructive"
                  onClick={() => setShowDelete(true)}
                >
                  <Trash2Icon className="mr-1 size-4" /> Delete Project
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-white">Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{selected?.name}&rdquo;?
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
