"use client";

import { useConfirmar } from "@/components/ui/confirmar";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { localeIntl } from "@/lib/idioma";
import { useRouter } from "@/i18n/navigation";
import { ArrowLeft, MoreVertical, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { BotonActualizar } from "@/components/ui/boton-actualizar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePriceLists } from "@/features/inventory/hooks/use-price-lists";

const MAX_NOMBRE = 30;

export default function PriceListsPage() {
  const t = useTranslations("products.priceLists");
  const locale = useLocale();
  const router = useRouter();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const { listas, loading, saving, refetch, crear, alternarActiva, eliminar } =
    usePriceLists(tenantId, tenantLoading);

  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const confirmar = useConfirmar();

  // Borrar una lista no se deshace (sus precios especiales se pierden).
  async function eliminarConfirmado(lista: Parameters<typeof eliminar>[0]) {
    const si = await confirmar({
      titulo: t("deleteTitle", { nombre: lista.nombre }),
      descripcion: t("deleteDesc"),
    });
    if (si) await eliminar(lista);
  }

  async function confirmarCreacion() {
    const lista = await crear(nombre);
    if (!lista) return;
    setCreando(false);
    setNombre("");
    // Se entra directo a elegir productos: una lista vacía no sirve de nada y
    // obligar a un clic más solo añade fricción.
    router.push(`/products/price-lists/${lista.id}`);
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 h-7 text-xs text-muted-foreground"
            onClick={() => router.push("/products")}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            {t("back")}
          </Button>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <BotonActualizar onActualizar={refetch} />
          <SpecularActionButton
            tone="money"
            className="h-8 active:scale-[0.98] transition-transform"
            onClick={() => setCreando(true)}
          >
            {t("create")}
          </SpecularActionButton>
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {t("loading")}
        </p>
      ) : listas.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border py-16 animate-fade-in-up stagger-2">
          <Tag className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {t("empty")}
          </p>
          <SpecularActionButton
            tone="money"
            className="h-8 mt-1"
            onClick={() => setCreando(true)}
          >
            {t("createFirst")}
          </SpecularActionButton>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in-up stagger-2">
          {listas.map((l) => (
            <div
              key={l.id}
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/products/price-lists/${l.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {l.nombre}
                    </span>
                    <Badge variant={l.activa ? "default" : "secondary"}>
                      {l.activa ? t("active") : t("draft")}
                    </Badge>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t("products", { count: l.productos })}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon" className="h-7 w-7" />
                    }
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => void alternarActiva(l)}>
                      {l.activa ? t("deactivate") : t("activate")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => void eliminarConfirmado(l)}
                    >
                      {t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {t("lastModified")}{" "}
                {new Date(l.actualizado_en).toLocaleDateString(localeIntl(locale), {
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={creando} onOpenChange={setCreando}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{t("newTitle")}</DialogTitle>
            <DialogDescription className="text-xs">
              {t("newDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("name")}</Label>
            <Input
              autoFocus
              value={nombre}
              maxLength={MAX_NOMBRE}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nombre.trim()) void confirmarCreacion();
              }}
              placeholder={t("namePlaceholder")}
              className="h-8 text-sm"
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {nombre.length} / {MAX_NOMBRE}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCreando(false)}
              disabled={saving}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={() => void confirmarCreacion()}
              disabled={!nombre.trim() || saving}
            >
              {saving ? t("creating") : t("continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
