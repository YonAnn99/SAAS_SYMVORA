"use client";

import { Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";

export function LegalFooter() {
  const locale = useLocale();

  const links = [
    { href: `/${locale}/terminos` as const, label: "Términos" },
    { href: `/${locale}/aviso-privacidad` as const, label: "Privacidad" },
    { href: `/${locale}/politica-cookies` as const, label: "Cookies" },
  ];

  return (
    <footer className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 md:px-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-500">
        <span>© 2026 SYMVORA. Todos los derechos reservados.</span>
        <nav aria-label="Enlaces legales" className="flex items-center gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-black transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
