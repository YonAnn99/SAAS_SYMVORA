export * from "./components/close-register-dialog";
export * from "./components/movement-dialog";
export * from "./components/movements-table";
export * from "./components/open-register-dialog";
export * from "./components/open-register-required-dialog";
export * from "./components/register-summary-cards";
export * from "./hooks/use-cash-register";
export * from "./hooks/use-open-register";
export * from "./services/cash-register-service";
// ⚠️ `cash-register-server-service` NO se reexporta aqui, y no es un olvido.
//
// Importa `server.server.ts`, que usa `next/headers`. Este barril lo consume
// `pos/page.tsx`, que es `"use client"`, asi que reexportarlo arrastraba
// `next/headers` al bundle del navegador y ROMPIA EL BUILD DE PRODUCCION con
// "You're importing a module that depends on next/headers" — un error que no
// aparece en `next dev` ni en `tsc`, solo al desplegar.
//
// Quien lo necesite (hoy el cron `/api/cron/auto-close-registers`) lo importa
// por su ruta directa, que es lo que ya hacia.
export * from "./types/cash-register.types";