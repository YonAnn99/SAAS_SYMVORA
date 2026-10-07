import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server.server";

export const maxDuration = 15;

/**
 * El visitante sale de la demo (X de la franja): se borra SU negocio y SU
 * usuario en ese momento, sin esperar a que venza (migracion 112).
 *
 * La sesion se verifica aqui (cookie, `getUser`); el borrado va con
 * service_role porque toca `auth.users`. `borrar_mi_demo` vuelve a comprobar
 * que el usuario sea de visitante: una cuenta real nunca se borra por aqui.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const esVisitante = (user.app_metadata as Record<string, unknown> | null)?.is_demo === true;
  if (!esVisitante) {
    return NextResponse.json({ error: "No es una demo" }, { status: 403 });
  }

  const admin = createSupabaseServiceRoleClient();
  const { data: borrado, error } = await admin.rpc("borrar_mi_demo", { p_user_id: user.id });
  if (error) {
    console.error("[demo/salir] borrar_mi_demo failed:", error.message);
    // No es grave: la demo vence sola y la limpieza la borra.
    return NextResponse.json({ error: "No se pudo borrar la demo" }, { status: 500 });
  }

  return NextResponse.json({ borrado: Boolean(borrado) });
}
