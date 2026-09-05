"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/lib/utils";
import { springTransition } from "./animations";
import { useBubbleMenuAnimation } from "./use-bubble-menu-animation";
import { MENU, X, CHEVRON_DOWN, CHEVRON_RIGHT } from "./morph-icons";
import "@/styles/bubble-menu.css";

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
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileItemRefs = useRef<HTMLElement[]>([]);
  const mobileLabelRefs = useRef<HTMLElement[]>([]);

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

  useBubbleMenuAnimation({
    containerRef: mobileMenuRef,
    itemRefs: mobileItemRefs,
    labelRefs: mobileLabelRefs,
    isOpen: mobileOpen,
  });

  return (
    <header className="fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] pointer-events-none">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 lg:pt-5">
        <div
          className={cn(
            "pointer-events-auto rounded-2xl transition-all duration-300",
            "backdrop-blur-2xl backdrop-saturate-150",
            mobileOpen
              ? "bg-neutral-900/90 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
              : scrolled
                ? "bg-white/75 border border-white/50 shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:bg-neutral-950/70 dark:border-white/10"
                : "bg-white/50 border border-white/50 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:bg-neutral-950/40 dark:border-white/10"
          )}
        >
          <div className="h-14 sm:h-16 px-3 sm:px-4 lg:px-6 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Image
                alt="SYMVORA Logo"
                className="h-7 sm:h-8 w-auto object-contain shrink-0 dark:invert"
                src="/symvora-logo.webp"
                width={32}
                height={32}
                priority
              />
              <span
className={cn(
                  "text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap",
                  mobileOpen ? "text-white" : "text-black"
                )}
              >
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
                          className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-black transition-colors px-3 py-2 rounded-lg hover:bg-neutral-100/80 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
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
                              className="absolute top-full left-0 mt-2 w-56 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/60 dark:border-white/10 py-2 ring-1 ring-black/5 dark:ring-white/10 z-50"
                              role="menu"
                            >
                              {item.children!.map((child) => (
                                <Link
                                  key={child.label}
                                  href={child.href ?? "#"}
                                  className="block px-4 py-2 text-sm text-neutral-600 hover:text-black hover:bg-neutral-50/80 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800/60 transition-colors"
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
                        className="text-sm font-medium text-neutral-600 hover:text-black transition-colors px-3 py-2 rounded-lg hover:bg-neutral-100/80 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800/60"
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
                className={cn(
                  "hidden sm:block text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded dark:text-neutral-300 dark:hover:text-white",
                  mobileOpen
                    ? "text-neutral-300 hover:text-white"
                    : "text-neutral-600 hover:text-black"
                )}
              >
                {t("landing.nav.login")}
              </Link>
              <Link
                href="/signup"
                className={cn(
                  "hidden sm:inline-flex text-sm font-medium px-5 py-2 rounded-lg transition-all active:translate-y-px items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  mobileOpen
                    ? "bg-white text-black hover:bg-neutral-200 focus-visible:ring-white"
                    : "bg-black text-white hover:bg-neutral-800 focus-visible:ring-neutral-500 dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:focus-visible:ring-neutral-300"
                )}
              >
                {t("landing.nav.cta")}
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <button
                className={cn(
                  "lg:hidden p-2 -mr-1 sm:-mr-2 rounded-lg transition-colors dark:text-neutral-100",
                  mobileOpen ? "text-white hover:bg-white/10" : "text-neutral-900 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60"
                )}
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
        </div>

        <div
          ref={mobileMenuRef}
          id="mobile-menu"
          className="lg:hidden pointer-events-auto mt-2 rounded-2xl overflow-hidden bg-neutral-950/95 backdrop-blur-2xl border border-white/10 shadow-2xl text-white pb-[env(safe-area-inset-bottom)] invisible"
          aria-hidden={!mobileOpen}
        >
          <div className="px-4 py-4 space-y-2">
            {navItems.map((item, idx) => {
              const hasChildren = item.children && item.children.length > 0;
              const isMobileOpen = mobileOpenDropdown === item.label;
              const itemRef = (el: HTMLDivElement | null) => {
                if (el) mobileItemRefs.current[idx] = el;
              };
              const labelRef = (el: HTMLSpanElement | null) => {
                if (el) mobileLabelRefs.current[idx] = el;
              };

              if (hasChildren) {
                return (
                  <div
                    key={item.label}
                    ref={itemRef}
                    className="bubble-menu-item border-t border-white/10 pt-2 first:border-t-0 first:pt-0"
                  >
                    <button
                      onClick={() => handleDropdownClick(item.label)}
                      className="w-full flex items-center justify-between text-sm font-medium text-neutral-300 hover:text-white py-2"
                      aria-expanded={isMobileOpen}
                    >
                      <span ref={labelRef}>{t(item.label)}</span>
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
                              className="block text-sm text-neutral-400 hover:text-white py-1"
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
                  ref={itemRef as unknown as React.Ref<HTMLAnchorElement>}
                  className="bubble-menu-item block text-sm font-medium text-neutral-300 hover:text-white py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  <span ref={labelRef}>{t(item.label)}</span>
                </a>
              );
            })}
            <div
              ref={(el) => {
                if (el) {
                  const i = navItems.length;
                  mobileItemRefs.current[i] = el;
                  mobileLabelRefs.current[i] = el;
                }
              }}
              className="bubble-menu-item pt-4 border-t border-white/10 space-y-2"
            >
              <Link
                href="/login"
                className="block text-sm font-medium text-neutral-300 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                {t("landing.nav.login")}
              </Link>
              <Link
                href="/signup"
                className="block bg-white text-black text-sm font-medium px-5 py-2 rounded-lg text-center hover:bg-neutral-200 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {t("landing.nav.cta")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
