/**
 * Los importes de una orden de compra.
 *
 * POR QUE EXISTE. Esta cuenta estaba escrita DOS VECES, y la que se veia no era
 * la que se guardaba:
 *
 *   - `purchase-order-dialog.tsx` la calculaba para pintar Subtotal / IVA /
 *     Total, pero `handleSave` no mandaba ninguno de los tres.
 *   - `use-purchase-orders.ts` la rehacia con un `subtotal * 0.16` suelto, y
 *     ESA era la que acababa en la base.
 *
 * Mientras las dos aplicaran siempre el 16 % daban lo mismo y nadie lo notaba.
 * En cuanto el IVA se puede desactivar, dejarlas separadas garantiza que la
 * pantalla diga una cosa y la orden guarde otra. Aqui hay una sola.
 *
 * Ademas ninguna de las dos redondeaba: `subtotal * 0.16` entraba crudo en una
 * columna `DECIMAL(10,2)` y lo truncaba la base. Ahora se redondea antes.
 *
 * Vive fuera del JSX como `purchase-receipt.ts` y `stock-status.ts`: es lo
 * unico con reglas de negocio y lo unico que merece test.
 */

/** IVA general en Mexico. */
export const TASA_IVA = 0.16;

/** Un renglon tal y como lo tiene el formulario: texto, no numeros. */
export interface RenglonOrden {
  cantidad_solicitada: string;
  costo_unitario: string;
}

export interface TotalesOrden {
  subtotal: number;
  impuesto: number;
  total: number;
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Lo que vale la orden.
 *
 * Los renglones llegan como cadenas porque vienen de campos de texto; un campo
 * vacio o a medio escribir cuenta como 0 y no como `NaN`, que acabaria escrito
 * como importe.
 */
export function totalesOrdenCompra(
  renglones: RenglonOrden[],
  incluyeIva: boolean
): TotalesOrden {
  const subtotal = redondear2(
    renglones.reduce((acc, r) => {
      const cantidad = parseFloat(r.cantidad_solicitada) || 0;
      const costo = parseFloat(r.costo_unitario) || 0;
      return acc + cantidad * costo;
    }, 0)
  );

  const impuesto = incluyeIva ? redondear2(subtotal * TASA_IVA) : 0;
  return { subtotal, impuesto, total: redondear2(subtotal + impuesto) };
}

/**
 * ¿Esta orden guardada llevaba IVA?
 *
 * Se deduce de lo guardado en vez de guardarse aparte: la base ya distingue el
 * caso, porque el RPC de recepcion saca la tasa dividiendo `impuesto` entre
 * `subtotal` (migracion 065). Hermano de `tasaIvaDeOrden()`.
 *
 * Sirve para rehidratar la casilla al abrir una orden para editar. Sin esto,
 * reabrir una orden sin IVA le devolveria el 16 % en cuanto se guardara.
 *
 * Con subtotal 0 devuelve `false` en vez de dividir entre cero. Es un caso de
 * borde estrecho —una orden de importe cero— y ahi da igual: 0 mas IVA sigue
 * siendo 0.
 */
export function ordenLlevaIva(orden: {
  subtotal: number | string;
  impuesto: number | string;
}): boolean {
  const subtotal = Number(orden.subtotal);
  if (!(subtotal > 0)) return false;
  return Number(orden.impuesto) > 0;
}
