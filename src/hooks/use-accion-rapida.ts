"use client";

/**
 * Abre la ventana de un boton cuando se llega desde la busqueda rapida con
 * `?accion=<id>` (ver `lib/acciones-rapidas.ts`).
 *
 * Espera a que la pagina este lista (`listo`) para no abrir un dialogo sobre
 * datos que aun cargan, lo llama UNA vez y quita el parametro de la URL: asi
 * recargar la pagina no vuelve a abrir la ventana.
 */

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PARAM_ACCION } from "@/lib/acciones-rapidas";

export function useAccionRapida(id: string, abrir: () => void, listo = true) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const atendida = useRef(false);
  const pedida = searchParams.get(PARAM_ACCION) === id;

  // Una accion nueva (otra vez desde la busqueda) vuelve a poder atenderse.
  useEffect(() => {
    if (!pedida) atendida.current = false;
  }, [pedida]);

  useEffect(() => {
    if (!pedida || !listo || atendida.current) return;
    atendida.current = true;
    abrir();

    const resto = new URLSearchParams(searchParams.toString());
    resto.delete(PARAM_ACCION);
    const query = resto.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pedida, listo, abrir, searchParams, pathname, router]);
}
