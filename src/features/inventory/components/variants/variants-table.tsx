"use client";

import { Palette, Pencil } from "lucide-react";
import { BotonEliminar } from "@/components/ui/boton-eliminar";
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
import type { VarianteProducto } from "../../types/inventory.types";
import { VariantSwipeList } from "./variant-swipe-list";

interface VariantsTableProps {
  variants: VarianteProducto[];
  filteredVariants: VarianteProducto[];
  loading: boolean;
  getProductName: (productId: string) => string;
  onEdit: (variant: VarianteProducto) => void;
  /** `false` si no se pudo borrar (la fila deslizable del celular reaparece). */
  onDelete: (variant: VarianteProducto) => void | Promise<boolean | void>;
  onAdd: () => void;
}

export function VariantsTable({
  variants,
  filteredVariants,
  loading,
  getProductName,
  onEdit,
  onDelete,
  onAdd,
}: VariantsTableProps) {
  return (
    <Card className="animate-fade-in-up stagger-3">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Variantes</CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            {variants.length} variantes
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Cargando...
          </div>
        ) : filteredVariants.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Palette className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {variants.length === 0
                ? "No hay variantes creadas"
                : "No se encontraron variantes"}
            </p>
            <SpecularActionButton
              tone="add"
              className="h-8 mt-1"
              onClick={onAdd}
            >

              Agregar variante
            </SpecularActionButton>
          </div>
        ) : (
          <>
          {/* Celular: una pastilla deslizable por variante (editar/eliminar al
              deslizar), como en el Catalogo. */}
          <div className="md:hidden">
            <VariantSwipeList
              variantes={filteredVariants}
              getProductName={getProductName}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Producto
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Talla
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Color
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    SKU
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Precio
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Stock
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVariants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell className="font-medium text-sm">
                      {getProductName(variant.producto_id)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {variant.talla || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {variant.color ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full border"
                            style={{ backgroundColor: variant.color }}
                          />
                          {variant.color}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {variant.sku || "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      ${variant.precio_venta.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {variant.stock_actual}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => onEdit(variant)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <BotonEliminar
                          nombre={`la variante ${[variant.talla, variant.color].filter(Boolean).join(" / ") || ""}`.trim()}
                          detalle="No se puede deshacer"
                          onEliminar={async () => {
                            await onDelete(variant);
                          }}
                        />
                      </div>
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