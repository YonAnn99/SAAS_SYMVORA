"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="space-y-8">
      <div className="flex items-center justify-between animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("products.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tu catálogo de productos
          </p>
        </div>
        <Button size="sm" className="h-8 active:scale-[0.98] transition-transform">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("products.addProduct")}
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 animate-fade-in-up stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Products table */}
      <Card className="animate-fade-in-up stagger-3">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{t("products.title")}</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {products.length} productos
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Package className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {t("products.noProducts")}
              </p>
              <Button size="sm" className="h-8 mt-1 active:scale-[0.98] transition-transform">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("products.addProduct")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">{t("products.name")}</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">{t("products.barcode")}</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">{t("products.unit")}</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("products.salePrice")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("products.currentStock")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">{t("common.status")}</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium text-sm">
                      {product.nombre}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">{product.codigo_barras || "-"}</TableCell>
                    <TableCell className="text-sm">
                      {t(`products.units.${product.unidad_medida}`)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      ${product.precio_venta.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {product.stock_actual}
                    </TableCell>
                    <TableCell>
                      {product.stock_actual <= product.stock_minimo ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          {t("products.lowStock")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
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
