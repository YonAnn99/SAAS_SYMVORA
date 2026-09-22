import { describe, expect, it } from "vitest";
import {
  aRenglonesRpc,
  renglonesConDatos,
  validarCompraDirecta,
  type RenglonCompraForm,
} from "@/features/inventory/compra-directa";
import { componerValor } from "@/features/inventory/purchase-order-items";

/**
 * La compra directa SUMA INVENTARIO. Todo lo que se cuela por aqui acaba
 * cambiando existencias reales, asi que cada caso de estos evita un descuadre
 * concreto, no un mensaje feo.
 */

const PROD = "11111111-1111-1111-1111-111111111111";
const VAR = "22222222-2222-2222-2222-222222222222";

const vacio: RenglonCompraForm = { valor: "", cantidad: "", costo_unitario: "" };

function renglon(over: Partial<RenglonCompraForm> = {}): RenglonCompraForm {
  return { valor: PROD, cantidad: "5", costo_unitario: "10", ...over };
}

describe("qué renglones cuentan", () => {
  it("ignora las filas que el usuario ni tocó", () => {
    // El formulario arranca con una fila vacia y añade otra al pulsar
    // "Agregar". Sin esto, una fila en blanco al final bloquearia el guardado
    // de una compra por lo demas correcta.
    expect(renglonesConDatos([renglon(), vacio])).toHaveLength(1);
    expect(validarCompraDirecta([renglon(), vacio]).ok).toBe(true);
  });

  it("una compra solo de filas vacías no se puede guardar", () => {
    // Guardarla crearia otra cabecera sin renglones: exactamente el apunte
    // muerto que esta pantalla dejo de producir.
    const r = validarCompraDirecta([vacio, vacio]);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("sin-renglones");
  });
});

describe("cantidades", () => {
  it("rechaza cantidad cero", () => {
    // Crearia una compra que no acredita nada y ensucia el historial.
    const r = validarCompraDirecta([renglon({ cantidad: "0" })]);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("cantidad-invalida");
  });

  it("rechaza cantidad negativa", () => {
    // Este es el caro: una cantidad negativa RESTARIA inventario desde la
    // pantalla de compras, que es lo contrario de lo que el usuario cree estar
    // haciendo.
    const r = validarCompraDirecta([renglon({ cantidad: "-3" })]);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("cantidad-invalida");
  });

  it("rechaza una cantidad a medio escribir en vez de tratarla como cero", () => {
    // `parseFloat("")` es NaN. Sin la comprobacion de finitud acabaria en la
    // base como cantidad nula o como NaN.
    for (const cantidad of ["", "  ", "abc", "-"]) {
      expect(validarCompraDirecta([renglon({ cantidad })]).motivo).toBe(
        "cantidad-invalida"
      );
    }
  });

  it("acepta cantidades decimales", () => {
    // `detalle_compras.cantidad` es DECIMAL(10,3): hay mercancia por kilo.
    expect(validarCompraDirecta([renglon({ cantidad: "2.5" })]).ok).toBe(true);
  });
});

describe("costos", () => {
  it("acepta costo cero", () => {
    // Mercancia de regalo, muestras y bonificaciones del proveedor existen.
    expect(validarCompraDirecta([renglon({ costo_unitario: "0" })]).ok).toBe(true);
  });

  it("rechaza costo negativo", () => {
    const r = validarCompraDirecta([renglon({ costo_unitario: "-1" })]);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("costo-invalido");
  });
});

describe("el renglón que falla se identifica", () => {
  it("dice cuál es, contando desde uno y sin contar las filas vacías", () => {
    // Decir "hay un error" en una compra de ocho renglones obliga a revisarlos
    // todos a mano.
    const r = validarCompraDirecta([
      renglon(),
      renglon({ cantidad: "0" }),
      vacio,
    ]);
    expect(r.renglon).toBe(2);
  });
});

describe("traducción al RPC", () => {
  it("manda la variante y deja que el servidor deduzca el producto padre", () => {
    // Mandar los dos y que no casaran acreditaria el stock en un cubo mientras
    // el renglon nombra otro producto. Es el descuadre silencioso que la
    // migracion 066 tuvo que arreglar en la recepcion de ordenes.
    const [item] = aRenglonesRpc([
      renglon({ valor: componerValor(PROD, VAR), cantidad: "3", costo_unitario: "7.5" }),
    ]);
    expect(item.variante_id).toBe(VAR);
    expect(item.cantidad).toBe(3);
    expect(item.costo_unitario).toBe(7.5);
  });

  it("manda variante_id nulo cuando el producto no tiene variantes", () => {
    const [item] = aRenglonesRpc([renglon()]);
    expect(item.producto_id).toBe(PROD);
    expect(item.variante_id).toBeNull();
  });

  it("no manda las filas vacías", () => {
    expect(aRenglonesRpc([renglon(), vacio, renglon()])).toHaveLength(2);
  });

  it("convierte a número, no manda las cadenas del formulario", () => {
    // El RPC hace `(v_item->>'cantidad')::DECIMAL`; una cadena con espacios o
    // una coma decimal reventaria la transaccion entera en el servidor.
    const [item] = aRenglonesRpc([renglon({ cantidad: "12", costo_unitario: "3.25" })]);
    expect(typeof item.cantidad).toBe("number");
    expect(typeof item.costo_unitario).toBe("number");
  });
});
