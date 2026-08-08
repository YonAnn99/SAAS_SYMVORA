"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package } from "lucide-react";
import type { Producto } from "@/lib/types/database";

export default function ProductsPage() {
  const t = useTranslations();
  const [products, setProducts] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch products from Supabase
    setLoading(false);
  }, []);

  const filteredProducts = products.filter((product) =>
    product.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {t("products.title")}
          </h2>
          <p className="text-muted-foreground">
            Gestiona tu catálogo de productos
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("products.addProduct")}
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Products table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("products.title")}</CardTitle>
          <CardDescription>
            {products.length} productos registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[400px] items-center justify-center">
              {t("common.loading")}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <Package className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                {t("products.noProducts")}
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("products.addProduct")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("products.name")}</TableHead>
                  <TableHead>{t("products.barcode")}</TableHead>
                  <TableHead>{t("products.unit")}</TableHead>
                  <TableHead className="text-right">
                    {t("products.salePrice")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("products.currentStock")}
                  </TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.nombre}
                    </TableCell>
                    <TableCell>{product.codigo_barras || "-"}</TableCell>
                    <TableCell>
                      {t(`products.units.${product.unidad_medida}`)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${product.precio_venta.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.stock_actual}
                    </TableCell>
                    <TableCell>
                      {product.stock_actual <= product.stock_minimo ? (
                        <Badge variant="destructive">
                          {t("products.lowStock")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        {t("common.edit")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
