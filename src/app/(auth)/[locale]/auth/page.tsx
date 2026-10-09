import { Suspense } from "react";
import { AuthForms } from "@/components/auth/auth-forms";
import { getReferrerBusinessName } from "@/lib/referrals-server";
import { giroDeRegistro } from "@/features/marketing/giros";
import { rutaDeRegresoSegura } from "@/lib/ruta-de-regreso";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; ref?: string; giro?: string; next?: string }>;
}) {
  const { mode, ref, giro, next } = await searchParams;
  // A donde volver al entrar (lo pone el middleware). Lo que no sea una ruta
  // interna segura se ignora y se entra al dashboard como siempre.
  const destino = rutaDeRegresoSegura(next);
  // Viene de "Prueba gratis" en la pagina de un giro: el slug (o, en enlaces
  // viejos, la configuracion). Lo que no sea un giro conocido se ignora.
  const initialGiro = giroDeRegistro(giro)?.slug;
  const initialMode = mode === "signup" ? "signup" : "login";

  const referralCode = ref?.trim() ? ref.trim() : null;
  const referrerBusinessName = referralCode
    ? await getReferrerBusinessName(referralCode)
    : null;

  return (
    <Suspense>
      <AuthForms
        initialMode={initialMode as "login" | "signup"}
        referralCode={referralCode}
        referrerBusinessName={referrerBusinessName}
        initialGiro={initialGiro}
        destino={destino}
      />
    </Suspense>
  );
}