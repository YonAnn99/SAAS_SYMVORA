import { Suspense } from "react";
import { AuthForms } from "@/components/auth/auth-forms";
import { getReferrerBusinessName } from "@/lib/referrals";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; ref?: string }>;
}) {
  const { mode, ref } = await searchParams;
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
      />
    </Suspense>
  );
}