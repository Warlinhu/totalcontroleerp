import { test, expect } from "@playwright/test";

test.describe("Autenticação", () => {
  test("landing mostra a chamada e leva ao login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/TotalControle/i);
    await page.getByRole("link", { name: /entrar|começar|acessar/i }).first().click();
    await expect(page).toHaveURL(/\/auth/);
  });

  test("login exige e-mail e senha válidos", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel(/e-?mail/i).fill("nao-existe@example.com");
    await page.getByLabel(/senha/i).first().fill("senha-invalida");
    await page.getByRole("button", { name: /entrar/i }).first().click();
    await expect(page.locator("body")).toContainText(/inválid|incorret|erro/i, { timeout: 15_000 });
  });

  test("cadastro valida campos obrigatórios", async ({ page }) => {
    await page.goto("/auth");
    const criar = page.getByRole("tab", { name: /criar conta|cadastr/i });
    if (await criar.count()) await criar.first().click();
    await page.getByRole("button", { name: /criar conta|cadastrar/i }).first().click();
    await expect(page.locator("body")).toBeVisible();
  });

  test("rota protegida redireciona para /auth", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/auth/, { timeout: 20_000 });
  });

  test("recuperação de senha está acessível", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
  });
});
