"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { DockMovil } from "@/components/layout/dock-movil";
import { CommandMenu } from "@/components/search/command-menu";
import { TutorialProvider } from "@/components/tutorial/tutorial-provider";
import { TutorialDialog } from "@/components/tutorial/tutorial-dialog";
import { TutorialMinimized } from "@/components/tutorial/tutorial-minimized";
import { LegalFooter } from "@/components/dashboard/legal-footer";
import { PolicyUpdateBanner } from "@/components/compliance/policy-update-banner";
import { AvisoEstadoPago } from "@/features/payments/components/aviso-estado-pago";
import { DemoBanner } from "@/components/demo/demo-banner";
import { OpenRegisterPrompt } from "@/features/cash-register/components/open-register-prompt";
import { TenantProvider } from "@/contexts/tenant-context";
import { SucursalProvider } from "@/contexts/sucursal-context";
import { ConfirmarProvider } from "@/components/ui/confirmar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Los avisos de arriba (demo, fin de prueba, pago vencido) ocupan alto EN EL
  // FLUJO, encima del panel. Se mide y se publica en `--alto-avisos` para que
  // el panel (y las alturas de `alto-panel.ts`) midan la pantalla MENOS los
  // avisos: si no, la pagina se desplazaba y en el POS del celular "Ver
  // carrito" quedaba debajo del dock. Variable CSS y no estado: sin re-render.
  const avisosRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const avisos = avisosRef.current;
    if (!avisos) return;
    const raiz = document.documentElement;
    const publicar = () => raiz.style.setProperty("--alto-avisos", `${avisos.offsetHeight}px`);
    publicar();
    const observador = new ResizeObserver(publicar);
    observador.observe(avisos);
    return () => {
      observador.disconnect();
      raiz.style.removeProperty("--alto-avisos");
    };
  }, []);

  return (
    <TenantProvider>
      {/* Dentro de TenantProvider a la fuerza: necesita el tenantId para
          saber qué sucursales cargar. */}
      <SucursalProvider>
      <TutorialProvider>
      {/* Una sola ventana de "¿Seguro?" para todo el panel (ver `confirmar.tsx`). */}
      <ConfirmarProvider>
        {/* `sticky`: refuerzo. El panel ya descuenta su alto y la pagina no se
            desplaza, pero si algo vuelve a hacerla mas alta, el aviso (p. ej.
            "Tu prueba termina hoy") sigue a la vista en vez de irse con el scroll. */}
        <div ref={avisosRef} className="sticky top-0 z-40">
          <DemoBanner />
          <PolicyUpdateBanner />
          <AvisoEstadoPago />
          <OpenRegisterPrompt />
        </div>
        {/* En escritorio el fondo es el de la barra lateral (`--nav-bg`) y la
            columna de contenido lo tapa con la esquina izquierda redondeada:
            el panel se ve "desbordado" sobre el menú y la pestaña activa del
            menú se funde con él (ver `.nav-pestana` en globals.css). */}
        <div className="flex h-[calc(100dvh-var(--alto-avisos,0px))] overflow-hidden lg:bg-[var(--nav-bg)]">
          <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
          <div className="flex flex-1 flex-col overflow-hidden bg-background lg:rounded-l-[28px]">
            <Header onSearchOpen={() => setSearchOpen(true)} />
            {/*
              El pie va DENTRO de `main` (el único elemento que hace scroll en
              este shell) para que NO quede clavado abajo comiéndose espacio de
              forma permanente.

              Pero meterlo ahí a secas no basta: en una pantalla con poco
              contenido el pie se plantaba justo debajo del contenido, a media
              página, dejando ~300px vacíos por debajo. De ahí el patrón de
              "sticky footer": el contenido va en un envoltorio `flex-1` que se
              come el espacio sobrante, así que el pie cae al fondo cuando hay
              poco que mostrar y se va hacia abajo cuando hay mucho.
            */}
            {/* Sin relleno inferior en escritorio: el pie queda pegado al fondo
                (su `mt-6` ya lo separa del contenido). En celular y tablet el
                relleno deja libre el hueco del dock (pegado abajo) para que no
                tape el final de la pantalla. Ver `alto-panel.ts`. */}
            <main className="flex flex-1 flex-col overflow-y-auto px-4 pt-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:px-6 md:pt-6 lg:pb-0">
              <div className="flex-1">{children}</div>
              <LegalFooter />
            </main>
          </div>
          <DockMovil />
          <CommandMenu open={searchOpen} setOpen={setSearchOpen} />
          <TutorialDialog />
          <TutorialMinimized />
        </div>
      </ConfirmarProvider>
      </TutorialProvider>
      </SucursalProvider>
    </TenantProvider>
  );
}
