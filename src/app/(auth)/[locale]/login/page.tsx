import { redirect } from "next/navigation";
import { rutaDeRegresoSegura } from "@/lib/ruta-de-regreso";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  // El destino se conserva: sin el, quien venia de un enlace (p. ej. /billing)
  // acababa en el dashboard.
  const destino = rutaDeRegresoSegura(next);
  redirect(
    `/${locale}/auth?mode=login${destino ? `&next=${encodeURIComponent(destino)}` : ""}`
  );
}
