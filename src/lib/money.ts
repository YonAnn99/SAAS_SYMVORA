/**
 * Formato de dinero en pesos mexicanos.
 *
 * Hoy conviven tres formas de pintar precios en el proyecto, y la dominante
 * (`$${n.toFixed(2)}`) NO agrupa millares: un precio de 1234.5 sale "$1234.50".
 * En una pantalla que compara dos columnas de precio eso se lee mal.
 *
 * Este helper es solo para lo nuevo. Cambiar las tablas existentes a la vez
 * alteraria pantallas que ya funcionan, asi que se deja para cuando se toquen
 * por otro motivo.
 */
export function formatMXN(n: number): string {
  return Number(n).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
}
