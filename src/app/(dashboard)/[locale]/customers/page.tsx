"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Contact, CreditCard, PauseCircle, Pencil, Search, Stamp } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { useCustomers, CreditPaymentDialog, EditCustomerDialog, deleteCustomer } from "@/features/customers";
import { BotonEliminar } from "@/components/ui/boton-eliminar";
import { logActivity } from "@/lib/supabase/activity-logger";
import type { Cliente } from "@/lib/types/database";
import { EncabezadoModulo } from "@/components/dashboard/encabezado-modulo";
import { useLealtad } from "@/features/lealtad/use-lealtad";
import { PestanaLealtad, paraVentana } from "@/features/customers/components/lealtad/pestana-lealtad";
import {
  VentanaTarjeta,
  type TarjetaParaVentana,
} from "@/features/customers/components/lealtad/ventana-tarjeta";

const PESTANAS = ["clientes", "lealtad"];

export default function CustomersPage() {
  const t = useTranslations();
  const { tenantId } = useCurrentTenant();
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const {
    customers,
    loading,
    refresh,
    paymentDialogFor,
    setPaymentDialogFor,
    savingPayment,
    handleRegisterPayment,
  } = useCustomers(tenantId);

  // Tarjetas de lealtad (migracion 115): viven en este modulo. La pestaña la
  // ve quien puede configurarla, y el resto del equipo cuando ya esta activa.
  const lealtad = useLealtad(tenantId);
  const puedeConfigurar = can("loyalty.manage");
  const programaActivo = Boolean(lealtad.programa?.activo);
  const verPestanaLealtad = puedeConfigurar || programaActivo;
  const [ventana, setVentana] = useState<TarjetaParaVentana | null>(null);
  const [emitiendo, setEmitiendo] = useState<string | null>(null);
  // Editar: misma regla que la base (RLS de `clientes`: `inventory.manage`).
  const puedeEditarClientes = can("inventory.manage");
  const [editando, setEditando] = useState<Cliente | null>(null);

  // Eliminar: misma regla que editar. Con saldo pendiente se bloquea en la
  // fila; con ventas, la base lo impide y `deleteCustomer` lo explica.
  const eliminarCliente = async (cliente: Cliente) => {
    const teniaTarjeta = Boolean(tarjetaDe(cliente.id));
    try {
      await deleteCustomer(cliente.id);
      void logActivity({
        action: "DELETE",
        entity: "cliente",
        entityId: cliente.id,
        entityName: cliente.nombre,
      });
      toast.success(`Cliente ${cliente.nombre} eliminado`);
      void refresh();
      // Su tarjeta de lealtad se borro en cascada.
      if (teniaTarjeta) void lealtad.refrescar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el cliente");
    }
  };

  // La pestaña sale de `?tab=` (mismo patron que Configuracion).
  const searchParams = useSearchParams();
  const [pestana, setPestana] = useState(() => {
    const pedida = searchParams.get("tab");
    return pedida && PESTANAS.includes(pedida) ? pedida : "clientes";
  });
  const cambiarPestana = (valor: unknown) => {
    const siguiente = typeof valor === "string" ? valor : "clientes";
    setPestana(siguiente);
    const url = new URL(window.location.href);
    if (siguiente === "clientes") url.searchParams.delete("tab");
    else url.searchParams.set("tab", siguiente);
    window.history.replaceState(null, "", url);
  };

  const filtered = customers.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const tarjetaDe = (clienteId: string) => lealtad.tarjetas.find((x) => x.cliente_id === clienteId);

  // Desde la fila: abre la tarjeta del cliente, o se la crea si no tiene.
  const abrirTarjeta = async (clienteId: string) => {
    const existente = tarjetaDe(clienteId);
    if (existente) {
      setVentana(paraVentana(existente));
      return;
    }
    setEmitiendo(clienteId);
    const estado = await lealtad.emitir(clienteId);
    setEmitiendo(null);
    if (!estado) return;
    const cliente = customers.find((c) => c.id === clienteId);
    toast.success("Tarjeta creada");
    setVentana({
      id: estado.tarjeta_id,
      codigo: estado.codigo,
      sellos: estado.sellos,
      clienteNombre: cliente?.nombre ?? "Cliente",
      clienteEmail: cliente?.email ?? null,
    });
  };

  const pestanaVisible = verPestanaLealtad ? pestana : "clientes";

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <EncabezadoModulo
            titulo={t("customers.title")}
            descripcion={t("customers.subtitle")}
          />
        </div>
      </div>

      <Tabs value={pestanaVisible} onValueChange={cambiarPestana} className="w-full animate-fade-in-up stagger-2">
        {verPestanaLealtad && (
          <TabsList>
            <TabsTrigger value="clientes" className="gap-1.5 text-xs">
              <Contact className="h-3.5 w-3.5" />
              {t("finances.customers")}
            </TabsTrigger>
            <TabsTrigger value="lealtad" className="gap-1.5 text-xs">
              <Stamp className="h-3.5 w-3.5" />
              Tarjetas de lealtad
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="clientes" className="space-y-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("customers.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Programa pausado: explica por que no aparece "Crear tarjeta". */}
          {lealtad.programa && !programaActivo && verPestanaLealtad && (
            <button
              type="button"
              onClick={() => cambiarPestana("lealtad")}
              className="flex w-full items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-800 dark:text-amber-300"
            >
              <PauseCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">
                El programa de lealtad está pausado: no se crean tarjetas ni se suman sellos.
              </span>
              <span className="shrink-0 font-medium underline underline-offset-2">Ver tarjetas de lealtad</span>
            </button>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {t("finances.customers")}
                </CardTitle>
                <span className="text-xs text-muted-foreground font-mono">
                  {customers.length} clientes
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                  {t("common.loading")}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <p className="text-sm text-muted-foreground">
                    {t("customers.noCustomers")}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs uppercase tracking-wider">
                          {t("customers.name")}
                        </TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wider">
                          {t("finances.balance")}
                        </TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wider">
                          {t("finances.creditLimit")}
                        </TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wider">
                          {t("common.actions")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((c) => {
                        const tarjeta = programaActivo ? tarjetaDe(c.id) : undefined;
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium text-sm">
                              {c.nombre}
                              {tarjeta && lealtad.programa && (
                                <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                                  {tarjeta.sellos}/{lealtad.programa.sellos_meta}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {c.saldo_pendiente > 0 ? (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] px-1.5 py-0 font-mono"
                                >
                                  ${c.saldo_pendiente.toFixed(2)}
                                </Badge>
                              ) : (
                                <span className="text-sm font-mono text-muted-foreground">
                                  $0.00
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono">
                              ${c.limite_credito.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {puedeEditarClientes && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setEditando(c)}
                                    aria-label={`Editar ${c.nombre}`}
                                    title="Editar cliente"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {puedeEditarClientes && (
                                  <BotonEliminar
                                    nombre={c.nombre}
                                    disabled={c.saldo_pendiente > 0}
                                    detalle={
                                      c.saldo_pendiente > 0
                                        ? "Tiene saldo pendiente: registra su abono antes de eliminarlo"
                                        : tarjetaDe(c.id)
                                          ? "También se borra su tarjeta de lealtad. No se puede deshacer"
                                          : "No se puede deshacer"
                                    }
                                    onEliminar={() => eliminarCliente(c)}
                                  />
                                )}
                                {programaActivo && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1 text-xs"
                                    disabled={emitiendo === c.id}
                                    onClick={() => void abrirTarjeta(c.id)}
                                    title={tarjeta ? "Ver tarjeta de lealtad" : "Crear tarjeta de lealtad"}
                                  >
                                    <CreditCard className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">{tarjeta ? "Tarjeta" : "Crear tarjeta"}</span>
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={c.saldo_pendiente <= 0}
                                  onClick={() => setPaymentDialogFor(c)}
                                >
                                  {t("finances.addPayment")}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {verPestanaLealtad && tenantId && (
          <TabsContent value="lealtad">
            <PestanaLealtad
              lealtad={lealtad}
              puedeConfigurar={puedeConfigurar}
              tenantId={tenantId}
              clientes={customers}
              onClienteCreado={() => void refresh()}
            />
          </TabsContent>
        )}
      </Tabs>

      {lealtad.programa && (
        <VentanaTarjeta
          tarjeta={ventana}
          programa={lealtad.programa}
          onOpenChange={(a) => !a && setVentana(null)}
        />
      )}

      <EditCustomerDialog
        cliente={editando}
        onOpenChange={(open) => !open && setEditando(null)}
        onSaved={(actualizado) => {
          void refresh();
          // Su nombre y correo tambien se ven en su tarjeta de lealtad.
          if (tarjetaDe(actualizado.id)) void lealtad.refrescar();
        }}
      />

      <CreditPaymentDialog
        cliente={paymentDialogFor}
        onOpenChange={(open) => !open && setPaymentDialogFor(null)}
        onConfirm={handleRegisterPayment}
        saving={savingPayment}
      />
    </div>
  );
}
