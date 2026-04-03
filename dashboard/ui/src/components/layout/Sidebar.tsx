import { NavLink } from "react-router-dom";
import {
  HomeIcon,
  NetworkIcon,
  BotIcon,
  WrenchIcon,
  FolderOpenIcon,
  ShieldCheckIcon,
  PackageIcon,
  CommandIcon,
} from "lucide-react";
import type { WorkspaceData } from "@/lib/api";

const links = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/org-chart", label: "Org Chart", icon: NetworkIcon },
  { to: "/agents", label: "Agents", icon: BotIcon },
  { to: "/skills", label: "Skills", icon: WrenchIcon },
  { to: "/projects", label: "Projects", icon: FolderOpenIcon },
  { to: "/governance", label: "Governance", icon: ShieldCheckIcon },
  { to: "/export", label: "Export", icon: PackageIcon },
] as const;

interface SidebarProps {
  workspaceName?: string;
  data?: WorkspaceData | null;
}

export function Sidebar({ workspaceName, data }: SidebarProps) {
  const healthScore = data?.health?.score ?? 0;
  const tier = data?.governance?.tier;

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-white/[0.06] bg-[oklch(0.1_0.005_260)]">
      {/* Logo area */}
      <div className="px-5 pt-5 pb-1">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15">
            <span className="text-sm font-bold text-amber-400">C</span>
          </div>
          <h1 className="text-[13px] font-bold tracking-[0.2em] text-white/90">
            <span className="text-amber-400">CLAW</span>STRAP
          </h1>
        </div>
        {workspaceName && (
          <p className="mt-2.5 truncate text-[11px] font-medium text-white/40">
            {workspaceName}
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 my-3 h-px bg-white/[0.06]" />

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/25">
          Navigation
        </p>
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              [
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-amber-500/10 text-amber-400"
                  : "text-white/45 hover:bg-white/[0.04] hover:text-white/70",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`size-[15px] shrink-0 transition-colors ${
                    isActive ? "text-amber-400" : "text-white/30 group-hover:text-white/50"
                  }`}
                />
                {label}
                {isActive && (
                  <div className="ml-auto size-1.5 rounded-full bg-amber-400" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Health score + footer */}
      <div className="border-t border-white/[0.06] px-4 py-3.5">
        {data && (
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/25">
                Health
              </span>
              <span className={`text-[11px] font-bold tabular-nums ${
                healthScore >= 80 ? "text-emerald-400" : healthScore >= 50 ? "text-amber-400" : "text-red-400"
              }`}>
                {healthScore}%
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  healthScore >= 80 ? "bg-emerald-500" : healthScore >= 50 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
            {tier && (
              <div className="mt-2 flex items-center gap-1.5">
                <div className={`size-1.5 rounded-full ${
                  tier === "strict" ? "bg-red-400" : tier === "standard" ? "bg-amber-400" : "bg-emerald-400"
                }`} />
                <span className="text-[10px] capitalize text-white/35">{tier} governance</span>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-white/20">
            v0.1
          </p>
          <div className="flex items-center gap-1 rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/25">
            <CommandIcon className="size-2.5" />
            K
          </div>
        </div>
      </div>
    </aside>
  );
}
