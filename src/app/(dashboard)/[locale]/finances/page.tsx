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
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [saldoReal, setSaldoReal] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [totalVentas, setTotalVentas] = useState(0);

  useEffect(() => {
    fetchCashRegister();
  }, []);

  const fetchCashRegister = async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

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

      const { data: movementData } = await supabase
        .from("movimientos_caja")
        .select("*")
        .eq("caja_id", register.id)
        .order("fecha", { ascending: false });

      if (movementData) {
        setMovements(movementData);
      }

      const { data: ventasData } = await supabase
        .from("ventas")
        .select("total")
        .eq("tenant_id", register.tenant_id)
        .eq("usuario_id", user.id)
        .eq("estado", "COMPLETADA")
        .gte("fecha_venta", register.fecha_apertura);

      if (ventasData) {
        const ventasTotal = ventasData.reduce((sum, v) => sum + v.total, 0);
        setTotalVentas(ventasTotal);
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

    const saldoEsperado = activeRegister.fondo_inicial + totalEntradas - totalSalidas + totalVentas;
    const saldoRealNum = parseFloat(saldoReal) || 0;
    const diferencia = saldoRealNum - saldoEsperado;

    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("cajas")
      .update({
        estado: "CERRADA",
        fecha_cierre: new Date().toISOString(),
        total_ventas: totalVentas,
        total_entradas: totalEntradas,
        total_salidas: totalSalidas,
        saldo_esperado: saldoEsperado,
        saldo_real: saldoRealNum,
        diferencia,
        notas_cierre: closingNotes || null,
      })
      .eq("id", activeRegister.id);

    setActiveRegister(null);
    setMovements([]);
    setTotalVentas(0);
    setShowCloseDialog(false);
    setSaldoReal("");
    setClosingNotes("");
  };

  const totalEntradas = movements
    .filter((m) => m.tipo === "ENTRADA")
    .reduce((sum, m) => sum + m.monto, 0);

  const totalSalidas = movements
    .filter((m) => m.tipo === "SALIDA")
    .reduce((sum, m) => sum + m.monto, 0);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {t("finances.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Control de caja y movimientos financieros
          </p>
        </div>
        {!activeRegister ? (
          <Button onClick={() => setShowOpenDialog(true)} size="sm" className="h-8 active:scale-[0.98] transition-transform">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("pos.openRegister")}
          </Button>
        ) : (
          <Button variant="destructive" onClick={() => setShowCloseDialog(true)} size="sm" className="h-8 active:scale-[0.98] transition-transform">
            {t("pos.closeRegister")}
          </Button>
        )}
      </div>

      {/* Cash register status */}
      <div className="grid gap-4 md:grid-cols-5">
        {[
          { title: t("pos.initialFund"), value: `$${activeRegister?.fondo_inicial.toFixed(2) || "0.00"}`, icon: Wallet, color: "" },
          { title: "Ventas", value: `+$${totalVentas.toFixed(2)}`, icon: ArrowUpCircle, color: "text-blue-600 dark:text-blue-400" },
          { title: t("finances.movementTypes.ENTRY"), value: `+$${totalEntradas.toFixed(2)}`, icon: ArrowUpCircle, color: "text-[#346538] dark:text-[#7BC67E]" },
          { title: t("finances.movementTypes.EXIT"), value: `-$${totalSalidas.toFixed(2)}`, icon: ArrowDownCircle, color: "text-[#9F2F2D] dark:text-[#F2A5A4]" },
          { title: t("finances.balance"), value: `$${(activeRegister?.fondo_inicial || 0) + totalEntradas - totalSalidas + totalVentas}`, icon: Wallet, color: "" },
        ].map((card, i) => (
          <Card key={card.title} className={`animate-fade-in-up stagger-${i + 2}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {card.title}
              </CardTitle>
              <card.icon className={`h-3.5 w-3.5 ${card.color || "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-lg font-semibold tracking-tight font-mono ${card.color}`}>{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Movements */}
      <Card className="animate-fade-in-up stagger-6">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3">
          <CardTitle className="text-sm font-medium">{t("finances.movements")}</CardTitle>
          {activeRegister && (
            <Button onClick={() => setShowMovementDialog(true)} size="sm" className="h-8 active:scale-[0.98] transition-transform">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t("finances.addMovement")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              No hay movimientos registrados
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">{t("common.date")}</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">{t("common.description")}</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">{t("common.status")}</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("common.total")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="text-sm">
                      {new Date(movement.fecha).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{movement.descripcion}</TableCell>
                    <TableCell>
                      <Badge
                        variant={movement.tipo === "ENTRADA" ? "default" : "destructive"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {t(`finances.movementTypes.${movement.tipo}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      <span
                        className={
                          movement.tipo === "ENTRADA"
                            ? "text-[#346538] dark:text-[#7BC67E]"
                            : "text-[#9F2F2D] dark:text-[#F2A5A4]"
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Open register dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">{t("pos.openRegister")}</DialogTitle>
            <DialogDescription className="text-xs">
              Ingresa el fondo inicial para abrir la caja
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("pos.initialFund")}</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={initialFund}
                onChange={(e) => setInitialFund(e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowOpenDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" className="h-8 active:scale-[0.98] transition-transform" onClick={handleOpenRegister}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add movement dialog */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">{t("finances.addMovement")}</DialogTitle>
            <DialogDescription className="text-xs">
              Registra un movimiento de entrada o salida
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("common.status")}</Label>
              <Select
                value={movementType}
                onValueChange={(v) => setMovementType(v as "ENTRADA" | "SALIDA")}
              >
                <SelectTrigger className="h-8 text-sm">
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
            <div className="space-y-1.5">
              <Label className="text-xs">{t("common.total")}</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("common.description")}</Label>
              <Input
                placeholder="Descripción del movimiento"
                value={movementDescription}
                onChange={(e) => setMovementDescription(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowMovementDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" className="h-8 active:scale-[0.98] transition-transform" onClick={handleAddMovement}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close register dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Cerrar caja</DialogTitle>
            <DialogDescription className="text-xs">
              Ingresa el saldo real para cerrar la caja
            </DialogDescription>
          </DialogHeader>
          {activeRegister && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fondo inicial</span>
                  <span className="font-mono">${activeRegister.fondo_inicial.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ventas</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">+${totalVentas.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entradas</span>
                  <span className="font-mono text-[#346538] dark:text-[#7BC67E]">+${totalEntradas.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salidas</span>
                  <span className="font-mono text-[#9F2F2D] dark:text-[#F2A5A4]">-${totalSalidas.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Saldo esperado</span>
                  <span className="font-mono">${(activeRegister.fondo_inicial + totalEntradas - totalSalidas + totalVentas).toFixed(2)}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Saldo real (contado) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={saldoReal}
                  onChange={(e) => setSaldoReal(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              {saldoReal && (
                <div className={`rounded-lg p-3 text-sm font-medium ${
                  (parseFloat(saldoReal) || 0) - (activeRegister.fondo_inicial + totalEntradas - totalSalidas + totalVentas) >= 0
                    ? "bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]"
                    : "bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#9F2F2D]/20 dark:text-[#F2A5A4]"
                }`}>
                  Diferencia: ${((parseFloat(saldoReal) || 0) - (activeRegister.fondo_inicial + totalEntradas - totalSalidas + totalVentas)).toFixed(2)}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Notas de cierre</Label>
                <Input
                  placeholder="Observaciones (opcional)"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowCloseDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" size="sm" className="h-8" onClick={handleCloseRegister}>
              Cerrar caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
