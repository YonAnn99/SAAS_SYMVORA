"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  RECIBIDA: "bg-green-100 text-green-800",
  CANCELADA: "bg-red-100 text-red-800",
};

export default function PurchasesPage() {
  const t = useTranslations();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPurchaseDialog, setShowNewPurchaseDialog] = useState(false);
  const [showNewSupplierDialog, setShowNewSupplierDialog] = useState(false);

  // New purchase form
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseTotal, setPurchaseTotal] = useState("");

  // New supplier form
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
      <div className="flex h-[400px] items-center justify-center">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          {t("purchases.title")}
        </h2>
        <p className="text-muted-foreground">
          Gestiona compras y proveedores
        </p>
      </div>

      <Tabs defaultValue="purchases" className="w-full">
        <TabsList>
          <TabsTrigger value="purchases" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            {t("purchases.title")}
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2">
            <Truck className="h-4 w-4" />
            {t("purchases.supplier")}
          </TabsTrigger>
        </TabsList>

        {/* Purchases tab */}
        <TabsContent value="purchases">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("purchases.title")}</CardTitle>
                <CardDescription>
                  {purchases.length} compras registradas
                </CardDescription>
              </div>
              <Button onClick={() => setShowNewPurchaseDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("purchases.addPurchase")}
              </Button>
            </CardHeader>
            <CardContent>
              {purchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {t("purchases.noPurchases")}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("purchases.supplier")}</TableHead>
                      <TableHead>{t("purchases.invoiceNumber")}</TableHead>
                      <TableHead>{t("purchases.date")}</TableHead>
                      <TableHead>{t("purchases.status")}</TableHead>
                      <TableHead className="text-right">
                        {t("purchases.total")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="font-medium">
                          {purchase.proveedor?.nombre || "N/A"}
                        </TableCell>
                        <TableCell>{purchase.numero_factura || "-"}</TableCell>
                        <TableCell>
                          {new Date(
                            purchase.fecha_compra
                          ).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[purchase.estado]}>
                            {t(`purchases.statuses.${purchase.estado}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
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

        {/* Suppliers tab */}
        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("purchases.supplier")}</CardTitle>
                <CardDescription>
                  {suppliers.length} proveedores registrados
                </CardDescription>
              </div>
              <Button onClick={() => setShowNewSupplierDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar proveedor
              </Button>
            </CardHeader>
            <CardContent>
              {suppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <Truck className="h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No hay proveedores registrados
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.name")}</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>{t("common.email")}</TableHead>
                      <TableHead>{t("common.phone")}</TableHead>
                      <TableHead className="text-right">
                        {t("common.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">
                          {supplier.nombre}
                        </TableCell>
                        <TableCell>{supplier.contact_name || "-"}</TableCell>
                        <TableCell>{supplier.email || "-"}</TableCell>
                        <TableCell>{supplier.telefono || "-"}</TableCell>
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
        </TabsContent>
      </Tabs>

      {/* New purchase dialog */}
      <Dialog
        open={showNewPurchaseDialog}
        onOpenChange={setShowNewPurchaseDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("purchases.addPurchase")}</DialogTitle>
            <DialogDescription>
              Registra una nueva compra con proveedor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("purchases.supplier")}</Label>
              <Select value={selectedSupplier} onValueChange={(v) => setSelectedSupplier(v || "")}>
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>{t("purchases.invoiceNumber")}</Label>
              <Input
                placeholder="Número de factura"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("purchases.total")}</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={purchaseTotal}
                onChange={(e) => setPurchaseTotal(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewPurchaseDialog(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreatePurchase}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New supplier dialog */}
      <Dialog
        open={showNewSupplierDialog}
        onOpenChange={setShowNewSupplierDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar proveedor</DialogTitle>
            <DialogDescription>
              Registra un nuevo proveedor en tu directorio
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input
                placeholder="Nombre del proveedor"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input
                placeholder="Nombre del contacto"
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("common.email")}</Label>
              <Input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={supplierEmail}
                onChange={(e) => setSupplierEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("common.phone")}</Label>
              <Input
                placeholder="Teléfono"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewSupplierDialog(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreateSupplier}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
