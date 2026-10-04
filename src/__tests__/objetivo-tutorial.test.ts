import { afterEach, describe, expect, it } from "vitest";
import { buscarObjetivo } from "@/components/tutorial/objetivo-tutorial";

/** jsdom no hace layout: se simula el tamaño de cada enlace. */
function enlace(href: string, visible: boolean) {
  const a = document.createElement("a");
  a.setAttribute("href", href);
  const rect = visible
    ? { x: 10, y: 10, width: 120, height: 40, top: 10, left: 10, right: 130, bottom: 50 }
    : { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
  a.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect }) as DOMRect;
  a.getClientRects = () =>
    (visible ? [a.getBoundingClientRect()] : []) as unknown as DOMRectList;
  document.body.appendChild(a);
  return a;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("buscarObjetivo", () => {
  it("salta el enlace oculto del menú lateral y toma el visible", () => {
    enlace("/es/products", false);
    const visible = enlace("/es/products", true);
    expect(buscarObjetivo('a[href*="/products"]', "bottom", false)).toBe(visible);
  });

  it("sin ninguno visible regresa null (el paso va centrado)", () => {
    enlace("/es/settings", false);
    expect(buscarObjetivo('a[href$="/settings"]', "right", true)).toBeNull();
  });

  it("los pasos del menú lateral no se anclan fuera de escritorio", () => {
    enlace("/es/products", true);
    expect(buscarObjetivo('a[href*="/products"]', "right", false)).toBeNull();
    expect(buscarObjetivo('a[href*="/products"]', "right", true)).not.toBeNull();
  });

  it("los pasos centrados o sin selector no buscan nada", () => {
    enlace("/es/products", true);
    expect(buscarObjetivo(null, "bottom", true)).toBeNull();
    expect(buscarObjetivo('a[href*="/products"]', "center", true)).toBeNull();
  });
});
