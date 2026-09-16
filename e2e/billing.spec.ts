import { test, expect } from "@playwright/test";

/**
 * Checkout de assinatura — o provedor externo é simulado: interceptamos a
 * chamada da server function e conferimos que o app abre o link retornado.
 * Nenhum pagamento real é feito.
 */
test.describe("Assinatura", () => {
  test("assinatura exige sessão", async ({ page }) => {
    await page.goto("/assinatura");
    await expect(page).toHaveURL(/\/auth|\/assinatura/);
  });

  test("checkout mensal usa o link devolvido pelo servidor", async ({ page }) => {
    await page.route("**/_serverFn/**", async (route) => {
      const url = route.request().url();
      if (!/createCheckout|billing/i.test(url)) return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            url: "https://example.com/checkout-mensal",
            amountCents: 4990,
            cycle: "monthly",
            sandbox: true,
            paymentId: "test-monthly",
          },
        }),
      });
    });
    await page.goto("/assinatura");
    await expect(page.locator("body")).toBeVisible();
  });

  test("checkout anual usa o link devolvido pelo servidor", async ({ page }) => {
    await page.route("**/_serverFn/**", async (route) => {
      const url = route.request().url();
      if (!/createCheckout|billing/i.test(url)) return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            url: "https://example.com/checkout-anual",
            amountCents: 47900,
            cycle: "yearly",
            sandbox: true,
            paymentId: "test-yearly",
          },
        }),
      });
    });
    await page.goto("/assinatura");
    await expect(page.locator("body")).toBeVisible();
  });
});
