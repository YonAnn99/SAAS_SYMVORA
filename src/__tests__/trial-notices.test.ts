import { describe, expect, it } from "vitest";
import {
  DIAS_AVISO_PREVIO,
  DIAS_GRACIA_AVISO_FIN,
  avisoPendiente,
  columnaMarca,
  diasRestantes,
  type SuscripcionParaAviso,
} from "@/lib/trial-notices";

const AHORA = new Date("2026-09-15T12:00:00Z");

/** Suscripción en prueba que vence dentro de `dias` (negativo = ya venció). */
function sub(
  dias: number,
  marcas: Partial<SuscripcionParaAviso> = {}
): SuscripcionParaAviso {
  return {
    status: "trial",
    trial_end: new Date(AHORA.getTime() + dias * 86_400_000).toISOString(),
    trial_aviso_previo_en: null,
    trial_aviso_fin_en: null,
    ...marcas,
  };
}

describe("a quién le toca aviso", () => {
  it("no avisa mientras queda tiempo de sobra", () => {
    expect(avisoPendiente(sub(6), AHORA)).toBeNull();
    expect(avisoPendiente(sub(3), AHORA)).toBeNull();
  });

  it("avisa cuando entra en la ventana previa", () => {
    expect(avisoPendiente(sub(DIAS_AVISO_PREVIO), AHORA)).toBe("por_vencer");
    expect(avisoPendiente(sub(0.5), AHORA)).toBe("por_vencer");
  });

  it("avisa el día que vence y durante la gracia", () => {
    expect(avisoPendiente(sub(0), AHORA)).toBe("vencida");
    expect(avisoPendiente(sub(-1), AHORA)).toBe("vencida");
    expect(avisoPendiente(sub(-DIAS_GRACIA_AVISO_FIN), AHORA)).toBe("vencida");
  });

  it("NO avisa de pruebas caducadas hace mucho", () => {
    // La cota que evita que el primer despliegue del cron dispare un correo a
    // todo el histórico de cuentas abandonadas.
    expect(avisoPendiente(sub(-DIAS_GRACIA_AVISO_FIN - 1), AHORA)).toBeNull();
    expect(avisoPendiente(sub(-90), AHORA)).toBeNull();
  });
});

describe("idempotencia (el cron corre a diario)", () => {
  it("no repite el aviso previo si ya se mandó", () => {
    const yaAvisado = sub(1, { trial_aviso_previo_en: AHORA.toISOString() });
    expect(avisoPendiente(yaAvisado, AHORA)).toBeNull();
  });

  it("no repite el aviso de vencimiento si ya se mandó", () => {
    const yaAvisado = sub(-1, { trial_aviso_fin_en: AHORA.toISOString() });
    expect(avisoPendiente(yaAvisado, AHORA)).toBeNull();
  });

  it("haber mandado el previo NO bloquea el de vencimiento", () => {
    // Son dos correos distintos: quien recibió "te quedan 2 días" debe recibir
    // después "se acabó". Con una sola marca compartida, el segundo no saldría.
    const conPrevio = sub(-1, { trial_aviso_previo_en: AHORA.toISOString() });
    expect(avisoPendiente(conPrevio, AHORA)).toBe("vencida");
  });

  it("recorrer varios días seguidos manda exactamente dos correos", () => {
    // Simula el cron real: una prueba que arranca con 5 días y se revisa a
    // diario hasta pasada la gracia.
    const estado: SuscripcionParaAviso = {
      status: "trial",
      trial_end: new Date(AHORA.getTime() + 5 * 86_400_000).toISOString(),
      trial_aviso_previo_en: null,
      trial_aviso_fin_en: null,
    };
    const enviados: string[] = [];

    for (let dia = 0; dia <= 10; dia++) {
      const hoy = new Date(AHORA.getTime() + dia * 86_400_000);
      const aviso = avisoPendiente(estado, hoy);
      if (aviso) {
        enviados.push(aviso);
        // Lo mismo que hará la ruta tras enviar.
        if (aviso === "por_vencer") {
          estado.trial_aviso_previo_en = hoy.toISOString();
        } else {
          estado.trial_aviso_fin_en = hoy.toISOString();
        }
      }
    }

    expect(enviados).toEqual(["por_vencer", "vencida"]);
  });
});

describe("estados que no reciben nada", () => {
  it("una cuenta que ya paga no recibe avisos", () => {
    expect(avisoPendiente({ ...sub(1), status: "active" }, AHORA)).toBeNull();
    expect(avisoPendiente({ ...sub(-1), status: "active" }, AHORA)).toBeNull();
  });

  it("una cuenta dada de baja no recibe avisos", () => {
    // Se fue a propósito: perseguirla con correos de prueba es ruido.
    expect(avisoPendiente({ ...sub(-1), status: "canceled" }, AHORA)).toBeNull();
  });

  it("una cuenta ya marcada como expirada tampoco", () => {
    expect(avisoPendiente({ ...sub(-1), status: "expired" }, AHORA)).toBeNull();
  });
});

describe("diasRestantes", () => {
  it("redondea hacia arriba: quedan 'días completos'", () => {
    // Media hora antes de vencer sigue siendo "queda 1 día", no 0, para que el
    // aviso previo no se convierta en el de vencimiento por unas horas.
    expect(diasRestantes(new Date(AHORA.getTime() + 1_800_000), AHORA)).toBe(1);
    expect(diasRestantes(AHORA, AHORA)).toBe(0);
    expect(diasRestantes(new Date(AHORA.getTime() - 1_800_000), AHORA)).toBe(0);
  });

  it("acepta cadena ISO igual que Date", () => {
    const fin = new Date(AHORA.getTime() + 2 * 86_400_000);
    expect(diasRestantes(fin.toISOString(), AHORA)).toBe(
      diasRestantes(fin, AHORA)
    );
  });
});

describe("columnaMarca", () => {
  it("cada aviso marca su propia columna", () => {
    expect(columnaMarca("por_vencer")).toBe("trial_aviso_previo_en");
    expect(columnaMarca("vencida")).toBe("trial_aviso_fin_en");
    expect(columnaMarca("por_vencer")).not.toBe(columnaMarca("vencida"));
  });
});
