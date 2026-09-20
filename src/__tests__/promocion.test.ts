import { describe, expect, it } from "vitest";
import {
  claveDePlanNuevo,
  cobrosPromoIniciales,
  precioCobroCents,
  promoAplica,
  trasCobrar,
} from "@/features/payments/promocion";
import { PROMO_LANZAMIENTO, SUBSCRIPTION_PRICE_CENTS } from "@/lib/pricing";

/**
 * La promocion de lanzamiento cobra $199 tres veces y despues $399. Todo lo que
 * puede salir mal aqui se paga en dinero real: cobrar de menos para siempre,
 * cobrar de mas antes de tiempo, o regalar meses que nadie autorizo.
 */

describe("a quien le toca la promoción", () => {
  it("nunca se le aplica al plan anual", () => {
    // $199 es media mensualidad; aplicarselo a un cobro anual de $3,588 seria
    // regalar el 94% del año. El anual se queda con su "Ahorra 25%".
    expect(promoAplica("yearly")).toBe(false);
    expect(cobrosPromoIniciales("yearly")).toBe(0);
    expect(precioCobroCents("yearly", 3)).toBe(SUBSCRIPTION_PRICE_CENTS.yearly);
  });

  it("una suscripción anual no puede nacer con cobros promocionales", () => {
    expect(claveDePlanNuevo("yearly")).toBe("yearly");
  });
});

describe("cuánto se cobra en cada ciclo", () => {
  it("los tres primeros cobros son de $199 y el cuarto de $399", () => {
    // El fallo que evita: quedarse cobrando $199 para siempre porque el
    // contador nunca se consulta al calcular el monto.
    const montos: number[] = [];
    let restantes = cobrosPromoIniciales("monthly");

    for (let ciclo = 0; ciclo < 4; ciclo++) {
      montos.push(precioCobroCents("monthly", restantes));
      restantes = trasCobrar(restantes, true).restantes;
    }

    expect(montos).toEqual([19900, 19900, 19900, SUBSCRIPTION_PRICE_CENTS.monthly]);
  });

  it("el precio de un cobro no depende de que la promoción siga encendida", () => {
    // `precioCobroCents` no mira `PROMO_LANZAMIENTO.activa` a proposito: si lo
    // hiciera, apagar la oferta le subiria el recibo de golpe a todo el que
    // fuera por su mes 2, que es incumplir lo prometido.
    expect(precioCobroCents("monthly", 2)).toBe(19900);
  });
});

describe("el contador de cobros promocionales", () => {
  it("un mes regalado por referido no consume promoción", () => {
    // El credito de referido reembolsa el cargo entero: el cliente no pago
    // nada, asi que gastarle un mes de promocion seria cobrarle dos veces el
    // mismo beneficio.
    expect(trasCobrar(3, false)).toEqual({
      restantes: 3,
      debeVolverAlPlanNormal: false,
    });
  });

  it("pide el cambio de plan una sola vez, en el cobro que lo agota", () => {
    // Conekta no es idempotente ni gratis: repetir `updateSubscription` en
    // cada cobro posterior es una llamada de red por recibo, y con el riesgo de
    // tocar una suscripcion que el cliente ya cambio a anual por su cuenta.
    expect(trasCobrar(2, true).debeVolverAlPlanNormal).toBe(false);
    expect(trasCobrar(1, true).debeVolverAlPlanNormal).toBe(true);
    expect(trasCobrar(0, true).debeVolverAlPlanNormal).toBe(false);
  });

  it("no baja de cero por muchos cobros que lleguen", () => {
    // Un reenvio del webhook o un cliente de dos años no pueden dejar el
    // contador en negativo: el CHECK de la migracion 073 rechazaria el UPDATE
    // y el webhook devolveria error, haciendo que Conekta reintentara sin fin.
    expect(trasCobrar(0, true).restantes).toBe(0);
    expect(trasCobrar(-1, true).restantes).toBe(0);
  });
});

describe("apagar la promoción", () => {
  it("solo decide si una suscripción NUEVA nace con cobros promocionales", () => {
    // Las dos preguntas son distintas y el modulo las separa: `activa` manda
    // sobre quien entra, el contador manda sobre quien ya entro.
    const iniciales = cobrosPromoIniciales("monthly");
    expect(iniciales).toBe(PROMO_LANZAMIENTO.activa ? PROMO_LANZAMIENTO.cobros : 0);

    // Con la promocion apagada, una suscripcion con contador vivo sigue
    // pagando $199 hasta agotarlo.
    expect(precioCobroCents("monthly", 1)).toBe(19900);
  });
});

describe("coherencia de la constante", () => {
  it("el descuento anunciado nunca promete más de lo que cobra", () => {
    // El sello dice "-50% OFF" y la card tacha $399. La mitad exacta de $399
    // seria $199.50: los $199 redondean a favor del cliente (50.1% real), que
    // es el unico lado seguro. Si alguien sube `precioCents` a 20000 el
    // descuento cae por debajo del 50% y la portada pasaria a mentir.
    const descuentoReal =
      1 - PROMO_LANZAMIENTO.precioCents / SUBSCRIPTION_PRICE_CENTS.monthly;
    expect(descuentoReal).toBeGreaterThanOrEqual(PROMO_LANZAMIENTO.descuentoPct / 100);
  });
});
