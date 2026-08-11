import { test, expect } from "@playwright/test";

test.describe("Auth Flow", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/es/auth?mode=login");

    await expect(page).toHaveTitle(/SYMVORA/);
    await expect(page.getByText("Iniciar sesión")).toBeVisible();
  });

  test("should show signup page", async ({ page }) => {
    await page.goto("/es/auth?mode=signup");

    await expect(page.getByText("Crear cuenta")).toBeVisible();
  });

  test("should toggle between login and signup", async ({ page }) => {
    await page.goto("/es/auth?mode=login");

    const toggleButton = page.getByText("Iniciar sesión").last();
    await toggleButton.click();

    await expect(page.getByText("Crear cuenta")).toBeVisible();
  });
});

test.describe("POS Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/es/pos");
  });

  test("should show POS page structure", async ({ page }) => {
    await expect(page.getByPlaceholder("Escanear código de barras o buscar producto")).toBeVisible();
    await expect(page.getByText("Carrito")).toBeVisible();
  });

  test("should show empty cart message", async ({ page }) => {
    await expect(page.getByText("El carrito está vacío")).toBeVisible();
  });

  test("should have payment method buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Efectivo/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Tarjeta/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Transferencia/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Crédito/i })).toBeVisible();
  });

  test("should have complete sale button disabled when cart is empty", async ({ page }) => {
    const completeButton = page.getByRole("button", { name: /Completar venta/i });
    await expect(completeButton).toBeDisabled();
  });
});

test.describe("Products Page", () => {
  test("should show products page", async ({ page }) => {
    await page.goto("/es/products");

    await expect(page.getByText("Productos")).toBeVisible();
    await expect(page.getByRole("button", { name: /Agregar producto/i })).toBeVisible();
  });

  test("should have search input", async ({ page }) => {
    await page.goto("/es/products");

    await expect(page.getByPlaceholder("Buscar...")).toBeVisible();
  });
});

test.describe("Finances Page", () => {
  test("should show finances page", async ({ page }) => {
    await page.goto("/es/finances");

    await expect(page.getByText("Caja")).toBeVisible();
  });
});

test.describe("Dashboard Page", () => {
  test("should show dashboard page", async ({ page }) => {
    await page.goto("/es/dashboard");

    await expect(page.getByText("Dashboard")).toBeVisible();
  });
});
