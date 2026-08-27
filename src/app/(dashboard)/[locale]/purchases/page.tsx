"use client";

import { useTranslations } from "next-intl";
import { ShoppingCart, Truck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePurchases } from "@/features/inventory";
import { PurchasesTable } from "@/features/inventory";
import { SuppliersTable } from "@/features/inventory";
import { NewPurchaseDialog } from "@/features/inventory";
import { NewSupplierDialog } from "@/features/inventory";

export default function PurchasesPage() {
  const t = useTranslations();
  const {
    purchases,
    suppliers,
    loading,
    showNewPurchaseDialog,
    setShowNewPurchaseDialog,
    showNewSupplierDialog,
    setShowNewSupplierDialog,
    handleCreatePurchase,
    handleCreateSupplier,
    handleUpdatePurchaseStatus,
    handleDeletePurchase,
  } = usePurchases();

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
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          {t("purchases.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona compras y proveedores
        </p>
      </div>

      <Tabs defaultValue="purchases" className="w-full animate-fade-in-up stagger-2">
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
            onUpdateStatus={handleUpdatePurchaseStatus}
            onDelete={handleDeletePurchase}
          />
        </TabsContent>

        <TabsContent value="suppliers">
          <SuppliersTable
            suppliers={suppliers}
            onAdd={() => setShowNewSupplierDialog(true)}
          />
        </TabsContent>
      </Tabs>

      {/* New purchase dialog */}
      <NewPurchaseDialog
        open={showNewPurchaseDialog}
        onOpenChange={setShowNewPurchaseDialog}
        suppliers={suppliers}
        onConfirm={handleCreatePurchase}
      />

      {/* New supplier dialog */}
      <NewSupplierDialog
        open={showNewSupplierDialog}
        onOpenChange={setShowNewSupplierDialog}
        onConfirm={handleCreateSupplier}
      />
    </div>
  );
}