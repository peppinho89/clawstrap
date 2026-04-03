import { useState } from "react";
import type { WorkspaceData } from "@/lib/api";
import { exportPaperclip } from "@/lib/api";
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
import { Badge } from "@/components/ui/badge";
import {
  PackageIcon,
  CheckCircle2Icon,
  ClockIcon,
  FolderOutputIcon,
  RocketIcon,
} from "lucide-react";

interface ExportProps {
  data: WorkspaceData;
  onMutate: () => void;
}

export default function Export({ data, onMutate }: ExportProps) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; outputDir: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await exportPaperclip({
        name: fd.get("name") as string,
        mission: fd.get("mission") as string,
      });
      setResult(res);
      onMutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Export</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Generate workspace exports</p>
      </div>

      {/* Last export info */}
      {data.lastExport && (
        <Card className="border-white/[0.06]">
          <CardHeader className="flex-row items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <PackageIcon className="size-4 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-[15px] text-white">Last Export</CardTitle>
              <CardDescription className="mt-0.5 flex items-center gap-2 text-[12px]">
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">
                  {data.lastExport.format}
                </Badge>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <ClockIcon className="size-3" />
                  {new Date(data.lastExport.exportedAt).toLocaleString()}
                </span>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
              <FolderOutputIcon className="size-3.5 shrink-0 text-white/20" />
              <code className="truncate text-[12px] text-amber-400/80">
                {data.lastExport.outputDir}
              </code>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export form */}
      <Card className="border-white/[0.06]">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-violet-500/10 p-1.5">
              <RocketIcon className="size-4 text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-[15px] text-white">Export to Paperclip</CardTitle>
              <CardDescription className="text-[12px]">
                Generate a Paperclip-compatible workspace export.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleExport} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-white/60">Company Name</label>
              <Input
                name="name"
                required
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-white/60">Mission</label>
              <Textarea
                name="mission"
                required
                placeholder="Describe the company mission..."
                className="min-h-[100px]"
              />
            </div>
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/[0.05] px-3 py-2">
                <p className="text-[12px] text-red-400">{error}</p>
              </div>
            )}
            <Button
              type="submit"
              disabled={submitting}
              className="bg-amber-500 text-black hover:bg-amber-400"
            >
              <PackageIcon className="mr-1.5 size-4" />
              {submitting ? "Exporting..." : "Export"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
          <CardHeader className="flex-row items-center gap-3">
            <div className="rounded-full bg-emerald-500/15 p-2">
              <CheckCircle2Icon className="size-5 text-emerald-400" />
            </div>
            <CardTitle className="text-[15px] text-emerald-400">Export Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/10 px-3 py-2">
              <FolderOutputIcon className="size-3.5 shrink-0 text-emerald-400/50" />
              <code className="truncate text-[12px] text-emerald-300/80">{result.outputDir}</code>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
