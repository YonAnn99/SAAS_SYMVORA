import { redirect } from "next/navigation";

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  const { ref } = await searchParams;

  const refQuery = ref ? `&ref=${encodeURIComponent(ref)}` : "";
  redirect(`/${locale}/auth?mode=signup${refQuery}`);
}
