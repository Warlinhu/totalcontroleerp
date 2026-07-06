import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  LayoutDashboard, Package, Users, Truck, UserCog, HandCoins, Receipt,
  BellRing, Settings, LogOut, Building2, ChevronDown, ShieldAlert,
  LifeBuoy, MessageSquare, UserPlus, Sun, Moon, Monitor, Rows2, Rows3, Search,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { useTheme } from "@/lib/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandPalette } from "@/components/command-palette";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = { label: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    label: "Operação",
    items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard },
      { to: "/app/products", label: "Produtos/Serviços", icon: Package },
      { to: "/app/customers", label: "Clientes", icon: Users },
      { to: "/app/suppliers", label: "Fornecedores", icon: Truck },
      { to: "/app/employees", label: "Funcionários", icon: UserCog },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { to: "/app/debtors", label: "A receber", icon: HandCoins },
      { to: "/app/payables", label: "A pagar", icon: Receipt },
      { to: "/app/reminders", label: "Lembretes", icon: BellRing },
    ],
  },
  {
    label: "Suporte & Equipe",
    items: [
      { to: "/app/support", label: "Chamados", icon: LifeBuoy },
      { to: "/app/team", label: "Equipe", icon: Users },
      { to: "/app/settings", label: "Configurações", icon: Settings },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { to: "/app/platform/companies", label: "Empresas", icon: Building2 },
      { to: "/app/platform/tickets", label: "Chamados clientes", icon: MessageSquare },
      { to: "/app/platform/errors", label: "Erros", icon: ShieldAlert },
      { to: "/app/platform/admins", label: "Administradores", icon: UserPlus },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { current, memberships, setCurrentCompanyId } = useCompany();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { mode, setMode, density, setDensity } = useTheme();

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  useEffect(() => {
    if (!current && !pathname.startsWith("/onboarding")) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [current, pathname, navigate]);

  if (!current) return null;

  const ModeIcon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-primary shadow-elegant">
              <LayoutDashboard className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="text-sm font-semibold leading-tight">
              TotalControle<span className="ml-1 text-xs font-normal text-muted-foreground">ERP</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="mt-3 w-full justify-between bg-background/60">
                <span className="flex items-center gap-2 truncate">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{current.company.name}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Suas empresas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {memberships.map((m) => (
                <DropdownMenuItem key={m.company_id} onClick={() => setCurrentCompanyId(m.company_id)}>
                  {m.company.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/onboarding" })}>
                + Criar outra empresa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.to || (item.to !== "/app" && pathname.startsWith(item.to));
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-all",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                          : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className={cn("h-4 w-4", active ? "" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-primary">
              <LayoutDashboard className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">TotalControle</span>
          </div>

          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="hidden h-9 flex-1 max-w-md items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted lg:flex"
          >
            <Search className="h-4 w-4" />
            <span>Buscar telas, clientes, ações…</span>
            <kbd className="ml-auto rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
          </button>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              title={`Densidade: ${density}`}
              onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
            >
              {density === "compact" ? <Rows2 className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="Tema">
                  <ModeIcon className="h-4 w-4" />
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
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={handleSignOut}>
              Sair
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-4 lg:p-8">{children}</div>
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}
