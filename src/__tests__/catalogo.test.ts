import { describe, expect, it } from "vitest";
import {
  limpiarSlugTecleado,
  slugConSufijo,
  slugDesdeNombre,
  slugValido,
  urlCatalogo,
} from "@/features/catalogo/slug";
import {
  CANTIDAD_MAXIMA,
  conteoPedido,
  mensajePedido,
  reducirPedido,
  textoPrecio,
  totalEstimado,
  type LineaPedido,
} from "@/features/catalogo/pedido";

describe("enlace del catálogo", () => {
  it("arma el slug desde el nombre del negocio", () => {
    expect(slugDesdeNombre("Autopartes Carrillo")).toBe("autopartes-carrillo");
    expect(slugDesdeNombre("  Tacos & Más «Don Pepe»  ")).toBe("tacos-mas-don-pepe");
    expect(slugDesdeNombre("Ferretería Ñoño")).toBe("ferreteria-nono");
  });

  it("recorta a 40 sin dejar un guion al final", () => {
    const slug = slugDesdeNombre("Abarrotes y Materiales para Construcción del Norte de la Ciudad");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
    expect(slugValido(slug)).toBe(true);
  });

  it("valida igual que el CHECK de la base", () => {
    expect(slugValido("mi-tienda")).toBe(true);
    expect(slugValido("ab")).toBe(false);
    expect(slugValido("Mi-Tienda")).toBe(false);
    expect(slugValido("mi--tienda")).toBe(false);
    expect(slugValido("-mi-tienda")).toBe(false);
    expect(slugValido("mi tienda")).toBe(false);
    expect(slugValido("a".repeat(41))).toBe(false);
  });

  it("limpia lo tecleado y conserva el guion mientras escribe", () => {
    expect(limpiarSlugTecleado("Mi Tienda ")).toBe("mi-tienda-");
    expect(limpiarSlugTecleado("--Café")).toBe("cafe");
  });

  it("agrega sufijo sin pasar de 40", () => {
    expect(slugConSufijo("mi-tienda", 2)).toBe("mi-tienda-2");
    const largo = slugConSufijo("a".repeat(40), 12);
    expect(largo.length).toBe(40);
    expect(slugValido(largo)).toBe(true);
  });

  it("URL pública en www con idioma", () => {
    expect(urlCatalogo("mi-tienda", "es", "https://www.symvora.com.mx/")).toBe(
      "https://www.symvora.com.mx/es/catalogo/mi-tienda"
    );
    expect(urlCatalogo("mi-tienda", "fr", "https://x.mx")).toBe("https://x.mx/es/catalogo/mi-tienda");
  });
});

const coca = { productoId: "p1", varianteId: null, nombre: "Coca Cola 600 ml", variante: null, unidad: "PIEZA", precio: 18 };
const jamon = { productoId: "p2", varianteId: null, nombre: "Jamón", variante: null, unidad: "KG", precio: 180 };
const playera = { productoId: "p3", varianteId: "v1", nombre: "Playera", variante: "Rojo · M", unidad: "PIEZA", precio: 150 };

describe("carrito del catálogo", () => {
  it("agrega, suma y separa variantes", () => {
    let l: LineaPedido[] = [];
    l = reducirPedido(l, { tipo: "agregar", linea: coca });
    l = reducirPedido(l, { tipo: "agregar", linea: coca });
    l = reducirPedido(l, { tipo: "agregar", linea: playera });
    l = reducirPedido(l, { tipo: "agregar", linea: { ...playera, varianteId: "v2", variante: "Azul · M" } });
    expect(l).toHaveLength(3);
    expect(l[0].cantidad).toBe(2);
    expect(l[1].clave).toBe("p3:v1");
    expect(conteoPedido(l)).toBe(4);
  });

  it("granel acepta decimales y cuenta como un renglón", () => {
    let l = reducirPedido([], { tipo: "agregar", linea: jamon, cantidad: 0.25 });
    l = reducirPedido(l, { tipo: "cantidad", clave: "p2", cantidad: 0.7504 });
    expect(l[0].cantidad).toBe(0.75);
    expect(conteoPedido(l)).toBe(1);
  });

  it("piezas no aceptan fracciones; cantidad 0 quita; tope máximo", () => {
    let l = reducirPedido([], { tipo: "agregar", linea: coca });
    l = reducirPedido(l, { tipo: "cantidad", clave: "p1", cantidad: 1.5 });
    expect(l[0].cantidad).toBe(1);
    l = reducirPedido(l, { tipo: "cantidad", clave: "p1", cantidad: 50000 });
    expect(l[0].cantidad).toBe(CANTIDAD_MAXIMA);
    l = reducirPedido(l, { tipo: "cantidad", clave: "p1", cantidad: 0 });
    expect(l).toHaveLength(0);
  });

  it("total estimado, o null si falta un precio", () => {
    let l = reducirPedido([], { tipo: "agregar", linea: coca, cantidad: 3 });
    l = reducirPedido(l, { tipo: "agregar", linea: jamon, cantidad: 0.5 });
    expect(totalEstimado(l)).toBe(144);
    l = reducirPedido(l, { tipo: "agregar", linea: { ...playera, precio: null } });
    expect(totalEstimado(l)).toBeNull();
  });

  it("mensaje de WhatsApp con renglones, total y aviso", () => {
    let l = reducirPedido([], { tipo: "agregar", linea: coca, cantidad: 2 });
    l = reducirPedido(l, { tipo: "agregar", linea: playera });
    const m = mensajePedido("Miscelánea Lupita", l, "Ana");
    expect(m).toContain("Hola, Miscelánea Lupita. Soy Ana");
    expect(m).toContain("• 2 pzas Coca Cola 600 ml — $36.00");
    expect(m).toContain("Playera (Rojo · M)");
    expect(m).toContain("Total estimado: $186.00");
    expect(m).toContain("confirman disponibilidad");
  });

  it("sin precios no inventa total", () => {
    const l = reducirPedido([], { tipo: "agregar", linea: { ...coca, precio: null } });
    const m = mensajePedido("Tienda", l);
    expect(m).not.toContain("Total");
    expect(m).not.toContain("$");
  });

  it("texto del precio en la tarjeta", () => {
    expect(textoPrecio(26, 26, "PIEZA")).toBe("$26.00");
    expect(textoPrecio(18, 32, "PIEZA")).toBe("desde $18.00");
    expect(textoPrecio(180, 180, "KG")).toBe("$180.00 por kg");
    expect(textoPrecio(null, null, "PIEZA")).toBeNull();
  });
});
