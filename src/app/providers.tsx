"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      enableSystem
      disableTransitionOnChange
      // El `color-scheme` lo fija globals.css segun la clase. Si next-themes lo
      // escribe en linea (`color-scheme: light`), le gana al CSS, y justo esa
      // declaracion deja que Chrome/MIUI en Android oscurezcan a la fuerza el
      // modo claro (fondo negro con texto azul marino ilegible).
      enableColorScheme={false}
    >
      {children}
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
