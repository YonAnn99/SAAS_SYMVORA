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
import { DemoBanner } from "@/components/demo/demo-banner";
import { OpenRegisterPrompt } from "@/features/cash-register/components/open-register-prompt";
import { TenantProvider } from "@/contexts/tenant-context";
import { SucursalProvider } from "@/contexts/sucursal-context";

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
        <DemoBanner />
        <PolicyUpdateBanner />
        <OpenRegisterPrompt />
        <div className="flex h-screen overflow-hidden">
          <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
          <div className="flex flex-1 flex-col overflow-hidden">
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
            <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
              <div className="flex-1">{children}</div>
              <LegalFooter />
            </main>
          </div>
          <CommandMenu open={searchOpen} setOpen={setSearchOpen} />
          <TutorialDialog />
          <TutorialMinimized />
        </div>
      </TutorialProvider>
      </SucursalProvider>
    </TenantProvider>
  );
}
