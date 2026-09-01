"use client";

import { useTranslations } from "next-intl";
import { Plus, Pencil, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Proveedor } from "../../types/inventory.types";

interface SuppliersTableProps {
  suppliers: Proveedor[];
  onAdd: () => void;
  onEdit: (supplier: Proveedor) => void;
}

export function SuppliersTable({ suppliers, onAdd, onEdit }: SuppliersTableProps) {
  const t = useTranslations();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">
          {t("purchases.supplier")}
        </CardTitle>
        <SpecularActionButton tone="add" onClick={onAdd} className="h-8">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar proveedor
        </SpecularActionButton>
      </CardHeader>
      <CardContent>
        {suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Truck className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No hay proveedores registrados
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("common.name")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Contacto
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("common.email")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("common.phone")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium text-sm">
                      {supplier.nombre}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {supplier.contact_name || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {supplier.email || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {supplier.telefono || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(supplier)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
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