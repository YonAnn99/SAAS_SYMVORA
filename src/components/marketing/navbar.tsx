"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MorphIcon } from "morphicons/react";
import { springTransition } from "./animations";
import { MENU, X, CHEVRON_DOWN, CHEVRON_RIGHT } from "./morph-icons";

interface NavItem {
  label: string;
  href?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    label: "landing.nav.productsLabel",
    children: [
      { label: "landing.nav.products.pos", href: "#pos" },
      { label: "landing.nav.products.inventory", href: "#inventory" },
      { label: "landing.nav.products.purchases", href: "#purchases" },
      { label: "landing.nav.products.finances", href: "#finances" },
      { label: "landing.nav.products.invoicing", href: "#invoicing" },
    ],
  },
  {
    label: "landing.nav.solutionsLabel",
    children: [
      { label: "landing.nav.solutions.byIndustry", href: "#industries" },
      { label: "landing.nav.solutions.enterprises", href: "#enterprises" },
      { label: "landing.nav.solutions.developers", href: "#developers" },
    ],
  },
  {
    label: "landing.nav.pricing",
    href: "#pricing",
  },
  {
    label: "landing.nav.companyLabel",
    children: [
      { label: "landing.nav.company.about", href: "#about" },
      { label: "landing.nav.company.blog", href: "#blog" },
      { label: "landing.nav.company.support", href: "#support" },
      { label: "landing.nav.company.careers", href: "#careers" },
    ],
  },
];

export function Navbar() {
  const t = useTranslations();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpenDropdown, setMobileOpenDropdown] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRefs = useRef<Record<string, HTMLDivElement>>({});

  // Reset transient UI state on route change. The link onClick handlers also
  // close the menu, but this catches programmatic navigation (router.push,
  // browser back/forward). The react-hooks/set-state-in-effect rule flags this
  // pattern; it is intentional for route-driven UI resets.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
    setMobileOpenDropdown(null);
    setOpenDropdown(null);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      let clickedInside = false;
      Object.values(dropdownRefs.current).forEach((ref) => {
        if (ref && ref.contains(target)) {
          clickedInside = true;
        }
      });
      if (!clickedInside) {
        setOpenDropdown(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDropdownMouseEnter = (key: string) => {
    if (window.innerWidth >= 1024) {
      setOpenDropdown(key);
    }
  };

  const handleDropdownMouseLeave = () => {
    if (window.innerWidth >= 1024) {
      setOpenDropdown(null);
    }
  };

  const handleDropdownClick = (key: string) => {
    if (window.innerWidth < 1024) {
      setMobileOpenDropdown(mobileOpenDropdown === key ? null : key);
    }
  };

  const handleResize = () => {
    if (window.innerWidth >= 1024) {
      setMobileOpen(false);
      setMobileOpenDropdown(null);
    }
  };

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 8);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl transition-all duration-300 pt-[env(safe-area-inset-top)] ${
        scrolled
          ? "shadow-[0_2px_12px_rgba(0,0,0,0.08)] border-b border-neutral-200/60"
          : "shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
      }`}
    >
      <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            alt="SYMVORA Logo"
            className="h-8 w-auto object-contain"
            src="/symvora-logo.webp"
            width={32}
            height={32}
            priority
          />
          <span className="text-xl font-bold tracking-tight text-black font-[var(--font-montserrat)]">
            SYMVORA
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-2" role="navigation" aria-label="Navegación principal">
          {navItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openDropdown === item.label;

            return (
              <div
                key={item.label}
                ref={(el) => { if (el) dropdownRefs.current[item.label] = el; }}
                className="relative"
                onMouseEnter={() => handleDropdownMouseEnter(item.label)}
                onMouseLeave={handleDropdownMouseLeave}
              >
                {hasChildren ? (
                  <>
                    <button
                      className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-black transition-colors px-3 py-2 rounded-lg hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                    >
                      {t(item.label)}
                      <MorphIcon
                        icon={isOpen ? CHEVRON_RIGHT : CHEVRON_DOWN}
                        size={16}
                        spring="snappy"
                        reducedMotion="user"
                        aria-hidden="true"
                      />
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={springTransition}
                          className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-neutral-200 py-2 ring-1 ring-black/5 z-50"
                          role="menu"
                        >
                          {item.children!.map((child) => (
                            <Link
                              key={child.label}
                              href={child.href ?? "#"}
                              className="block px-4 py-2 text-sm text-neutral-600 hover:text-black hover:bg-neutral-50 transition-colors"
                              role="menuitem"
                              onClick={() => setOpenDropdown(null)}
                            >
                              {t(child.label)}
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  <a
                    href={item.href}
                    className="text-sm font-medium text-neutral-600 hover:text-black transition-colors px-3 py-2 rounded-lg hover:bg-neutral-100"
                  >
                    {t(item.label)}
                  </a>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/login"
            className="hidden sm:block text-sm font-medium text-neutral-600 hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
          >
            {t("landing.nav.login")}
          </Link>
          <Link
            href="/signup"
            className="hidden sm:inline-flex bg-black text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-neutral-800 transition-all active:translate-y-px items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
          >
            {t("landing.nav.cta")}
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <button
            className="lg:hidden p-2 -mr-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          >
            <MorphIcon
              icon={mobileOpen ? X : MENU}
              size={20}
              spring="snappy"
              reducedMotion="user"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={springTransition}
            className="lg:hidden bg-white border-t border-neutral-100 overflow-hidden pb-[env(safe-area-inset-bottom)]"
          >
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => {
                const hasChildren = item.children && item.children.length > 0;
                const isMobileOpen = mobileOpenDropdown === item.label;

                if (hasChildren) {
                  return (
                    <div key={item.label} className="border-t border-neutral-100 pt-2">
                      <button
                        onClick={() => handleDropdownClick(item.label)}
                        className="w-full flex items-center justify-between text-sm font-medium text-neutral-600 hover:text-black py-2"
                        aria-expanded={isMobileOpen}
                      >
                        {t(item.label)}
                        <MorphIcon
                          icon={isMobileOpen ? CHEVRON_RIGHT : CHEVRON_DOWN}
                          size={16}
                          spring="snappy"
                          reducedMotion="user"
                          aria-hidden="true"
                        />
                      </button>
                      <AnimatePresence>
                        {isMobileOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={springTransition}
                            className="pl-4 mt-2 space-y-1"
                          >
                            {item.children!.map((child) => (
                              <Link
                                key={child.label}
                                href={child.href ?? "#"}
                                className="block text-sm text-neutral-600 hover:text-black py-1"
                                onClick={() => {
                                  setMobileOpen(false);
                                  setMobileOpenDropdown(null);
                                }}
                              >
                                {t(child.label)}
                              </Link>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className="block text-sm font-medium text-neutral-600 hover:text-black py-2"
                    onClick={() => setMobileOpen(false)}
                  >
                    {t(item.label)}
                  </a>
                );
              })}
              <div className="pt-4 border-t border-neutral-100 space-y-2">
                <Link
                  href="/login"
                  className="block text-sm font-medium text-neutral-600 hover:text-black"
                  onClick={() => setMobileOpen(false)}
                >
                  {t("landing.nav.login")}
                </Link>
                <Link
                  href="/signup"
                  className="block bg-black text-white text-sm font-medium px-5 py-2 rounded-lg text-center hover:bg-neutral-800 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {t("landing.nav.cta")}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
