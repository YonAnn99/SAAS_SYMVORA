"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ShoppingCart, Truck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Compra, Proveedor } from "@/lib/types/database";

const statusColors: Record<string, string> = {
  PENDIENTE: "bg-[#FBF3DB] text-[#956400] dark:bg-[#956400]/20 dark:text-[#E5C46B]",
  RECIBIDA: "bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]",
  CANCELADA: "bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#9F2F2D]/20 dark:text-[#F2A5A4]",
};

export default function PurchasesPage() {
  const t = useTranslations();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPurchaseDialog, setShowNewPurchaseDialog] = useState(false);
  const [showNewSupplierDialog, setShowNewSupplierDialog] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseTotal, setPurchaseTotal] = useState("");

  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = createSupabaseBrowserClient();

    const { data: purchasesData } = await supabase
      .from("compras")
      .select(`
        *,
        proveedor:proveedor_id(nombre),
        usuario:usuario_id(email)
      `)
      .order("fecha_compra", { ascending: false });

    if (purchasesData) {
      setPurchases(purchasesData);
    }

    const { data: suppliersData } = await supabase
      .from("proveedores")
      .select("*")
      .order("nombre");

    if (suppliersData) {
      setSuppliers(suppliersData);
    }

    setLoading(false);
  };

  const handleCreatePurchase = async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !selectedSupplier) return;

    const { error } = await supabase.from("compras").insert({
      proveedor_id: selectedSupplier,
      usuario_id: user.id,
      numero_factura: invoiceNumber,
      total: parseFloat(purchaseTotal) || 0,
    });

    if (!error) {
      setShowNewPurchaseDialog(false);
      setSelectedSupplier("");
      setInvoiceNumber("");
      setPurchaseTotal("");
      fetchData();
    }
  };

  const handleCreateSupplier = async () => {
    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase.from("proveedores").insert({
      nombre: supplierName,
      contact_name: supplierContact,
      email: supplierEmail,
      telefono: supplierPhone,
    });

    if (!error) {
      setShowNewSupplierDialog(false);
      setSupplierName("");
      setSupplierContact("");
      setSupplierEmail("");
      setSupplierPhone("");
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-in-up stagger-1">
        <h2 className="text-2xl font-semibold tracking-tight">
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium">{t("purchases.title")}</CardTitle>
              <Button onClick={() => setShowNewPurchaseDialog(true)} size="sm" className="h-8 active:scale-[0.98] transition-transform">
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wider">{t("purchases.supplier")}</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">{t("purchases.invoiceNumber")}</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">{t("purchases.date")}</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">{t("purchases.status")}</TableHead>
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
                        <TableCell className="text-sm font-mono text-muted-foreground">{purchase.numero_factura || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(purchase.fecha_compra).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusColors[purchase.estado]} text-[10px] px-1.5 py-0`}>
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium">{t("purchases.supplier")}</CardTitle>
              <Button onClick={() => setShowNewSupplierDialog(true)} size="sm" className="h-8 active:scale-[0.98] transition-transform">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Agregar proveedor
              </Button>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wider">{t("common.name")}</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Contacto</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">{t("common.email")}</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">{t("common.phone")}</TableHead>
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
                        <TableCell className="text-sm text-muted-foreground">{supplier.contact_name || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{supplier.email || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{supplier.telefono || "-"}</TableCell>
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
        </TabsContent>
      </Tabs>

      {/* New purchase dialog */}
      <Dialog open={showNewPurchaseDialog} onOpenChange={setShowNewPurchaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">{t("purchases.addPurchase")}</DialogTitle>
            <DialogDescription className="text-xs">
              Registra una nueva compra con proveedor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("purchases.supplier")}</Label>
              <Select value={selectedSupplier} onValueChange={(v) => setSelectedSupplier(v || "")}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("purchases.invoiceNumber")}</Label>
              <Input
                placeholder="Número de factura"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("purchases.total")}</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={purchaseTotal}
                onChange={(e) => setPurchaseTotal(e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowNewPurchaseDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" className="h-8 active:scale-[0.98] transition-transform" onClick={handleCreatePurchase}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New supplier dialog */}
      <Dialog open={showNewSupplierDialog} onOpenChange={setShowNewSupplierDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Agregar proveedor</DialogTitle>
            <DialogDescription className="text-xs">
              Registra un nuevo proveedor en tu directorio
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("common.name")}</Label>
              <Input
                placeholder="Nombre del proveedor"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contacto</Label>
              <Input
                placeholder="Nombre del contacto"
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("common.email")}</Label>
              <Input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={supplierEmail}
                onChange={(e) => setSupplierEmail(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("common.phone")}</Label>
              <Input
                placeholder="Teléfono"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowNewSupplierDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" className="h-8 active:scale-[0.98] transition-transform" onClick={handleCreateSupplier}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
