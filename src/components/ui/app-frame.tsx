import React from "react";
import Link from "next/link";
import Image from "next/image";
import BubbleMenu from "./bubble-menu";

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="h-[100dvh] bg-zinc-950 p-2 sm:p-3 md:p-4 lg:p-5 flex flex-col font-sans relative overflow-hidden">
        
        <div className="md:hidden">
          <BubbleMenu
            logo={<Image src="/symvora-logo.webp" alt="SYMVORA" width={110} height={24} className="object-contain dark:brightness-0 dark:invert transition-all" />}
            menuBg="var(--bubble-bg)"
            menuContentColor="var(--bubble-text)"
            useFixedPosition={false}
          />
        </div>

        <div className="relative flex-1 bg-white dark:bg-zinc-900 rounded-[32px] sm:rounded-[40px] overflow-hidden shadow-2xl flex flex-col">
          
          <header className="absolute top-0 left-1/2 -translate-x-1/2 w-[95%] sm:w-[90%] max-w-4xl bg-zinc-950 text-white rounded-b-[24px] sm:rounded-b-[32px] px-6 py-4 z-50 items-center justify-between shadow-sm h-[72px] hidden md:flex">
            
            <svg className="absolute -top-[1px] -left-6 w-6 h-[26px] text-zinc-950" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 24V0H0C13.2548 0 24 10.7452 24 24Z" />
            </svg>
            
            <svg className="absolute -top-[1px] -right-6 w-6 h-[26px] text-zinc-950" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 24V0H24C10.7452 0 0 10.7452 0 24Z" />
            </svg>

            <div className="flex items-center">
              <Image 
                src="/symvora-logo.webp" 
                alt="SYMVORA" 
                width={140} 
                height={30} 
                className="object-contain brightness-0 invert"
              />
            </div>

            <nav className="flex items-center gap-8 text-sm font-medium text-zinc-300">
              <Link href="#features" className="hover:text-white transition-colors">Productos</Link>
              <Link href="#pricing" className="hover:text-white transition-colors">Precios</Link>
              <Link href="#resources" className="hover:text-white transition-colors">Recursos</Link>
            </nav>

            <div className="flex items-center gap-4">
              <Link href="/login" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
                Iniciar sesión
              </Link>
              <Link href="/register" className="text-sm font-semibold bg-white text-zinc-950 px-5 py-2.5 rounded-full hover:bg-zinc-200 transition-colors">
                Prueba gratis
              </Link>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden pt-24 md:pt-28 pb-10 scrollbar-hide">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}