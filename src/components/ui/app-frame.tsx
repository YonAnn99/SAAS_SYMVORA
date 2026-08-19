"use client";

import React, { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import BubbleMenu from "./bubble-menu";
import { CookieBanner } from "./cookie-banner";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="h-[100dvh] bg-black p-2 sm:p-3 md:p-4 lg:p-5 flex flex-col font-sans relative overflow-hidden">
      
      <div className="md:hidden">
        <BubbleMenu
          logo={
            <div className="w-[100px] h-[28px] overflow-hidden">
              <img 
                src="/symvora-logo.webp" 
                alt="SYMVORA" 
                width="100" 
                height="28"
                className="w-full h-full object-contain dark:brightness-0 dark:invert transition-all"
                style={{ objectFit: 'contain' }}
              />
            </div>
          }
          menuBg="var(--bubble-bg)"
          menuContentColor="var(--bubble-text)"
          useFixedPosition={false}
        />
      </div>

      <div className="relative flex-1 bg-white dark:bg-zinc-900 rounded-[32px] sm:rounded-[40px] overflow-hidden shadow-2xl flex flex-col">
        
        <header className="absolute top-0 left-1/2 -translate-x-1/2 w-[95%] sm:w-[90%] max-w-4xl bg-zinc-950 text-white rounded-b-[24px] sm:rounded-b-[32px] px-6 py-4 z-50 items-center justify-between shadow-sm h-[88px] hidden md:flex">
          
          <svg className="absolute -top-[1px] -left-6 w-6 h-[26px] text-zinc-950" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 24V0H0C13.2548 0 24 10.7452 24 24Z" />
          </svg>
          
          <svg className="absolute -top-[1px] -right-6 w-6 h-[26px] text-zinc-950" viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 24V0H24C10.7452 0 0 10.7452 0 24Z" />
          </svg>

          <a href="#" onClick={scrollToTop} className="flex items-center gap-2.5 hover:opacity-90 transition-opacity cursor-pointer">
            <Image 
              src="/symvora-logo.webp" 
              alt="SYMVORA" 
              width={80} 
              height={56} 
              className="w-[80px] h-[56px] object-contain brightness-0 invert"
            />
            <span className="font-bold text-lg tracking-tight text-white">SYMVORA</span>
          </a>

          <nav className="flex items-center gap-8 text-sm font-medium text-zinc-400">
            <Link href="#features" className="hover:text-white transition-colors">Productos</Link>
            <Link href="#pricing" className="hover:text-white transition-colors">Precios</Link>
            <Link href="#footer-contacto" className="hover:text-white transition-colors">Contáctanos</Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
              Iniciar sesión
            </Link>
            <Link href="/signup" className="text-sm font-semibold bg-white text-zinc-950 px-5 py-2.5 rounded-full hover:bg-zinc-200 transition-colors">
              Prueba gratis
            </Link>
          </div>
        </header>

        <main ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden pt-20 md:pt-28 pb-0 scrollbar-hide relative scroll-smooth">
          {children}
          
          <CookieBanner />
        </main>
      </div>
    </div>
  );
}