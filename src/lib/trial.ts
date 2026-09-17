/**
 * Cuanto dura la prueba gratuita.
 *
 * ⚠️ TIENE QUE COINCIDIR con `public.dias_de_prueba()` en la base de datos
 * (migracion 069). No pueden compartir una constante —una vive en TypeScript y
 * la otra en SQL—, asi que el acuerdo se vigila con un test: `trial.test.ts` lee
 * el archivo de la migracion y compara el numero con este. Si cambias uno sin el
 * otro, la bateria de tests falla antes de que nadie vea un texto mintiendo.
 *
 * Reparto de responsabilidades:
 *
 *   - La BASE manda sobre la duracion real. `complete_onboarding` es quien fija
 *     `subscriptions.trial_end` al dar de alta una cuenta, y el middleware y la
 *     pantalla de facturacion derivan todo de esa fecha.
 *   - Este valor es solo para los TEXTOS: la landing, los correos, los terminos
 *     y la metadata de SEO, que hablan de la prueba antes de que exista ninguna
 *     suscripcion que consultar.
 *
 * Antes esto no existia y el numero estaba escrito a mano en unas veinte
 * cadenas repartidas por i18n, correos, terminos y documentacion. Pasar de 7 a
 * 14 obligo a cazarlas una por una; la siguiente vez es esta linea.
 */
export const DIAS_PRUEBA = 14;
