import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EtiquetaPromo, useTextoPromo } from "@/components/marketing/etiqueta-promo";
import es from "@/messages/es.json";
import en from "@/messages/en.json";

function conIdioma(mensajes: typeof es, locale: string, hijo: React.ReactNode) {
  return (
    <NextIntlClientProvider locale={locale} messages={mensajes}>
      {hijo}
    </NextIntlClientProvider>
  );
}

function Texto() {
  return <p data-testid="texto">{useTextoPromo() ?? "sin-promo"}</p>;
}

afterEach(() => {
  vi.doUnmock("@/lib/pricing");
  vi.resetModules();
});

describe("etiqueta de la promoción junto a «Precios»", () => {
  it("con la promoción activa pinta «−50%» en español y en inglés", () => {
    const { unmount } = render(conIdioma(es, "es", <EtiquetaPromo />));
    expect(screen.getByText("−50%")).toBeTruthy();
    unmount();
    render(conIdioma(en as typeof es, "en", <EtiquetaPromo />));
    expect(screen.getByText("−50%")).toBeTruthy();
  });

  it("es la misma pastilla roja que la del selector de precios", () => {
    render(conIdioma(es, "es", <EtiquetaPromo />));
    const pastilla = screen.getByText("−50%");
    expect(pastilla.className).toContain("bg-red-500");
    expect(pastilla.className).toContain("rounded-full");
  });

  it("el texto para el menú del celular sale del mismo lugar", () => {
    render(conIdioma(es, "es", <Texto />));
    expect(screen.getByTestId("texto").textContent).toBe("−50%");
  });

  it("con la promoción apagada no se dibuja nada (igual que la pastilla de precios)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/pricing", async () => {
      const real = await vi.importActual<typeof import("@/lib/pricing")>("@/lib/pricing");
      return { ...real, PROMO_LANZAMIENTO: { ...real.PROMO_LANZAMIENTO, activa: false } };
    });
    const { EtiquetaPromo: Apagada, useTextoPromo: textoApagado } = await import(
      "@/components/marketing/etiqueta-promo"
    );
    function TextoApagado() {
      return <p data-testid="texto">{textoApagado() ?? "sin-promo"}</p>;
    }
    const { container } = render(
      conIdioma(
        es,
        "es",
        <>
          <Apagada />
          <TextoApagado />
        </>
      )
    );
    expect(screen.queryByText("−50%")).toBeNull();
    expect(screen.getByTestId("texto").textContent).toBe("sin-promo");
    expect(container.querySelector(".bg-red-500")).toBeNull();
  });
});
