import { describe, expect, it } from "vitest";
import { mensajeDeError } from "@/features/inventory/error-message";

describe("mensajeDeError", () => {
  it("lee un error de supabase-js, que NO es un Error", () => {
    // EL DEFECTO QUE EVITA: supabase-js no lanza excepciones, devuelve
    // `{ message, details, hint, code }`. Comprobando solo `instanceof Error`
    // el texto salía vacío y TODAS las traducciones eran código muerto: daba
    // igual lo que respondiera la base, el usuario veía el mensaje genérico.
    const deSupabase = {
      message: "Could not find the table 'public.productos_favoritos' in the schema cache",
      details: null,
      hint: null,
      code: "PGRST205",
    };
    expect(mensajeDeError(deSupabase)).toBe(
      "Esta función aún no está disponible en tu base de datos"
    );
  });

  it("traduce el tope de stock, que la base lanza en inglés", () => {
    expect(mensajeDeError(new Error("Stock cannot be negative: -3"))).toBe(
      "El stock no puede quedar en negativo"
    );
  });

  it("traduce el rechazo de RLS, que llega en jerga de Postgres", () => {
    expect(
      mensajeDeError({
        message: "new row violates row-level security policy for table",
      })
    ).toBe("No tienes permiso para modificar productos");
  });

  it("deja pasar un mensaje que ya es legible", () => {
    expect(mensajeDeError(new Error("No perteneces a este negocio"))).toBe(
      "No perteneces a este negocio"
    );
  });

  it("nunca devuelve cadena vacía ni 'undefined'", () => {
    // Un toast en blanco es peor que un mensaje impreciso.
    for (const v of [null, undefined, {}, { message: null }, 42]) {
      expect(mensajeDeError(v)).toBe("No se pudo guardar el cambio");
    }
  });
});
