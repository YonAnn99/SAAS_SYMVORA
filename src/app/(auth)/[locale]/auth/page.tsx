import { Suspense } from "react";
import { AuthForms } from "@/components/auth/auth-forms";
import { getReferrerBusinessName } from "@/lib/referrals-server";
import { giroDeRegistro } from "@/features/marketing/giros";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; ref?: string; giro?: string }>;
}) {
  const { mode, ref, giro } = await searchParams;
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
      />
    </Suspense>
  );
}