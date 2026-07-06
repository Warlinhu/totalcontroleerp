import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useTheme } from "@/lib/theme-provider";
import {
  LayoutDashboard, Package, Users, Truck, UserCog, HandCoins, Receipt,
  BellRing, Settings, Building2, ShieldAlert, LifeBuoy, MessageSquare,
  UserPlus, Sun, Moon, Monitor, Rows3, Rows2,
} from "lucide-react";

type Cmd = { label: string; to: string; icon: React.ComponentType<{ className?: string }>; group: string };

const COMMANDS: Cmd[] = [
  { label: "Dashboard", to: "/app", icon: LayoutDashboard, group: "Operação" },
  { label: "Produtos/Serviços", to: "/app/products", icon: Package, group: "Operação" },
  { label: "Clientes", to: "/app/customers", icon: Users, group: "Operação" },
  { label: "Fornecedores", to: "/app/suppliers", icon: Truck, group: "Operação" },
  { label: "Funcionários", to: "/app/employees", icon: UserCog, group: "Operação" },
  { label: "Devedores (a receber)", to: "/app/debtors", icon: HandCoins, group: "Financeiro" },
  { label: "Contas a pagar", to: "/app/payables", icon: Receipt, group: "Financeiro" },
  { label: "Lembretes", to: "/app/reminders", icon: BellRing, group: "Financeiro" },
  { label: "Chamados de suporte", to: "/app/support", icon: LifeBuoy, group: "Suporte" },
  { label: "Equipe", to: "/app/team", icon: Users, group: "Configurações" },
  { label: "Configurações", to: "/app/settings", icon: Settings, group: "Configurações" },
  { label: "Empresas cadastradas", to: "/app/platform/companies", icon: Building2, group: "Plataforma" },
  { label: "Chamados dos clientes", to: "/app/platform/tickets", icon: MessageSquare, group: "Plataforma" },
  { label: "Monitoramento de erros", to: "/app/platform/errors", icon: ShieldAlert, group: "Plataforma" },
  { label: "Administradores", to: "/app/platform/admins", icon: UserPlus, group: "Plataforma" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { setMode, setDensity, density } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  const groups = Array.from(new Set(COMMANDS.map((c) => c.group)));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar telas, ações e configurações…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {groups.map((g) => (
          <CommandGroup key={g} heading={g}>
            {COMMANDS.filter((c) => c.group === g).map((c) => (
              <CommandItem key={c.to} value={`${g} ${c.label}`} onSelect={() => go(c.to)}>
                <c.icon className="mr-2 h-4 w-4" />
                {c.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Preferências">
          <CommandItem onSelect={() => { setMode("light"); setOpen(false); }}>
            <Sun className="mr-2 h-4 w-4" /> Tema claro
          </CommandItem>
          <CommandItem onSelect={() => { setMode("dark"); setOpen(false); }}>
            <Moon className="mr-2 h-4 w-4" /> Tema escuro
          </CommandItem>
          <CommandItem onSelect={() => { setMode("system"); setOpen(false); }}>
            <Monitor className="mr-2 h-4 w-4" /> Seguir o sistema
          </CommandItem>
          <CommandItem onSelect={() => { setDensity(density === "compact" ? "comfortable" : "compact"); setOpen(false); }}>
            {density === "compact" ? <Rows3 className="mr-2 h-4 w-4" /> : <Rows2 className="mr-2 h-4 w-4" />}
            Alternar densidade ({density === "compact" ? "→ confortável" : "→ compacta"})
            <CommandShortcut>⇧D</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
