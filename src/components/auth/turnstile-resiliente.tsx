"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";

/**
 * Turnstile (Cloudflare) del login, el registro, «olvidé mi contraseña» y la clave de colaborador.
 *
 * POR QUE NO EL `<Turnstile>` SUELTO. Antes cada formulario lo usaba con `onError` = «borra el token y pon el
 * aviso rojo». Una clienta con Safari (Mac e iPhone) se quedaba con el aviso y el botón en «Verificando…»
 * sin remedio, y nadie sabia por que: el codigo del error no se guardaba en ningun sitio. Ahora:
 *
 *   1. El widget arranca INVISIBLE (`interaction-only`), como antes: en el camino normal no cambia nada a la vista
 *      (el recuadro fijo de ~70 px no dejaba que el login cupiera en un celular).
 *   2. Si falla, se reintenta SOLO dos veces (1.5 s y 3 s). La mayoria de los fallos pasajeros (red, Private Relay,
 *      la prueba de trabajo que bloquea el hilo en WebKit) se arreglan ahi, sin que la persona lo note.
 *   3. Si sigue fallando, el widget pasa a VISIBLE (`appearance: "always"`) para que lo pueda resolver a mano, y el
 *      aviso lleva el CODIGO del error y un boton «Reintentar verificacion».
 *   4. Cada fallo se reporta a Sentry con su codigo y el navegador (una vez por carga), y a la consola.
 *   5. Al lograr un token el aviso de captcha se QUITA (antes se quedaba aunque el widget se recuperara). Solo se
 *      quita ese aviso: un «contraseña incorrecta» posterior se respeta.
 *
 * El captcha NO se puentea: sin token, Supabase rechaza el inicio de sesion. Aqui solo se hace mas dificil que falle.
 */

/** Lo unico que los formularios necesitan del widget: reiniciarlo tras un intento. */
export interface ControlTurnstile {
  reset: () => void;
}

/** Esperas antes de cada reintento silencioso. Al agotarse, el widget pasa a visible. */
export const ESPERAS_REINTENTO_MS = [1500, 3000] as const;

interface Props {
  id: string;
  siteKey: string;
  /** El token verificado, o `null` cuando falla o vence. */
  onToken: (token: string | null) => void;
  /** El estado del aviso de error del formulario: aqui se escribe el aviso del captcha y se quita al recuperarse. */
  setError: Dispatch<SetStateAction<string | null>>;
}

export const TurnstileResiliente = forwardRef<ControlTurnstile, Props>(function TurnstileResiliente(
  { id, siteKey, onToken, setError },
  ref
) {
  const t = useTranslations("auth");
  const widget = useRef<TurnstileInstance | undefined>(undefined);
  const fallos = useRef(0);
  const avisoPuesto = useRef<string | null>(null);
  const reportado = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  // `key` nuevo = widget nuevo: el cambio a visible necesita un render desde cero.
  const [visible, setVisible] = useState(false);
  const [fallo, setFallo] = useState(false);

  const reiniciar = useCallback(() => {
    window.clearTimeout(timer.current);
    widget.current?.reset();
  }, []);

  useImperativeHandle(ref, () => ({ reset: reiniciar }), [reiniciar]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const alFallar = useCallback(
    (codigo?: string) => {
      const cod = codigo || "desconocido";
      onToken(null);
      // Un solo reporte por carga: un mismo equipo roto fallaria varias veces y llenaria Sentry de lo mismo.
      if (!reportado.current) {
        reportado.current = true;
        console.warn(`[Turnstile ${id}] error ${cod}`);
        Sentry.captureMessage("Turnstile fallo", {
          level: "warning",
          tags: { turnstile_codigo: cod, turnstile_widget: id },
          extra: { navegador: typeof navigator === "undefined" ? "" : navigator.userAgent },
        });
      }

      const espera = ESPERAS_REINTENTO_MS[fallos.current];
      fallos.current += 1;
      if (espera !== undefined) {
        // Reintento silencioso: el boton sigue en «Verificando…» y no hay aviso rojo.
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => widget.current?.reset(), espera);
        return;
      }

      // Sigue fallando: widget visible + aviso con el codigo + boton para reintentar.
      setVisible(true);
      setFallo(true);
      const aviso = t("captchaError", { codigo: cod });
      avisoPuesto.current = aviso;
      setError(aviso);
    },
    [id, onToken, setError, t]
  );

  const alLograr = useCallback(
    (token: string) => {
      fallos.current = 0;
      setFallo(false);
      onToken(token);
      const puesto = avisoPuesto.current;
      if (puesto) {
        // Solo se quita el aviso del captcha; cualquier otro error del formulario se queda.
        setError((actual) => (actual === puesto ? null : actual));
        avisoPuesto.current = null;
      }
    },
    [onToken, setError]
  );

  const reintentar = useCallback(() => {
    fallos.current = 0;
    setFallo(false);
    const puesto = avisoPuesto.current;
    if (puesto) {
      setError((actual) => (actual === puesto ? null : actual));
      avisoPuesto.current = null;
    }
    reiniciar();
  }, [reiniciar, setError]);

  return (
    <>
      <Turnstile
        // Al pasar a visible se vuelve a montar con la nueva apariencia.
        key={visible ? "visible" : "invisible"}
        id={id}
        siteKey={siteKey}
        options={{
          appearance: visible ? "always" : "interaction-only",
          // Los reintentos los controlamos nosotros (arriba), para que sean predecibles.
          retry: "never",
          refreshExpired: "auto",
        }}
        onSuccess={alLograr}
        onError={alFallar}
        onExpire={() => onToken(null)}
        ref={widget}
      />
      {fallo && (
        <button
          type="button"
          onClick={reintentar}
          className="auth-forgot-link"
          style={{ display: "block", margin: "8px auto 0" }}
        >
          {t("captchaReintentar")}
        </button>
      )}
    </>
  );
});
