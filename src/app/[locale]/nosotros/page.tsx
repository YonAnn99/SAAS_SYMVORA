import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppFrame } from "@/components/ui/app-frame";
import Footer from "@/components/ui/footer";
import { NosotrosContenido } from "@/components/marketing/nosotros-contenido";

/**
 * /es/nosotros: identidad, mision, vision y valores de SYMVORA. Solo en
 * español (el mercado es Mexico); en /en responde 404, igual que Aprende.
 */

export const metadata: Metadata = {
  title: "Nosotros | SYMVORA",
  description:
    "SYMVORA desarrolla soluciones de software innovadoras, funcionales y adaptables que ayudan a empresas y negocios a optimizar sus procesos, tomar mejores decisiones y crecer mediante la tecnología.",
  alternates: { canonical: "/es/nosotros" },
};

export default async function NosotrosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "es") notFound();

  return (
    <AppFrame inicio="/es">
      <NosotrosContenido />
      <Footer />
    </AppFrame>
  );
}
