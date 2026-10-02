/**
 * Celular con lada de pais: lo que se pide al crear la cuenta.
 *
 * Se guarda en E.164 (`+525512345678`), que es lo que espera la API de
 * WhatsApp y lo que valida la base (`contacto_usuarios.telefono`).
 *
 * La lista es corta a proposito: Mexico primero (es casi todo el publico) y
 * luego los paises de la region. Cada uno sabe cuantos digitos lleva su numero
 * NACIONAL, para rechazar uno incompleto en vez de guardar basura a la que
 * nunca llegaria un aviso.
 */

export interface PaisLada {
  /** ISO 3166-1 alfa-2: es la llave (EE.UU. y Canada comparten la lada +1). */
  codigo: string;
  nombre: { es: string; en: string };
  bandera: string;
  /** Lada sin el "+". */
  lada: string;
  /** Digitos del numero nacional: [minimo, maximo]. */
  digitos: [number, number];
}

export const PAISES_LADA: readonly PaisLada[] = [
  { codigo: "MX", nombre: { es: "México", en: "Mexico" }, bandera: "🇲🇽", lada: "52", digitos: [10, 10] },
  { codigo: "US", nombre: { es: "Estados Unidos", en: "United States" }, bandera: "🇺🇸", lada: "1", digitos: [10, 10] },
  { codigo: "CA", nombre: { es: "Canadá", en: "Canada" }, bandera: "🇨🇦", lada: "1", digitos: [10, 10] },
  { codigo: "GT", nombre: { es: "Guatemala", en: "Guatemala" }, bandera: "🇬🇹", lada: "502", digitos: [8, 8] },
  { codigo: "SV", nombre: { es: "El Salvador", en: "El Salvador" }, bandera: "🇸🇻", lada: "503", digitos: [8, 8] },
  { codigo: "HN", nombre: { es: "Honduras", en: "Honduras" }, bandera: "🇭🇳", lada: "504", digitos: [8, 8] },
  { codigo: "NI", nombre: { es: "Nicaragua", en: "Nicaragua" }, bandera: "🇳🇮", lada: "505", digitos: [8, 8] },
  { codigo: "CR", nombre: { es: "Costa Rica", en: "Costa Rica" }, bandera: "🇨🇷", lada: "506", digitos: [8, 8] },
  { codigo: "PA", nombre: { es: "Panamá", en: "Panama" }, bandera: "🇵🇦", lada: "507", digitos: [8, 8] },
  { codigo: "CU", nombre: { es: "Cuba", en: "Cuba" }, bandera: "🇨🇺", lada: "53", digitos: [8, 8] },
  { codigo: "DO", nombre: { es: "República Dominicana", en: "Dominican Republic" }, bandera: "🇩🇴", lada: "1", digitos: [10, 10] },
  { codigo: "CO", nombre: { es: "Colombia", en: "Colombia" }, bandera: "🇨🇴", lada: "57", digitos: [10, 10] },
  { codigo: "VE", nombre: { es: "Venezuela", en: "Venezuela" }, bandera: "🇻🇪", lada: "58", digitos: [10, 10] },
  { codigo: "EC", nombre: { es: "Ecuador", en: "Ecuador" }, bandera: "🇪🇨", lada: "593", digitos: [9, 9] },
  { codigo: "PE", nombre: { es: "Perú", en: "Peru" }, bandera: "🇵🇪", lada: "51", digitos: [9, 9] },
  { codigo: "BO", nombre: { es: "Bolivia", en: "Bolivia" }, bandera: "🇧🇴", lada: "591", digitos: [8, 8] },
  { codigo: "CL", nombre: { es: "Chile", en: "Chile" }, bandera: "🇨🇱", lada: "56", digitos: [9, 9] },
  // Argentina: los moviles en WhatsApp llevan un "9" extra (54 9 11...).
  { codigo: "AR", nombre: { es: "Argentina", en: "Argentina" }, bandera: "🇦🇷", lada: "54", digitos: [10, 11] },
  { codigo: "UY", nombre: { es: "Uruguay", en: "Uruguay" }, bandera: "🇺🇾", lada: "598", digitos: [8, 8] },
  { codigo: "PY", nombre: { es: "Paraguay", en: "Paraguay" }, bandera: "🇵🇾", lada: "595", digitos: [9, 9] },
  { codigo: "BR", nombre: { es: "Brasil", en: "Brazil" }, bandera: "🇧🇷", lada: "55", digitos: [10, 11] },
  { codigo: "ES", nombre: { es: "España", en: "Spain" }, bandera: "🇪🇸", lada: "34", digitos: [9, 9] },
];

export const PAIS_POR_DEFECTO = "MX";

export function paisPorCodigo(codigo: string | null | undefined): PaisLada {
  return PAISES_LADA.find((p) => p.codigo === codigo) ?? PAISES_LADA[0];
}

/**
 * Numero nacional limpio (solo digitos) o `null` si no tiene la longitud del
 * pais. Tolera lo que la gente pega: espacios, guiones, parentesis, el numero
 * completo con su lada ("+52 55..."), el "1" viejo de los celulares de Mexico
 * (52 1 55...) y el "0" de marcacion nacional.
 */
export function numeroNacional(codigoPais: string, numero: string): string | null {
  const pais = paisPorCodigo(codigoPais);
  const [min, max] = pais.digitos;
  let digitos = numero.replace(/\D/g, "");

  const cabe = (d: string) => d.length >= min && d.length <= max;
  if (cabe(digitos)) return digitos;

  // Pegaron el numero completo con la lada del pais.
  if (digitos.startsWith(pais.lada) && cabe(digitos.slice(pais.lada.length))) {
    return digitos.slice(pais.lada.length);
  }

  // Mexico: el "1" de movil que WhatsApp ya no usa (52 1 55..., o 1 55...).
  if (pais.codigo === "MX") {
    if (digitos.startsWith("521") && cabe(digitos.slice(3))) return digitos.slice(3);
    if (digitos.length === 11 && digitos.startsWith("1")) return digitos.slice(1);
  }

  // El "0" de marcacion nacional (Argentina, Peru...).
  digitos = digitos.replace(/^0+/, "");
  return cabe(digitos) ? digitos : null;
}

/** `+52` + numero nacional, o `null` si el numero no es valido para el pais. */
export function aE164(codigoPais: string, numero: string): string | null {
  const nacional = numeroNacional(codigoPais, numero);
  return nacional ? `+${paisPorCodigo(codigoPais).lada}${nacional}` : null;
}

/** Separa un E.164 guardado en pais + numero nacional, para editarlo. */
export function desdeE164(
  e164: string | null | undefined,
  codigoPais?: string | null
): { pais: string; numero: string } {
  if (!e164) return { pais: codigoPais ?? PAIS_POR_DEFECTO, numero: "" };
  const digitos = e164.replace(/\D/g, "");
  // Primero el pais guardado (desempata la lada +1), luego el que coincida.
  const candidatos = [
    ...(codigoPais ? [paisPorCodigo(codigoPais)] : []),
    ...[...PAISES_LADA].sort((a, b) => b.lada.length - a.lada.length),
  ];
  for (const pais of candidatos) {
    const resto = digitos.slice(pais.lada.length);
    if (digitos.startsWith(pais.lada) && resto.length >= pais.digitos[0] && resto.length <= pais.digitos[1]) {
      return { pais: pais.codigo, numero: resto };
    }
  }
  return { pais: codigoPais ?? PAIS_POR_DEFECTO, numero: digitos };
}

/** `+52 55 1234 5678` para mostrar; si no se reconoce, el E.164 tal cual. */
export function formatearTelefono(e164: string, codigoPais?: string | null): string {
  const { pais, numero } = desdeE164(e164, codigoPais);
  const lada = paisPorCodigo(pais).lada;
  if (!e164.replace(/\D/g, "").startsWith(lada)) return e164;
  const grupos =
    numero.length === 10
      ? [numero.slice(0, 2), numero.slice(2, 6), numero.slice(6)]
      : numero.length > 4
        ? [numero.slice(0, numero.length - 4), numero.slice(-4)]
        : [numero];
  return `+${lada} ${grupos.join(" ")}`;
}
