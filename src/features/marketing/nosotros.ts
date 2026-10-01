/**
 * Contenido de /es/nosotros: la identidad de SYMVORA, tomada del documento
 * "Identidad Symvora" (solo lo publico; las guias internas de marca —arquetipo,
 * personalidad verbal, publico objetivo, arquitectura— no se muestran).
 *
 * Vive aparte de la maquetacion (`components/marketing/nosotros-contenido.tsx`)
 * para poder editar el texto sin tocar el diseño, igual que `aprende.ts`.
 *
 * De las lineas de solucion se omiten, a proposito, Desarrollo web e
 * Inteligencia artificial.
 */

export const ESLOGAN = "Sinergia que impulsa la evolución";

export const ESENCIA = [
  "SYMVORA es una empresa de tecnología dedicada al desarrollo de software y soluciones digitales para empresas y negocios.",
  "Su propósito es utilizar la tecnología para resolver problemas reales, optimizar procesos y ayudar a las organizaciones a trabajar de manera más eficiente, ordenada y escalable.",
  "Nace de la unión entre visión empresarial, desarrollo tecnológico e innovación, con la intención de convertirse en un aliado tecnológico para los negocios.",
];

export interface ParteNombre {
  silaba: string;
  inspiracion: string;
  texto: string;
}

export const NOMBRE: { partes: ParteNombre[]; concepto: string } = {
  partes: [
    {
      silaba: "SYM",
      inspiracion: "Synergy · sinergia",
      texto: "Representa la colaboración entre personas, equipos, empresas y tecnología.",
    },
    {
      silaba: "VOR",
      inspiracion: "Visión · movimiento · impulso",
      texto: "Simboliza la búsqueda constante de evolución y la capacidad de transformar una idea en una solución.",
    },
    {
      silaba: "A",
      inspiracion: "Adaptación · avance · apertura",
      texto: "Representa adaptación, avance y apertura hacia nuevas posibilidades.",
    },
  ],
  concepto:
    "SYMVORA representa la sinergia entre la visión empresarial y la tecnología para impulsar la evolución de los negocios.",
};

export interface Pilar {
  id: "proposito" | "mision" | "vision";
  titulo: string;
  destacado: string;
  detalle?: string;
}

export const PILARES: Pilar[] = [
  {
    id: "proposito",
    titulo: "Propósito",
    destacado: "Convertir problemas empresariales en soluciones tecnológicas.",
    detalle:
      "SYMVORA busca que las empresas y negocios puedan aprovechar la tecnología de una manera práctica, accesible y orientada a resultados.",
  },
  {
    id: "mision",
    titulo: "Misión",
    destacado:
      "Desarrollar soluciones de software innovadoras, funcionales y adaptables que ayuden a empresas y negocios a optimizar sus procesos, tomar mejores decisiones y crecer mediante la tecnología.",
  },
  {
    id: "vision",
    titulo: "Visión",
    destacado:
      "Convertir a SYMVORA en una empresa de tecnología reconocida por desarrollar soluciones de software capaces de transformar la manera en que las empresas operan, evolucionan y aprovechan la tecnología.",
    detalle:
      "A largo plazo, SYMVORA busca desarrollar un ecosistema de soluciones tecnológicas que atienda diferentes necesidades y sectores empresariales.",
  },
];

export interface Valor {
  id:
    | "innovacion"
    | "evolucion"
    | "compromiso"
    | "colaboracion"
    | "calidad"
    | "adaptabilidad"
    | "vision-empresarial";
  titulo: string;
  texto: string;
}

export const VALORES: Valor[] = [
  { id: "innovacion", titulo: "Innovación", texto: "Buscar constantemente nuevas formas de resolver problemas mediante tecnología." },
  { id: "evolucion", titulo: "Evolución", texto: "Aprender, mejorar y adaptar las soluciones continuamente." },
  { id: "compromiso", titulo: "Compromiso", texto: "Responder por lo que se desarrolla y cumplir con los objetivos establecidos con cada cliente." },
  { id: "colaboracion", titulo: "Colaboración", texto: "Creer que las mejores soluciones surgen de la combinación de diferentes conocimientos, perspectivas y experiencias." },
  { id: "calidad", titulo: "Calidad", texto: "Crear software funcional, confiable, mantenible y pensado para crecer." },
  { id: "adaptabilidad", titulo: "Adaptabilidad", texto: "Entender que cada empresa tiene necesidades diferentes y desarrollar soluciones capaces de responder a ellas." },
  { id: "vision-empresarial", titulo: "Visión empresarial", texto: "No desarrollar tecnología únicamente por desarrollar tecnología; cada solución debe aportar valor al negocio." },
];

export const PROPUESTA = {
  frase:
    "SYMVORA transforma las necesidades de empresas y negocios en soluciones de software diseñadas para mejorar su operación, control y crecimiento.",
  formula: ["Comprensión del negocio", "Tecnología", "Personalización", "Innovación"],
  cierre:
    "SYMVORA busca entender primero el problema y posteriormente determinar qué solución tecnológica tiene sentido.",
};

export interface LineaSolucion {
  id: "empresarial" | "pos" | "automatizacion" | "personalizado";
  titulo: string;
  puntos: string[];
  texto?: string;
  /** El producto que ya existe hoy. */
  disponible?: boolean;
}

export const LINEAS: LineaSolucion[] = [
  {
    id: "pos",
    titulo: "Punto de venta",
    puntos: ["Ventas", "Inventarios", "Clientes", "Productos", "Reportes", "Control de operaciones"],
    disponible: true,
  },
  {
    id: "empresarial",
    titulo: "Software empresarial",
    puntos: ["Sistemas administrativos", "Sistemas de gestión", "Sistemas de cotizaciones", "Sistemas de control interno"],
  },
  {
    id: "automatizacion",
    titulo: "Automatización",
    puntos: ["Automatización de procesos", "Integración de sistemas", "Flujos de trabajo digitales", "Eliminación de procesos manuales"],
  },
  {
    id: "personalizado",
    titulo: "Software personalizado",
    puntos: [],
    texto: "Desarrollo de soluciones específicas de acuerdo con las necesidades de cada empresa.",
  },
];

export const FILOSOFIA = {
  cita: "La tecnología debe resolver problemas, no crear más problemas.",
  parrafos: [
    "SYMVORA busca desarrollar herramientas que sean útiles, comprensibles y capaces de adaptarse a las necesidades reales de quienes las utilizan.",
    "La empresa entiende el desarrollo de software como un medio para generar valor, no como un fin en sí mismo.",
  ],
};

export const IDEA_CENTRAL = {
  parrafos: [
    "SYMVORA no es un punto de venta. SYMVORA es la empresa que crea soluciones tecnológicas.",
    "El punto de venta es simplemente el primer producto que demuestra lo que SYMVORA es capaz de construir.",
  ],
  cita: "Necesito una solución. Necesito a SYMVORA.",
};
