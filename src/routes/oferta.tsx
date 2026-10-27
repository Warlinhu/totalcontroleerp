import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PublicOfferCheckout } from "@/components/payment-link-offers";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

const searchSchema = z.object({
  codigo: z.string().optional(),
  oferta: z.string().optional(),
});

export const Route = createFileRoute("/oferta")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Oferta especial — Total Controle - Gestão Empresarial" },
      { name: "description", content: "Oferta especial do Total Controle - Gestão Empresarial com pagamento seguro." },
      { property: "og:title", content: "Oferta especial — Total Controle - Gestão Empresarial" },
      { property: "og:description", content: "Oferta especial do Total Controle - Gestão Empresarial com pagamento seguro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OfferPage,
});

function OfferPage() {
  const search = Route.useSearch();
  const code = (search.codigo ?? search.oferta ?? "").trim().toLowerCase();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <ThemeToggle floating />
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <BrandLogo className="h-16 w-auto" />
        <h1 className="text-xl font-bold">Total Controle - Gestão Empresarial</h1>
        <p className="text-sm text-muted-foreground">Oferta especial — pagamento seguro</p>
      </div>
      {code ? (
        <PublicOfferCheckout code={code} />
      ) : (
        <p className="text-center text-muted-foreground">
          Link inválido: o código da oferta está ausente.
        </p>
      )}
    </div>
  );
}
