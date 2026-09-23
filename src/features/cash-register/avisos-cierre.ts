/**
 * A quien se avisa de un cierre de caja. Reglas puras, sin red, para poder
 * probarlas: un aviso de mas es ruido en la bandeja del dueño, y uno de menos
 * es un corte que nadie reviso.
 */

/**
 * Cierre AUTOMATICO (cron). Al dueño de la caja y al SUPER_ADMIN, salvo que
 * sean la misma persona: antes el dueño que dejaba su propia caja abierta
 * recibia dos correos del mismo cierre.
 */
export function destinatariosCierreAutomatico(params: {
  userEmail: string;
  userRole: string;
  superAdminEmail: string | null;
}): { usuario: string | null; superAdmin: string | null } {
  const superAdmin = params.superAdminEmail || null;
  const esDelDueno =
    params.userRole === "SUPER_ADMIN" ||
    (superAdmin !== null &&
      params.userEmail.trim().toLowerCase() === superAdmin.trim().toLowerCase());
  return {
    usuario: !esDelDueno && params.userEmail ? params.userEmail : null,
    superAdmin,
  };
}

/**
 * Cierre MANUAL (desde Finanzas). Se avisa al SUPER_ADMIN cuando cierra
 * cualquier otro —cajero o administrador—. Si cierra el propio dueño, no: es
 * el quien acaba de contar el dinero.
 */
export function debeAvisarCierreManual(rolQuienCierra: string | null): boolean {
  return rolQuienCierra !== "SUPER_ADMIN";
}

