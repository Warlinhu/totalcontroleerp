import { test, expect } from "@playwright/test";

/**
 * PDV (cupom de venda). Sem sessão de teste configurada, o fluxo garante
 * pelo menos que a rota é protegida — com E2E_EMAIL/E2E_PASSWORD definidos,
 * faz o login e percorre o carrinho.
 */
const email = process.env["E2E_EMAIL"];
const password = process.env["E2E_PASSWORD"];

test("PDV é protegido por login", async ({ page }) => {
  await page.goto("/app/pos");
  await expect(page).toHaveURL(/\/auth/, { timeout: 20_000 });
});

test.describe("Cupom de venda", () => {
  test.skip(!email || !password, "defina E2E_EMAIL e E2E_PASSWORD para rodar");

  test("adiciona item e fecha a venda", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel(/e-?mail/i).fill(email!);
    await page.getByLabel(/senha/i).first().fill(password!);
    await page.getByRole("button", { name: /entrar/i }).first().click();
    await page.waitForURL(/\/app/, { timeout: 30_000 });

    await page.goto("/app/pos");
    const firstProduct = page.getByRole("button", { name: /adicionar|\+/ }).first();
    await firstProduct.click();
    await page.getByRole("button", { name: /finalizar|fechar venda/i }).first().click();
    await expect(page.locator("body")).toContainText(/venda|cupom/i);
  });
});
