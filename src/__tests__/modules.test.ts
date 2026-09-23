import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GRANTABLE_MODULES,
  GRANTABLE_PERMISSIONS,
  MODULES,
  permissionForPath,
} from "@/lib/modules";

describe("catálogo de módulos", () => {
  it("Usuarios y Facturación NO son concedibles", () => {
    // Conceder Usuarios permitiría a esa persona ascender a otros y a sí
    // misma; Facturación permite cancelar la suscripción del negocio.
    // Decisión del usuario (2026-09-11), respaldada además por el CHECK de la
    // migración 055.
    for (const key of ["users", "billing"]) {
      const mod = MODULES.find((m) => m.key === key)!;
      expect(mod.grantable, `${key} no debe ser concedible`).toBe(false);
      expect(mod.notGrantableReason, `${key} debe explicar por qué`).toBeTruthy();
    }
  });

  it("ningún permiso que reparta poder es concedible", () => {
    for (const p of [
      "org.manage_members",
      "org.manage_members_write",
      "org.delete",
      "subscription.manage",
    ]) {
      expect(GRANTABLE_PERMISSIONS.has(p), `${p} no debe ser concedible`).toBe(false);
    }
  });

  it("todo módulo no concedible explica el motivo", () => {
    // Sin motivo, la restricción parece arbitraria y alguien la quitará.
    for (const mod of MODULES.filter((m) => !m.grantable)) {
      expect(mod.notGrantableReason, `${mod.key} sin motivo`).toBeTruthy();
    }
  });

  it("las claves de módulo son únicas", () => {
    const keys = MODULES.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ningún permiso aparece en dos módulos concedibles", () => {
    // ESTE es el invariante que faltaba y que causó el error 500:
    // `purchases` y `purchaseOrders` compartían `purchases.manage`, así que al
    // activar ambos switches el diálogo mandaba el permiso duplicado y el
    // INSERT chocaba con UNIQUE (tenant_id, user_id, permission).
    //
    // Dos switches que controlan el mismo permiso son además engañosos: si
    // activas uno y desactivas el otro, el resultado es indefinido. Si dos
    // pantallas comparten permiso, deben ser UN módulo con varias rutas.
    const permisos = GRANTABLE_MODULES.map((m) => m.permission);
    const duplicados = permisos.filter((p, i) => permisos.indexOf(p) !== i);
    expect(duplicados, `permisos duplicados: ${duplicados.join(", ")}`).toEqual([]);
  });

  it("las rutas no se solapan entre módulos distintos", () => {
    // Una misma ruta en dos módulos haría que permissionForPath dependiera del
    // orden del array, que es justo el tipo de fragilidad que causó el bug.
    const rutas = MODULES.flatMap((m) => m.paths);
    expect(new Set(rutas).size).toBe(rutas.length);
  });
});

describe("permissionForPath", () => {
  it("deja abiertas las rutas que hoy ve todo el equipo", () => {
    // Prueba de NO REGRESIÓN: estas rutas no tienen `minRole` en el sidebar,
    // así que deben seguir sin exigir permiso. Si alguna empezara a pedirlo,
    // los cajeros perderían acceso de golpe.
    for (const ruta of ["/customers", "/suggestions"]) {
      expect(permissionForPath(ruta), `${ruta} debe seguir abierta`).toBeNull();
    }
  });

  it("dashboard, reportes y bitácora piden permiso (migración 088)", () => {
    // Antes el dashboard y la bitácora estaban abiertos a todo el equipo y el
    // cajero veía las ventas del mes, la ganancia y quién hizo qué.
    expect(permissionForPath("/dashboard")).toBe("sales.view_reports");
    expect(permissionForPath("/reports")).toBe("sales.view_reports");
    expect(permissionForPath("/activity")).toBe("activity.view");
  });

  it("el CATÁLOGO de productos sigue abierto a todo el equipo", () => {
    // /products es lo que el cajero consulta para vender. Mapearlo a
    // inventory.manage dejaría a los cajeros sin catálogo.
    expect(permissionForPath("/products")).toBeNull();
    expect(MODULES.find((m) => m.key === "inventory")!.permission).toBe("inventory.manage");
  });

  it("las LISTAS DE PRECIOS exigen inventory.manage pese a colgar de /products", () => {
    // EL DEFECTO QUE EVITA: `permissionForPath` compara por prefijo, y
    // `/products` es `permission: null` a propósito. Si esta ruta no estuviera
    // declarada en el módulo `inventory`, heredaría ese `null` y CUALQUIER
    // CAJERO podría entrar a definir los precios de venta del negocio.
    //
    // Funciona porque la función ordena de ruta más larga a más corta: la
    // específica gana a `/products`.
    expect(permissionForPath("/products/price-lists")).toBe("inventory.manage");
    expect(permissionForPath("/products/price-lists/abc-123")).toBe("inventory.manage");
    // Y la pantalla de al lado no se contamina.
    expect(permissionForPath("/products")).toBeNull();
  });

  it("protege las rutas de administración con su permiso", () => {
    // `/finances` exige `cash.manage`, NO `finances.manage`: desde la migración
    // 062 el cajero necesita entrar a esa pantalla para abrir su propia caja,
    // sin la cual el POS lo bloquea. La pantalla ya es por usuario (solo
    // muestra la caja de quien la abre). `finances.manage` sigue existiendo y
    // gobierna en la base lo que va más allá de la caja propia.
    expect(permissionForPath("/finances")).toBe("cash.manage");
    expect(permissionForPath("/purchases")).toBe("purchases.manage");
    expect(permissionForPath("/settings")).toBe("org.manage_settings");
    expect(permissionForPath("/users")).toBe("org.manage_members");
    expect(permissionForPath("/billing")).toBe("subscription.manage");
  });

  it("/purchases y /purchase-orders comparten módulo pero ambas quedan protegidas", () => {
    // Son UN módulo con dos rutas. "/purchase-orders" no coincide por prefijo
    // con "/purchases", así que sin su ruta explícita quedaría abierta.
    expect(permissionForPath("/purchases")).toBe("purchases.manage");
    expect(permissionForPath("/purchase-orders")).toBe("purchases.manage");

    const compras = MODULES.filter((m) => m.permission === "purchases.manage");
    expect(compras, "debe haber un solo módulo de compras").toHaveLength(1);
    expect(compras[0].paths).toEqual(["/purchases", "/purchase-orders"]);
  });

  it("CFDI y Cancelar ventas ya no figuran como módulos", () => {
    // CFDI está descartado por ahora; sales.void no lo usa ninguna pantalla
    // (el permiso sigue en role_permissions gobernando la RLS de ventas).
    expect(MODULES.find((m) => m.key === "facturas")).toBeUndefined();
    expect(MODULES.find((m) => m.key === "salesVoid")).toBeUndefined();
    // /facturas cae al chequeo por rol del middleware, como antes.
    expect(permissionForPath("/facturas")).toBeNull();
  });

  it("resuelve subrutas por el prefijo más específico", () => {
    expect(permissionForPath("/settings/payments")).toBe("org.manage_settings");
    expect(permissionForPath("/finances/algo/mas")).toBe("cash.manage");
  });

  it("una ruta desconocida queda abierta, no bloqueada", () => {
    // Fallar hacia "abierto" es lo correcto aquí: las escrituras están
    // protegidas por RLS de todos modos, y bloquear por defecto dejaría
    // inaccesible cualquier página nueva hasta que alguien la mapee.
    expect(permissionForPath("/ruta-que-no-existe")).toBeNull();
  });
});

describe("GRANTABLE_MODULES", () => {
  it("incluye los módulos operativos que el dueño querría repartir", () => {
    const keys = GRANTABLE_MODULES.map((m) => m.key);
    for (const esperado of ["inventory", "purchases", "finances", "reports", "settings"]) {
      expect(keys, `falta ${esperado}`).toContain(esperado);
    }
  });

  it("todo módulo concedible tiene un permiso asociado", () => {
    // Un módulo concedible sin permiso no se podría enforcar en la base de
    // datos: el switch no haría nada.
    for (const mod of GRANTABLE_MODULES) {
      expect(mod.permission, `${mod.key} concedible sin permiso`).toBeTruthy();
    }
  });
});

describe("los permisos concedibles caben en el CHECK de la base", () => {
  // EL DEFECTO QUE EVITA, y que estuvo vivo meses sin que nadie lo notara:
  // `modules.ts` dice qué switches se pueden tocar, pero quien decide si la
  // fila entra es un CHECK en `user_permission_overrides`. Si un permiso está
  // en uno y no en el otro, el switch aparece en el diálogo y **revienta al
  // guardar** — no falla al pintar, falla al usarlo, que es cuando el dueño ya
  // creía haberlo concedido.
  //
  // Pasó con `cash.manage`: la migración 062 cambió el módulo "Finanzas" de
  // `finances.manage` a `cash.manage` y nadie tocó el CHECK. Estuvo roto desde
  // entonces hasta la 077.
  //
  // Se lee el CHECK de los ficheros de migración y se toma el del número MÁS
  // ALTO que lo defina, porque se redefine entero cada vez que se toca (055 ->
  // 070 -> 077). Así el test no caduca la próxima vez.
  const CONSTRAINT = "user_permission_overrides_permission_check";
  const dir = join(process.cwd(), "supabase", "migrations");

  function permisosDelCheck(): string[] {
    const ficheros = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .reverse();

    for (const fichero of ficheros) {
      const sql = readFileSync(join(dir, fichero), "utf8");
      // Solo la DEFINICIÓN (ADD CONSTRAINT), nunca el DROP, que también nombra
      // la restricción y dejaría el test leyendo una lista vacía.
      const i = sql.indexOf(`ADD CONSTRAINT ${CONSTRAINT}`);
      if (i === -1) continue;
      const bloque = sql.slice(i, sql.indexOf(";", i));
      return [...bloque.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]);
    }
    throw new Error(`Ninguna migración define ${CONSTRAINT}`);
  }

  it("la lectura del SQL funciona de verdad y no devuelve una lista vacía", () => {
    // Sin esto, un cambio de formato en la migración haría que el regex dejara
    // de casar y el test de abajo pasaría comparando contra nada.
    const permisos = permisosDelCheck();
    expect(permisos.length).toBeGreaterThan(10);
    expect(permisos).toContain("org.manage_settings");
  });

  it("TODO permiso concedible está admitido por el CHECK", () => {
    const admitidos = new Set(permisosDelCheck());
    for (const permiso of GRANTABLE_PERMISSIONS) {
      expect(
        admitidos.has(permiso),
        `"${permiso}" es concedible en modules.ts pero el CHECK de la base lo rechaza: su switch fallaría al guardar`
      ).toBe(true);
    }
  });

  it("los dos que se arreglaron o añadieron en la 077 siguen dentro", () => {
    const admitidos = new Set(permisosDelCheck());
    expect(admitidos.has("cash.manage"), "cash.manage: el switch de Finanzas").toBe(true);
    expect(admitidos.has("org.manage_branches"), "org.manage_branches: Sucursales").toBe(true);
  });
});

describe("el módulo de Sucursales", () => {
  it("es del SUPER_ADMIN por defecto, pero cedible", () => {
    // La decisión (2026-09-22): dar de alta locales no reparte poder como
    // Usuarios o Facturación, así que el dueño puede cederlo a un encargado.
    // Lo que lo hace exclusivo de fábrica es `role_permissions` (migración
    // 077), no este flag.
    const mod = MODULES.find((m) => m.key === "branches")!;
    expect(mod.permission).toBe("org.manage_branches");
    expect(mod.grantable).toBe(true);
  });

  it("protege /branches con su permiso SIN robarle /settings a Configuración", () => {
    // `permissionForPath` resuelve por prefijo. Si este módulo declarara
    // "/settings", Configuración pasaría a exigir `org.manage_branches` y
    // ningún ORG_ADMIN podría entrar a editar los datos del negocio.
    expect(MODULES.find((m) => m.key === "branches")!.paths).toEqual(["/branches"]);
    expect(permissionForPath("/branches")).toBe("org.manage_branches");
    expect(permissionForPath("/settings")).toBe("org.manage_settings");
  });
});

describe("el middleware enciende el control de TODAS las rutas con permiso", () => {
  // EL DEFECTO QUE EVITA, y que se cometió al añadir las listas de precios:
  // `modules.ts` solo dice QUÉ permiso exige una ruta. Quien decide si se
  // comprueba algo es `ADMIN_ONLY_PATHS` en el middleware. Declarar la ruta en
  // uno y no en el otro la deja completamente abierta, en silencio y sin que
  // ningún test lo note.
  //
  // Se inspecciona el fuente en vez de importar el middleware porque ese módulo
  // arrastra `next/server` y el cliente de Supabase al cargarse. Mismo enfoque
  // que `legal-footer.test.ts`.
  const middleware = readFileSync(
    join(process.cwd(), "src/lib/supabase/middleware.ts"),
    "utf8"
  );

  // Hueco PREEXISTENTE, descubierto al escribir este test (2026-09-16):
  // `/reports` exige `sales.view_reports` en modules.ts pero no está en la
  // lista del middleware, así que esa comprobación nunca corre. NO se añade
  // aquí porque hacerlo cambiaría a quién deja entrar el sistema hoy, y esa es
  // una decisión del dueño del negocio, no de un test. Queda anotado para que
  // la excepción sea deliberada y visible en vez de un descuido silencioso.
  //
  // Cerrado en la migracion 088: el dueño decidio que el cajero no ve las
  // cifras del negocio, y `/reports` entro en la lista con `/dashboard`.
  const EXCEPCIONES_CONOCIDAS = new Set<string>();

  it("cada ruta que exige permiso está en la lista del middleware", () => {
    const protegidas = MODULES.filter((m) => m.permission !== null)
      .flatMap((m) => m.paths)
      .filter((ruta) => !EXCEPCIONES_CONOCIDAS.has(ruta));
    expect(protegidas.length).toBeGreaterThan(0);

    for (const ruta of protegidas) {
      expect(
        middleware.includes(`"${ruta}"`),
        `${ruta} exige permiso en modules.ts pero NO está en ADMIN_ONLY_PATHS/SUPER_ADMIN_ONLY_PATHS: el middleware la deja pasar sin comprobar nada`
      ).toBe(true);
    }
  });
});
