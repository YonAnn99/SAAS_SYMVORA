import { describe, expect, it } from "vitest";
import {
  NAVIGATION,
  VISIBLE_NAVIGATION,
  filterNavigation,
  moduleLabelKeyForPath,
  stripLocale,
} from "@/lib/navigation";
import { tutorialSteps } from "@/components/tutorial/steps-data";
import esMessages from "@/messages/es.json";
import enMessages from "@/messages/en.json";

/** Lee una clave i18n con puntos ("layout.dashboard") sobre el JSON. */
function resolverClave(clave: string, mensajes: object = esMessages): unknown {
  return clave
    .split(".")
    .reduce<unknown>(
      (nodo, parte) =>
        nodo && typeof nodo === "object"
          ? (nodo as Record<string, unknown>)[parte]
          : undefined,
      mensajes
    );
}

describe("orden del menú", () => {
  it("es exactamente el que pidió el dueño del negocio", () => {
    // Se fija explicitamente porque el menu ya se desordeno una vez por
    // acumulacion: cada modulo nuevo se añadia al final. Si alguien vuelve a
    // hacerlo, este test lo dice en vez de que se note en produccion.
    expect(VISIBLE_NAVIGATION.map((i) => i.href)).toEqual([
      "/dashboard",
      "/pos",
      "/products",
      "/customers",
      "/finances",
      "/reports",
      "/purchases",
      "/purchase-orders",
      "/activity",
      "/users",
      "/branches",
      "/settings/payments",
      "/billing",
      "/suggestions",
      "/settings",
    ]);
  });

  it("no hay rutas repetidas", () => {
    const hrefs = NAVIGATION.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("toda clave i18n existe en es.json", () => {
    for (const item of NAVIGATION) {
      expect(typeof resolverClave(item.name), item.name).toBe("string");
    }
  });

  it("el módulo CFDI sigue oculto, no borrado", () => {
    // Decision de negocio del 2026-09-05: se apago el acceso sin quitar codigo.
    // Reactivarlo es quitar `hidden`, asi que la entrada debe seguir ahi.
    const facturas = NAVIGATION.find((i) => i.href === "/facturas");
    expect(facturas).toBeDefined();
    expect(facturas?.hidden).toBe(true);
    expect(VISIBLE_NAVIGATION).not.toContain(facturas);
  });
});

describe("título del encabezado (moduleLabelKeyForPath)", () => {
  it("cada ruta del menú resuelve a SU propia etiqueta", () => {
    // El encabezado usaba `path.includes(ruta)` sobre un objeto en orden de
    // declaracion. Este test es la red que faltaba.
    for (const item of VISIBLE_NAVIGATION) {
      expect(moduleLabelKeyForPath(item.href), item.href).toBe(item.name);
    }
  });

  it("/settings/payments dice Métodos de pago, no Configuración", () => {
    // EL BUG CONCRETO: `/settings` es subcadena de `/settings/payments` y
    // estaba declarado antes, asi que ganaba. Se resuelve por prefijo mas
    // largo, no por orden.
    expect(moduleLabelKeyForPath("/settings/payments")).toBe("layout.payments");
    expect(moduleLabelKeyForPath("/settings")).toBe("layout.settings");
  });

  it("Clientes y Sugerencias ya no caen al fallback", () => {
    // Faltaban en el mapa del encabezado y mostraban "Dashboard".
    expect(moduleLabelKeyForPath("/customers")).toBe("layout.customers");
    expect(moduleLabelKeyForPath("/suggestions")).toBe("layout.suggestions");
  });

  it("funciona con y sin prefijo de idioma", () => {
    for (const ruta of ["/es/customers", "/en/customers", "/customers"]) {
      expect(moduleLabelKeyForPath(ruta), ruta).toBe("layout.customers");
    }
  });

  it("las subrutas heredan el título de su módulo", () => {
    expect(moduleLabelKeyForPath("/es/facturas/config")).toBe("layout.facturas");
    expect(moduleLabelKeyForPath("/es/products/import")).toBe("layout.products");
  });

  it("las rutas heredadas sin menú conservan título propio", () => {
    // Redirecciones a /products?tab=… que se dejaron vivas por los enlaces
    // guardados: no salen en el menu pero deben identificarse.
    expect(moduleLabelKeyForPath("/variants")).toBe("layout.variants");
    expect(moduleLabelKeyForPath("/lots")).toBe("layout.lots");
    expect(moduleLabelKeyForPath("/inventory-adjustments")).toBe(
      "layout.adjustments"
    );
  });

  it("una ruta desconocida devuelve null, no un módulo inventado", () => {
    // El fallback anterior era "Dashboard": afirmaba un modulo equivocado.
    expect(moduleLabelKeyForPath("/ruta-que-no-existe")).toBeNull();
  });

  it("toda etiqueta de título existe en es.json Y en en.json", () => {
    // El mapa viejo tenia el texto en español a pelo, asi que en /en el
    // encabezado salia en español.
    const rutas = [
      ...VISIBLE_NAVIGATION.map((i) => i.href),
      "/facturas",
      "/variants",
      "/lots",
      "/inventory-adjustments",
    ];
    for (const ruta of rutas) {
      const clave = moduleLabelKeyForPath(ruta);
      expect(clave, ruta).not.toBeNull();
      expect(typeof resolverClave(clave!, esMessages), `${clave} en es`).toBe("string");
      expect(typeof resolverClave(clave!, enMessages), `${clave} en en`).toBe("string");
    }
  });
});

describe("stripLocale", () => {
  it("quita el prefijo de idioma", () => {
    expect(stripLocale("/es/dashboard")).toBe("/dashboard");
    expect(stripLocale("/en/pos")).toBe("/pos");
  });

  it("no mutila rutas que empiezan por esas letras", () => {
    // La version anterior usaba /^\/(es|en)/ sin anclar al separador, asi que
    // una ruta como /entries habria quedado en /tries.
    expect(stripLocale("/entries")).toBe("/entries");
    expect(stripLocale("/estado")).toBe("/estado");
  });

  it("la raíz del idioma queda como /", () => {
    expect(stripLocale("/es")).toBe("/");
  });
});

describe("selectores del tutorial contra el orden del menú", () => {
  // El tutorial localiza enlaces con `document.querySelector`, que devuelve la
  // PRIMERA coincidencia del documento. Un selector `*=` sobre una ruta que es
  // prefijo de otra resuelve al enlace equivocado segun el orden del menu — es
  // justo lo que habria pasado con /settings al mover Metodos de pago delante
  // de Configuracion.
  const selectoresDeEnlace = tutorialSteps
    .map((p) => p.targetSelector)
    .filter((s): s is string => Boolean(s) && s!.startsWith("a[href"));

  it("ningún selector con `*=` apunta a una ruta que sea prefijo de otra del menú", () => {
    const hrefs = VISIBLE_NAVIGATION.map((i) => i.href);

    for (const selector of selectoresDeEnlace) {
      const coincidencia = selector.match(/a\[href\*="([^"]+)"\]/);
      if (!coincidencia) continue; // ya esta anclado con $= o ^=
      const ruta = coincidencia[1];

      const ambiguas = hrefs.filter((h) => h.includes(ruta));
      expect(
        ambiguas.length,
        `El selector ${selector} coincide con ${ambiguas.length} rutas del menú ` +
          `(${ambiguas.join(", ")}). querySelector se queda con la primera, que ` +
          `depende del orden. Ánclalo con $= o usa un id.`
      ).toBe(1);
    }
  });

  it("el paso de Configuración está anclado y no puede resolver a Métodos de pago", () => {
    const paso = tutorialSteps.find((p) => p.moduleKey === "layout.settings");
    expect(paso?.targetSelector).toBe('a[href$="/settings"]');

    // La razon de ser del anclaje: en el menu, Metodos de pago va antes.
    const hrefs = VISIBLE_NAVIGATION.map((i) => i.href);
    expect(hrefs.indexOf("/settings/payments")).toBeLessThan(
      hrefs.indexOf("/settings")
    );
  });
});

describe("filterNavigation", () => {
  const todo = () => true;
  const nada = () => false;

  it("un SUPER_ADMIN con todos los permisos ve el menú completo", () => {
    // Completo = con varias sucursales. Sucursales es el unico modulo que
    // depende de DATOS y no solo de permisos.
    expect(filterNavigation("SUPER_ADMIN", todo, { multiSucursal: true })).toHaveLength(
      VISIBLE_NAVIGATION.length
    );
  });

  it("Sucursales NO aparece con un solo local, ni para el dueño", () => {
    // El dueño de una tienda de un solo local tiene el permiso, pero un modulo
    // de sucursales vacio solo seria ruido en su menu.
    const conUno = filterNavigation("SUPER_ADMIN", todo).map((i) => i.href);
    expect(conUno).not.toContain("/branches");
    // Y sin la opcion explicita es lo mismo que "un solo local": nadie tiene
    // que acordarse de pasarla para que el negocio pequeño no lo vea.
    expect(filterNavigation("SUPER_ADMIN", todo, {}).map((i) => i.href)).not.toContain("/branches");
  });

  it("con varios locales, Sucursales aparece solo a quien tiene el permiso", () => {
    const soloBranches = (p: string) => p === "org.manage_branches";
    expect(
      filterNavigation("ORG_ADMIN", soloBranches, { multiSucursal: true }).map((i) => i.href)
    ).toContain("/branches");
    // Varios locales NO basta: sin `org.manage_branches` (un ORG_ADMIN de
    // fabrica, un cajero) no se ve.
    const sinBranches = (p: string) => p !== "org.manage_branches";
    expect(
      filterNavigation("ORG_ADMIN", sinBranches, { multiSucursal: true }).map((i) => i.href)
    ).not.toContain("/branches");
  });

  it("nunca devuelve módulos ocultos, ni con todos los permisos", () => {
    const visibles = filterNavigation("SUPER_ADMIN", todo);
    expect(visibles.some((i) => i.href === "/facturas")).toBe(false);
  });

  // Los 5 permisos reales del rol CAJERO, verificados contra `role_permissions`
  // en produccion. Modelar el caso real importa: con "ningun permiso" el POS
  // desaparece (exige `sales.create`) y el test daria una falsa alarma.
  //
  // `cash.manage` se añadio en la migracion 062: el cajero abre y cierra SU
  // propia caja. Sin el, el POS lo bloquearia para siempre, porque desde ese
  // mismo cambio vender exige tener caja abierta.
  const PERMISOS_CAJERO = [
    "billing.view",
    "cash.manage",
    "inventory.view",
    "sales.create",
    "sales.view_reports",
  ];
  const comoCajero = (permiso: string) => PERMISOS_CAJERO.includes(permiso);

  it("un CAJERO ve exactamente su subconjunto de siempre", () => {
    // NO REGRESION: este es el menu que un cajero tiene hoy. Si cambia, alguien
    // gano o perdio acceso sin querer al tocar el orden o los permisos.
    expect(filterNavigation("CAJERO", comoCajero).map((i) => i.href)).toEqual([
      "/dashboard",
      "/pos",
      "/products",
      "/customers",
      // Finanzas SÍ aparece desde la migración 062. No es una fuga de permisos:
      // la pantalla solo muestra la caja del propio usuario, y el cajero tiene
      // que entrar para abrirla o el POS no lo deja vender.
      "/finances",
      "/reports",
      "/activity",
      "/suggestions",
    ]);
  });

  it("un CAJERO NO ve los módulos de administración", () => {
    const visibles = filterNavigation("CAJERO", comoCajero).map((i) => i.href);
    // `/finances` ya NO está en esta lista: el cajero entra a su propia caja.
    // Lo que sigue fuera de su alcance es todo lo demás.
    for (const ruta of [
      "/users",
      "/billing",
      "/settings",
      "/settings/payments",
      "/purchases",
      "/purchase-orders",
    ]) {
      expect(visibles, `${ruta} no debe verse`).not.toContain(ruta);
    }
  });

  it("con el rol sin resolver (null) no se filtra por rol a favor de nadie", () => {
    // Mientras `role` es null, `hasRole` da false: quien llame debe esperar a
    // `loading`. Se fija el comportamiento para que nadie asuma lo contrario.
    const visibles = filterNavigation(null, nada).map((i) => i.href);
    expect(visibles).not.toContain("/users");
    expect(visibles).toContain("/dashboard");
  });
});
