"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, Loader2, Package, Palette } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EncabezadoModulo } from "@/components/dashboard/encabezado-modulo";
import { useIsDemo } from "@/hooks/use-is-demo";
import { EstadoCatalogo } from "@/features/catalogo/components/estado-catalogo";
import { PersonalizarCatalogo } from "@/features/catalogo/components/personalizar-catalogo";
import { ProductosCatalogo } from "@/features/catalogo/components/productos-catalogo";
import { VistaPreviaCatalogo } from "@/features/catalogo/components/vista-previa-catalogo";
import { useConfigCatalogo } from "@/features/catalogo/use-config-catalogo";

const PESTANAS = ["productos", "personalizar", "vista-previa"];
const CLASE_PESTANA = "gap-1.5 text-xs max-sm:group-data-[variant=default]/tabs-list:px-1.5";

/**
 * Catálogo en línea (migraciones 124-125): la página pública de productos del
 * negocio, con pedido por WhatsApp. Aquí se publica, se eligen los productos
 * (ocultar, destacar, precio especial), se personaliza y se ve la vista previa.
 * Permiso `catalog.manage` (lo protege el middleware por `modules.ts`).
 */
export default function OnlineCatalogPage() {
  const searchParams = useSearchParams();
  const [pestana, setPestana] = useState(() => {
    const pedida = searchParams.get("tab");
    return pedida && PESTANAS.includes(pedida) ? pedida : "productos";
  });
  const cambiarPestana = (valor: unknown) => {
    const siguiente = typeof valor === "string" ? valor : "productos";
    setPestana(siguiente);
    const url = new URL(window.location.href);
    if (siguiente === "productos") url.searchParams.delete("tab");
    else url.searchParams.set("tab", siguiente);
    window.history.replaceState(null, "", url);
  };

  const esDemo = useIsDemo();
  const { tenantId, guardado, borrador, cargando, error, guardar } = useConfigCatalogo();

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="animate-fade-in-up stagger-1">
        <EncabezadoModulo
          titulo="Catálogo en línea"
          descripcion="Tu página de productos para que tus clientes te pidan por WhatsApp"
        />
      </div>

      {esDemo ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            El catálogo en línea no está disponible en la demo. Crea tu cuenta gratis para publicar el tuyo.
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No se pudo cargar el catálogo. Recarga la página.
          </CardContent>
        </Card>
      ) : cargando || !borrador || !tenantId ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="animate-fade-in-up stagger-2 space-y-6">
          <EstadoCatalogo
            guardado={guardado}
            borrador={borrador}
            guardar={guardar}
            onFaltanDatos={() => cambiarPestana("personalizar")}
          />

          <Tabs value={pestana} onValueChange={cambiarPestana} className="w-full">
            <TabsList className="w-full sm:w-fit">
              <TabsTrigger value="productos" className={CLASE_PESTANA}>
                <Package className="h-3.5 w-3.5 max-sm:hidden" />
                Productos
              </TabsTrigger>
              <TabsTrigger value="personalizar" className={CLASE_PESTANA}>
                <Palette className="h-3.5 w-3.5 max-sm:hidden" />
                Personalizar
              </TabsTrigger>
              <TabsTrigger value="vista-previa" className={CLASE_PESTANA}>
                <Eye className="h-3.5 w-3.5 max-sm:hidden" />
                Vista previa
              </TabsTrigger>
            </TabsList>

            <TabsContent value="productos">
              {pestana === "productos" && <ProductosCatalogo tenantId={tenantId} />}
            </TabsContent>
            <TabsContent value="personalizar">
              {pestana === "personalizar" && (
                <PersonalizarCatalogo tenantId={tenantId} guardado={guardado} borrador={borrador} guardar={guardar} />
              )}
            </TabsContent>
            <TabsContent value="vista-previa">{pestana === "vista-previa" && <VistaPreviaCatalogo />}</TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
