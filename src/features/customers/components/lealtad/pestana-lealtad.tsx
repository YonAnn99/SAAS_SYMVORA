"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, Gift, Loader2, PauseCircle, Plus, QrCode, Search, Settings2, SlidersHorizontal, Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Cliente } from "@/lib/types/database";
import { DIAS_INACTIVO, esInactiva, panelLealtad, progreso } from "@/features/lealtad/lealtad";
import type { useLealtad } from "@/features/lealtad/use-lealtad";
import { SEMANAS_PANEL, type TarjetaConCliente } from "@/features/lealtad/lealtad-service";
import { ALTO_GRAFICA_CHICA } from "@/components/charts/tarjeta-grafica";
import { CustomerSelector } from "../customer-selector";
import { NewCustomerDialog } from "../new-customer-dialog";
import { FormularioPrograma } from "./formulario-programa";
import { QrMostrador } from "./qr-mostrador";
import { VentanaTarjeta, type TarjetaParaVentana } from "./ventana-tarjeta";

type Lealtad = ReturnType<typeof useLealtad>;

// Chart.js solo baja al abrir la pestaña.
const GraficaSellos = dynamic(() => import("./grafica-sellos").then((m) => m.GraficaSellos), {
  ssr: false,
  loading: () => <div className={`${ALTO_GRAFICA_CHICA} w-full animate-pulse rounded-md bg-muted`} />,
});

type Filtro = "todas" | "un-sello" | "premio" | "inactivas" | "qr";

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: "todas", texto: "Todas" },
  { valor: "un-sello", texto: "A un sello" },
  { valor: "premio", texto: "Con premio" },
  { valor: "inactivas", texto: `Sin venir ${DIAS_INACTIVO} días` },
  { valor: "qr", texto: "Se unieron con QR" },
];

function diasTexto(dias: number | null): string {
  if (dias == null) return "—";
  if (dias < 1) return "< 1 día";
  const n = dias < 10 ? Math.round(dias * 10) / 10 : Math.round(dias);
  return `${n} ${n === 1 ? "día" : "días"}`;
}

function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function paraVentana(t: TarjetaConCliente): TarjetaParaVentana {
  return {
    id: t.id,
    codigo: t.codigo,
    sellos: t.sellos,
    clienteNombre: t.cliente?.nombre ?? "Cliente",
    clienteEmail: t.cliente?.email ?? null,
  };
}

/**
 * Pestaña "Tarjetas de lealtad" de Clientes (migracion 115): configuracion
 * del programa, resumen del mes y la lista de tarjetas.
 */
export function PestanaLealtad({
  lealtad,
  puedeConfigurar,
  tenantId,
  clientes,
  onClienteCreado,
}: {
  lealtad: Lealtad;
  /** `loyalty.manage`: configura el programa y ajusta sellos. */
  puedeConfigurar: boolean;
  tenantId: string;
  clientes: Cliente[];
  onClienteCreado: () => void;
}) {
  const { programa, tarjetas, resumen, cargando, guardando, guardar, emitir, ajustar, refrescar } = lealtad;
  const [configAbierta, setConfigAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [ventana, setVentana] = useState<TarjetaParaVentana | null>(null);
  const [ajustando, setAjustando] = useState<TarjetaConCliente | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const listaRef = useRef<HTMLDivElement>(null);
  const metaPrograma = programa?.sellos_meta ?? 10;

  const panel = useMemo(
    () => panelLealtad(tarjetas, resumen?.sellosRecientes ?? [], metaPrograma, new Date(), { numSemanas: SEMANAS_PANEL }),
    [tarjetas, resumen, metaPrograma]
  );

  const filtradas = useMemo(() => {
    const ahora = new Date();
    const porFiltro = tarjetas.filter((t) => {
      if (filtro === "todas") return true;
      if (filtro === "qr") return t.origen === "qr";
      if (!t.activa) return false;
      const p = progreso(t.sellos, metaPrograma);
      if (filtro === "un-sello") return p.faltan === 1;
      if (filtro === "premio") return p.premiosDisponibles > 0;
      return esInactiva(t, ahora);
    });
    const q = busqueda.trim().toLowerCase();
    if (!q) return porFiltro;
    return porFiltro.filter(
      (t) => t.cliente?.nombre.toLowerCase().includes(q) || t.codigo.toLowerCase().includes(q.replace(/-/g, ""))
    );
  }, [tarjetas, busqueda, filtro, metaPrograma]);

  if (cargando) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sin programa: bienvenida (y el formulario directo para quien puede crearlo).
  if (!programa) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stamp className="h-5 w-5 text-primary" />
            Premia a tus clientes frecuentes
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Cada compra suma un sello en una tarjeta digital con tu logo. Al completar los sellos, tu cliente se
            lleva el premio que tú elijas (por ejemplo, «10 cafés = 1 gratis»). Tu cliente la abre desde su
            celular, sin descargar nada.
          </p>
        </CardHeader>
        <CardContent>
          {puedeConfigurar ? (
            <FormularioPrograma programa={null} puedeEditar guardando={guardando} onGuardar={guardar} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Pídele al dueño del negocio que configure el programa de lealtad.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const meta = programa.sellos_meta;

  // Reactivar sin abrir la configuracion: se guarda el programa tal cual, con
  // `activo` en true.
  const activar = () =>
    void guardar({
      nombre: programa.nombre,
      sellos_meta: programa.sellos_meta,
      premio_descripcion: programa.premio_descripcion,
      premio_tipo: programa.premio_tipo,
      premio_producto_id: programa.premio_producto_id,
      premio_valor: programa.premio_valor != null ? Number(programa.premio_valor) : null,
      compra_minima: Number(programa.compra_minima),
      paleta: programa.paleta,
      color_acento: programa.color_acento,
      icono_sello: programa.icono_sello,
      color_fondo: programa.color_fondo,
      alta_publica: programa.alta_publica,
      aviso_privacidad_url: programa.aviso_privacidad_url,
      activo: true,
    });

  return (
    <div className="space-y-4">
      {/* Pausado: sin esto, "Nueva tarjeta" deshabilitado no decia por que. */}
      {!programa.activo && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center dark:text-amber-300">
          <PauseCircle className="hidden h-5 w-5 shrink-0 sm:block" aria-hidden="true" />
          <p className="flex-1">
            <span className="font-medium">El programa de lealtad está pausado.</span> No se suman sellos ni se
            pueden crear tarjetas nuevas.
            {!puedeConfigurar && " Pídele al dueño del negocio que lo active."}
          </p>
          {puedeConfigurar && (
            <Button size="sm" className="h-8 shrink-0 gap-1.5" onClick={activar} disabled={guardando}>
              {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Activar programa
            </Button>
          )}
        </div>
      )}

      {/* Resumen del mes */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { etiqueta: "Tarjetas activas", valor: resumen?.tarjetasActivas ?? 0 },
          { etiqueta: "Sellos este mes", valor: resumen?.sellosDelMes ?? 0 },
          { etiqueta: "Premios este mes", valor: resumen?.canjesDelMes ?? 0 },
        ].map((c) => (
          <Card key={c.etiqueta}>
            <CardContent className="p-3 sm:p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.etiqueta}</p>
              <p className="mt-1 font-mono text-xl font-semibold">{c.valor}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quien vuelve y quien esta cerca del premio. Las tarjetas con filtro
          llevan a la lista ya filtrada. */}
      <Card>
        <CardContent className="grid gap-5 p-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="grid grid-cols-2 gap-2.5 self-start">
            {[
              { etiqueta: "A un sello del premio", valor: String(panel.aUnSello), filtro: "un-sello" as Filtro },
              { etiqueta: "Premios por canjear", valor: String(panel.conPremio), filtro: "premio" as Filtro },
              {
                etiqueta: "Vuelven cada",
                valor: diasTexto(panel.diasEntreVisitas),
                nota: `${panel.recurrentes} ${panel.recurrentes === 1 ? "cliente volvió" : "clientes volvieron"}`,
              },
              {
                etiqueta: `Sin venir ${DIAS_INACTIVO} días`,
                valor: String(panel.inactivas),
                filtro: "inactivas" as Filtro,
              },
            ].map((m) => {
              const contenido = (
                <>
                  <p className="text-[11px] leading-tight text-muted-foreground">{m.etiqueta}</p>
                  <p className="mt-1 font-mono text-lg font-semibold">{m.valor}</p>
                  {"nota" in m && <p className="text-[10px] text-muted-foreground">{m.nota}</p>}
                </>
              );
              return "filtro" in m && m.filtro ? (
                <button
                  key={m.etiqueta}
                  type="button"
                  onClick={() => {
                    setFiltro(m.filtro);
                    listaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`rounded-xl border p-3 text-left transition-colors hover:border-primary/50 ${
                    filtro === m.filtro ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  {contenido}
                </button>
              ) : (
                <div key={m.etiqueta} className="rounded-xl border border-border p-3">
                  {contenido}
                </div>
              );
            })}
          </div>
          <GraficaSellos semanas={panel.semanas} />
        </CardContent>
      </Card>

      {/* Configuracion, plegada: ya existe y lo diario es la lista. */}
      <Card>
        <button
          type="button"
          onClick={() => setConfigAbierta((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
          aria-expanded={configAbierta}
        >
          <Settings2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{programa.nombre}</p>
            <p className="truncate text-xs text-muted-foreground">
              {meta} sellos = {programa.premio_descripcion}
              {programa.activo ? "" : " · Pausado"}
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${configAbierta ? "rotate-180" : ""}`} />
        </button>
        {configAbierta && (
          <CardContent className="border-t border-border pt-4">
            <FormularioPrograma
              // Se reinicia si el programa cambia por fuera (p. ej. "Activar"
              // del aviso): si no, guardaria su copia vieja y lo pausaria otra vez.
              key={programa.actualizado_en}
              programa={programa}
              puedeEditar={puedeConfigurar}
              guardando={guardando}
              onGuardar={guardar}
            />
          </CardContent>
        )}
      </Card>

      {programa.alta_publica && (
        <QrMostrador programa={programa} puedeConfigurar={puedeConfigurar} onCodigoCambiado={refrescar} />
      )}

      {/* Tarjetas */}
      <Card ref={listaRef} className="scroll-mt-4">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-medium">
              Tarjetas <span className="font-mono text-xs text-muted-foreground">{tarjetas.length}</span>
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-56 sm:flex-none">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar cliente o código"
                  className="h-8 pl-8 text-sm"
                />
              </div>
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setNuevaAbierta(true)}
                disabled={!programa.activo}
                title={programa.activo ? undefined : "Activa el programa para emitir tarjetas"}
              >
                <Plus className="h-3.5 w-3.5" />
                Nueva tarjeta
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tarjetas.length > 0 && (
            <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" role="radiogroup" aria-label="Filtrar tarjetas">
              {FILTROS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  role="radio"
                  aria-checked={filtro === f.valor}
                  onClick={() => setFiltro(f.valor)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    filtro === f.valor
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.texto}
                </button>
              ))}
            </div>
          )}
          {filtradas.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {tarjetas.length === 0
                ? "Aún no hay tarjetas. Crea la primera con «Nueva tarjeta» o desde la lista de clientes."
                : filtro !== "todas" && !busqueda.trim()
                  ? "Ninguna tarjeta en este grupo por ahora."
                  : "Ninguna tarjeta coincide con la búsqueda."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wider">Cliente</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Sellos</TableHead>
                    <TableHead className="hidden text-xs uppercase tracking-wider sm:table-cell">Última visita</TableHead>
                    <TableHead className="hidden text-right text-xs uppercase tracking-wider sm:table-cell">Premios</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((t) => {
                    const p = progreso(t.sellos, meta);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="max-w-48 text-sm font-medium">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{t.cliente?.nombre ?? "—"}</span>
                            {t.origen === "qr" && (
                              <span
                                className="shrink-0 rounded-full bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-pink-700 dark:text-pink-300"
                                title="Se registró solo con el QR del mostrador"
                              >
                                QR
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-32">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${p.pct}%` }} />
                            </div>
                            <span className="font-mono text-xs">
                              {t.sellos}/{meta}
                            </span>
                            {p.premiosDisponibles > 0 && (
                              <Gift className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-label="Premio listo" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                          {fechaCorta(t.ultima_visita)}
                        </TableCell>
                        <TableCell className="hidden text-right font-mono text-sm sm:table-cell">
                          {t.premios_canjeados}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setVentana(paraVentana(t))}
                              aria-label={`Ver tarjeta de ${t.cliente?.nombre ?? "cliente"}`}
                              title="Ver tarjeta"
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            {puedeConfigurar && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setAjustando(t)}
                                aria-label={`Ajustar sellos de ${t.cliente?.nombre ?? "cliente"}`}
                                title="Ajustar sellos"
                              >
                                <SlidersHorizontal className="h-4 w-4" />
                              </Button>
                            )}
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

      <VentanaTarjeta tarjeta={ventana} programa={programa} onOpenChange={(a) => !a && setVentana(null)} />

      <AjustarSellosDialog
        tarjeta={ajustando}
        meta={meta}
        onCerrar={() => setAjustando(null)}
        onAjustar={ajustar}
      />

      <NuevaTarjetaDialog
        abierta={nuevaAbierta}
        onOpenChange={setNuevaAbierta}
        tenantId={tenantId}
        clientes={clientes}
        tarjetas={tarjetas}
        onClienteCreado={onClienteCreado}
        onEmitir={async (clienteId) => {
          const estado = await emitir(clienteId);
          if (!estado) return false;
          const cliente = clientes.find((c) => c.id === clienteId);
          setVentana({
            id: estado.tarjeta_id,
            codigo: estado.codigo,
            sellos: estado.sellos,
            clienteNombre: cliente?.nombre ?? "Cliente",
            clienteEmail: cliente?.email ?? null,
          });
          return true;
        }}
      />
    </div>
  );
}

function AjustarSellosDialog({
  tarjeta,
  meta,
  onCerrar,
  onAjustar,
}: {
  tarjeta: TarjetaConCliente | null;
  meta: number;
  onCerrar: () => void;
  onAjustar: (tarjetaId: string, cantidad: number, nota: string) => Promise<boolean>;
}) {
  const [cantidad, setCantidad] = useState("1");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  if (!tarjeta) return null;
  const n = Math.trunc(Number(cantidad));
  const resultado = tarjeta.sellos + (Number.isFinite(n) ? n : 0);
  const valido = Number.isFinite(n) && n !== 0 && resultado >= 0 && nota.trim().length > 0;

  const confirmar = async () => {
    setGuardando(true);
    const ok = await onAjustar(tarjeta.id, n, nota.trim());
    setGuardando(false);
    if (ok) {
      setCantidad("1");
      setNota("");
      onCerrar();
    }
  };

  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Ajustar sellos</DialogTitle>
          <DialogDescription className="text-xs">
            {tarjeta.cliente?.nombre} tiene {tarjeta.sellos} de {meta} sellos. Usa números negativos para quitar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Sellos a sumar (o quitar)</Label>
            <Input
              type="number"
              step={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="h-8 font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Quedará en {Math.max(0, resultado)} sellos.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo</Label>
            <Input
              value={nota}
              maxLength={200}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej. Compra que no se escaneó"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button size="sm" onClick={confirmar} disabled={!valido || guardando} className="gap-1.5">
            {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NuevaTarjetaDialog({
  abierta,
  onOpenChange,
  tenantId,
  clientes,
  tarjetas,
  onClienteCreado,
  onEmitir,
}: {
  abierta: boolean;
  onOpenChange: (abierta: boolean) => void;
  tenantId: string;
  clientes: Cliente[];
  tarjetas: TarjetaConCliente[];
  onClienteCreado: () => void;
  onEmitir: (clienteId: string) => Promise<boolean>;
}) {
  const [clienteId, setClienteId] = useState("");
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const yaTiene = tarjetas.some((t) => t.cliente_id === clienteId);

  const emitir = async () => {
    setEmitiendo(true);
    const ok = await onEmitir(clienteId);
    setEmitiendo(false);
    if (ok) {
      setClienteId("");
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={abierta && !nuevoCliente} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Nueva tarjeta de lealtad</DialogTitle>
            <DialogDescription className="text-xs">
              Elige al cliente o regístralo con el botón de la derecha.
            </DialogDescription>
          </DialogHeader>
          <CustomerSelector
            customers={clientes}
            selectedCustomer={clienteId}
            onSelectCustomer={(id) => setClienteId(id === "none" ? "" : id)}
            onNewCustomer={() => setNuevoCliente(true)}
            allowGeneral={false}
            label="Cliente"
          />
          {yaTiene && (
            <p className="text-xs text-muted-foreground">
              Este cliente ya tiene tarjeta: se abrirá la que tiene.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={emitir} disabled={!clienteId || emitiendo} className="gap-1.5">
              {emitiendo && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {yaTiene ? "Ver tarjeta" : "Crear tarjeta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewCustomerDialog
        open={nuevoCliente}
        onOpenChange={setNuevoCliente}
        tenantId={tenantId}
        onCreated={(cliente) => {
          onClienteCreado();
          setClienteId(cliente.id);
        }}
      />
    </>
  );
}
