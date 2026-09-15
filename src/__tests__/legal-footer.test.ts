import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * El pie legal del panel.
 *
 * Se inspecciona el fuente en vez de renderizar porque lo que se quiere fijar
 * son decisiones de CLASES y de estructura, no comportamiento: un render no
 * distinguiría `bg-neutral-50` de `bg-muted/30`, que es exactamente el defecto
 * que hacía salir una franja blanca sobre el panel oscuro.
 */
/**
 * Quita comentarios antes de inspeccionar.
 *
 * Hace falta: los comentarios de estos componentes EXPLICAN qué se evitó
 * ("no uses `bg-neutral-50`", "no el Link de @/i18n/navigation"), así que
 * buscar esas cadenas en el fuente crudo da un falso positivo contra la propia
 * documentación del arreglo.
 */
function soloCodigo(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, "") // bloque, incluidos los {/* */} de JSX
    .replace(/^\s*\/\/.*$/gm, ""); // línea
}

const leer = (ruta: string) =>
  soloCodigo(readFileSync(join(process.cwd(), ruta), "utf8"));

const footer = leer("src/components/dashboard/legal-footer.tsx");
const shell = leer("src/components/dashboard/dashboard-shell.tsx");

describe("colores del pie legal", () => {
  it("no usa colores fijos: sigue al tema", () => {
    // EL DEFECTO CONCRETO: `bg-neutral-50` y `border-neutral-200` no tienen
    // variante oscura, así que el pie salía como una franja blanca sobre el
    // panel en modo oscuro.
    for (const clase of ["bg-neutral-", "border-neutral-", "text-neutral-"]) {
      expect(
        footer.includes(clase),
        `${clase} es un color fijo; usa un token del tema (bg-muted, border-border, text-muted-foreground)`
      ).toBe(false);
    }
  });

  it("usa los tokens del tema", () => {
    expect(footer).toContain("border-border");
    expect(footer).toContain("text-muted-foreground");
  });
});

describe("los enlaces legales siguen ahí", () => {
  it("apuntan a las tres páginas en el dominio de marketing", () => {
    for (const ruta of ["terminos", "aviso-privacidad", "politica-cookies"]) {
      expect(footer, `falta ${ruta}`).toContain(ruta);
    }
    expect(footer).toContain("https://www.symvora.com.mx");
  });

  it("abren fuera, sin filtrar la sesión", () => {
    expect(footer).toContain('target="_blank"');
    expect(footer).toContain('rel="noopener noreferrer"');
  });

  it("son <a> normales, NO el Link de i18n", () => {
    // Son URLs absolutas a otro dominio. El `Link` de `@/i18n/navigation` es
    // para rutas internas y les antepone el idioma; pasarle algo que no es un
    // pathname interno ya provocó un 404 en este proyecto.
    expect(footer).not.toContain("@/i18n/navigation");
  });
});

describe("el pie se desplaza con el contenido", () => {
  it("se monta DENTRO de <main>, no como hermano", () => {
    // `main` es el único elemento que hace scroll del shell. Fuera de él, el
    // pie queda clavado abajo y se come ~65px permanentes en un teléfono.
    const dentroDeMain = /<main[^>]*>[\s\S]*<LegalFooter \/>[\s\S]*<\/main>/.test(
      shell
    );
    expect(
      dentroDeMain,
      "LegalFooter debe ir dentro de <main> para que haga scroll con el contenido"
    ).toBe(true);
  });

  it("main es columna flex y el contenido crece: el pie cae al fondo", () => {
    // LA REGRESIÓN CONCRETA: al meter el pie dentro de `main` sin más, en una
    // pantalla con poco contenido quedaba plantado justo debajo del contenido,
    // a media página, con ~319px vacíos por debajo — medido en /es/finances.
    // El patrón de "sticky footer" lo corrige: `main` en columna flex y el
    // contenido en un envoltorio `flex-1` que se come el espacio sobrante.
    const etiquetaMain = shell.match(/<main[^>]*>/)?.[0] ?? "";
    expect(etiquetaMain, "main debe ser flex").toMatch(/\bflex\b/);
    expect(etiquetaMain, "main debe apilar en columna").toContain("flex-col");

    const envoltorio = shell.match(/<main[^>]*>\s*(<div[^>]*>)\s*\{children\}/);
    expect(
      envoltorio,
      "{children} debe ir en un <div> propio entre <main> y <LegalFooter />"
    ).not.toBeNull();
    expect(
      envoltorio?.[1],
      "el envoltorio de {children} necesita flex-1 para empujar el pie al fondo"
    ).toContain("flex-1");
  });
});
