import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Apple, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import windowsInstaller from "@/assets/installers/windows.asset.json";
import macosInstaller from "@/assets/installers/macos.asset.json";
import linuxInstaller from "@/assets/installers/linux.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TotalControle ERP — Gestão empresarial simples" },
      { name: "description", content: "Sistema de gestão para pequenas e médias empresas: cadastros, financeiro, lembretes e monitoramento. Multi-empresa e seguro." },
      { property: "og:title", content: "TotalControle ERP" },
      { property: "og:description", content: "Gestão empresarial completa e simples." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const DOWNLOADS = [
  {
    id: "windows",
    label: "Windows",
    ext: ".zip",
    size: "~145 MB",
    icon: Monitor,
    href: (windowsInstaller as { url: string }).url,
    hint: "Descompacte e execute TotalControleERP.exe.",
  },
  {
    id: "macos",
    label: "macOS",
    ext: ".zip",
    size: "~350 MB",
    icon: Apple,
    href: (macosInstaller as { url: string }).url,
    hint: "Arraste TotalControleERP.app para Aplicativos.",
  },
  {
    id: "linux",
    label: "Linux",
    ext: ".tar.gz",
    size: "~120 MB",
    icon: Monitor,
    href: (linuxInstaller as { url: string }).url,
    hint: "Descompacte e execute o binário TotalControleERP.",
  },
];

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="#downloads" className="hidden sm:inline-flex">
              <Button variant="ghost">Baixar</Button>
            </a>
            <Button asChild variant="ghost"><Link to="/auth">Entrar</Link></Button>
            <Button asChild><Link to="/auth">Criar conta</Link></Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-24 text-center">
          <div className="mb-8 flex justify-center">
            <div className="rounded-2xl bg-gradient-hero p-6 shadow-elegant">
              <BrandLogo className="h-32 w-auto" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Gestão empresarial sem complicação
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Cadastros, financeiro, lembretes de vencimento e mais — tudo num só lugar,
            organizado por empresa.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth">Começar agora</Link></Button>
            <Button asChild size="lg" variant="outline">
              <a href="#downloads">
                <Download className="mr-2 h-4 w-4" /> Baixar aplicativo
              </a>
            </Button>
          </div>
        </section>

        <section id="downloads" className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-5xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                Instale o TotalControle no seu computador
              </h2>
              <p className="mt-3 text-muted-foreground">
                Escolha a versão do seu sistema operacional. O app abre em janela própria,
                atualiza sozinho quando publicamos novidades e funciona igual à versão web.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {DOWNLOADS.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col items-center rounded-xl border bg-card p-6 text-center shadow-soft transition-all hover:shadow-elegant"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
                    <d.icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-semibold">{d.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.ext} • {d.size}
                  </p>
                  <p className="mt-3 min-h-[2.5rem] text-sm text-muted-foreground">
                    {d.hint}
                  </p>
                  <Button asChild className="mt-4 w-full">
                    <a href={d.href} download>
                      <Download className="mr-2 h-4 w-4" /> Baixar
                    </a>
                  </Button>
                </div>
              ))}
            </div>

            <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">
              No macOS, ao abrir pela primeira vez, clique com o botão direito no app e
              escolha “Abrir” para autorizar. Para Android, use o navegador do celular:
              menu → “Adicionar à tela inicial” instala o app como PWA.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TotalControle ERP
      </footer>
    </div>
  );
}
