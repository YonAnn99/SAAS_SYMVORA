"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useCashRegister } from "@/features/cash-register/hooks/use-cash-register";
import { CloseRegisterDialog } from "@/features/cash-register/components/close-register-dialog";
import { MovementDialog } from "@/features/cash-register/components/movement-dialog";
import { MovementsTable } from "@/features/cash-register/components/movements-table";
import { OpenRegisterDialog } from "@/features/cash-register/components/open-register-dialog";
import { RegisterSummaryCards } from "@/features/cash-register/components/register-summary-cards";
import { OpenSinceTooltip } from "@/features/cash-register/components/open-since-tooltip";
import { useTutorialContext } from "@/components/tutorial/tutorial-provider";
import { useSucursal } from "@/contexts/sucursal-context";
import { SucursalSelector } from "@/features/sucursales/components/sucursal-selector";
import { destinoPorDefecto, sucursalDelPos } from "@/features/sucursales/seleccion";

export default function FinancesPage() {
  const t = useTranslations();
  const router = useRouter();
  const { tenantId, role, loading: tenantLoading } = useCurrentTenant();
  const { sucursales, activas, hayVarias, seleccionada } = useSucursal();
  // El dueño tiene una caja por local (migracion 086) y aqui ve la del que
  // elija; con "Todas", la mas reciente. El resto, su caja de siempre: misma
  // regla que el punto de venta, para que Finanzas y el POS hablen de la misma.
  const esDueno = role === "SUPER_ADMIN";
  const sucursalCaja = sucursalDelPos({ esDueno, hayVarias, seleccionada, activas });
  const cash = useCashRegister(tenantId, sucursalCaja);
  const nombreSucursalCaja = hayVarias
    ? sucursales.find((s) => s.id === cash.activeRegister?.sucursal_id)?.nombre
    : undefined;
  const autoOpenedRef = useRef(false);

  const { isActive: tutorialActivo, minimized: tutorialMinimizado } = useTutorialContext();

  // Abre automáticamente la ventana de fondo inicial al entrar a Finanzas sin caja abierta.
  // Con el tutorial en curso NO: su paso "Abre la caja" señala el botón con una
  // flecha, y el diálogo abierto solo la tapaba (primer acceso de cuentas nuevas).
  useEffect(() => {
    if (tutorialActivo || tutorialMinimizado) return;
    if (!cash.loading && !tenantLoading && !cash.activeRegister && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      cash.setShowOpenDialog(true);
    }
  }, [cash.loading, tenantLoading, cash.activeRegister, cash, tutorialActivo, tutorialMinimizado]);

  if (cash.loading || tenantLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <OpenSinceTooltip fechaApertura={cash.activeRegister?.fecha_apertura}>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {t("finances.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {nombreSucursalCaja
              ? `Caja de ${nombreSucursalCaja}`
              : "Control de caja y movimientos financieros"}
          </p>
        </OpenSinceTooltip>
        <div className="flex items-center gap-2">
        {esDueno && <SucursalSelector />}
        {!cash.activeRegister ? (
          <span id="tutorial-open-cash-btn">
            <SpecularActionButton
              tone="money"
              onClick={() => cash.setShowOpenDialog(true)}
              className="h-8 active:scale-[0.98] transition-transform"
            >

              {t("pos.openRegister")}
            </SpecularActionButton>
          </span>
        ) : (
          <span id="tutorial-close-cash-btn">
            <SpecularActionButton
              tone="destructive"
              onClick={() => cash.setShowCloseDialog(true)}
              className="h-8 active:scale-[0.98] transition-transform"
            >
              {t("pos.closeRegister")}
            </SpecularActionButton>
          </span>
        )}
        </div>
      </div>

      <RegisterSummaryCards
        activeRegisterFondoInicial={cash.activeRegister?.fondo_inicial ?? 0}
        totalVentas={cash.totalVentas}
        totalEntradas={cash.totalEntradas}
        totalSalidas={cash.totalSalidas}
        saldoEsperado={cash.saldoEsperado}
      />

      <MovementsTable
        movements={cash.movements}
        canAdd={Boolean(cash.activeRegister)}
        onAdd={() => cash.setShowMovementDialog(true)}
      />

      <OpenRegisterDialog
        open={cash.showOpenDialog}
        sucursalInicial={destinoPorDefecto(seleccionada, activas)}
        onOpenChange={cash.setShowOpenDialog}
        onConfirm={async (fondoInicial, sucursalId) => {
          const reg = await cash.handleOpenRegister(fondoInicial, sucursalId);
          if (reg) {
            router.push("/pos");
          }
        }}
      />

      <MovementDialog
        open={cash.showMovementDialog}
        onOpenChange={cash.setShowMovementDialog}
        onConfirm={(tipo, monto, descripcion) =>
          void cash.handleAddMovement(tipo, monto, descripcion)
        }
      />

      <CloseRegisterDialog
        open={cash.showCloseDialog}
        onOpenChange={cash.setShowCloseDialog}
        register={cash.activeRegister}
        totalVentas={cash.totalVentas}
        totalEntradas={cash.totalEntradas}
        totalSalidas={cash.totalSalidas}
        saldoEsperado={cash.saldoEsperado}
        onConfirm={(saldoReal, notasCierre) =>
          void cash.handleCloseRegister(saldoReal, notasCierre)
        }
      />
    </div>
  );
}