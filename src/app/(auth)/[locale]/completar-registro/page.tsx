import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server.server";
import { CompletarRegistroForm } from "@/components/auth/completar-registro-form";

/**
 * Ultimo paso del registro para quien entro con Google por primera vez: tiene
 * sesion (Supabase creo el usuario al volver de Google) pero no negocio. El
 * middleware manda aqui a todo usuario sin membresia.
 */
export default async function CompletarRegistroPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/auth?mode=login`);

  // Con service role y filtrado por SU id: la respuesta no puede depender de
  // politicas RLS que, con un token emitido antes de tener negocio, aun no le
  // reconocen nada.
  const admin = createSupabaseServiceRoleClient();
  const { data: membresia } = await admin
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  // Ya tiene negocio (recargo, volvio atras, o termino en otra pestaña): no se
  // le ofrece crear otro. La base tambien lo impediria (migracion 087).
  if (membresia) redirect(`/${locale}/dashboard`);

  const meta = user.user_metadata ?? {};
  const nombreInicial =
    (typeof meta.nombre === "string" && meta.nombre) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    "";

  return (
    <CompletarRegistroForm
      userId={user.id}
      email={user.email ?? ""}
      nombreInicial={nombreInicial}
    />
  );
}
