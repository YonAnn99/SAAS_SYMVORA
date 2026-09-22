import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  SIN_CATEGORIA,
  applyProductFilters,
  countActiveFilters,
  countByStatus,
  sinMinimoDefinido,
  sortProducts,
  stockStatus,
} from "@/features/inventory/stock-status";

let secuencia = 0;
const p = (o: Partial<Parameters<typeof applyProductFilters>[0][number]> = {}) => ({
  // El id hace falta desde que existe el filtro de favoritos, que casa por id.
  id: `p${++secuencia}`,
  nombre: "Producto",
  stock_actual: 10,
  stock_minimo: 5,
  precio_venta: 100,
  categoria: "Bebidas" as string | null,
  creado_en: "2026-01-01T00:00:00.000Z",
  actualizado_en: "2026-01-01T00:00:00.000Z",
  ...o,
});

describe("stockStatus", () => {
  it("un producto sin existencias es AGOTADO, no 'bajo'", () => {
    // La regla vieja de la tabla (`stock <= minimo`) lo marcaba como "Stock
    // bajo": 0 <= 5 es cierto. Así el mismo producto decía "bajo" en la
    // etiqueta y "agotado" en el filtro.
    expect(stockStatus({ stock_actual: 0, stock_minimo: 5 })).toBe("agotado");
  });

  it("stock negativo también es agotado", () => {
    // Puede quedar negativo por una venta offline (migración 051).
    expect(stockStatus({ stock_actual: -3, stock_minimo: 5 })).toBe("agotado");
  });

  it("queda algo pero por debajo del mínimo: bajo", () => {
    expect(stockStatus({ stock_actual: 2, stock_minimo: 5 })).toBe("bajo");
    expect(stockStatus({ stock_actual: 5, stock_minimo: 5 })).toBe("bajo");
  });

  it("por encima del mínimo: ok", () => {
    expect(stockStatus({ stock_actual: 6, stock_minimo: 5 })).toBe("ok");
  });

  it("sin mínimo definido, todo lo que tenga existencias es ok", () => {
    // stock_minimo = 0 es el valor por defecto. Sin mínimo no hay forma de
    // saber qué es "poco", así que no se inventa un umbral.
    expect(stockStatus({ stock_actual: 1, stock_minimo: 0 })).toBe("ok");
    expect(stockStatus({ stock_actual: 0, stock_minimo: 0 })).toBe("agotado");
  });

  it("los cuatro grupos no se solapan y cubren todo", () => {
    const productos = [
      { stock_actual: 0, stock_minimo: 5 },
      { stock_actual: 3, stock_minimo: 5 },
      { stock_actual: 9, stock_minimo: 5 },
      { stock_actual: -1, stock_minimo: 2 },
      { stock_actual: 7, stock_minimo: 0 },
      { stock_actual: 0, stock_minimo: 0, es_servicio: true },
    ];
    const counts = countByStatus(productos);
    // La invariante que sostiene los contadores de los chips: cada producto cae
    // en EXACTAMENTE un grupo, así que la suma es el total. "servicio" se pudo
    // añadir sin romperla porque parte el catálogo en dos limpiamente.
    expect(counts.servicio + counts.agotado + counts.bajo + counts.ok).toBe(
      productos.length
    );
    expect(counts).toEqual({ servicio: 1, agotado: 2, bajo: 1, ok: 2 });
  });
});

describe("los servicios no tienen stock que agotar", () => {
  it("un servicio nunca sale agotado, aunque esté en cero", () => {
    // EL FALLO QUE EVITA: una asesoría o un envío a domicilio salían con la
    // etiqueta roja "Agotado" en el catálogo. Peor: el Punto de Venta los
    // escondía al llegar a cero, así que el servicio no se podía cobrar.
    expect(stockStatus({ stock_actual: 0, stock_minimo: 0, es_servicio: true })).toBe(
      "servicio"
    );
  });

  it("sus existencias son irrelevantes, se hayan quedado en el número que sea", () => {
    // En producción quedó un servicio con stock 5/5 porque su dueño le puso
    // un número a mano para que apareciera en el POS. Ese 5 no debe cambiar
    // nada, ni hacia "bajo" ni hacia "ok".
    for (const stock of [-2, 0, 5, 999]) {
      expect(
        stockStatus({ stock_actual: stock, stock_minimo: 5, es_servicio: true })
      ).toBe("servicio");
    }
  });

  it("no se le reclama un mínimo que no tiene sentido", () => {
    // `sinMinimoDefinido` alimenta la lista de "productos que hay que
    // arreglar". Un servicio ahí sería ruido permanente e inarreglable.
    expect(sinMinimoDefinido({ stock_actual: 0, stock_minimo: 0, es_servicio: true })).toBe(
      false
    );
    expect(sinMinimoDefinido({ stock_actual: 0, stock_minimo: 0 })).toBe(true);
  });

  it("no cae en los filtros por grupo de stock", () => {
    // Filtrar por "agotado" no debe devolver los servicios: no lo están, y
    // mezclarlos convertiría ese filtro en inútil.
    const servicio = p({ stock_actual: 0, stock_minimo: 0, es_servicio: true });
    const agotado = p({ stock_actual: 0, stock_minimo: 5 });
    const filtrados = applyProductFilters([servicio, agotado], {
      ...EMPTY_FILTERS,
      stock: ["agotado"],
    });
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].id).toBe(agotado.id);
  });

  it("un producto normal no se ve afectado por el campo ausente", () => {
    // `es_servicio` es opcional en el tipo: los productos que llegan de
    // consultas que no lo traen tienen que seguir clasificándose igual.
    expect(stockStatus({ stock_actual: 0, stock_minimo: 5 })).toBe("agotado");
    expect(stockStatus({ stock_actual: 0, stock_minimo: 5, es_servicio: false })).toBe(
      "agotado"
    );
  });
});

describe("sortProducts", () => {
  const a = p({ nombre: "Aaa", precio_venta: 30, stock_actual: 1, creado_en: "2026-03-01T00:00:00Z", actualizado_en: "2026-01-01T00:00:00Z" });
  const b = p({ nombre: "Bbb", precio_venta: 10, stock_actual: 9, creado_en: "2026-01-01T00:00:00Z", actualizado_en: "2026-05-01T00:00:00Z" });
  const c = p({ nombre: "Ccc", precio_venta: 20, stock_actual: 5, creado_en: "2026-02-01T00:00:00Z", actualizado_en: "2026-03-01T00:00:00Z" });
  const todos = [a, b, c];

  const nombres = (sort: Parameters<typeof sortProducts>[1]) =>
    sortProducts(todos, sort).map((x) => x.nombre);

  it("ordena por fecha de creación en ambos sentidos", () => {
    expect(nombres("recientes")).toEqual(["Aaa", "Ccc", "Bbb"]);
    expect(nombres("antiguos")).toEqual(["Bbb", "Ccc", "Aaa"]);
  });

  it("ordena por última modificación", () => {
    expect(nombres("modificados")).toEqual(["Bbb", "Ccc", "Aaa"]);
  });

  it("ordena por stock en ambos sentidos", () => {
    expect(nombres("stockAsc")).toEqual(["Aaa", "Ccc", "Bbb"]);
    expect(nombres("stockDesc")).toEqual(["Bbb", "Ccc", "Aaa"]);
  });

  it("ordena por precio en ambos sentidos", () => {
    expect(nombres("precioAsc")).toEqual(["Bbb", "Ccc", "Aaa"]);
    expect(nombres("precioDesc")).toEqual(["Aaa", "Ccc", "Bbb"]);
  });

  it("ordena por título en ambos sentidos", () => {
    expect(nombres("nombreAsc")).toEqual(["Aaa", "Bbb", "Ccc"]);
    expect(nombres("nombreDesc")).toEqual(["Ccc", "Bbb", "Aaa"]);
  });

  it("desempata por nombre para que el orden sea estable", () => {
    // Sin desempate, dos productos del mismo precio podrían intercambiarse
    // entre recargas y la lista "saltaría" sin motivo aparente.
    const x = p({ nombre: "Zeta", precio_venta: 50 });
    const y = p({ nombre: "Alfa", precio_venta: 50 });
    expect(sortProducts([x, y], "precioAsc").map((i) => i.nombre)).toEqual([
      "Alfa",
      "Zeta",
    ]);
  });

  it("no muta el array original", () => {
    const original = [a, b, c];
    sortProducts(original, "nombreDesc");
    expect(original.map((x) => x.nombre)).toEqual(["Aaa", "Bbb", "Ccc"]);
  });

  it("un producto sin fecha no rompe el orden", () => {
    const sinFecha = p({ nombre: "Sin", creado_en: null });
    const r = sortProducts([sinFecha, a], "recientes");
    expect(r.map((x) => x.nombre)).toEqual(["Aaa", "Sin"]);
  });
});

describe("sinMinimoDefinido", () => {
  it("el mínimo por defecto (0) cuenta como indefinido", () => {
    // Es el valor por defecto de la columna Y el que deja la importación CSV
    // cuando no se mapea la columna: es el caso masivo, no el raro.
    expect(sinMinimoDefinido(p({ stock_minimo: 0 }))).toBe(true);
  });

  it("un mínimo de verdad no es indefinido", () => {
    expect(sinMinimoDefinido(p({ stock_minimo: 5 }))).toBe(false);
  });

  it("CRUZA los grupos de stock, no es un cuarto grupo", () => {
    // Un producto agotado también puede estar sin mínimo. Por eso es un filtro
    // booleano aparte y no un valor más de StockStatus: como cuarto valor
    // rompería la invariante de que los tres suman el total.
    const agotadoSinMinimo = p({ stock_actual: 0, stock_minimo: 0 });
    expect(stockStatus(agotadoSinMinimo)).toBe("agotado");
    expect(sinMinimoDefinido(agotadoSinMinimo)).toBe(true);
  });
});

describe("applyProductFilters", () => {
  const agotado = p({ nombre: "Agotado", stock_actual: 0 });
  const bajo = p({ nombre: "Bajo", stock_actual: 2 });
  const ok = p({ nombre: "Ok", stock_actual: 20 });
  const sinCat = p({ nombre: "SinCat", stock_actual: 20, categoria: null });
  const todos = [agotado, bajo, ok, sinCat];

  it("sin filtros devuelve todo", () => {
    expect(applyProductFilters(todos, EMPTY_FILTERS)).toHaveLength(4);
  });

  it("filtra por un grupo de stock", () => {
    const r = applyProductFilters(todos, { ...EMPTY_FILTERS, stock: ["agotado"] });
    expect(r.map((x) => x.nombre)).toEqual(["Agotado"]);
  });

  it("varios grupos de stock se suman", () => {
    const r = applyProductFilters(todos, {
      ...EMPTY_FILTERS,
      stock: ["agotado", "bajo"],
    });
    expect(r).toHaveLength(2);
  });

  it("filtra por categoría", () => {
    const r = applyProductFilters(todos, { ...EMPTY_FILTERS, categoria: "Bebidas" });
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.categoria === "Bebidas")).toBe(true);
  });

  it("filtra los que no tienen categoría", () => {
    const r = applyProductFilters(todos, { ...EMPTY_FILTERS, categoria: SIN_CATEGORIA });
    expect(r.map((x) => x.nombre)).toEqual(["SinCat"]);
  });

  it("combina stock y categoría, no los sustituye", () => {
    const r = applyProductFilters(todos, {
      ...EMPTY_FILTERS,
      stock: ["ok"],
      categoria: "Bebidas",
    });
    expect(r.map((x) => x.nombre)).toEqual(["Ok"]);
  });

  it("filtra por stock indefinido", () => {
    const sinMin = p({ nombre: "SinMinimo", stock_actual: 20, stock_minimo: 0 });
    const r = applyProductFilters([...todos, sinMin], {
      ...EMPTY_FILTERS,
      sinMinimo: true,
    });
    expect(r.map((x) => x.nombre)).toEqual(["SinMinimo"]);
  });

  it("'solo favoritos' sin ningún favorito devuelve cero, no el catálogo", () => {
    // El error clásico: leer "no hay favoritos" como "no hay filtro" y enseñar
    // los 4 productos con el chip encendido.
    const r = applyProductFilters(todos, {
      ...EMPTY_FILTERS,
      soloFavoritos: true,
    });
    expect(r).toHaveLength(0);
  });

  it("filtra por favoritos", () => {
    const r = applyProductFilters(
      todos,
      { ...EMPTY_FILTERS, soloFavoritos: true },
      new Set([ok.id, agotado.id])
    );
    expect(r.map((x) => x.nombre).sort()).toEqual(["Agotado", "Ok"]);
  });

  it("los chips se combinan: favoritos Y stock bajo dan la intersección", () => {
    // Es la razón de que los chips no sean excluyentes: "mis favoritos que se
    // están acabando" es la consulta útil.
    const r = applyProductFilters(
      todos,
      { ...EMPTY_FILTERS, soloFavoritos: true, stock: ["bajo"] },
      new Set([bajo.id, ok.id])
    );
    expect(r.map((x) => x.nombre)).toEqual(["Bajo"]);
  });

  it("el chip sigue filtrando junto a 'sin categoría'", () => {
    // La rama de SIN_CATEGORIA hace `return` y decide sola el predicado: si un
    // filtro nuevo se coloca DESPUÉS, se lo salta en este caso concreto.
    const sinCatSinMinimo = p({
      nombre: "SinCatSinMinimo",
      stock_actual: 20,
      stock_minimo: 0,
      categoria: null,
    });
    const r = applyProductFilters([...todos, sinCatSinMinimo], {
      ...EMPTY_FILTERS,
      categoria: SIN_CATEGORIA,
      sinMinimo: true,
    });
    expect(r.map((x) => x.nombre)).toEqual(["SinCatSinMinimo"]);
  });
});

describe("countActiveFilters", () => {
  it("sin filtros es cero", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it("el orden por defecto NO cuenta como filtro activo", () => {
    // Si contara, el botón mostraría siempre un "1" y perdería significado.
    expect(countActiveFilters({ ...EMPTY_FILTERS, sort: DEFAULT_SORT })).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, sort: "precioAsc" })).toBe(1);
  });

  it("suma stock, categoría y orden", () => {
    expect(
      countActiveFilters({ stock: ["bajo"], categoria: "Ropa", sort: "precioAsc" })
    ).toBe(3);
  });

  it("los chips de acceso rápido también cuentan", () => {
    // El contador del botón Filtros debe reflejarlos: si no, se puede tener la
    // tabla filtrada por un chip con el botón diciendo que no hay filtros.
    expect(countActiveFilters({ ...EMPTY_FILTERS, sinMinimo: true })).toBe(1);
    expect(countActiveFilters({ ...EMPTY_FILTERS, soloFavoritos: true })).toBe(1);
    expect(
      countActiveFilters({
        ...EMPTY_FILTERS,
        sinMinimo: true,
        soloFavoritos: true,
        stock: ["bajo"],
      })
    ).toBe(3);
  });
});
