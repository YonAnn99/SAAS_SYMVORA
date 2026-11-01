import type { Metadata } from "next";
import { InstalarApp } from "@/features/instalar-app/instalar-app";

export const metadata: Metadata = {
  title: "Instala SYMVORA en tu computadora",
  description: "Instala SYMVORA como programa en Windows o Mac: ícono en tu escritorio, ventana propia y actualizaciones automáticas.",
};

/**
 * Pagina para instalar SYMVORA como app (PWA). Vive en el host de la APP
 * (app.symvora.com.mx): instalada desde `www` seria otra app, de otro origen.
 * Publica: esta en `isPublicRoute` del middleware. La landing enlaza aqui.
 */
export default function InstalarPage() {
  return <InstalarApp />;
}
