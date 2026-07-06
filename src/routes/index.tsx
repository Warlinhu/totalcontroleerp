import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";


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
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth">Começar agora</Link></Button>
          </div>
        </section>
      </main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TotalControle ERP
      </footer>
    </div>
  );
}
