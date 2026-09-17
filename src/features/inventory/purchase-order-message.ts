/**
 * El texto del pedido que se manda al proveedor por WhatsApp.
 *
 * Texto plano a proposito: WhatsApp no renderiza Markdown, asi que unos `**`
 * llegarian literales. Los asteriscos SUELTOS si ponen negrita en WhatsApp, y
 * se usan asi en el titulo.
 */

export interface LineaMensaje {
  nombre: string;
  cantidad: number;
  costo_unitario: number;
}

export interface DatosMensaje {
  numeroOrden: string;
  proveedor: string;
  negocio: string;
  lineas: LineaMensaje[];
  total: number;
  /**
   * Si el total lleva el 16 %.
   *
   * Desde que el IVA se puede desactivar, un "Total" a secas es ambiguo: el
   * proveedor no puede saber si la cifra ya lo incluye o si habra que
   * sumarlo despues. Dejarlo implicito es pedir un malentendido sobre
   * cuanto se le va a pagar.
   */
  incluyeIva: boolean;
  fechaEstimada?: string | null;
}

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function mensajeParaProveedor(datos: DatosMensaje): string {
  const partes: string[] = [];

  // Sin nombre del proveedor se saluda en generico en vez de dejar un "Hola ,".
  partes.push(
    datos.proveedor ? `Hola, ${datos.proveedor}.` : "Hola."
  );
  partes.push(
    `Le comparto nuestro pedido *${datos.numeroOrden}* de ${datos.negocio}:`
  );
  partes.push("");

  for (const l of datos.lineas) {
    // `String` de un number ya se come los ceros finales: 2.000 sale "2" y 1.5
    // sale "1.5". No hace falta formatear la cantidad a mano.
    partes.push(
      `• ${String(l.cantidad)} x ${l.nombre} — ${money(l.costo_unitario)} c/u`
    );
  }

  partes.push("");
  partes.push(
    `Total: *${money(datos.total)}* ${
      datos.incluyeIva ? "(IVA incluido)" : "(sin IVA)"
    }`
  );

  if (datos.fechaEstimada) {
    partes.push(`Fecha estimada de entrega: ${datos.fechaEstimada}`);
  }

  partes.push("");
  partes.push("Quedo atento a su confirmación. ¡Gracias!");

  return partes.join("\n");
}
