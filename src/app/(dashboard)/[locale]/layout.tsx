"use client";

import { useState } from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandMenu } from "@/components/search/command-menu";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <NextIntlClientProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onSearchOpen={() => setSearchOpen(true)} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
        <CommandMenu open={searchOpen} setOpen={setSearchOpen} />
      </div>
    </NextIntlClientProvider>
  );
}
