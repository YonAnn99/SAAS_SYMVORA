"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { vaciarCache } from "@/lib/cache-datos";
import { vaciarCarritoGuardado } from "@/features/pos/stores/cart";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirmar } from "@/components/ui/confirmar";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useOpenRegister } from "@/features/cash-register/hooks/use-open-register";

/**
 * Cerrar sesión, con el aviso de caja abierta. Lo usan el menú del avatar
 * (header) y el pie del menú lateral: una sola copia del aviso.
 *
 * `avisoCajaAbierta` es el diálogo ya armado; quien usa el hook lo pinta.
 *
 * `salir({ confirmar: true })` (botón de la barra de módulos y del dock):
 * con la caja cerrada pregunta "¿Cerrar sesión?" antes de salir; con la caja
 * abierta abre el aviso de cerrar caja, igual que sin confirmar.
 */
export function useCerrarSesion() {
  const router = useRouter();
  const { tenantId } = useCurrentTenant();
  const { hasOpenRegister } = useOpenRegister(tenantId);
  const [aviso, setAviso] = useState(false);
  const confirmarDialogo = useConfirmar();

  const cerrarSesion = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    vaciarCache();
    vaciarCarritoGuardado();
    router.push("/login");
    router.refresh();
  };

  /**
   * Avisa si queda caja abierta, pero NO impide salir.
   *
   * Bloquear de verdad seria una trampa: sin conexion no se puede cerrar caja
   * (`use-cash-register` lo impide si hay ventas sin subir), asi que el cajero
   * quedaria encerrado hasta que volviera internet. Y tampoco podria bloquear
   * una terminal compartida al alejarse de ella.
   */
  const salir = async ({ confirmar = false }: { confirmar?: boolean } = {}) => {
    if (hasOpenRegister === true) {
      setAviso(true);
      return;
    }
    // `null` (aún no se sabe si hay caja) tampoco bloquea: mismo criterio que
    // arriba, nunca encerrar al usuario.
    if (
      confirmar &&
      !(await confirmarDialogo({
        titulo: "¿Cerrar sesión?",
        descripcion: "Tendrás que volver a iniciar sesión para usar el sistema.",
        accion: "Cerrar sesión",
        tono: "aviso",
      }))
    ) {
      return;
    }
    await cerrarSesion();
  };

  const avisoCajaAbierta = (
    <Dialog open={aviso} onOpenChange={setAviso}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Tienes la caja abierta</DialogTitle>
          <DialogDescription className="text-sm">
            Si sales sin cerrarla, el corte del día quedará sin cuadrar y el
            siguiente turno arrancará sobre tu caja. Puedes cerrarla ahora o
            salir de todos modos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            className="h-8 w-full sm:w-auto"
            onClick={() => void cerrarSesion()}
          >
            Salir de todos modos
          </Button>
          <Button
            className="h-8 w-full sm:w-auto"
            onClick={() => {
              setAviso(false);
              router.push("/finances");
            }}
          >
            Ir a cerrar caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { salir, avisoCajaAbierta };
}
