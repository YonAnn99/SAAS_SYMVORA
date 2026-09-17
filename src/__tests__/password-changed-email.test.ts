import { describe, expect, it, vi } from "vitest";
import { sendPasswordChangedAlertEmail } from "@/lib/email";

describe("sendPasswordChangedAlertEmail", () => {
  it("maneja la ausencia de RESEND_API_KEY devolviendo ok: false sin lanzar excepciones", async () => {
    const res = await sendPasswordChangedAlertEmail({
      to: "admin@negocio.com",
      businessName: "Mi Tienda",
      userEmail: "cajero@negocio.com",
      userRole: "Cajero",
      isSelf: false,
    });

    expect(res).toBeDefined();
    expect(res.ok).toBe(false);
    expect(res.error).toContain("RESEND_API_KEY not configured");
  });

  it("acepta los parámetros para notificación a uno mismo", async () => {
    const res = await sendPasswordChangedAlertEmail({
      to: "cajero@negocio.com",
      businessName: "Mi Tienda",
      userEmail: "cajero@negocio.com",
      userRole: "Cajero",
      isSelf: true,
      dateStr: "17 de septiembre de 2026, 01:30",
    });

    expect(res).toBeDefined();
    expect(res.ok).toBe(false); // Porque en ambiente de test local no hay RESEND_API_KEY
  });
});
