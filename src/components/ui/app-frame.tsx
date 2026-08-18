import React from "react";
import Link from "next/link";

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Contenedor Exterior (El "Bisel" del dispositivo) */}
      {/* Usamos el color de fondo base de la app para el marco exterior */}
      <div className="h-[100dvh] bg-zinc-50 dark:bg-zinc-950 p-2 sm:p-3 md:p-4 lg:p-5 flex flex-col font-sans">
        
        {/* Contenedor Interior (El "Canvas" de la Landing Page) */}
        <div className="relative flex-1 bg-white dark:bg-zinc-900 rounded-[32px] sm:rounded-[40px] overflow-hidden shadow-2xl ring-1 ring-zinc-200 dark:ring-white/10 flex flex-col">
          
          {/* Header / Navbar Integrado (Dinámico Claro/Oscuro) */}
          {/* El header hace contraste: Oscuro en Light Mode, Claro en Dark Mode */}
          <header className="absolute top-0 left-1/2 -translate-x-1/2 w-[95%] sm:w-[90%] max-w-4xl bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 rounded-b-[24px] sm:rounded-b-[32px] px-6 py-4 z-50 flex items-center justify-between transition-all duration-300 shadow-sm">
            
            {/* Esquina Cóncava Izquierda (Sincronizada con el color del header) */}
            <svg className="absolute top-0 -left-6 w-6 h-6 text-zinc-950 dark:text-zinc-50 transition-colors duration-300" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 24V0H0C13.2548 0 24 10.7452 24 24Z" />
            </svg>
            
            {/* Esquina Cóncava Derecha (Sincronizada con el color del header) */}
            <svg className="absolute top-0 -right-6 w-6 h-6 text-zinc-950 dark:text-zinc-50 transition-colors duration-300" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 24V0H24C10.7452 0 0 10.7452 0 24Z" />
            </svg>

            {/* Branding Mejorado */}
            <div className="flex items-center gap-3">
              {/* Contenedor del ícono invertido al header */}
              <div className="w-8 h-8 bg-white dark:bg-zinc-950 rounded-full flex items-center justify-center transition-colors duration-300">
                <span className="text-zinc-950 dark:text-white font-bold text-xl leading-none">S</span>
              </div>
              <span className="font-semibold text-lg tracking-tight hidden sm:block text-white dark:text-zinc-950">SYMVORA</span>
            </div>

            {/* Navegación (Adaptable) */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-300 dark:text-zinc-600">
              <Link href="#features" className="hover:text-white dark:hover:text-zinc-950 transition-colors">Productos</Link>
              <Link href="#pricing" className="hover:text-white dark:hover:text-zinc-950 transition-colors">Precios</Link>
              <Link href="#resources" className="hover:text-white dark:hover:text-zinc-950 transition-colors">Recursos</Link>
            </nav>

            {/* CTAs (Invertidos) */}
            <div className="flex items-center gap-4">
              <Link href="/login" className="hidden sm:block text-sm font-medium text-zinc-300 dark:text-zinc-600 hover:text-white dark:hover:text-zinc-950 transition-colors">
                Iniciar sesión
              </Link>
              <Link href="/register" className="text-sm font-semibold bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white px-5 py-2.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                Prueba gratis
              </Link>
            </div>
          </header>

          {/* Contenido Principal (Con clase para ocultar scrollbar) */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden pt-28 pb-10 scrollbar-hide">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}