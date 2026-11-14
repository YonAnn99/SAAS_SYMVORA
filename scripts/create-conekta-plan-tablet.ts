/**
 * Crea el plan "SYMVORA ANUAL TABLET" en Conekta si no existe.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/create-conekta-plan-tablet.ts
 */
import { ensurePlanExists, getPlan } from "../src/features/payments/services/conekta/plans";
import { CONEKTA_PLAN_IDS, CONEKTA_PLAN_AMOUNTS } from "../src/features/payments/services/conekta/config";

async function main() {
  const apiKey = process.env.CONEKTA_PRIVATE_KEY;
  if (!apiKey) {
    console.error("ERROR: CONEKTA_PRIVATE_KEY no está configurada en las variables de entorno.");
    process.exit(1);
  }

  console.log("Iniciando aprovisionamiento en Conekta...");
  console.log(`Plan clave: yearlyTablet`);
  console.log(`ID objetivo: ${CONEKTA_PLAN_IDS.yearlyTablet}`);
  console.log(`Monto objetivo: ${CONEKTA_PLAN_AMOUNTS.yearlyTablet / 100} MXN (${CONEKTA_PLAN_AMOUNTS.yearlyTablet} centavos)`);

  try {
    const planId = await ensurePlanExists("yearlyTablet");
    console.log(`\n¡Plan asegurado con éxito! Plan ID: ${planId}`);

    const info = await getPlan(planId);
    console.log("\nDetalles registrados en Conekta:");
    console.log(`  - ID: ${info.id}`);
    console.log(`  - Nombre: ${info.name}`);
    console.log(`  - Monto: $${(Number(info.amount) / 100).toFixed(2)} ${info.currency}`);
    console.log(`  - Intervalo: ${info.interval} (frecuencia: ${info.frequency})`);
    console.log(`  - Trial days: ${info.trial_period_days}`);
    console.log("\nEl plan ya está activo y disponible en tu panel de Conekta (panel.conekta.com/subscriptions/plans).");
  } catch (error: any) {
    console.error("Error al registrar el plan en Conekta:", error?.response?.data || error?.message || error);
    process.exit(1);
  }
}

main();
