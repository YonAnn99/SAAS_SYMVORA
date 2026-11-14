/**
 * Actualiza los suscriptores existentes con promoción activa sumando +3 cobros restantes.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/actualizar-promocion-existentes.ts
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("ERROR: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Consultando suscripciones con promoción activa...");

  const { data: subs, error: selectError } = await supabase
    .from("subscriptions")
    .select("id, tenant_id, promo_cobros_restantes, promo_plan")
    .gt("promo_cobros_restantes", 0)
    .not("promo_plan", "is", null);

  if (selectError) {
    console.error("Error al consultar suscripciones:", selectError.message);
    process.exit(1);
  }

  if (!subs || subs.length === 0) {
    console.log("No hay suscriptores con promoción activa actualmente en la base de datos.");
    console.log("Todas las nuevas suscripciones nacerán automáticamente con 6 meses.");
    return;
  }

  console.log(`Encontradas ${subs.length} suscripciones con promoción activa.`);

  let actualizadas = 0;
  for (const sub of subs) {
    const nuevosRestantes = sub.promo_cobros_restantes + 3;
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        promo_cobros_restantes: nuevosRestantes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    if (updateError) {
      console.error(`Error actualizando suscripción ${sub.id}:`, updateError.message);
    } else {
      console.log(`- Suscripción ${sub.id} (tenant: ${sub.tenant_id}): ${sub.promo_cobros_restantes} cobros -> ${nuevosRestantes} cobros`);
      actualizadas++;
    }
  }

  console.log(`\n¡Actualización completada! ${actualizadas}/${subs.length} suscripciones actualizadas.`);
}

main();
