"use client";

import { useTranslations } from "next-intl";
import { Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PurchaseWithRelations } from "../../types/inventory.types";
import { purchaseStatusColors } from "../../services/purchase-service";

interface PurchasesTableProps {
  purchases: PurchaseWithRelations[];
  onAdd: () => void;
}

export function PurchasesTable({ purchases, onAdd }: PurchasesTableProps) {
  const t = useTranslations();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">
          {t("purchases.title")}
        </CardTitle>
        <Button
          onClick={onAdd}
          size="sm"
          className="h-8 active:scale-[0.98] transition-transform"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("purchases.addPurchase")}
        </Button>
      </CardHeader>
      <CardContent>
        {purchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <ShoppingCart className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {t("purchases.noPurchases")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("purchases.supplier")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("purchases.invoiceNumber")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("purchases.date")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("purchases.status")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("purchases.total")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium text-sm">
                      {purchase.proveedor?.nombre || "N/A"}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {purchase.numero_factura || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(purchase.fecha_compra).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${purchaseStatusColors[purchase.estado]} text-[10px] px-1.5 py-0`}
                      >
                        {t(`purchases.statuses.${purchase.estado}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      ${purchase.total.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}