"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <TenantProvider>
      {/* Dentro de TenantProvider a la fuerza: necesita el tenantId para
          saber qué sucursales cargar. */}
      <SucursalProvider>
      <TutorialProvider>
      {/* Una sola ventana de "¿Seguro?" para todo el panel (ver `confirmar.tsx`). */}
      <ConfirmarProvider>
        <DemoBanner />
        <PolicyUpdateBanner />
        <AvisoEstadoPago />
        <OpenRegisterPrompt />
        {/* En escritorio el fondo es el de la barra lateral (`--nav-bg`) y la
            columna de contenido lo tapa con la esquina izquierda redondeada:
            el panel se ve "desbordado" sobre el menú y la pestaña activa del
            menú se funde con él (ver `.nav-pestana` en globals.css). */}
        <div className="flex h-screen overflow-hidden lg:bg-[var(--nav-bg)]">
          <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
          <div className="flex flex-1 flex-col overflow-hidden bg-background lg:rounded-l-[28px]">
            <Header onSearchOpen={() => setSearchOpen(true)} onMenuClick={() => setSidebarOpen(true)} />
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
            {/* Sin relleno inferior: el pie queda pegado al fondo (su `mt-6`
                ya lo separa del contenido). Ver `alto-panel.ts`. */}
            <main className="flex flex-1 flex-col overflow-y-auto px-4 pt-4 md:px-6 md:pt-6">
              <div className="flex-1">{children}</div>
              <LegalFooter />
            </main>
          </div>
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
