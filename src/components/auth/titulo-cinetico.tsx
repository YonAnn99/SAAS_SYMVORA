"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Titulo del panel azul del login/registro con tipografia cinetica (como el
 * video de referencia hecho en jitter.video): renglones apilados en mayusculas;
 * cada uno aparece letra por letra con las letras separadas y luego se juntan.
 *
 * Solo CSS (`auth-toggle.css`, `.auth-cinetico*`): cada letra lleva sus tiempos
 * en variables CSS. Se anima con `transform`, no con `letter-spacing`, para que
 * el bloque no cambie de ancho mientras se anima. Solo se reproduce con
 * `activo` (el panel visible); el que sale se queda en su estado final.
 *
 * El estado final es el estilo normal de cada letra: las animaciones solo
 * cubren la entrada y, al terminar (`data-terminado`), se quitan. Asi ninguna
 * letra se puede quedar oculta si el navegador se salta un cuadro.
 */

/** Margen tras el fin calculado antes de quitar las animaciones. */
const MARGEN_FIN_MS = 200;

/** Entre una letra y la siguiente, como si se tecleara. */
const PASO_LETRA_MS = 35;
/** Entre el inicio de un renglon y el del siguiente (se traslapan). */
const ENTRE_RENGLONES_MS = 300;
/** Lo que tardan las letras de un renglon en juntarse. */
export const DURACION_JUNTAR_MS = 380;

export interface TiempoRenglon {
  /** Cuando aparece la primera letra. */
  inicio: number;
  /** Cuando, ya escritas todas, las letras se empiezan a juntar. */
  junta: number;
}

/** Tiempos (ms) de cada renglon y el fin de toda la animacion. */
export function tiemposCineticos(
  lineas: string[],
  retraso = 0
): { renglones: TiempoRenglon[]; fin: number } {
  const renglones = lineas.map((linea, k) => {
    const inicio = retraso + k * ENTRE_RENGLONES_MS;
    return { inicio, junta: inicio + [...linea].length * PASO_LETRA_MS };
  });
  const fin = renglones.reduce((max, r) => Math.max(max, r.junta + DURACION_JUNTAR_MS), retraso);
  return { renglones, fin };
}

export function TituloCinetico({
  lineas,
  subtitulo,
  activo,
  retraso = 0,
  logo,
}: {
  lineas: string[];
  subtitulo?: string;
  /** Solo el panel visible se anima. */
  activo: boolean;
  /** Para esperar al deslizamiento del panel. */
  retraso?: number;
  logo?: ReactNode;
}) {
  const { renglones, fin } = tiemposCineticos(lineas, retraso);
  const [terminado, setTerminado] = useState(false);

  // Red de seguridad: al acabar, se quitan las animaciones y queda el estilo
  // normal (todo visible). Al desactivarse se reinicia para la proxima vez.
  useEffect(() => {
    if (!activo) return undefined;
    const t = setTimeout(() => setTerminado(true), fin + MARGEN_FIN_MS);
    return () => {
      clearTimeout(t);
      setTerminado(false);
    };
  }, [activo, fin]);

  return (
    <div
      className="auth-cinetico"
      data-activo={activo ? "true" : "false"}
      data-terminado={terminado ? "true" : "false"}
    >
      {logo}
      <h1 className="auth-cinetico-titulo" aria-label={lineas.join(" ")}>
        {lineas.map((linea, k) => (
          <span key={k} className="auth-cinetico-linea" aria-hidden="true">
            {[...linea].map((letra, i) => (
              <span
                key={i}
                className="auth-cinetico-letra"
                style={
                  {
                    "--i": i,
                    "--aparece": `${renglones[k].inicio + i * PASO_LETRA_MS}ms`,
                    "--junta": `${renglones[k].junta}ms`,
                  } as CSSProperties
                }
              >
                {letra === " " ? " " : letra}
              </span>
            ))}
          </span>
        ))}
      </h1>
      {subtitulo && (
        <p className="auth-cinetico-sub" style={{ "--aparece": `${fin}ms` } as CSSProperties}>
          {subtitulo}
        </p>
      )}
    </div>
  );
}
