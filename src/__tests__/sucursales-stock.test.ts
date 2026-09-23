import { describe, expect, it } from "vitest";
import {
  conStockDeSucursal,
  conStockDeSucursalVariantes,
  conStockSumado,
  conStockSumadoVariantes,
  destinoDeEdicionDeStock,
  vendiblesEnLocal,
  type FilaStockSucursal,
} from "@/features/sucursales/stock";
import { destinoPorDefecto, seleccionEfectiva } from "@/features/sucursales/seleccion";
import { resumenPorSucursal } from "@/features/sucursales/resumen";
import { opcionesDeTraspaso } from "@/features/sucursales/traspaso";

/**
 * Las reglas de cliente que deciden QUE existencias se ven y DONDE cae un
 * cambio. Cada una, si se equivoca, descuadra el inventario en silencio: el
 * numero que se enseña sigue siendo creible.
 */

const COCA = { id: "coca", stock_actual: 40, es_servicio: false };
const ENVIO = { id: "envio", stock_actual: 0, es_servicio: true };
const PAN = { id: "pan", stock_actual: 7, es_servicio: false };

const NORTE: FilaStockSucursal[] = [
  { producto_id: "coca", variante_id: null, cantidad: 3, se_vende: true },
  { producto_id: "envio", variante_id: null, cantidad: 0, se_vende: false },
];

describe("existencias de un local sobre el catálogo del negocio", () => {
  it("cambia el total del negocio por lo que hay EN ESE local", () => {
    const [coca] = conStockDeSucursal([COCA], NORTE);
    expect(coca.stock_actual).toBe(3); // no 40
  });

  it("ESTE es el importante: sin fila en el local es CERO, no el total", () => {
    // El pan nunca pisó Norte. Enseñar sus 7 del negocio es justo el fallo
    // que esto evita: el POS lo ofrecería y la venta lo rechazaría.
    const [, , pan] = conStockDeSucursal([COCA, ENVIO, PAN], NORTE);
    expect(pan.stock_actual).toBe(0);
  });

  it("'se vende aquí' nace encendido y respeta el apagado", () => {
    const [coca, envio, pan] = conStockDeSucursal([COCA, ENVIO, PAN], NORTE);
    expect(coca.se_vende).toBe(true);
    expect(envio.se_vende).toBe(false);
    expect(pan.se_vende).toBe(true); // sin fila: por defecto encendido
  });

  it("cada talla tiene su stock por local, independiente del producto", () => {
    const filas: FilaStockSucursal[] = [
      { producto_id: "sueter", variante_id: "m", cantidad: 2, se_vende: true },
      { producto_id: "sueter", variante_id: null, cantidad: 9, se_vende: true },
    ];
    const [m, l] = conStockDeSucursalVariantes(
      [
        { id: "m", producto_id: "sueter", stock_actual: 50 },
        { id: "l", producto_id: "sueter", stock_actual: 50 },
      ],
      filas
    );
    expect(m.stock_actual).toBe(2);
    // La fila del producto suelto (variante NULL) no es de la talla L.
    expect(l.stock_actual).toBe(0);
  });
});

describe("qué ofrece el mostrador de un local", () => {
  it("lo que tiene existencias, más los servicios, menos lo que no se vende ahí", () => {
    const productos = conStockDeSucursal([COCA, ENVIO, PAN], NORTE);
    const ids = vendiblesEnLocal(productos).map((p) => p.id);
    expect(ids).toContain("coca");
    expect(ids).not.toContain("pan"); // 0 en este local
    // El envío es servicio (se vende sin existencias), pero este local lo
    // apagó: "se vende aquí" gana también sobre los servicios.
    expect(ids).not.toContain("envio");
  });

  it("un servicio encendido se ofrece aunque no tenga existencias (migración 075)", () => {
    const ids = vendiblesEnLocal(
      conStockDeSucursal([ENVIO], [{ producto_id: "envio", variante_id: null, cantidad: 0, se_vende: true }])
    ).map((p) => p.id);
    expect(ids).toEqual(["envio"]);
  });
});

describe("dónde cae una edición de existencias", () => {
  it("con un solo local, el camino de siempre", () => {
    expect(destinoDeEdicionDeStock(false, null)).toEqual({ tipo: "negocio" });
  });

  it("con varios y uno elegido, sobre ese local", () => {
    expect(destinoDeEdicionDeStock(true, "norte")).toEqual({ tipo: "sucursal", sucursalId: "norte" });
  });

  it("ESTE es el importante: con varios y «Todas», se bloquea", () => {
    // Se ve el total (40 = 25 + 15). Cambiarlo a 30 deja una diferencia de -10
    // que no tiene local: aplicarla al de por defecto sería inventarse dónde
    // faltó la mercancía.
    expect(destinoDeEdicionDeStock(true, null).tipo).toBe("bloqueado");
  });
});

describe("a qué local va una compra, orden o ajuste por defecto", () => {
  const activas = [{ id: "centro" }, { id: "norte" }];

  it("la sucursal que se está mirando", () => {
    expect(destinoPorDefecto("norte", activas)).toBe("norte");
  });

  it("con un solo local abierto, ese, sin preguntar", () => {
    expect(destinoPorDefecto(null, [{ id: "centro" }])).toBe("centro");
  });

  it("con varios y «Todas», ninguno: el formulario obliga a elegir", () => {
    expect(destinoPorDefecto(null, activas)).toBeNull();
  });

  it("una sucursal cerrada nunca es destino, aunque esté elegida para consultar", () => {
    expect(destinoPorDefecto("cerrada", activas)).toBeNull();
  });
});

describe("comparativa de locales", () => {
  const sucursales = [
    { id: "centro", nombre: "Centro", activa: true },
    { id: "norte", nombre: "Norte", activa: true },
  ];

  it("ESTE es el importante: el total es la suma de las filas, ni más ni menos", () => {
    const { filas, total } = resumenPorSucursal(
      sucursales,
      [
        { sucursal_id: "centro", total: 100 },
        { sucursal_id: "centro", total: 50 },
        { sucursal_id: "norte", total: 30 },
        { sucursal_id: null, total: 20 }, // venta sin local
      ],
      [
        { sucursal_id: "centro", cantidad: 10 },
        { sucursal_id: "norte", cantidad: 4 },
      ],
      [
        { sucursal_id: "norte", estado: "ABIERTA", diferencia: null },
        { sucursal_id: "centro", estado: "CERRADA", diferencia: -15 },
      ]
    );
    const suma = (k: "ventas" | "tickets" | "unidades" | "cajasAbiertas" | "diferenciaCortes") =>
      filas.reduce((acc, f) => acc + f[k], 0);

    expect(total.ventas).toBe(200);
    expect(suma("ventas")).toBe(total.ventas);
    expect(suma("tickets")).toBe(total.tickets);
    expect(suma("unidades")).toBe(total.unidades);
    expect(suma("cajasAbiertas")).toBe(total.cajasAbiertas);
    expect(suma("diferenciaCortes")).toBe(total.diferenciaCortes);
  });

  it("las ventas sin local salen en su propia fila en vez de perderse", () => {
    const { filas } = resumenPorSucursal(sucursales, [{ sucursal_id: null, total: 20 }], [], []);
    const huerfana = filas.find((f) => f.sucursalId === null);
    expect(huerfana?.ventas).toBe(20);
  });

  it("sin ventas huérfanas, esa fila no aparece", () => {
    const { filas } = resumenPorSucursal(sucursales, [{ sucursal_id: "centro", total: 5 }], [], []);
    expect(filas.map((f) => f.sucursalId)).toEqual(["centro", "norte"]);
  });

  it("el ticket promedio no divide entre cero", () => {
    const { filas } = resumenPorSucursal(sucursales, [], [], []);
    expect(filas.every((f) => f.ticketPromedio === 0)).toBe(true);
  });
});

describe("qué se puede traspasar desde un local", () => {
  const productos = [
    { id: "coca", nombre: "Coca 600ml", es_servicio: false },
    { id: "envio", nombre: "Envío", es_servicio: true },
    { id: "sueter", nombre: "Suéter", es_servicio: false },
  ];
  const variantes = [
    { id: "m", producto_id: "sueter", talla: "M", color: "Rojo" },
    { id: "l", producto_id: "sueter", talla: "L", color: "Rojo" },
  ];
  const filas: FilaStockSucursal[] = [
    { producto_id: "coca", variante_id: null, cantidad: 12, se_vende: true },
    { producto_id: "envio", variante_id: null, cantidad: 5, se_vende: true },
    { producto_id: "sueter", variante_id: "m", cantidad: 3, se_vende: true },
    { producto_id: "sueter", variante_id: "l", cantidad: 0, se_vende: true },
  ];

  it("solo lo que hay, con su cantidad, y cada talla aparte", () => {
    const ops = opcionesDeTraspaso(productos, variantes, filas);
    expect(ops.map((o) => [o.etiqueta, o.disponible])).toEqual([
      ["Coca 600ml", 12],
      ["Suéter · M / Rojo", 3],
    ]);
  });

  it("nunca un servicio, aunque por error tuviera cantidad", () => {
    const ops = opcionesDeTraspaso(productos, variantes, filas);
    expect(ops.some((o) => o.productoId === "envio")).toBe(false);
  });

  it("la opción de variante lleva su id para que el servidor mueva la talla correcta", () => {
    const sueter = opcionesDeTraspaso(productos, variantes, filas).find((o) => o.varianteId);
    expect(sueter).toMatchObject({ productoId: "sueter", varianteId: "m" });
  });
});

describe("qué sucursal se aplica según lo que el usuario tiene asignado", () => {
  const norte = { id: "norte" };
  const centro = { id: "centro" };

  it("ESTE es el importante: restringido a un solo local, siempre ese — nunca «Todas»", () => {
    // En Productos, «Todas» es el total del negocio. Un cajero de Norte no debe
    // ver las existencias de Principal, ni aunque tuviera guardado «Todas».
    expect(
      seleccionEfectiva({ seleccionada: null, activas: [norte], hayVarias: false, restringido: true })
    ).toBe("norte");
  });

  it("sin restricción y con un solo local, «Todas» (como siempre)", () => {
    expect(
      seleccionEfectiva({ seleccionada: "norte", activas: [norte], hayVarias: false, restringido: false })
    ).toBeNull();
  });

  it("con varias disponibles, lo que el usuario eligió", () => {
    expect(
      seleccionEfectiva({ seleccionada: "centro", activas: [norte, centro], hayVarias: true, restringido: true })
    ).toBe("centro");
  });
});

describe("«Todas» de un usuario restringido: la suma de SUS locales", () => {
  it("suma el stock suelto de los locales recibidos y no mezcla las variantes", () => {
    const filas: FilaStockSucursal[] = [
      { producto_id: "coca", variante_id: null, cantidad: 3, se_vende: true },
      { producto_id: "coca", variante_id: null, cantidad: 4, se_vende: true },
      { producto_id: "sueter", variante_id: "m", cantidad: 9, se_vende: true },
    ];
    const [coca, sueter] = conStockSumado(
      [
        { id: "coca", stock_actual: 100 },
        { id: "sueter", stock_actual: 100 },
      ],
      filas
    );
    expect(coca.stock_actual).toBe(7); // no los 100 del negocio
    expect(sueter.stock_actual).toBe(0); // la talla M no es el suéter suelto
  });

  it("cada talla suma lo suyo", () => {
    const [m] = conStockSumadoVariantes(
      [{ id: "m", producto_id: "sueter", stock_actual: 50 }],
      [
        { producto_id: "sueter", variante_id: "m", cantidad: 2, se_vende: true },
        { producto_id: "sueter", variante_id: "m", cantidad: 5, se_vende: true },
      ]
    );
    expect(m.stock_actual).toBe(7);
  });
});
