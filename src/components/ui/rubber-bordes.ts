"use client"

import * as React from "react"
import { animate, useMotionValue, type MotionValue } from "motion/react"

/*
 * La fisica del "Rubber Segment" de React Bits (registro @react-bits,
 * `RubberSegment-TS-TW`), separada del dibujo para usarla en horizontal (la
 * barra de pestañas, `tabs.tsx`) y en vertical (el menu lateral,
 * `sidebar.tsx`): al cambiar de opcion la pastilla se ESTIRA desde la actual
 * hasta la nueva y, al llegar, el borde de atras pasa de largo unos pixeles y
 * se APLASTA de vuelta.
 *
 * Solo mueve dos bordes (`inicio` y `fin`, en px); quien la usa decide si son
 * izquierda/derecha o arriba/abajo y como pintarlos.
 */
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]
const SPRING_UI = { type: "spring" as const, duration: 0.3, bounce: 0 }
const SPRING_RELAX = { type: "spring" as const, duration: 0.16, bounce: 0 }
/** Cuanto dura el estiramiento. */
const DILATE = 0.19
/** Cuando empieza a caer sobre el destino (se solapa con el estiramiento). */
const HANDOFF = 0.15
/** 100 = estira hasta abarcar origen y destino. */
const STRETCH = 100
/** Pixeles que el borde de atras pasa de largo antes de asentarse. */
const SQUASH = 3

export type Borde = { inicio: number; fin: number }

export function useRubberBordes() {
  const inicio = useMotionValue(0)
  const fin = useMotionValue(0)
  const gen = React.useRef(0)
  const handoff = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  /** Coloca la pastilla sin animar (al montar, redimensionar, reduced motion). */
  const saltar = React.useCallback(
    (b: Borde) => {
      clearTimeout(handoff.current)
      gen.current += 1
      inicio.jump(b.inicio)
      fin.jump(b.fin)
    },
    [inicio, fin]
  )

  // Cae sobre el destino: el borde que va delante llega con un spring; el de
  // atras pasa de largo SQUASH px y regresa (el "aplastado").
  const caer = React.useCallback(
    (b: Borde) => {
      const g = ++gen.current
      const dir =
        Math.sign((b.inicio + b.fin) / 2 - (inicio.get() + fin.get()) / 2) || 1
      const [lead, leadTo, trail, trailTo]: [
        MotionValue<number>,
        number,
        MotionValue<number>,
        number,
      ] = dir > 0 ? [fin, b.fin, inicio, b.inicio] : [inicio, b.inicio, fin, b.fin]
      animate(lead, leadTo, { ...SPRING_UI, velocity: lead.getVelocity() })
      animate(trail, trailTo + dir * SQUASH, {
        ...SPRING_UI,
        velocity: trail.getVelocity(),
      }).then(() => {
        if (gen.current === g) animate(trail, trailTo, SPRING_RELAX)
      })
    },
    [inicio, fin]
  )

  /** Se estira hasta abarcar origen y destino y, antes de terminar, cae. */
  const viajar = React.useCallback(
    (a: Borde, b: Borde) => {
      clearTimeout(handoff.current)
      gen.current += 1
      const u = STRETCH / 100
      const tween = { duration: DILATE, ease: EASE_OUT }
      animate(inicio, b.inicio + (Math.min(a.inicio, b.inicio) - b.inicio) * u, tween)
      animate(fin, b.fin + (Math.max(a.fin, b.fin) - b.fin) * u, tween)
      handoff.current = setTimeout(() => caer(b), HANDOFF * 1000)
    },
    [inicio, fin, caer]
  )

  /** Para en seco (desmontaje). */
  const detener = React.useCallback(() => {
    clearTimeout(handoff.current)
    inicio.stop()
    fin.stop()
  }, [inicio, fin])

  return { inicio, fin, saltar, viajar, detener }
}
