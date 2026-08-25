/**
 * Crea (o actualiza) la cuenta de prueba del sistema real.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/create-test-account.ts
 *
 * - Email fijo pruebas@symvora.com.mx (dominio propio, sin bandeja real:
 *   se crea con email_confirm=true vía Admin API, nunca llega correo).
 * - Idempotente: si el usuario existe, actualiza la contraseña.
 *
 * El provisioning del tenant (complete_onboarding) se hace por separado
 * vía SQL con SET LOCAL request.jwt.claims (migración 028 crea la
 * suscripción trial dentro del RPC).
 */
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "pruebas@symvora.com.mx";
// Rota esta contraseña regenerando el script si las credenciales se filtran.
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "dZsFT8bPvFIhYQcU";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Faltan env de Supabase");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. ¿Existe ya?
  const { data: listData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existing = listData?.users?.find((u) => u.email === TEST_EMAIL);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`updateUserById: ${error.message}`);
    console.log(`Usuario existente actualizado: ${existing.id}`);
    console.log("USER_ID=" + existing.id);
    return;
  }

  // 2. Crear
  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      nombre: "Usuario de Pruebas",
      nombre_establecimiento: "Pruebas SYMVORA",
      giro_comercial: "GENERAL",
    },
  });

  if (error) throw new Error(`createUser: ${error.message}`);
  console.log(`Usuario creado: ${data.user?.id}`);
  console.log("USER_ID=" + data.user?.id);
}

main();
