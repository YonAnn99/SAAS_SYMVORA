import { redirect } from "next/navigation";

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string; promo?: string }>;
}) {
  const { locale } = await params;
  const { ref, promo } = await searchParams;

  const refQuery = ref ? `&ref=${encodeURIComponent(ref)}` : "";
  const promoQuery = promo ? `&promo=${encodeURIComponent(promo)}` : "";
  redirect(`/${locale}/auth?mode=signup${refQuery}${promoQuery}`);
}
