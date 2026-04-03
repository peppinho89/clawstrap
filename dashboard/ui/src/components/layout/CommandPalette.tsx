import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  HomeIcon,
  NetworkIcon,
  BotIcon,
  WrenchIcon,
  FolderOpenIcon,
  ShieldCheckIcon,
  PackageIcon,
  PlusIcon,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(path: string) {
    navigate(path);
    setOpen(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => go("/")}>
            <HomeIcon className="mr-2 size-4" />
            Home
          </CommandItem>
          <CommandItem onSelect={() => go("/org-chart")}>
            <NetworkIcon className="mr-2 size-4" />
            Org Chart
          </CommandItem>
          <CommandItem onSelect={() => go("/agents")}>
            <BotIcon className="mr-2 size-4" />
            Agents
          </CommandItem>
          <CommandItem onSelect={() => go("/skills")}>
            <WrenchIcon className="mr-2 size-4" />
            Skills
          </CommandItem>
          <CommandItem onSelect={() => go("/projects")}>
            <FolderOpenIcon className="mr-2 size-4" />
            Projects
          </CommandItem>
          <CommandItem onSelect={() => go("/governance")}>
            <ShieldCheckIcon className="mr-2 size-4" />
            Governance
          </CommandItem>
          <CommandItem onSelect={() => go("/export")}>
            <PackageIcon className="mr-2 size-4" />
            Export
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/agents?action=add")}>
            <PlusIcon className="mr-2 size-4" />
            Add Agent
          </CommandItem>
          <CommandItem onSelect={() => go("/skills?action=add")}>
            <PlusIcon className="mr-2 size-4" />
            Add Skill
          </CommandItem>
          <CommandItem onSelect={() => go("/projects?action=add")}>
            <PlusIcon className="mr-2 size-4" />
            Add Project
          </CommandItem>
          <CommandItem onSelect={() => go("/export")}>
            <PackageIcon className="mr-2 size-4" />
            Export to Paperclip
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
