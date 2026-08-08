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
import { Plus, Wallet, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Caja, MovimientoCaja } from "@/lib/types/database";

export default function FinancesPage() {
  const t = useTranslations();
  const [activeRegister, setActiveRegister] = useState<Caja | null>(null);
  const [movements, setMovements] = useState<MovimientoCaja[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [initialFund, setInitialFund] = useState("");
  const [movementType, setMovementType] = useState<"ENTRADA" | "SALIDA">("ENTRADA");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementDescription, setMovementDescription] = useState("");

  useEffect(() => {
    fetchCashRegister();
  }, []);

  const fetchCashRegister = async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Get active cash register
    const { data: register } = await supabase
      .from("cajas")
      .select("*")
      .eq("usuario_id", user.id)
      .eq("estado", "ABIERTA")
      .order("fecha_apertura", { ascending: false })
      .limit(1)
      .single();

    if (register) {
      setActiveRegister(register);

      // Get movements
      const { data: movementData } = await supabase
        .from("movimientos_caja")
        .select("*")
        .eq("caja_id", register.id)
        .order("fecha", { ascending: false });

      if (movementData) {
        setMovements(movementData);
      }
    }

    setLoading(false);
  };

  const handleOpenRegister = async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("cajas")
      .insert({
        usuario_id: user.id,
        fondo_inicial: parseFloat(initialFund) || 0,
      })
      .select()
      .single();

    if (data) {
      setActiveRegister(data);
      setShowOpenDialog(false);
      setInitialFund("");
    }
  };

  const handleAddMovement = async () => {
    if (!activeRegister) return;

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("movimientos_caja").insert({
      caja_id: activeRegister.id,
      tipo: movementType,
      monto: parseFloat(movementAmount) || 0,
      descripcion: movementDescription,
    });

    if (!error) {
      setShowMovementDialog(false);
      setMovementAmount("");
      setMovementDescription("");
      fetchCashRegister();
    }
  };

  const handleCloseRegister = async () => {
    if (!activeRegister) return;

    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("cajas")
      .update({
        estado: "CERRADA",
        fecha_cierre: new Date().toISOString(),
      })
      .eq("id", activeRegister.id);

    setActiveRegister(null);
    setMovements([]);
  };

  const totalEntradas = movements
    .filter((m) => m.tipo === "ENTRADA")
    .reduce((sum, m) => sum + m.monto, 0);

  const totalSalidas = movements
    .filter((m) => m.tipo === "SALIDA")
    .reduce((sum, m) => sum + m.monto, 0);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {t("finances.title")}
          </h2>
          <p className="text-muted-foreground">
            Control de caja y movimientos financieros
          </p>
        </div>
        {!activeRegister ? (
          <Button onClick={() => setShowOpenDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("pos.openRegister")}
          </Button>
        ) : (
          <Button variant="destructive" onClick={handleCloseRegister}>
            {t("pos.closeRegister")}
          </Button>
        )}
      </div>

      {/* Cash register status */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("pos.initialFund")}
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${activeRegister?.fondo_inicial.toFixed(2) || "0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("finances.movementTypes.ENTRY")}
            </CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              +${totalEntradas.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("finances.movementTypes.EXIT")}
            </CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              -${totalSalidas.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("finances.balance")}
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(activeRegister?.fondo_inicial || 0) + totalEntradas - totalSalidas}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Movements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("finances.movements")}</CardTitle>
            <CardDescription>Movimientos de la sesión actual</CardDescription>
          </div>
          {activeRegister && (
            <Button onClick={() => setShowMovementDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("finances.addMovement")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              No hay movimientos registrados
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("common.description")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.total")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>
                      {new Date(movement.fecha).toLocaleString()}
                    </TableCell>
                    <TableCell>{movement.descripcion}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          movement.tipo === "ENTRADA" ? "default" : "destructive"
                        }
                      >
                        {t(`finances.movementTypes.${movement.tipo}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          movement.tipo === "ENTRADA"
                            ? "text-green-500"
                            : "text-red-500"
                        }
                      >
                        {movement.tipo === "ENTRADA" ? "+" : "-"}$
                        {movement.monto.toFixed(2)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Open register dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pos.openRegister")}</DialogTitle>
            <DialogDescription>
              Ingresa el fondo inicial para abrir la caja
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("pos.initialFund")}</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={initialFund}
                onChange={(e) => setInitialFund(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowOpenDialog(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleOpenRegister}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add movement dialog */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("finances.addMovement")}</DialogTitle>
            <DialogDescription>
              Registra un movimiento de entrada o salida
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.status")}</Label>
              <Select
                value={movementType}
                onValueChange={(v) => setMovementType(v as "ENTRADA" | "SALIDA")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">
                    {t("finances.movementTypes.ENTRY")}
                  </SelectItem>
                  <SelectItem value="SALIDA">
                    {t("finances.movementTypes.EXIT")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("common.total")}</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("common.description")}</Label>
              <Input
                placeholder="Descripción del movimiento"
                value={movementDescription}
                onChange={(e) => setMovementDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMovementDialog(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleAddMovement}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
