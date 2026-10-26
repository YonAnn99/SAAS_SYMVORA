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
  // acababa en el dashboard. Con destino se va directo al formulario.
  const destino = rutaDeRegresoSegura(next);
  if (destino) {
    redirect(`/${locale}/auth?mode=login&next=${encodeURIComponent(destino)}`);
  }
  // Sin destino ("Iniciar sesion" de la landing, cerrar sesion): `/auth` sin
  // `mode`. En celular abre la bienvenida (Iniciar sesion / Crear cuenta); en
  // escritorio, el login de siempre.
  redirect(`/${locale}/auth`);
}
