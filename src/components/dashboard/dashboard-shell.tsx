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
import { TenantProvider } from "@/contexts/tenant-context";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <TenantProvider>
      <TutorialProvider>
        <DemoBanner />
        <PolicyUpdateBanner />
        <div className="flex h-screen overflow-hidden">
          <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header onSearchOpen={() => setSearchOpen(true)} onMenuClick={() => setSidebarOpen(true)} />
            <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
            <LegalFooter />
          </div>
          <CommandMenu open={searchOpen} setOpen={setSearchOpen} />
          <TutorialDialog />
          <TutorialMinimized />
        </div>
      </TutorialProvider>
    </TenantProvider>
  );
}
