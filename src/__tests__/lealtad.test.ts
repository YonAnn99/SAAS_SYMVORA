import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ICONOS_SELLO,
  cambioDeTarjeta,
  codigoAgrupado,
  codigoDesdeEscaneo,
  aplicarPremio,
  contraste,
  esInactiva,
  iconoDeSello,
  inicioDeSemana,
  luminancia,
  paletaDeTarjeta,
  panelLealtad,
  progreso,
  textoProgreso,
  urlTarjeta,
} from "@/features/lealtad/lealtad";

describe("progreso de la tarjeta", () => {
  it("cuenta llenos, faltantes y porcentaje", () => {
    expect(progreso(8, 10)).toEqual({ llenos: 8, meta: 10, faltan: 2, premiosDisponibles: 0, pct: 80 });
  });

  it("con la meta alcanzada hay un premio y la cuadricula va llena", () => {
    expect(progreso(10, 10)).toMatchObject({ llenos: 10, faltan: 0, premiosDisponibles: 1, pct: 100 });
  });

  it("un ajuste puede dejar sellos de mas: dos premios, cuadricula llena", () => {
    expect(progreso(23, 10)).toMatchObject({ llenos: 10, premiosDisponibles: 2, pct: 100 });
  });

  it("valores raros no rompen la cuenta", () => {
    expect(progreso(-3, 0)).toEqual({ llenos: 0, meta: 1, faltan: 1, premiosDisponibles: 0, pct: 0 });
  });

  it("texto para el cliente", () => {
    expect(textoProgreso(8, 10, "Café grande gratis")).toBe("Llevas 8 de 10 para tu Café grande gratis");
    expect(textoProgreso(10, 10, "Café grande gratis")).toBe("¡Ya tienes tu Café grande gratis!");
  });
});

describe("codigoDesdeEscaneo", () => {
  it("lee la URL del QR, con idioma y dominio", () => {
    expect(codigoDesdeEscaneo("https://app.symvora.com.mx/es/tarjeta/6XAHQCNCHPZF")).toBe("6XAHQCNCHPZF");
    expect(codigoDesdeEscaneo("http://localhost:3000/en/tarjeta/6xahqcnchpzf?x=1")).toBe("6XAHQCNCHPZF");
  });

  it("lee el codigo solo, en minusculas o agrupado", () => {
    expect(codigoDesdeEscaneo("6xahqcnchpzf")).toBe("6XAHQCNCHPZF");
    expect(codigoDesdeEscaneo(" 6XAH-QCNC-HPZF ")).toBe("6XAHQCNCHPZF");
  });

  it("un codigo de barras de producto NO es una tarjeta", () => {
    expect(codigoDesdeEscaneo("7501055309912")).toBeNull();
    expect(codigoDesdeEscaneo("ARR-001")).toBeNull();
    // Letras que el alfabeto excluye (0, O, 1, I, L, U).
    expect(codigoDesdeEscaneo("OOOOOOOOOOOO")).toBeNull();
    expect(codigoDesdeEscaneo("")).toBeNull();
    expect(codigoDesdeEscaneo(null)).toBeNull();
  });

  it("se agrupa de 4 en 4 para leerlo", () => {
    expect(codigoAgrupado("6XAHQCNCHPZF")).toBe("6XAH-QCNC-HPZF");
  });
});

describe("urlTarjeta", () => {
  it("arma el enlace publico con idioma", () => {
    expect(urlTarjeta("6XAHQCNCHPZF", "es", "https://app.symvora.com.mx/")).toBe(
      "https://app.symvora.com.mx/es/tarjeta/6XAHQCNCHPZF"
    );
    expect(urlTarjeta("6XAHQCNCHPZF", "fr", "https://x.mx")).toBe("https://x.mx/es/tarjeta/6XAHQCNCHPZF");
  });
});

describe("paletaDeTarjeta", () => {
  it("clara y oscura con el acento del negocio", () => {
    expect(paletaDeTarjeta("clara", "#10b981")).toMatchObject({ fondo: "#FFFFFF", acento: "#10B981" });
    expect(paletaDeTarjeta("oscura", "#10B981")).toMatchObject({ fondo: "#0F172A", acento: "#10B981" });
  });

  it("sin acento valido usa el azul SYMVORA", () => {
    expect(paletaDeTarjeta("clara", null).acento).toBe("#1E3A8A");
    expect(paletaDeTarjeta("clara", "azul").acento).toBe("#1E3A8A");
  });

  it("un acento casi negro se aclara en la oscura; uno casi blanco se oscurece en la clara", () => {
    const oscura = paletaDeTarjeta("oscura", "#0A0A0A");
    expect(luminancia(oscura.acento)).toBeGreaterThan(luminancia("#0A0A0A"));
    const clara = paletaDeTarjeta("clara", "#FAFAFA");
    expect(luminancia(clara.acento)).toBeLessThan(luminancia("#FAFAFA"));
  });

  it("el texto sobre el acento contrasta", () => {
    expect(paletaDeTarjeta("clara", "#1E3A8A").sobreAcento).toBe("#FFFFFF");
    expect(paletaDeTarjeta("oscura", "#FDE047").sobreAcento).toBe("#0F172A");
  });
});

describe.each(["115_tarjetas_lealtad.sql", "120_lealtad_icono_y_fondo.sql"])(
  "contrato de la tarjeta publica (%s)",
  (archivo) => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations", archivo), "utf8");
    const publica = sql.slice(sql.indexOf("FUNCTION public.tarjeta_publica"));
    const cuerpo = publica.slice(0, publica.indexOf("$$;", publica.indexOf("AS $$")));

    it("no expone telefono, correo ni montos del cliente", () => {
      for (const campo of ["telefono", "email", "direccion", "saldo_pendiente", "limite_credito", "rfc", "total"]) {
        expect(cuerpo, campo).not.toMatch(new RegExp(`\\b${campo}\\b`));
      }
    });

    it("del cliente solo da el primer nombre", () => {
      expect(cuerpo).toMatch(/split_part\(btrim\(c\.nombre\), ' ', 1\)/);
    });

    it("solo la pueden llamar anon y authenticated", () => {
      expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.tarjeta_publica\(text\) FROM PUBLIC;/);
      expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.tarjeta_publica\(text\) TO anon, authenticated;/);
    });
  }
);

describe("icono del sello (migracion 120)", () => {
  it("la lista del selector es la misma que el CHECK de la base", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/120_lealtad_icono_y_fondo.sql"), "utf8");
    const check = sql.slice(sql.indexOf("icono_sello IN ("), sql.indexOf("))", sql.indexOf("icono_sello IN (")));
    const enBase = [...check.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(ICONOS_SELLO.map((i) => i.valor).sort()).toEqual(enBase);
  });

  it("un valor vacio o desconocido cae en la palomita", () => {
    expect(iconoDeSello("cafe")).toBe("cafe");
    expect(iconoDeSello(undefined)).toBe("check");
    expect(iconoDeSello("unicornio")).toBe("check");
  });
});

describe("paletaDeTarjeta con fondo propio", () => {
  it("sobre un fondo claro el texto es oscuro, y al reves", () => {
    const crema = paletaDeTarjeta("oscura", "#B45309", "#FEF3C7");
    expect(crema.fondo).toBe("#FEF3C7");
    expect(crema.oscuro).toBe(false);
    expect(contraste(crema.texto, crema.fondo)).toBeGreaterThan(7);

    const cafe = paletaDeTarjeta("clara", "#F59E0B", "#3B2416");
    expect(cafe.oscuro).toBe(true);
    expect(contraste(cafe.texto, cafe.fondo)).toBeGreaterThan(7);
  });

  it("un acento que se pierde contra el fondo se corrige", () => {
    const c = paletaDeTarjeta("clara", "#064E3B", "#064E3B");
    expect(contraste(c.acento, c.fondo)).toBeGreaterThanOrEqual(1.8);
  });

  it("un fondo invalido usa la paleta, como antes", () => {
    expect(paletaDeTarjeta("oscura", null, "rojo")).toEqual(paletaDeTarjeta("oscura", null));
    expect(paletaDeTarjeta("clara", null).oscuro).toBe(false);
    expect(paletaDeTarjeta("oscura", null).oscuro).toBe(true);
  });
});

describe("cambioDeTarjeta (tarjeta publica viva)", () => {
  it("la primera vez en el celular no anima nada", () => {
    expect(cambioDeTarjeta(null, { sellos: 4, canjes: 0 }, 6)).toEqual({ nuevos: [], completa: false });
  });

  it("los sellos nuevos rebotan", () => {
    expect(cambioDeTarjeta({ sellos: 3, canjes: 0 }, { sellos: 5, canjes: 0 }, 6)).toEqual({ nuevos: [3, 4], completa: false });
  });

  it("al completar la tarjeta hay celebracion, una sola vez", () => {
    expect(cambioDeTarjeta({ sellos: 5, canjes: 0 }, { sellos: 6, canjes: 0 }, 6)).toEqual({ nuevos: [5], completa: true });
    expect(cambioDeTarjeta({ sellos: 6, canjes: 0 }, { sellos: 6, canjes: 0 }, 6)).toEqual({ nuevos: [], completa: false });
  });

  it("tras un canje la cuenta empieza de nuevo", () => {
    expect(cambioDeTarjeta({ sellos: 6, canjes: 0 }, { sellos: 0, canjes: 1 }, 6)).toEqual({ nuevos: [], completa: false });
    expect(cambioDeTarjeta({ sellos: 6, canjes: 0 }, { sellos: 1, canjes: 1 }, 6)).toEqual({ nuevos: [0], completa: false });
  });

  it("un ajuste que quita sellos no anima", () => {
    expect(cambioDeTarjeta({ sellos: 4, canjes: 0 }, { sellos: 2, canjes: 0 }, 6)).toEqual({ nuevos: [], completa: false });
  });
});

describe("panelLealtad", () => {
  // Viernes 16 de octubre de 2026, mediodia (hora local).
  const ahora = new Date(2026, 9, 16, 12);
  const hace = (dias: number) => new Date(ahora.getTime() - dias * 86_400_000).toISOString();

  it("la semana empieza en lunes", () => {
    const lunes = inicioDeSemana(ahora);
    expect(lunes.getDay()).toBe(1);
    expect(lunes.getDate()).toBe(12);
    expect(inicioDeSemana(new Date(2026, 9, 18)).getDate()).toBe(12); // domingo
  });

  it("cuenta a un sello, con premio e inactivas solo en tarjetas activas", () => {
    const tarjetas = [
      { sellos: 9, activa: true, ultima_visita: hace(2) },
      { sellos: 9, activa: false, ultima_visita: hace(2) },
      { sellos: 10, activa: true, ultima_visita: hace(1) },
      { sellos: 3, activa: true, ultima_visita: hace(45) },
      { sellos: 0, activa: true, ultima_visita: null },
    ];
    const p = panelLealtad(tarjetas, [], 10, ahora);
    expect(p.aUnSello).toBe(1);
    expect(p.conPremio).toBe(1);
    expect(p.inactivas).toBe(1);
    expect(p.diasEntreVisitas).toBeNull();
    expect(esInactiva(tarjetas[4], ahora)).toBe(false);
  });

  it("frecuencia: promedio entre visitas del mismo cliente; sellos por semana", () => {
    const sellos = [
      { tarjeta_id: "a", creado_en: hace(0) },
      { tarjeta_id: "a", creado_en: hace(4) },
      { tarjeta_id: "a", creado_en: hace(10) },
      { tarjeta_id: "b", creado_en: hace(1) },
      { tarjeta_id: "c", creado_en: hace(200) }, // fuera de las 8 semanas
    ];
    const p = panelLealtad([], sellos, 10, ahora);
    expect(p.diasEntreVisitas).toBe(5);
    expect(p.recurrentes).toBe(1);
    expect(p.semanas).toHaveLength(8);
    expect(p.semanas[7].sellos).toBe(3); // lunes 12 a viernes 16: hoy, hace 1 y hace 4
    expect(p.semanas[6].sellos).toBe(1); // hace 10 dias: semana del lunes 5
    expect(p.semanas.reduce((s, w) => s + w.sellos, 0)).toBe(4);
  });
});

describe("aplicarPremio (mismo algoritmo que complete_sale_lealtad)", () => {
  const linea = (productId: string, precioUnitario: number, cantidad = 1, descuento = 0, varianteId: string | null = null) => ({
    productId,
    varianteId,
    precioUnitario,
    cantidad,
    descuento,
  });

  it("producto: una unidad gratis del renglon del premio", () => {
    const r = aplicarPremio([linea("pan", 10, 3), linea("cafe", 22, 2)], {
      tipo: "producto",
      productoId: "cafe",
      varianteId: null,
      valor: null,
    });
    expect(r.monto).toBe(22);
    expect(r.items[1].descuento).toBe(22);
    expect(r.items[0].descuento).toBe(0);
  });

  it("producto con variante: solo el renglon de esa variante", () => {
    const r = aplicarPremio([linea("cafe", 22, 1, 0, "chico"), linea("cafe", 35, 1, 0, "grande")], {
      tipo: "producto",
      productoId: "cafe",
      varianteId: "grande",
      valor: null,
    });
    expect(r.monto).toBe(35);
    expect(r.items[1].descuento).toBe(35);
  });

  it("producto que no esta en el carrito: lo avisa sin tocar nada", () => {
    const items = [linea("pan", 10)];
    const r = aplicarPremio(items, { tipo: "producto", productoId: "cafe", varianteId: null, valor: null });
    expect(r).toEqual({ items, monto: 0, faltaProducto: true });
  });

  it("producto con descuento manual: solo lo que queda del renglon", () => {
    const r = aplicarPremio([linea("cafe", 22, 1, 5)], { tipo: "producto", productoId: "cafe", varianteId: null, valor: null });
    expect(r.monto).toBe(17);
    expect(r.items[0].descuento).toBe(22);
  });

  it("monto: llena los renglones en orden y no pasa del subtotal", () => {
    const r = aplicarPremio([linea("a", 30), linea("b", 40)], { tipo: "monto", productoId: null, varianteId: null, valor: 50 });
    expect(r.monto).toBe(50);
    expect(r.items.map((i) => i.descuento)).toEqual([30, 20]);
    const tope = aplicarPremio([linea("a", 30)], { tipo: "monto", productoId: null, varianteId: null, valor: 50 });
    expect(tope.monto).toBe(30);
  });

  it("porcentaje: sobre el subtotal menos el descuento manual", () => {
    const r = aplicarPremio([linea("a", 100, 1, 10)], { tipo: "porcentaje", productoId: null, varianteId: null, valor: 15 });
    expect(r.monto).toBe(13.5);
    expect(r.items[0].descuento).toBe(23.5);
  });
});
