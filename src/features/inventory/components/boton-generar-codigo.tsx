"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { generateNextBarcode } from "../services/product-service";

/**
 * "Generar" junto al campo de codigo de barras: pone un EAN-13 interno "200..."
 * libre en el negocio (para productos o variantes que no traen codigo).
 */
export function BotonGenerarCodigo({ onCodigo }: { onCodigo: (codigo: string) => void }) {
  const { tenantId } = useCurrentTenant();
  const t = useTranslations("products.generateCode");
  const [generando, setGenerando] = useState(false);

  const generar = async () => {
    if (!tenantId) return;
    setGenerando(true);
    try {
      onCodigo(await generateNextBarcode(tenantId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error"));
    } finally {
      setGenerando(false);
    }
  };

  return (
    <button
      type="button"
      onClick={generar}
      disabled={generando || !tenantId}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
      title={t("title")}
    >
      {generando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
      {t("label")}
    </button>
  );
}
