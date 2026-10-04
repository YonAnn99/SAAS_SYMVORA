"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ShoppingCart, Truck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePurchases } from "@/features/inventory";
import { PurchasesTable } from "@/features/inventory";
import { SuppliersTable } from "@/features/inventory";
import { NewPurchaseDialog } from "@/features/inventory";
import { NewSupplierDialog } from "@/features/inventory";
import { PurchaseDetailDialog } from "@/features/inventory";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useAccionRapida } from "@/hooks/use-accion-rapida";
import { EncabezadoModulo } from "@/components/dashboard/encabezado-modulo";

export default function PurchasesPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const {
    purchases,
    suppliers,
    loading,
    showNewPurchaseDialog,
    setShowNewPurchaseDialog,
    editingPurchase,
    openEditPurchase,
    showNewSupplierDialog,
    setShowNewSupplierDialog,
    editingSupplier,
    openEditSupplier,
    handleCreatePurchase,
    handleUpdatePurchase,
    handleCreateSupplier,
    handleUpdateSupplier,
    handleUpdatePurchaseStatus,
    handleDeletePurchase,
    handleCancelPurchase,
    products,
    variants,
  } = usePurchases(tenantId, tenantLoading);
  const [compraAbierta, setCompraAbierta] = useState<string | null>(null);
  const [pestana, setPestana] = useState("purchases");

  // Desde la busqueda rapida (Ctrl/Cmd+K).
  useAccionRapida("nueva-compra", () => setShowNewPurchaseDialog(true), !loading);
  useAccionRapida(
    "agregar-proveedor",
    () => {
      setPestana("suppliers");
      setShowNewSupplierDialog(true);
    },
    !loading
  );

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="animate-fade-in-up stagger-1">
        <EncabezadoModulo
          titulo={t("purchases.title")}
          descripcion="Gestiona compras y proveedores"
        />
      </div>

      <Tabs
        value={pestana}
        onValueChange={(v) => setPestana(String(v))}
        className="w-full animate-fade-in-up stagger-2"
      >
        <TabsList>
          <TabsTrigger value="purchases" className="gap-1.5 text-xs">
            <ShoppingCart className="h-3.5 w-3.5" />
            {t("purchases.title")}
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-1.5 text-xs">
            <Truck className="h-3.5 w-3.5" />
            {t("purchases.supplier")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="purchases">
          <PurchasesTable
            purchases={purchases}
            onAdd={() => setShowNewPurchaseDialog(true)}
            onEdit={openEditPurchase}
            onUpdateStatus={handleUpdatePurchaseStatus}
            onDelete={handleDeletePurchase}
            onCancel={handleCancelPurchase}
            onOpen={(purchase) => setCompraAbierta(purchase.id)}
          />
        </TabsContent>

        <TabsContent value="suppliers">
          <SuppliersTable
            suppliers={suppliers}
            onAdd={() => setShowNewSupplierDialog(true)}
            onEdit={openEditSupplier}
          />
        </TabsContent>
      </Tabs>

      {/* New / edit purchase dialog */}
      <NewPurchaseDialog
        open={showNewPurchaseDialog}
        onOpenChange={setShowNewPurchaseDialog}
        suppliers={suppliers}
        products={products}
        variants={variants}
        editingPurchase={editingPurchase}
        onConfirm={(input, renglones) =>
          editingPurchase
            ? handleUpdatePurchase(editingPurchase.id, input)
            : handleCreatePurchase(input, renglones)
        }
      />

      {/* Desglose de una compra (clic en la fila). */}
      <PurchaseDetailDialog
        compraId={compraAbierta}
        tenantId={tenantId}
        onOpenChange={(open) => !open && setCompraAbierta(null)}
      />

      {/* New / edit supplier dialog */}
      <NewSupplierDialog
        open={showNewSupplierDialog}
        onOpenChange={setShowNewSupplierDialog}
        editingSupplier={editingSupplier}
        onConfirm={(input) =>
          editingSupplier
            ? handleUpdateSupplier(editingSupplier.id, input)
            : handleCreateSupplier(input)
        }
      />
    </div>
  );
}