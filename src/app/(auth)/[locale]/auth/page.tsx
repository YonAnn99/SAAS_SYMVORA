import { Suspense } from "react";
import { AuthForms } from "@/components/auth/auth-forms";
import { getReferrerBusinessName } from "@/lib/referrals-server";
import { CONFIGS_REGISTRO, type ConfigRegistro } from "@/features/marketing/giros";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; ref?: string; giro?: string }>;
}) {
  const { mode, ref, giro } = await searchParams;
  // Viene de "Prueba gratis" en la pagina de un giro. Solo se acepta si es una
  // configuracion que existe; cualquier otra cosa se ignora.
  const initialGiro = CONFIGS_REGISTRO.includes(giro as ConfigRegistro)
    ? (giro as ConfigRegistro)
    : undefined;
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