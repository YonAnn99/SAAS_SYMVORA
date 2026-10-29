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

import {
  aplicarAccion,
  conteosCatalogo,
  filtrarFilas,
  precioEspecialCapturado,
  type FilaCatalogo,
} from "@/features/catalogo/seleccion";
import { precioDeLinea } from "@/features/catalogo/pedido";

const fila = (extra: Partial<FilaCatalogo>): FilaCatalogo => ({
  id: "x",
  nombre: "Producto",
  categoria: null,
  imagen_url: null,
  precio_venta: 20,
  unidad_medida: "PIEZA",
  tieneVariantes: false,
  oculto: false,
  destacado: false,
  precio_especial: null,
  ...extra,
});

describe("módulo catálogo: selección de productos", () => {
  const filas = [
    fila({ id: "1", nombre: "Martillo", categoria: "Herramienta" }),
    fila({ id: "2", nombre: "Clavo", categoria: "Ferretería", oculto: true }),
    fila({ id: "3", nombre: "Pinzas", categoria: "Herramienta", destacado: true }),
    fila({ id: "4", nombre: "Taladro", destacado: true, oculto: true }),
  ];

  it("filtra por estado, categoría y búsqueda sin acentos", () => {
    const ids = (f: FilaCatalogo[]) => f.map((x) => x.id);
    expect(ids(filtrarFilas(filas, { busqueda: "", categoria: null, filtro: "publicados" }))).toEqual(["1", "3"]);
    expect(ids(filtrarFilas(filas, { busqueda: "", categoria: null, filtro: "ocultos" }))).toEqual(["2", "4"]);
    // Un destacado oculto no sale en el catálogo: no cuenta como destacado.
    expect(ids(filtrarFilas(filas, { busqueda: "", categoria: null, filtro: "destacados" }))).toEqual(["3"]);
    expect(ids(filtrarFilas(filas, { busqueda: "", categoria: "Herramienta", filtro: "todos" }))).toEqual(["1", "3"]);
    expect(ids(filtrarFilas(filas, { busqueda: "ferreteria", categoria: null, filtro: "todos" }))).toEqual(["2"]);
  });

  it("conteos de los filtros", () => {
    expect(conteosCatalogo(filas)).toEqual({ todos: 4, publicados: 2, ocultos: 2, destacados: 1 });
  });

  it("destacar algo oculto también lo publica", () => {
    expect(aplicarAccion({ oculto: true, destacado: false, precio_especial: null }, "destacar")).toEqual({
      oculto: false,
      destacado: true,
      precio_especial: null,
    });
    expect(aplicarAccion({ oculto: false, destacado: true, precio_especial: 5 }, "ocultar").oculto).toBe(true);
  });

  it("precio especial capturado", () => {
    expect(precioEspecialCapturado("", 20)).toEqual({ ok: true, valor: null });
    expect(precioEspecialCapturado("$15,5", 20)).toEqual({ ok: true, valor: 15.5 });
    expect(precioEspecialCapturado("20", 20)).toEqual({ ok: true, valor: null });
    expect(precioEspecialCapturado("0", 20).ok).toBe(false);
    expect(precioEspecialCapturado("abc", 20).ok).toBe(false);
  });

  it("el pedido usa el precio especial, salvo que se elija una variante", () => {
    expect(precioDeLinea({ precio_min: 20, precio_especial: 15 }, null)).toBe(15);
    expect(precioDeLinea({ precio_min: 20 }, null)).toBe(20);
    expect(precioDeLinea({ precio_min: 20, precio_especial: 15 }, { precio: 30 })).toBe(30);
    expect(precioDeLinea({ precio_min: null }, null)).toBeNull();
  });
});
