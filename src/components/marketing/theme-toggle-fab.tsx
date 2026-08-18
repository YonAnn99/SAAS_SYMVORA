"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggleFab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Patrón estándar para detectar montaje del lado del cliente y evitar
    // un mismatch de hidratación (el ícono depende de `theme`, que no se
    // conoce en el render del servidor). El mismo patrón ya existe sin
    // documentar en src/components/layout/header.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Cambiar entre modo claro y oscuro"
      className="fixed bottom-5 left-5 z-[110] flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-transform hover:scale-105 active:scale-95 dark:border-white/10 dark:bg-neutral-900 dark:text-white"
    >
      {mounted && theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
