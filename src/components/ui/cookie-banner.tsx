"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const hasAccepted = localStorage.getItem("symvora_cookies_accepted");
    if (!hasAccepted) {
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("symvora_cookies_accepted", "true");
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 sm:bottom-8 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[90%] sm:max-w-2xl bg-zinc-900 dark:bg-zinc-800 text-white p-4 sm:p-5 rounded-2xl shadow-2xl z-[9999] flex flex-col sm:flex-row items-center justify-between gap-4 border border-zinc-800 dark:border-zinc-700 animate-in fade-in slide-in-from-bottom-8 duration-500">
      
      <div className="text-sm text-zinc-300 text-center sm:text-left flex-1">
        Utilizamos cookies para mejorar tu experiencia en nuestra plataforma. Al continuar navegando, aceptas nuestra{" "}
        <Link href="/privacidad" className="text-white underline font-medium hover:text-blue-400 transition-colors">
          política de privacidad y cookies
        </Link>.
      </div>
      
      <button 
        onClick={acceptCookies}
        className="w-full sm:w-auto shrink-0 bg-white text-black px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-zinc-200 transition-colors"
      >
        Aceptar y cerrar
      </button>
    </div>
  );
}