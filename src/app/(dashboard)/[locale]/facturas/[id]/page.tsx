"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
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
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Download,
  FileDown,
  Stamp,
  XCircle,
  Building2,
  User,
  Receipt,
  Hash,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Factura, FacturaDetalle } from "@/lib/types/database";
import { useIsDemo } from "@/hooks/use-is-demo";
import { DemoRestrictedNotice } from "@/components/demo/demo-restricted-notice";

export default function FacturaDetailPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const isDemo = useIsDemo();
  const params = useParams<{ id: string }>();
  const facturaId = params.id;

  const [factura, setFactura] = useState<Factura | null>(null);
  const [detalle, setDetalle] = useState<FacturaDetalle[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchFactura = async () => {
      if (!facturaId) return;
      const supabase = createSupabaseBrowserClient();

      const { data: facturaData } = await supabase
        .from("facturas")
        .select("*")
        .eq("id", facturaId)
        .single();

      if (facturaData) {
        setFactura(facturaData);
        const { data: detalleData } = await supabase
          .from("factura_detalle")
          .select("*")
          .eq("factura_id", facturaId)
          .order("orden");

        if (detalleData) setDetalle(detalleData);
      }
      setLoading(false);
    };

    fetchFactura();
  }, [facturaId]);

  const handleStamp = async () => {
    if (!factura) return;
    if (isDemo) {
      toast.error("Las acciones de facturación no están disponibles en el modo demo.");
      return;
    }
    setProcessing(true);
    try {
      const response = await fetch("/api/facturas/stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factura_id: factura.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al timbrar");
      toast.success(data.message || "Factura timbrada");
      router.refresh();
      window.location.reload();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error al timbrar");
    } finally {
      setProcessing(false);
    }
  };

  const getEstadoBadge = (estado: Factura["estado"]) => {
    switch (estado) {
      case "BORRADOR":
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Borrador</Badge>;
      case "TIMBRADA":
        return <Badge className="text-[10px] px-1.5 py-0">Timbrada</Badge>;
      case "CANCELADA":
        return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Cancelada</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!factura) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Receipt className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Factura no encontrada</p>
        <SpecularActionButton
          tone="neutral"
          className="h-8"
          onClick={() => router.push(`/${locale}/facturas`)}
        >
          Volver
        </SpecularActionButton>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push(`/${locale}/facturas`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight font-mono">
              {factura.serie}-{factura.folio}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Facturación electrónica CFDI 4.0
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {factura.estado === "BORRADOR" && (
            <SpecularActionButton
              tone="money"
              className="h-8 active:scale-[0.98] transition-transform"
              onClick={handleStamp}
              disabled={processing}
            >
              <Stamp className="mr-1.5 h-3.5 w-3.5" />
              {processing ? "Timbrando..." : t("facturas.stamp")}
            </SpecularActionButton>
          )}
          {factura.estado === "TIMBRADA" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => window.open(`/api/facturas/${factura.id}/xml`, "_blank")}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                XML
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => window.open(`/api/facturas/${factura.id}/pdf`, "_blank")}
              >
                <FileDown className="mr-1.5 h-3.5 w-3.5" />
                PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 animate-fade-in-up stagger-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Emisor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{factura.emisor_razon_social}</p>
            <p className="text-muted-foreground font-mono text-xs">RFC: {factura.emisor_rfc}</p>
            <p className="text-muted-foreground text-xs">Régimen: {factura.emisor_regimen_fiscal}</p>
            <p className="text-muted-foreground text-xs">CP: {factura.emisor_codigo_postal}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Receptor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{factura.receptor_razon_social}</p>
            <p className="text-muted-foreground font-mono text-xs">RFC: {factura.receptor_rfc}</p>
            <p className="text-muted-foreground text-xs">
              Régimen: {factura.receptor_regimen_fiscal}
            </p>
            <p className="text-muted-foreground text-xs">
              Uso CFDI: {factura.receptor_uso_cfdi} · CP: {factura.receptor_codigo_postal}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="animate-fade-in-up stagger-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t("facturas.concepts")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider">Concepto</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider">Cant.</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Unidad</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider">P. Unitario</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider">Descuento</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detalle.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm">{item.descripcion}</TableCell>
                  <TableCell className="text-right text-sm font-mono">{item.cantidad}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.unidad}</TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    ${item.precio_unitario.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    ${item.descuento.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    ${item.subtotal.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator className="my-4" />
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">${factura.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">Descuento</span>
              <span className="font-mono">${factura.descuento.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">IVA (16%)</span>
              <span className="font-mono">${factura.impuesto.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-8 font-semibold">
              <span>Total</span>
              <span className="font-mono">${factura.total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up stagger-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            Detalles CFDI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estado</span>
            {getEstadoBadge(factura.estado)}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Método de pago</span>
            <span className="font-mono">{factura.metodo_pago}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Forma de pago</span>
            <span className="font-mono">{factura.forma_pago}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha emisión</span>
            <span>{new Date(factura.fecha_emision).toLocaleString("es-MX")}</span>
          </div>
          {factura.uuid_cfdi && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">UUID</span>
              <span className="font-mono text-xs text-right">{factura.uuid_cfdi}</span>
            </div>
          )}
          {factura.fecha_timbrado && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha timbrado</span>
              <span>{new Date(factura.fecha_timbrado).toLocaleString("es-MX")}</span>
            </div>
          )}
          {factura.pac_nombre && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">PAC</span>
              <span>{factura.pac_nombre}</span>
            </div>
          )}
          {factura.estado === "CANCELADA" && (
            <>
              {factura.fecha_cancelacion && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha cancelación</span>
                  <span>{new Date(factura.fecha_cancelacion).toLocaleString("es-MX")}</span>
                </div>
              )}
              {factura.motivo_cancelacion && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Motivo</span>
                  <span className="text-right">{factura.motivo_cancelacion}</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}