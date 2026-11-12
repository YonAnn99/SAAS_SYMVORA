"use client";

import { useSyncExternalStore } from "react";
import {
  CONSENTIMIENTO_SERVIDOR,
  consentimientoActual,
  suscribirConsentimiento,
  type Consentimiento,
} from "@/lib/consentimiento-cookies";

/** La eleccion de cookies de esta persona; se actualiza al guardarla. */
export function useConsentimiento(): Consentimiento {
  return useSyncExternalStore(suscribirConsentimiento, consentimientoActual, () => CONSENTIMIENTO_SERVIDOR);
}
