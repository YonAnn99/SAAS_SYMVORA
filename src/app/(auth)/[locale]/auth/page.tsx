import { Suspense } from "react";
import { AuthForms } from "@/components/auth/auth-forms";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const initialMode = mode === "signup" ? "signup" : "login";

  return (
    <Suspense>
      <AuthForms initialMode={initialMode as "login" | "signup"} />
    </Suspense>
  );
}
