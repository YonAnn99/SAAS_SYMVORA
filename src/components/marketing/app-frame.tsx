"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Menu, X, ChevronRight } from "lucide-react";
import { WhatsAppFab } from "./whatsapp-fab";
import { ThemeToggleFab } from "./theme-toggle-fab";

interface NavLink {
  href: string;
  label: string;
}

const navLinks: NavLink[] = [
  { href: "#features", label: "landing.nav.features" },
  { href: "#pricing", label: "landing.nav.pricing" },
  { href: "#faq", label: "landing.nav.faq" },
];

function scrollToAnchor(href: string) {
  const id = href.replace("#", "");
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-[100dvh] bg-zinc-950 p-2 sm:p-3 md:p-4 lg:p-5 flex flex-col font-sans">
      <div className="relative flex-1 bg-white dark:bg-[#0C0C0C] rounded-[32px] sm:rounded-[40px] overflow-hidden shadow-2xl ring-1 ring-white/10 flex flex-col">
        <header className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] sm:w-[90%] max-w-4xl bg-zinc-950 text-white rounded-b-[24px] sm:rounded-b-[32px] px-5 sm:px-6 py-3 sm:py-4 z-50 flex items-center justify-between">
          <svg className="absolute top-0 -left-4 w-4 h-4 sm:-left-6 sm:w-6 sm:h-6 text-zinc-950" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M24 24V0H0C13.2548 0 24 10.7452 24 24Z" />
          </svg>
          <svg className="absolute top-0 -right-4 w-4 h-4 sm:-right-6 sm:w-6 sm:h-6 text-zinc-950" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M0 24V0H24C10.7452 0 0 10.7452 0 24Z" />
          </svg>

          <Link href="/" className="flex items-center gap-3">
            <Image
              alt="SYMVORA Logo"
              className="h-6 sm:h-7 w-auto object-contain brightness-0 invert"
              src="/symvora-logo.webp"
              width={28}
              height={28}
            />
            <span className="font-semibold text-lg tracking-tight hidden sm:block font-[var(--font-montserrat)]">
              SYMVORA
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-300" aria-label="Navegación principal">
            {navLinks.map((link) => (
              <button
                key={link.href}
                type="button"
                onClick={() => scrollToAnchor(link.href)}
                className="hover:text-white transition-colors"
              >
                {t(link.label)}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="hidden sm:block text-sm font-medium text-zinc-300 hover:text-white transition-colors"
            >
              {t("landing.nav.login")}
            </Link>
            <Link
              href="/signup"
              className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold bg-white text-zinc-950 px-5 py-2.5 rounded-full hover:bg-zinc-200 transition-colors"
            >
              {t("landing.nav.cta")}
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="md:hidden p-1 rounded-lg text-white hover:bg-white/10 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-controls="frame-mobile-menu"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {mobileOpen && (
          <div
            id="frame-mobile-menu"
            className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl bg-zinc-950 text-white rounded-2xl border border-white/10 shadow-2xl z-40 p-4 space-y-1"
          >
            {navLinks.map((link) => (
              <button
                key={link.href}
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  scrollToAnchor(link.href);
                }}
                className="block w-full text-left text-sm font-medium text-zinc-300 hover:text-white py-2 px-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                {t(link.label)}
              </button>
            ))}
            <div className="pt-2 mt-2 border-t border-white/10 space-y-2">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block text-center text-sm font-medium text-zinc-300 hover:text-white py-2 px-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                {t("landing.nav.login")}
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="block text-center text-sm font-semibold bg-white text-zinc-950 px-5 py-2.5 rounded-full hover:bg-zinc-200 transition-colors"
              >
                {t("landing.nav.cta")}
              </Link>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-24 sm:pt-28 pb-10">
          {children}
        </main>

        <WhatsAppFab />
        <ThemeToggleFab />
      </div>
    </div>
  );
}
