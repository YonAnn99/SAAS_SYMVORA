"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useTutorialContext } from "@/components/tutorial/tutorial-provider";
import { debeEmpujarAFinanzas, marcarAvisado, yaAvisadoHoy } from "../daily-prompt";
import { useOpenRegister } from "../hooks/use-open-register";

/**
 * Lleva a Finanzas la PRIMERA vez que alguien entra en el dia sin caja abierta.
 *
 * Es un empujon y no un candado: desde Finanzas se puede navegar a cualquier
 * modulo. Lo unico cerrado sin caja es el POS, y de eso se encarga el
 * middleware.
 *
 * No pinta nada; vive en `dashboard-shell` para que corra caiga donde caiga la
 * primera pantalla del dia.
 */
export function OpenRegisterPrompt() {
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const { hasOpenRegister, loading } = useOpenRegister(tenantId);
  const router = useRouter();
  const pathname = usePathname();
  const yaRedirigido = useRef(false);
  const { isActive, minimized } = useTutorialContext();
  // Si el tutorial estuvo en curso en ALGUN momento de esta carga, no se
  // empuja en toda la carga: al terminarlo o saltarlo no debe aparecer de golpe
  // una redireccion. El aviso tampoco se marca, asi que en la siguiente carga
  // funciona normal si sigue sin caja.
  const tutorialVisto = useRef(false);
  // Declarado ANTES del efecto de abajo: los efectos corren en orden, asi que
  // cuando se decide el empujon el ref ya refleja este render.
  useEffect(() => {
    if (isActive || minimized) tutorialVisto.current = true;
  }, [isActive, minimized]);

  useEffect(() => {
    if (tenantLoading || loading) return;
    // Una sola redireccion por montaje, pase lo que pase con los renders.
    if (yaRedirigido.current) return;
    // Sin caja confirmada, fuera de Finanzas y sin tutorial en curso.
    if (
      !debeEmpujarAFinanzas({
        hayCaja: hasOpenRegister,
        ruta: pathname,
        tutorialEnCurso: tutorialVisto.current,
      })
    ) {
      return;
    }

    let cancelado = false;
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelado || !user) return;
      // El tutorial pudo arrancar mientras se resolvia el usuario.
      if (tutorialVisto.current) return;
      if (yaAvisadoHoy(user.id)) return;

      // Se marca ANTES de navegar. Si se marcara despues y la navegacion
      // fallara, el aviso volveria a dispararse en cada carga.
      marcarAvisado(user.id);
      yaRedirigido.current = true;
      // Sin query string: el router de next-intl espera un PATHNAME. Con
      // "/finances?abrir_caja=1" lo toma entero como ruta, no la reconoce y
      // navega en relativo — daba /es/pos/finances y un 404.
      router.push("/finances");
    })();

    return () => {
      cancelado = true;
    };
  }, [tenantLoading, loading, hasOpenRegister, pathname, router, isActive, minimized]);

  return null;
}
