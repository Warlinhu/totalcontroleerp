import { createFileRoute, Link } from "@tanstack/react-router";

import {
  Download, Apple, Monitor, Smartphone, Check, ShoppingCart, HandCoins,
  FileText, BarChart3, ShieldCheck, Sparkles, ArrowRight, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FALLBACK_PLAN, formatBRL, priceForCycle } from "@/lib/billing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TotalControle ERP — Gestão completa por R$ 50/mês" },
      { name: "description", content: "PDV, financeiro, notas fiscais e relatórios num só sistema. Primeiro mês com 10% off e plano anual com 10% de desconto. Web, desktop e Android." },
      { property: "og:title", content: "TotalControle ERP — Gestão completa por R$ 50/mês" },
      { property: "og:description", content: "PDV, contas a receber e pagar, notas fiscais e dashboard. Comece hoje com desconto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const GH_RELEASE = "https://github.com/Warlinhu/totalcontroleerp/releases/latest/download";

const DOWNLOADS = [
  { id: "windows", label: "Windows", ext: ".zip", size: "App x64", icon: Monitor, href: `${GH_RELEASE}/TotalControleERP-windows-x64.zip`, hint: "Baixe, extraia o .zip e abra TotalControleERP.exe." },
  { id: "macos", label: "macOS", ext: ".zip", size: "Intel x64", icon: Apple, href: `${GH_RELEASE}/TotalControleERP-macos-x64.zip`, hint: "Baixe, extraia o .zip e mova o app para Aplicativos." },
  { id: "linux", label: "Linux", ext: ".tar.gz", size: "App x64", icon: Monitor, href: `${GH_RELEASE}/TotalControleERP-linux-x64.tar.gz`, hint: "Baixe, extraia o arquivo e execute TotalControleERP." },
  { id: "android", label: "Android", ext: ".apk", size: "Debug build", icon: Smartphone, href: `${GH_RELEASE}/TotalControleERP.apk`, hint: "Baixe o APK no celular e permita instalar de fontes externas." },
];

const FEATURES = [
  { icon: ShoppingCart, title: "PDV que vende rápido", text: "Carrinho, dinheiro, cartão, PIX e fiado. Fecha a venda em segundos e já lança no financeiro." },
  { icon: HandCoins, title: "Nada mais fica esquecido", text: "Contas a receber e a pagar com parcelas, lembretes de vencimento e baixa automática." },
  { icon: FileText, title: "Notas e cadastros no lugar", text: "Clientes, fornecedores, produtos, estoque e notas fiscais organizados por empresa." },
  { icon: BarChart3, title: "Números que decidem", text: "Faturamento, ticket médio, horário de pico e formas de pagamento em um dashboard claro." },
  { icon: Sparkles, title: "Assistente integrado", text: "Pergunte em português e receba respostas sobre suas vendas, estoque e devedores." },
  { icon: ShieldCheck, title: "Seguro e multi-empresa", text: "Cada empresa com seus dados isolados, permissões por equipe e acesso de qualquer lugar." },
];

const PAINS = [
  "Vendas anotadas em caderno e fiado que ninguém cobra",
  "Descobrir o lucro só no fim do mês — e no chute",
  "Planilhas que quebram e não abrem no celular",
  "Pagar caro por um ERP complicado que ninguém usa",
];

const FAQ = [
  { q: "Preciso instalar alguma coisa?", a: "Não. Funciona no navegador. Se preferir, temos app para Windows, macOS, Linux e Android — o mesmo sistema, os mesmos dados." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Sem fidelidade e sem multa. Você usa até o fim do período já pago." },
  { q: "Quantas empresas posso cadastrar?", a: "Quantas quiser, sem custo extra. A assinatura é da sua conta, não por empresa." },
  { q: "Como pago?", a: "PIX, boleto ou cartão de crédito pelo Mercado Pago. O acesso libera automaticamente após a confirmação." },
  { q: "E se eu tiver dúvidas?", a: "Você abre um chamado direto dentro do sistema e nossa equipe responde por lá." },
];

function LandingPage() {


  const plan = FALLBACK_PLAN;
  const firstMonth = priceForCycle(plan, "monthly", true);
  const normalMonth = plan.monthly_price_cents;
  const yearly = priceForCycle(plan, "yearly", false);
  const yearlyFull = normalMonth * 12;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <a href="#planos" className="hidden sm:inline-flex">
              <Button variant="ghost">Planos</Button>
            </a>
            <a href="#downloads" className="hidden sm:inline-flex">
              <Button variant="ghost"><Download className="mr-2 h-4 w-4" /> Baixar</Button>
            </a>
            <ThemeToggle />
            <Button asChild variant="ghost"><Link to="/auth">Entrar</Link></Button>
            <Button asChild><Link to="/auth">Começar agora</Link></Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:py-28">
          <Badge className="mb-6"><Star className="mr-1 h-3 w-3" /> 1º mês com 10% de desconto</Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Sua empresa sob controle por{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              {formatBRL(normalMonth)}
            </span>{" "}
            por mês
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            PDV, contas a receber e a pagar, notas fiscais, estoque e relatórios — tudo num
            sistema só, que abre no computador e no celular. Comece hoje pagando{" "}
            <strong className="text-foreground">{formatBRL(firstMonth)}</strong> no primeiro mês.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="text-base">
              <Link to="/auth">Quero começar agora <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base">
              <a href="#planos">Ver planos e preços</a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Sem fidelidade · Cancele quando quiser · Empresas ilimitadas na mesma conta
          </p>

          <div className="mt-14 flex justify-center">
            <div className="rounded-2xl bg-gradient-hero p-8 shadow-elegant">
              <BrandLogo className="h-28 w-auto" />
            </div>
          </div>
        </section>

        {/* Dores */}
        <section className="border-t bg-muted/30 py-16">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Se você se reconhece aqui, o TotalControle foi feito pra você
            </h2>
            <ul className="mx-auto mt-8 grid max-w-xl gap-3 text-left">
              {PAINS.map((p) => (
                <li key={p} className="flex items-start gap-3 rounded-lg border bg-card p-4">
                  <span className="mt-0.5 text-destructive">✕</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-muted-foreground">
              Em menos de 10 minutos você cadastra sua empresa, seus produtos e já faz a primeira venda.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Tudo o que a sua operação precisa</h2>
              <p className="mt-3 text-muted-foreground">
                Sem módulos extras, sem cobrança por usuário, sem letras miúdas.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-xl border bg-card p-6 shadow-soft transition-all hover:shadow-elegant">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Planos */}
        <section id="planos" className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-4xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Um preço justo, sem surpresa</h2>
              <p className="mt-3 text-muted-foreground">
                O mesmo sistema completo nos dois planos. Escolha como prefere pagar.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border bg-card p-8">
                <h3 className="text-lg font-semibold">Mensal</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{formatBRL(firstMonth)}</span>
                  <span className="text-muted-foreground">no 1º mês</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Depois {formatBRL(normalMonth)}/mês. Cancele quando quiser.
                </p>
                <ul className="mt-6 space-y-2 text-sm">
                  {["Sistema completo liberado", "Empresas e usuários ilimitados", "Apps para PC e celular", "Suporte por chamados"].map((b) => (
                    <li key={b} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{b}</li>
                  ))}
                </ul>
                <Button asChild className="mt-8 w-full" size="lg" variant="outline">
                  <Link to="/auth">Assinar mensal</Link>
                </Button>
              </div>

              <div className="relative rounded-2xl border-2 border-primary bg-card p-8 shadow-elegant">
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Economize {formatBRL(yearlyFull - yearly)}</Badge>
                <h3 className="text-lg font-semibold">Anual</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{formatBRL(yearly)}</span>
                  <span className="text-muted-foreground">/ano</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Equivale a {formatBRL(Math.round(yearly / 12))}/mês — 10% de desconto.
                </p>
                <ul className="mt-6 space-y-2 text-sm">
                  {["Tudo do plano mensal", "12 meses de licença garantidos", "Preço travado no período", "Prioridade no suporte"].map((b) => (
                    <li key={b} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{b}</li>
                  ))}
                </ul>
                <Button asChild className="mt-8 w-full" size="lg">
                  <Link to="/auth">Assinar anual e economizar</Link>
                </Button>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Pagamento seguro via Mercado Pago — PIX, boleto ou cartão. Acesso liberado
              automaticamente após a confirmação.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-center text-3xl font-bold tracking-tight">Perguntas frequentes</h2>
            <div className="mt-10 space-y-4">
              {FAQ.map((f) => (
                <div key={f.q} className="rounded-xl border bg-card p-5">
                  <h3 className="font-semibold">{f.q}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="border-t bg-gradient-hero py-20">
          <div className="mx-auto max-w-2xl px-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Comece hoje pagando {formatBRL(firstMonth)}
            </h2>
            <p className="mt-3 text-muted-foreground">
              Cadastro em 2 minutos. Ative a assinatura e use o sistema completo no mesmo dia.
            </p>
            <Button asChild size="lg" className="mt-8 text-base">
              <Link to="/auth">Criar minha conta <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>

        {/* Downloads */}
        <section id="downloads" className="border-t py-20">

            <div className="mx-auto max-w-5xl px-4">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight">Prefere o app instalado?</h2>
                <p className="mt-3 text-muted-foreground">
                  Já é assinante? Baixe o aplicativo para o seu sistema. Ele abre em janela
                  própria, atualiza sozinho e usa os mesmos dados da versão web.
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {DOWNLOADS.map((d) => (
                  <div key={d.id} className="flex flex-col items-center rounded-xl border bg-card p-6 text-center shadow-soft transition-all hover:shadow-elegant">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
                      <d.icon className="h-7 w-7" />
                    </div>
                    <h3 className="text-lg font-semibold">{d.label}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{d.ext} • {d.size}</p>
                    <p className="mt-3 min-h-[2.5rem] text-sm text-muted-foreground">{d.hint}</p>
                    <Button asChild className="mt-4 w-full" variant="outline">
                      <a href={d.href} rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" /> Baixar
                      </a>
                    </Button>
                  </div>
                ))}
              </div>

              <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">
                Downloads servidos direto da última release publicada no{" "}
                <a href="https://github.com/Warlinhu/totalcontroleerp/releases/latest" className="underline" target="_blank" rel="noopener noreferrer">GitHub</a>.
                No macOS, ao abrir pela primeira vez, clique com o botão direito no app e escolha “Abrir” para autorizar.
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
