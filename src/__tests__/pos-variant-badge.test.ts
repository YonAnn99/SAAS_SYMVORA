import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import type { VarianteProducto } from "@/features/pos/types/pos.types";
import esMessages from "@/messages/es.json";
import enMessages from "@/messages/en.json";

/**
 * El distintivo de variantes de la cuadrícula del POS.
 *
 * Lo que se fija aquí no es el CSS sino la REGLA: el número que muestra la
 * insignia tiene que coincidir siempre con las opciones que luego ofrece
 * `variant-picker-dialog`. Si divergen, el cajero ve "3 variantes", pulsa y le
 * salen otras — o peor, no le sale diálogo.
 *
 * Por eso `pos/page.tsx` deriva el conteo del mismo `variantsByProduct` que usa
 * `handleAddProduct` para decidir si abre el diálogo. Esta es la funcion que
 * representa esa derivación.
 */
function contarVariantes(
  variantsByProduct: Record<string, VarianteProducto[]>
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(variantsByProduct).map(([id, vs]) => [id, vs.length])
  );
}

/** Igual que la condición de `handleAddProduct`. */
function abreDialogo(
  variantsByProduct: Record<string, VarianteProducto[]>,
  productId: string
): boolean {
  return (variantsByProduct[productId] ?? []).length > 0;
}

const variante = (
  id: string,
  producto_id: string,
  stock_actual: number
): VarianteProducto =>
  ({
    id,
    producto_id,
    talla: "M",
    color: "ROJO",
    precio_venta: 0,
    stock_actual,
  }) as VarianteProducto;

describe("distintivo de variantes en el POS", () => {
  it("un producto sin variantes no lleva distintivo", () => {
    const conteo = contarVariantes({ "prod-1": [] });
    expect(conteo["prod-1"]).toBe(0);
  });

  it("un producto que ni siquiera figura en el mapa no lleva distintivo", () => {
    const conteo = contarVariantes({});
    expect(conteo["prod-desconocido"] ?? 0).toBe(0);
  });

  it("cuenta las variantes creadas", () => {
    const conteo = contarVariantes({
      sueter: [
        variante("v1", "sueter", 5),
        variante("v2", "sueter", 2),
        variante("v3", "sueter", 0),
      ],
    });
    expect(conteo.sueter).toBe(3);
  });

  it("incluye las variantes AGOTADAS", () => {
    // `fetchPosVariants` no filtra por stock a proposito: el cajero necesita
    // poder ver que una talla esta agotada, no que desaparezca. Si el conteo
    // las excluyera, la insignia diria menos de las que muestra el dialogo.
    const todasAgotadas = {
      gorra: [variante("v1", "gorra", 0), variante("v2", "gorra", 0)],
    };
    expect(contarVariantes(todasAgotadas).gorra).toBe(2);
    expect(abreDialogo(todasAgotadas, "gorra")).toBe(true);
  });

  it("el distintivo aparece exactamente cuando se abre el diálogo", () => {
    // LA INVARIANTE QUE IMPORTA. El caso real que la motiva: "Cafe" esta
    // marcado como `permite_variantes` pero no tiene ninguna creada, asi que
    // se vende directo — y no debe llevar distintivo.
    const mapa: Record<string, VarianteProducto[]> = {
      cafe: [], // permite_variantes = true, pero 0 creadas
      sueter: [variante("v1", "sueter", 5)],
      prueba: [],
    };
    const conteo = contarVariantes(mapa);

    for (const id of Object.keys(mapa)) {
      expect(
        conteo[id] > 0,
        `${id}: la insignia y el diálogo deben coincidir`
      ).toBe(abreDialogo(mapa, id));
    }

    expect(conteo.cafe).toBe(0);
    expect(conteo.sueter).toBe(1);
  });
});

describe("texto del distintivo (pos.variantsAvailable)", () => {
  // La insignia llama a `t("pos.variantsAvailable", { count })`. Si la clave no
  // existe, next-intl lanza MISSING_MESSAGE en tiempo de ejecucion y el fallo
  // solo se ve abriendo el POS. Aqui se cae la suite en su lugar.
  const locales = [
    ["es", esMessages],
    ["en", enMessages],
  ] as const;

  it("la clave existe en los dos idiomas", () => {
    for (const [locale, msgs] of locales) {
      expect(
        typeof (msgs as { pos: Record<string, unknown> }).pos.variantsAvailable,
        `falta en ${locale}.json`
      ).toBe("string");
    }
  });

  it("el plural ICU formatea bien singular y plural", () => {
    // Se usa `createTranslator`, la misma maquinaria de next-intl que corre en
    // la app (y dependencia directa), en vez de formatear a mano con
    // intl-messageformat, que aqui solo llega como dependencia transitiva.
    // Un ICU mal escrito no da MISSING_MESSAGE sino un error de parseo
    // distinto, asi que no basta con que la clave exista: tiene que formatear.
    for (const [locale, messages] of locales) {
      const t = createTranslator({ locale, messages });
      const uno = t("pos.variantsAvailable", { count: 1 });
      const varios = t("pos.variantsAvailable", { count: 3 });

      expect(uno, locale).toContain("1");
      expect(varios, locale).toContain("3");
      // Singular y plural tienen que ser textos distintos: si alguien escribe
      // la clave sin `plural`, ambos saldrian iguales y en español quedaria
      // "1 variantes disponibles".
      expect(uno, locale).not.toBe(varios.replace("3", "1"));
    }
  });
});
