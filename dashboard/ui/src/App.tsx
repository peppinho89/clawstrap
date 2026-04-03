import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { useWorkspace } from "@/hooks/useWorkspace";
import Home from "@/pages/Home";
import OrgChart from "@/pages/OrgChart";
import Agents from "@/pages/Agents";
import Skills from "@/pages/Skills";
import Projects from "@/pages/Projects";
import Governance from "@/pages/Governance";
import Export from "@/pages/Export";
import { LoaderCircleIcon, AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

function AppShell() {
  const { data, isLoading, error, refresh } = useWorkspace();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar workspaceName={data?.config?.workspaceName} data={data} />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          {isLoading && !data ? (
            <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl" />
                <LoaderCircleIcon className="relative size-8 animate-spin text-amber-500" />
              </div>
              <p className="mt-6 text-sm font-medium tracking-wide">Loading workspace...</p>
            </div>
          ) : error && !data ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="rounded-full bg-red-500/10 p-4">
                <AlertCircleIcon className="size-8 text-red-400" />
              </div>
              <p className="mt-4 text-sm text-red-400">{error}</p>
              <Button
                variant="outline"
                className="mt-4 border-red-500/20 text-red-400 hover:bg-red-500/10"
                onClick={refresh}
              >
                Retry
              </Button>
            </div>
          ) : data ? (
            <div className="animate-in-page">
              <Routes>
                <Route path="/" element={<Home data={data} />} />
                <Route
                  path="/org-chart"
                  element={<OrgChart data={data} onMutate={refresh} />}
                />
                <Route
                  path="/agents"
                  element={<Agents data={data} onMutate={refresh} />}
                />
                <Route
                  path="/skills"
                  element={<Skills data={data} onMutate={refresh} />}
                />
                <Route
                  path="/projects"
                  element={<Projects data={data} onMutate={refresh} />}
                />
                <Route
                  path="/governance"
                  element={<Governance data={data} onMutate={refresh} />}
                />
                <Route
                  path="/export"
                  element={<Export data={data} onMutate={refresh} />}
                />
              </Routes>
            </div>
          ) : null}
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
