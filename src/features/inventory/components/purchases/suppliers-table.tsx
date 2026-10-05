"use client";

import { useTranslations } from "next-intl";
import { Pencil, Truck } from "lucide-react";
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
import { BotonEliminar } from "@/components/ui/boton-eliminar";
import type { Proveedor } from "../../types/inventory.types";
import { SupplierSwipeList } from "./supplier-swipe-list";

interface SuppliersTableProps {
  suppliers: Proveedor[];
  onAdd: () => void;
  onEdit: (supplier: Proveedor) => void;
  /** `false` si no se pudo eliminar (p. ej. tiene compras u ordenes). */
  onDelete: (supplier: Proveedor) => Promise<boolean>;
}

export function SuppliersTable({ suppliers, onAdd, onEdit, onDelete }: SuppliersTableProps) {
  const t = useTranslations();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">
          {t("purchases.supplier")}
        </CardTitle>
        <SpecularActionButton tone="add" onClick={onAdd} className="h-8">

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
          <>
          {/* Celular: una pastilla por proveedor; deslizar (o tocar) edita. */}
          <div className="md:hidden">
            <SupplierSwipeList proveedores={suppliers} onEdit={onEdit} onDelete={onDelete} />
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("common.name")}
                  </TableHead>
                  {/* El celular va antes del email: es el dato con el que se
                      manda el pedido. La columna "Contacto" se quitó al dejar de
                      capturarse — habría salido vacía en todo proveedor nuevo. */}
                  <TableHead className="text-xs uppercase tracking-wider">
                    Celular
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("common.email")}
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
                    <TableCell className="text-sm font-mono">
                      {supplier.telefono || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {supplier.email || "—"}
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
                      <BotonEliminar
                        nombre={supplier.nombre}
                        detalle="Sus productos se quedan, sin proveedor asignado"
                        onEliminar={async () => {
                          await onDelete(supplier);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}