export type BillingPlan = {
  code: string;
  name: string;
  currency: string;
  monthly_price_cents: number;
  first_month_discount_pct: number;
  yearly_discount_pct: number;
};

export const FALLBACK_PLAN: BillingPlan = {
  code: "standard",
  name: "TotalControle ERP",
  currency: "BRL",
  monthly_price_cents: 5000,
  first_month_discount_pct: 10,
  yearly_discount_pct: 10,
};

export type Cycle = "monthly" | "yearly";

/** Preço em centavos para o ciclo escolhido, já com descontos aplicados. */
export function priceForCycle(plan: BillingPlan, cycle: Cycle, firstPurchase: boolean): number {
  if (cycle === "yearly") {
    const full = plan.monthly_price_cents * 12;
    return Math.round(full * (1 - plan.yearly_discount_pct / 100));
  }
  if (firstPurchase) {
    return Math.round(plan.monthly_price_cents * (1 - plan.first_month_discount_pct / 100));
  }
  return plan.monthly_price_cents;
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function cycleDays(cycle: Cycle): number {
  return cycle === "yearly" ? 365 : 30;
}
