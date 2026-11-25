import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import es from "@/messages/es.json";
import { AvisoAjustePlan } from "@/components/plan/aviso-ajuste-plan";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function pintar(nivel: "basico" | "pro" | "premium", sucursales: number, onElegir = vi.fn()) {
  render(
    <NextIntlClientProvider locale="es" messages={es}>
      <AvisoAjustePlan nivel={nivel} sucursalesActivas={sucursales} onElegir={onElegir} />
    </NextIntlClientProvider>
  );
  return onElegir;
}

describe("aviso de ajuste de plan antes de pagar", () => {
  it("Básico con 3 sucursales: avisa, propone Pro y lleva a Sucursales", () => {
    const onElegir = pintar("basico", 3);
    const aviso = screen.getByRole("alert");
    expect(aviso.textContent).toContain("Tienes 3 sucursales activas");
    expect(aviso.textContent).toContain("incluye hasta 1");
    expect(aviso.textContent).toContain("cierra 2 sucursales");
    fireEvent.click(screen.getByRole("button", { name: /Elegir Pro/ }));
    expect(onElegir).toHaveBeenCalledWith("pro");
    expect(screen.getByRole("link", { name: /Ir a Sucursales/ }).getAttribute("href")).toBe("/branches");
  });

  it("Básico con 1 sucursal cabe, pero avisa lo que se apaga sin borrar nada", () => {
    pintar("basico", 1);
    expect(screen.queryByRole("alert")).toBeNull();
    const nota = screen.getByRole("note").textContent ?? "";
    expect(nota).toContain("catálogo en línea");
    expect(nota).toContain("tarjetas de lealtad");
    expect(nota).toContain("No se borra nada");
  });

  it("Pro con 3 sucursales y Premium con muchas no muestran nada", () => {
    pintar("pro", 3);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("Pro con 5 sucursales propone Premium", () => {
    pintar("pro", 5);
    expect(screen.getByRole("alert").textContent).toContain("Elige Premium");
  });
});
