"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandMenu } from "@/components/search/command-menu";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onSearchOpen={() => setSearchOpen(true)} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
      <CommandMenu open={searchOpen} setOpen={setSearchOpen} />
    </div>
  );
}
