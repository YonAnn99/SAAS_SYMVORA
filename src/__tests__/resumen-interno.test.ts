import { describe, expect, it } from "vitest";
import {
  asuntoResumen,
  cargaAlta,
  construirCorreoNuevoNegocio,
  construirCorreoResumenInterno,
  detalleInactivo,
  diasDesde,
  haceCuanto,
  MAX_FILAS_SECCION,
  totalNovedades,
  UMBRAL_CARGA,
  type CargaSistema,
  type NegocioInactivo,
  type ResumenInterno,
} from "@/lib/resumen-interno";

const AHORA = new Date("2026-10-26T13:00:00Z"); // 7:00 en CDMX
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000).toISOString();

const vacio: ResumenInterno = {
  nuevos: [],
  incompletos: [],
  sin_productos: [],
  inactivos: [],
  por_vencer: [],
  pagos: [],
  vencidos_cancelados: [],
};

const inactivo = (extra: Partial<NegocioInactivo>): NegocioInactivo => ({
  negocio: "Tienda",
  giro: null,
  estatus: "trial",
  dueno: "Ana",
  correo: "ana@ejemplo.com",
  celular: "+525512345678",
  productos: 12,
  ventas: 3,
  ultima_venta: hace(24 * 9),
  creado_en: hace(24 * 20),
  ...extra,
});

describe("resumen interno", () => {
  it("sin novedades: el asunto lo dice y cada sección dice «Nada nuevo»", () => {
    const correo = construirCorreoResumenInterno(vacio, AHORA);
    expect(totalNovedades(vacio)).toBe(0);
    expect(correo.subject).toContain("sin novedades");
    expect(correo.html.match(/Nada nuevo\./g)).toHaveLength(7);
    expect(correo.text).toContain("El resumen corrió bien");
  });

  it("el asunto lleva los conteos que no son cero", () => {
    const r: ResumenInterno = {
      ...vacio,
      nuevos: [
        { negocio: "A", giro: null, dueno: null, correo: null, celular: null, origen: "google", creado_en: hace(2) },
        { negocio: "B", giro: null, dueno: null, correo: null, celular: null, origen: "email", creado_en: hace(3) },
      ],
      inactivos: [inactivo({})],
    };
    const asunto = asuntoResumen(r, AHORA);
    expect(asunto).toContain("2 nuevos");
    expect(asunto).toContain("1 inactivo");
    expect(asunto).not.toContain("pagos");
  });

  it("escapa lo que escribió el usuario", () => {
    const r: ResumenInterno = {
      ...vacio,
      incompletos: [
        { nombre: "<script>x</script>", negocio: "Tacos & Más", celular: null, correo: null, origen: "correo", creado_en: hace(5) },
      ],
    };
    const { html } = construirCorreoResumenInterno(r, AHORA);
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Tacos &amp; Más");
  });

  it("el celular abre WhatsApp con solo dígitos", () => {
    const r: ResumenInterno = { ...vacio, inactivos: [inactivo({ celular: "+52 55 1234 5678" })] };
    expect(construirCorreoResumenInterno(r, AHORA).html).toContain("https://wa.me/525512345678");
  });

  it("recorta cada sección a MAX_FILAS_SECCION y dice cuántos faltan", () => {
    const muchos = Array.from({ length: MAX_FILAS_SECCION + 4 }, (_, i) => inactivo({ negocio: `N${i}` }));
    const { html } = construirCorreoResumenInterno({ ...vacio, inactivos: muchos }, AHORA);
    expect(html).toContain("y 4 más.");
  });

  it("días sin vender y nunca ha vendido", () => {
    expect(diasDesde(hace(24 * 9 + 5), AHORA)).toBe(9);
    expect(detalleInactivo(inactivo({}), AHORA)).toBe("Sin vender hace 9 días · 12 productos");
    expect(
      detalleInactivo(inactivo({ ventas: 0, ultima_venta: null, creado_en: hace(24 * 4), productos: 1 }), AHORA)
    ).toBe("Nunca ha vendido (4 días de alta) · 1 producto");
  });

  it("hace cuánto: horas y días", () => {
    expect(haceCuanto(hace(5), AHORA)).toBe("hace 5 h");
    expect(haceCuanto(hace(24), AHORA)).toBe("hace 1 día");
    expect(haceCuanto(hace(50), AHORA)).toBe("hace 2 días");
  });
});

describe("termómetro de carga (migración 130)", () => {
  const carga = (extra: Partial<CargaSistema> = {}): CargaSistema => ({
    ventas_24h: 59,
    negocios_con_venta: 3,
    ventas_pico_minuto: 3,
    cajeros_pico_hora: 2,
    ...extra,
  });

  it("sin la clave (función anterior a la 130) no pinta la sección", () => {
    const correo = construirCorreoResumenInterno(vacio, AHORA);
    expect(correo.html).not.toContain("Carga del sistema");
    expect(correo.text).not.toContain("Carga del sistema");
  });

  it("con la clave pinta las cuatro cifras, sin alerta bajo el umbral", () => {
    const r = { ...vacio, carga: carga() };
    const correo = construirCorreoResumenInterno(r, AHORA);
    expect(correo.html).toContain("Carga del sistema");
    expect(correo.text).toContain("Pico de ventas en un minuto: 3");
    expect(correo.text).toContain("Pico de cajeros en una hora: 2");
    expect(cargaAlta(r.carga)).toBe(false);
    expect(correo.subject.startsWith("Resumen SYMVORA")).toBe(true);
    expect(correo.html).not.toContain("umbral de alerta");
  });

  it("alerta al llegar a cualquiera de los dos umbrales", () => {
    expect(cargaAlta(carga({ cajeros_pico_hora: UMBRAL_CARGA.cajerosPicoHora }))).toBe(true);
    expect(cargaAlta(carga({ ventas_pico_minuto: UMBRAL_CARGA.ventasPicoMinuto }))).toBe(true);
    expect(cargaAlta(carga({ cajeros_pico_hora: UMBRAL_CARGA.cajerosPicoHora - 1 }))).toBe(false);
    expect(cargaAlta(undefined)).toBe(false);

    const r = { ...vacio, carga: carga({ ventas_pico_minuto: 80 }) };
    const correo = construirCorreoResumenInterno(r, AHORA);
    expect(asuntoResumen(r, AHORA)).toMatch(/^⚠️ Carga alta · Resumen SYMVORA/);
    expect(correo.html).toContain("umbral de alerta");
    expect(correo.text).toContain("umbral de alerta");
  });

  it("la carga no cuenta como novedad", () => {
    expect(totalNovedades({ ...vacio, carga: carga({ ventas_24h: 500 }) })).toBe(0);
  });
});

describe("aviso de negocio nuevo", () => {
  it("incluye negocio, dueño, contacto y origen", () => {
    const correo = construirCorreoNuevoNegocio({
      negocio: "Miscelánea Lupita",
      giro: "ABARROTES",
      dueno: "Lupita Pérez",
      correo: "lupita@ejemplo.com",
      celular: "+525511112222",
      origen: "google",
      creado_en: hace(0),
    });
    expect(correo.subject).toBe("Nuevo negocio: Miscelánea Lupita");
    expect(correo.html).toContain("Lupita Pérez");
    expect(correo.html).toContain("https://wa.me/525511112222");
    expect(correo.html).toContain("Google");
    expect(correo.text).toContain("Correo: lupita@ejemplo.com");
  });
});

describe("método de pago", () => {
  it("traduce el enum y deja pasar lo desconocido", async () => {
    const { etiquetaMetodoPago } = await import("@/lib/resumen-interno");
    expect(etiquetaMetodoPago("card")).toBe("Tarjeta");
    expect(etiquetaMetodoPago("spei")).toBe("SPEI");
    expect(etiquetaMetodoPago("otro")).toBe("otro");
    expect(etiquetaMetodoPago(null)).toBe("—");
  });
});
