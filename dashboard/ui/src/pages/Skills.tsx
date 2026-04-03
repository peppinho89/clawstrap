import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { DashboardSkill, WorkspaceData, SkillPreview } from "@/lib/api";
import { createSkill, deleteSkill, previewSkill, importSkill } from "@/lib/api";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.min.css";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusIcon, Trash2Icon, WrenchIcon, ZapIcon, DownloadIcon, GlobeIcon, CheckCircle2Icon } from "lucide-react";

/** Strip YAML frontmatter block (---\n...\n---) from markdown content */
function stripFrontmatter(md: string): string {
  return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

interface SkillsProps {
  data: WorkspaceData;
  onMutate: () => void;
}

export default function Skills({ data, onMutate }: SkillsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<DashboardSkill | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importPreview, setImportPreview] = useState<SkillPreview | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setShowAdd(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const triggers = (fd.get("triggers") as string)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setSubmitting(true);
    setError(null);
    try {
      await createSkill({
        name: fd.get("name") as string,
        description: fd.get("description") as string,
        triggers: triggers.join(", "),
      });
      onMutate();
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create skill");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const fd = new FormData(e.currentTarget);
    const triggers = (fd.get("triggers") as string)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setSubmitting(true);
    setError(null);
    try {
      console.log("Update skill:", selected.name, triggers);
      onMutate();
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update skill");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await deleteSkill(selected.name);
      onMutate();
      setSelected(null);
      setShowDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete skill");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Skills</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {data.skills.length} skill{data.skills.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-amber-500 text-black hover:bg-amber-400">
          <PlusIcon className="mr-1.5 size-4" /> Add Skill
        </Button>
      </div>

      {data.skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-20">
          <div className="rounded-full bg-white/[0.04] p-4">
            <WrenchIcon className="size-6 text-white/20" />
          </div>
          <p className="mt-3 text-[13px] text-muted-foreground">
            No skills yet.{" "}
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
          {data.skills.map((skill) => (
            <Card
              key={skill.name}
              className="group cursor-pointer border-white/[0.06] transition-all duration-200 hover:border-white/10 hover:bg-white/[0.02]"
              onClick={() => setSelected(skill)}
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2">
                    <WrenchIcon className="size-3.5 text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-[14px] text-white">{skill.name}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2 text-[12px]">
                      {skill.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {skill.triggers && skill.triggers.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(skill.triggers) ? skill.triggers : [skill.triggers]).map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="bg-amber-500/10 text-amber-400/80 border-0 text-[10px]"
                      >
                        <ZapIcon className="mr-0.5 size-2" />
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Sheet — Tabbed: Create / Import */}
      <Sheet open={showAdd} onOpenChange={(o) => {
        setShowAdd(o);
        if (!o) { setImportUrl(""); setImportPreview(null); setImportSuccess(false); setError(null); }
      }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white">Add Skill</SheetTitle>
            <SheetDescription>Create a new skill or import one from the web.</SheetDescription>
          </SheetHeader>
          <Tabs defaultValue="import" className="px-4 mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="import" className="flex-1">
                <GlobeIcon className="mr-1.5 size-3.5" /> Import from Web
              </TabsTrigger>
              <TabsTrigger value="create" className="flex-1">
                <PlusIcon className="mr-1.5 size-3.5" /> Create Manual
              </TabsTrigger>
            </TabsList>

            {/* Import Tab */}
            <TabsContent value="import" className="space-y-4 pt-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-white/60">
                  Skill URL
                </label>
                <Input
                  placeholder="skills.sh/anthropics/skills/frontend-design"
                  value={importUrl}
                  onChange={(e) => { setImportUrl(e.target.value); setImportPreview(null); setImportSuccess(false); setError(null); }}
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Paste a skills.sh URL, GitHub URL, or shorthand (org/repo/skill)
                </p>
              </div>

              {!importPreview && !importSuccess && (
                <Button
                  onClick={async () => {
                    if (!importUrl) return;
                    setSubmitting(true); setError(null);
                    try {
                      const p = await previewSkill(importUrl);
                      setImportPreview(p);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to fetch skill");
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={!importUrl || submitting}
                  variant="outline"
                  className="w-full"
                >
                  <DownloadIcon className="mr-1.5 size-3.5" />
                  {submitting ? "Fetching..." : "Preview Skill"}
                </Button>
              )}

              {importPreview && !importSuccess && (
                <div className="space-y-3">
                  <Card className="border-amber-500/20 bg-amber-500/[0.03]">
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-amber-500/10 p-2">
                          <WrenchIcon className="size-3.5 text-amber-400" />
                        </div>
                        <div>
                          <CardTitle className="text-[14px] text-white">{importPreview.name}</CardTitle>
                          <CardDescription className="mt-1 text-[12px]">{importPreview.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {importPreview.triggers && (
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-medium text-white/50">Triggers:</span> {importPreview.triggers}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-medium text-white/50">Source:</span> {importPreview.source}
                      </p>
                      {importPreview.hasReferences && (
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-0 text-[10px]">
                          Includes reference files
                        </Badge>
                      )}
                    </CardContent>
                  </Card>

                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 max-h-48 overflow-y-auto">
                    <article className="prose prose-sm prose-invert max-w-none text-[12px] prose-headings:text-white prose-p:text-white/70 prose-code:text-amber-300 prose-code:bg-white/[0.06] prose-code:px-1 prose-code:rounded prose-code:text-[11px] prose-code:before:content-none prose-code:after:content-none">
                      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                        {stripFrontmatter(importPreview.preview).slice(0, 1000)}
                      </Markdown>
                    </article>
                  </div>

                  <Button
                    onClick={async () => {
                      setSubmitting(true); setError(null);
                      try {
                        await importSkill(importUrl);
                        setImportSuccess(true);
                        onMutate();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to import skill");
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    disabled={submitting}
                    className="w-full bg-amber-500 text-black hover:bg-amber-400"
                  >
                    <DownloadIcon className="mr-1.5 size-3.5" />
                    {submitting ? "Importing..." : `Import "${importPreview.name}"`}
                  </Button>
                </div>
              )}

              {importSuccess && (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] py-8">
                  <CheckCircle2Icon className="size-8 text-emerald-400" />
                  <p className="text-[13px] font-medium text-white">Skill imported successfully</p>
                  <p className="text-[11px] text-muted-foreground">
                    {importPreview?.name} is now available in your workspace
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>
                    Done
                  </Button>
                </div>
              )}

              {error && <p className="text-[12px] text-red-400">{error}</p>}
            </TabsContent>

            {/* Create Tab */}
            <TabsContent value="create" className="pt-2">
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-white/60">Name</label>
                  <Input name="name" required placeholder="e.g. data-extraction" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-white/60">Description</label>
                  <Textarea name="description" required placeholder="What does this skill do?" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-white/60">
                    Triggers (comma-separated)
                  </label>
                  <Input name="triggers" placeholder="extract, parse, analyze" />
                </div>
                {error && <p className="text-[12px] text-red-400">{error}</p>}
                <SheetFooter>
                  <Button type="submit" disabled={submitting} className="bg-amber-500 text-black hover:bg-amber-400">
                    {submitting ? "Creating..." : "Create Skill"}
                  </Button>
                </SheetFooter>
              </form>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Detail — wide dialog for readable markdown (documentation-style) */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0" showCloseButton={false}>
          {selected && (
            <>
              {/* Fixed header */}
              <div className="flex items-start justify-between border-b border-white/[0.06] px-8 py-5">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-500/10 p-2.5">
                      <WrenchIcon className="size-4 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">{selected.name}</h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">{selected.description}</p>
                    </div>
                  </div>
                  {selected.triggers && (
                    <div className="flex flex-wrap gap-1.5 pl-[52px]">
                      {(Array.isArray(selected.triggers)
                        ? selected.triggers
                        : selected.triggers.split(",").map((t) => t.trim())
                      ).filter(Boolean).map((t) => (
                        <Badge
                          key={t}
                          variant="secondary"
                          className="bg-amber-500/10 text-amber-400/80 border-0 text-[11px]"
                        >
                          <ZapIcon className="mr-0.5 size-2.5" />
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDelete(true)}
                  className="shrink-0"
                >
                  <Trash2Icon className="mr-1.5 size-3.5" /> Delete
                </Button>
              </div>

              {/* Scrollable markdown body */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                {selected.rawMarkdown ? (
                  <article className="skill-markdown prose prose-base prose-invert max-w-none">
                    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                      {stripFrontmatter(selected.rawMarkdown)}
                    </Markdown>
                  </article>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 py-16">
                    <WrenchIcon className="size-6 text-white/15" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      No content available for this skill.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-white">Delete Skill</DialogTitle>
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
