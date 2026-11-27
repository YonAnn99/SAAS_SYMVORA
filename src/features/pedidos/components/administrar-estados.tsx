"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { codigoDeErrorPedido } from "../transiciones";
import { eliminarEstadoPedido, guardarEstadoPedido, ordenarEstadosPedido, type DatosEstado } from "../pedidos-service";
import type { EstadoPropio } from "../types";

const COLORES = ["#0D9488", "#CA8A04", "#2563EB", "#7C3AED", "#16A34A", "#DB2777", "#EA3829", "#64748B"];
const MAX_ESTADOS = 15;

/**
 * «Administrar mis estados» (estilo Kyte): el negocio crea, renombra, colorea, reordena, desactiva y borra sus estados.
 * Los del sistema (Confirmado, Entregado, Cancelado) se renombran y recolorean; su función no cambia. Los que ya usó
 * un pedido solo se desactivan: el historial conserva su nombre y color.
 */
export function AdministrarEstados({
  tenantId,
  estados,
  onCambio,
  onVolver,
}: {
  tenantId: string;
  estados: EstadoPropio[];
  onCambio: () => Promise<void> | void;
  onVolver: () => void;
}) {
  const t = useTranslations("orders.v2.manage");
  const [editando, setEditando] = useState<EstadoPropio | "nuevo" | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(COLORES[0]);
  const [base, setBase] = useState<DatosEstado["base"]>("en_curso");
  const [aplicaA, setAplicaA] = useState<DatosEstado["aplica_a"]>("ambos");
  const [activo, setActivo] = useState(true);

  const abrir = (e: EstadoPropio | "nuevo") => {
    setEditando(e);
    if (e === "nuevo") {
      setNombre("");
      setColor(COLORES[estados.length % COLORES.length]);
      setBase("en_curso");
      setAplicaA("ambos");
      setActivo(true);
    } else {
      setNombre(e.nombre);
      setColor(e.color);
      setBase(e.base);
      setAplicaA(e.aplica_a);
      setActivo(e.activo);
    }
  };

  const guardar = async () => {
    if (!editando) return;
    setGuardando(true);
    try {
      await guardarEstadoPedido(tenantId, editando === "nuevo" ? null : editando.id, { nombre, color, base, aplica_a: aplicaA, activo });
      toast.success(t("saved"));
      setEditando(null);
      await onCambio();
    } catch (error) {
      const texto = (error as { message?: string } | null)?.message ?? "";
      toast.error(/Máximo/.test(texto) ? t("max", { max: MAX_ESTADOS }) : /sistema/.test(texto) ? t("systemLocked") : t("failed"));
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (e: EstadoPropio) => {
    setGuardando(true);
    try {
      const accion = await eliminarEstadoPedido(tenantId, e.id);
      toast.success(accion === "borrado" ? t("deleted") : t("deactivated"));
      await onCambio();
    } catch (error) {
      const texto = (error as { message?: string } | null)?.message ?? "";
      toast.error(/sistema/.test(texto) ? t("systemLocked") : t("failed"));
    } finally {
      setGuardando(false);
    }
  };

  const mover = async (e: EstadoPropio, delta: -1 | 1) => {
    const orden = [...estados].sort((a, b) => a.orden - b.orden);
    const i = orden.findIndex((x) => x.id === e.id);
    const j = i + delta;
    if (j < 0 || j >= orden.length) return;
    [orden[i], orden[j]] = [orden[j], orden[i]];
    try {
      await ordenarEstadosPedido(tenantId, orden.map((x) => x.id));
      await onCambio();
    } catch (error) {
      toast.error(t("failed"));
      void codigoDeErrorPedido((error as { message?: string } | null)?.message);
    }
  };

  if (editando) {
    return (
      <div className="space-y-3 text-sm">
        <p className="font-medium">{editando === "nuevo" ? t("newTitle") : t("editTitle")}</p>
        <label className="block text-xs font-medium">
          {t("name")}
          <Input value={nombre} maxLength={30} onChange={(e) => setNombre(e.target.value)} className="mt-1" />
        </label>
        <div>
          <p className="mb-1 text-xs font-medium">{t("color")}</p>
          <div className="flex flex-wrap gap-2">
            {COLORES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {editando === "nuevo" || !editando.es_sistema ? (
          <>
            <label className="block text-xs font-medium">
              {t("base")}
              <select value={base} onChange={(e) => setBase(e.target.value as DatosEstado["base"])} className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2">
                <option value="confirmado">{t("bases.confirmado")}</option>
                <option value="en_curso">{t("bases.en_curso")}</option>
                <option value="entregado">{t("bases.entregado")}</option>
              </select>
            </label>
            <label className="block text-xs font-medium">
              {t("appliesTo")}
              <select value={aplicaA} onChange={(e) => setAplicaA(e.target.value as DatosEstado["aplica_a"])} className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2">
                <option value="ambos">{t("applies.ambos")}</option>
                <option value="recoger">{t("applies.recoger")}</option>
                <option value="domicilio">{t("applies.domicilio")}</option>
              </select>
            </label>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t("systemNote")}</p>
        )}
        {editando !== "nuevo" && !editando.es_sistema && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium">{t("active")}</span>
            <Switch checked={activo} onCheckedChange={setActivo} aria-label={t("active")} />
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={guardando} onClick={() => setEditando(null)}>
            {t("back")}
          </Button>
          <Button className="flex-1" disabled={guardando || !nombre.trim()} onClick={() => void guardar()}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("save")}
          </Button>
        </div>
      </div>
    );
  }

  const orden = [...estados].sort((a, b) => a.orden - b.orden);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("desc")}</p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {orden.map((e, i) => (
          <li key={e.id} className="flex items-center gap-2 px-3 py-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: e.color }} aria-hidden="true" />
            <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => abrir(e)}>
              {e.nombre}
              {!e.activo && <span className="ml-2 text-xs text-muted-foreground">({t("inactive")})</span>}
              {e.es_sistema && <span className="ml-2 text-xs text-muted-foreground">({t("system")})</span>}
            </button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={guardando || i === 0} onClick={() => void mover(e, -1)} aria-label={t("up")}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={guardando || i === orden.length - 1} onClick={() => void mover(e, 1)} aria-label={t("down")}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            {!e.es_sistema && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={guardando} onClick={() => void borrar(e)} aria-label={t("delete")}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" disabled={estados.length >= MAX_ESTADOS} onClick={() => abrir("nuevo")}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("add")}
        </Button>
        <Button variant="outline" onClick={onVolver}>
          {t("back")}
        </Button>
      </div>
    </div>
  );
}
