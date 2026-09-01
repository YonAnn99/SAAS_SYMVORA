"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useCashRegister } from "@/features/cash-register/hooks/use-cash-register";
import { CloseRegisterDialog } from "@/features/cash-register/components/close-register-dialog";
import { MovementDialog } from "@/features/cash-register/components/movement-dialog";
import { MovementsTable } from "@/features/cash-register/components/movements-table";
import { OpenRegisterDialog } from "@/features/cash-register/components/open-register-dialog";
import { RegisterSummaryCards } from "@/features/cash-register/components/register-summary-cards";

export default function FinancesPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const cash = useCashRegister(tenantId);

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
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {t("finances.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Control de caja y movimientos financieros
          </p>
        </div>
        {!cash.activeRegister ? (
          <SpecularActionButton
            tone="money"
            onClick={() => cash.setShowOpenDialog(true)}
            className="h-8 active:scale-[0.98] transition-transform"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("pos.openRegister")}
          </SpecularActionButton>
        ) : (
          <SpecularActionButton
            tone="destructive"
            onClick={() => cash.setShowCloseDialog(true)}
            className="h-8 active:scale-[0.98] transition-transform"
          >
            {t("pos.closeRegister")}
          </SpecularActionButton>
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
        onConfirm={(fondoInicial) => void cash.handleOpenRegister(fondoInicial)}
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