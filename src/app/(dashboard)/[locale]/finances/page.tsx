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

export default function FinancesPage() {
  const t = useTranslations();
  const router = useRouter();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const cash = useCashRegister(tenantId);
  const autoOpenedRef = useRef(false);

  // Abre automáticamente la ventana de fondo inicial al entrar a Finanzas sin caja abierta
  useEffect(() => {
    if (!cash.loading && !tenantLoading && !cash.activeRegister && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      cash.setShowOpenDialog(true);
    }
  }, [cash.loading, tenantLoading, cash.activeRegister, cash]);

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
            Control de caja y movimientos financieros
          </p>
        </OpenSinceTooltip>
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
        onOpenChange={cash.setShowOpenDialog}
        onConfirm={async (fondoInicial) => {
          const reg = await cash.handleOpenRegister(fondoInicial);
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