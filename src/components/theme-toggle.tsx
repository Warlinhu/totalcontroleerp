import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = { className?: string; floating?: boolean };

export function ThemeToggle({ className, floating = false }: Props) {
  const { mode, setMode } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const Icon = !mounted ? Monitor : mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;

  return (
    <div
      className={cn(
        floating && "fixed right-4 top-4 z-50",
        className,
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Alternar tema"
            title="Alternar tema (claro / escuro / sistema)"
            className="rounded-full bg-background/80 shadow-soft backdrop-blur"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setMode("light")}>
            <Sun className="mr-2 h-4 w-4" /> Claro
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMode("dark")}>
            <Moon className="mr-2 h-4 w-4" /> Escuro
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMode("system")}>
            <Monitor className="mr-2 h-4 w-4" /> Sistema
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
