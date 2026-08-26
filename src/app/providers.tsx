"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      enableSystem
      disableTransitionOnChange
      scriptProps={{ type: "application/json" }}
    >
      {children}
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
