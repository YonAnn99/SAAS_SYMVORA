import { describe, expect, it } from "vitest";
import { resolverSeleccion } from "@/features/sucursales/seleccion";

/**
 * El fallo que estos test impiden NO es una pantalla rota: es una pantalla que
 * enseña **cero pesos como si fuera la verdad**.
 *
 * La sucursal elegida se recuerda en `localStorage`, que sobrevive al cierre de
 * sesión, al cambio de cuenta y al borrado de la propia sucursal. Si se filtrara
 * por un identificador que ya no existe, todas las consultas del panel
 * devolverían vacío y el comerciante vería "$0.00" en un día en el que vendió.
 * Un cero es una cifra creíble, así que nadie lo denunciaría como error.
 */

const SUCURSALES = [
  { id: "centro" },
  { id: "norte" },
] as const;

describe("qué sucursal queda elegida al cargar", () => {
  it("respeta la elección guardada si esa sucursal sigue existiendo", () => {
    expect(resolverSeleccion("norte", SUCURSALES)).toBe("norte");
  });

  it("sin nada guardado muestra TODAS, no la primera de la lista", () => {
    // Elegir una por su cuenta sería peor que no elegir: el dueño de dos
    // locales entraría creyendo ver su negocio entero y estaría viendo la mitad.
    expect(resolverSeleccion(null, SUCURSALES)).toBeNull();
  });

  it("ESTE es el importante: una sucursal que ya no existe cae a TODAS", () => {
    // Pasa de verdad: se cierra el navegador con "norte" elegida, se borra esa
    // sucursal, y al volver el panel filtraría por un id fantasma.
    expect(resolverSeleccion("borrada", SUCURSALES)).toBeNull();
  });

  it("cambiar de cuenta en el mismo navegador no arrastra la sucursal de la anterior", () => {
    // Mostrador compartido, o el dueño que gestiona dos negocios: el id guardado
    // es válido, pero de OTRO negocio. Como no está en la lista que devuelve
    // RLS, no se aplica.
    expect(resolverSeleccion("centro", [{ id: "otro-negocio-a" }])).toBeNull();
  });

  it("un negocio sin sucursales funciona como antes de que existieran", () => {
    expect(resolverSeleccion("centro", [])).toBeNull();
    expect(resolverSeleccion(null, [])).toBeNull();
  });

  it("la cadena vacía se trata como 'no hay nada guardado'", () => {
    // `localStorage.getItem` devuelve "" si algo escribió una cadena vacía, y
    // `"" !== null`, así que sin esta rama se buscaría una sucursal con id "".
    expect(resolverSeleccion("", SUCURSALES)).toBeNull();
  });
});
