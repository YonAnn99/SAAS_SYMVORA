import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { AppFrame } from "@/components/ui/app-frame";
import Footer from "@/components/ui/footer";
import { AprendeIndice } from "@/components/marketing/aprende-indice";

/**
 * /es/aprende: indice de guias de uso, una por modulo. Solo en español (el
 * mercado es Mexico); en /en responde 404.
 */

export const metadata: Metadata = {
  title: "Aprende a usar SYMVORA | Guías del punto de venta",
  description:
    "Guías paso a paso para usar SYMVORA: punto de venta, inventario, compras, caja, sucursales, usuarios y más.",
  alternates: { canonical: "/es/aprende" },
};

export default async function AprendePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "es") notFound();

  return (
    <AppFrame inicio="/es">
      <section className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />
              Aprende
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight text-black dark:text-neutral-50">
              Aprende a usar SYMVORA
            </h1>
            <p className="mt-4 text-base sm:text-lg text-neutral-600 dark:text-neutral-300">
              Guías paso a paso de cada módulo, desde tu primera venta hasta sucursales y permisos.
            </p>
          </div>
          <div className="mt-10">
            <AprendeIndice />
          </div>
        </div>
      </section>
      <Footer />
    </AppFrame>
  );
}
