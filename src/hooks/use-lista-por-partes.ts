"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Cuántos elementos se pintan de entrada y cuántos más en cada tramo. */
export const TRAMO_LISTA = 60;

/** Cuántos quedan a la vista tras pedir un tramo más (nunca más que el total). */
export function siguienteTramo(visibles: number, total: number, tramo = TRAMO_LISTA): number {
  return Math.min(total, Math.max(visibles, 0) + tramo);
}

/**
 * Pinta una lista larga por partes: los primeros `TRAMO_LISTA` y, al acercarse
 * al final (o al tocar «Mostrar más»), el siguiente tramo.
 *
 * Por qué: con 1,000 productos, Productos pintaba todas las filas a la vez
 * (150 mil elementos, 13 mil botones) y la pestaña se congelaba varios segundos
 * (medido el 2026-11-12). La búsqueda, los filtros, «marcar todos» y exportar
 * siguen trabajando sobre la lista COMPLETA: esto solo limita lo que se dibuja.
 *
 * - `clave`: lo que define la lista (búsqueda + filtros). Al cambiar, se vuelve
 *   al primer tramo. Editar o borrar un elemento no la cambia, así que no se
 *   pierde el lugar.
 * - `centinela`: ref para el elemento del final. Puede ponerse en varios (la
 *   lista de celular y la tabla conviven en el DOM; el oculto nunca dispara).
 */
export function useListaPorPartes(total: number, clave = "", tramo = TRAMO_LISTA) {
  const [estado, setEstado] = useState({ clave, pedidos: tramo });
  // Cambio de búsqueda o filtros: de vuelta al primer tramo (ajuste en el
  // render, sin efecto, para no pintar un cuadro con la lista vieja).
  if (estado.clave !== clave) setEstado({ clave, pedidos: tramo });
  const pedidos = estado.clave === clave ? estado.pedidos : tramo;
  const visibles = Math.min(total, pedidos);
  const hayMas = visibles < total;

  const mostrarMas = useCallback(
    () => setEstado((e) => ({ ...e, pedidos: e.pedidos + tramo })),
    [tramo]
  );

  const observador = useRef<IntersectionObserver | null>(null);
  const nodos = useRef(new Set<Element>());
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) mostrarMas();
      },
      { rootMargin: "800px 0px" }
    );
    observador.current = io;
    nodos.current.forEach((n) => io.observe(n));
    return () => {
      io.disconnect();
      observador.current = null;
    };
    // Se rehace al crecer la lista: si el centinela sigue a la vista tras
    // pintar un tramo, el observador nuevo vuelve a avisar.
  }, [mostrarMas, visibles]);

  const centinela = useCallback((nodo: Element | null) => {
    if (!nodo) return;
    nodos.current.add(nodo);
    observador.current?.observe(nodo);
    return () => {
      nodos.current.delete(nodo);
      observador.current?.unobserve(nodo);
    };
  }, []);

  return { visibles, hayMas, restantes: total - visibles, mostrarMas, centinela };
}
