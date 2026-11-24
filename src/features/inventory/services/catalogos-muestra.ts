import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UnidadMedida } from "@/lib/unidades";
import { generateNextSku } from "./product-service";

export interface ProductoMuestra {
  nombre: string;
  precio_venta: number;
  costo_compra: number;
  stock_actual: number;
  stock_minimo: number;
  categoria: string;
  unidad_medida?: UnidadMedida;
  codigo_barras?: string | null;
  es_servicio?: boolean;
}

export const CATALOGOS_POR_GIRO: Record<string, ProductoMuestra[]> = {
  abarrotes: [
    {
      nombre: "Coca-Cola Original 600 ml",
      precio_venta: 19,
      costo_compra: 14,
      stock_actual: 24,
      stock_minimo: 6,
      categoria: "Bebidas",
      unidad_medida: "PIEZA",
      codigo_barras: "7501055300075",
    },
    {
      nombre: "Papas Sabritas Sal 45 g",
      precio_venta: 20,
      costo_compra: 15,
      stock_actual: 20,
      stock_minimo: 5,
      categoria: "Botanas",
      unidad_medida: "PIEZA",
      codigo_barras: "7501011115484",
    },
    {
      nombre: "Leche Entera 1 L",
      precio_venta: 28,
      costo_compra: 22,
      stock_actual: 15,
      stock_minimo: 4,
      categoria: "Lácteos",
      unidad_medida: "PIEZA",
      codigo_barras: "7501020512144",
    },
  ],
  tiendas: [
    {
      nombre: "Coca-Cola Original 600 ml",
      precio_venta: 19,
      costo_compra: 14,
      stock_actual: 24,
      stock_minimo: 6,
      categoria: "Bebidas",
      unidad_medida: "PIEZA",
      codigo_barras: "7501055300075",
    },
    {
      nombre: "Papas Sabritas Sal 45 g",
      precio_venta: 20,
      costo_compra: 15,
      stock_actual: 20,
      stock_minimo: 5,
      categoria: "Botanas",
      unidad_medida: "PIEZA",
      codigo_barras: "7501011115484",
    },
    {
      nombre: "Galletas Marías 170 g",
      precio_venta: 18,
      costo_compra: 13,
      stock_actual: 18,
      stock_minimo: 4,
      categoria: "Abarrotes",
      unidad_medida: "PIEZA",
      codigo_barras: "7501000611416",
    },
  ],
  verdulerias: [
    {
      nombre: "Jitomate Saladette",
      precio_venta: 34,
      costo_compra: 22,
      stock_actual: 30,
      stock_minimo: 5,
      categoria: "Verduras",
      unidad_medida: "KG",
    },
    {
      nombre: "Aguacate Hass",
      precio_venta: 68,
      costo_compra: 46,
      stock_actual: 15,
      stock_minimo: 3,
      categoria: "Frutas",
      unidad_medida: "KG",
    },
    {
      nombre: "Plátano Tabasco",
      precio_venta: 24,
      costo_compra: 15,
      stock_actual: 25,
      stock_minimo: 5,
      categoria: "Frutas",
      unidad_medida: "KG",
    },
  ],
  "tiendas-de-mascotas": [
    {
      nombre: "Alimento Perro Adulto Croqueta",
      precio_venta: 48,
      costo_compra: 32,
      stock_actual: 50,
      stock_minimo: 10,
      categoria: "Alimento",
      unidad_medida: "KG",
    },
    {
      nombre: "Correa Reforzada con Asa",
      precio_venta: 125,
      costo_compra: 65,
      stock_actual: 12,
      stock_minimo: 3,
      categoria: "Accesorios",
      unidad_medida: "PIEZA",
    },
    {
      nombre: "Shampoo Acondicionador Mascota 250 ml",
      precio_venta: 85,
      costo_compra: 45,
      stock_actual: 10,
      stock_minimo: 2,
      categoria: "Higiene",
      unidad_medida: "PIEZA",
    },
  ],
  "tiendas-de-ropa": [
    {
      nombre: "Playera Cuello Redondo Algodón",
      precio_venta: 160,
      costo_compra: 80,
      stock_actual: 30,
      stock_minimo: 5,
      categoria: "Playeras",
      unidad_medida: "PIEZA",
    },
    {
      nombre: "Pantalón de Mezclilla Clásico",
      precio_venta: 390,
      costo_compra: 210,
      stock_actual: 18,
      stock_minimo: 4,
      categoria: "Pantalones",
      unidad_medida: "PIEZA",
    },
    {
      nombre: "Sudadera Lisa con Capucha",
      precio_venta: 420,
      costo_compra: 220,
      stock_actual: 14,
      stock_minimo: 3,
      categoria: "Abrigo",
      unidad_medida: "PIEZA",
    },
  ],
  ferreterias: [
    {
      nombre: "Martillo de Uña 16 oz",
      precio_venta: 145,
      costo_compra: 95,
      stock_actual: 10,
      stock_minimo: 2,
      categoria: "Herramientas",
      unidad_medida: "PIEZA",
    },
    {
      nombre: "Cinta de Aislar Negra 19 mm x 18 m",
      precio_venta: 22,
      costo_compra: 12,
      stock_actual: 35,
      stock_minimo: 8,
      categoria: "Eléctrico",
      unidad_medida: "PIEZA",
      codigo_barras: "7506240612345",
    },
    {
      nombre: "Desarmador de Cruz 1/4\" x 4\"",
      precio_venta: 68,
      costo_compra: 38,
      stock_actual: 15,
      stock_minimo: 3,
      categoria: "Herramientas",
      unidad_medida: "PIEZA",
    },
  ],
  farmacias: [
    {
      nombre: "Paracetamol 500 mg 10 tabletas",
      precio_venta: 25,
      costo_compra: 12,
      stock_actual: 40,
      stock_minimo: 8,
      categoria: "Medicamentos",
      unidad_medida: "PIEZA",
      codigo_barras: "7501234567890",
    },
    {
      nombre: "Alcohol Etílico 70% 250 ml",
      precio_venta: 32,
      costo_compra: 18,
      stock_actual: 20,
      stock_minimo: 4,
      categoria: "Primeros Auxilios",
      unidad_medida: "PIEZA",
    },
    {
      nombre: "Suero Rehidratante Oral 500 ml",
      precio_venta: 29,
      costo_compra: 17,
      stock_actual: 25,
      stock_minimo: 6,
      categoria: "Electrolitos",
      unidad_medida: "PIEZA",
    },
  ],
  carnicerias: [
    {
      nombre: "Bistec de Res Selecto",
      precio_venta: 195,
      costo_compra: 150,
      stock_actual: 20,
      stock_minimo: 4,
      categoria: "Res",
      unidad_medida: "KG",
    },
    {
      nombre: "Pechuga de Pollo Fresca",
      precio_venta: 125,
      costo_compra: 90,
      stock_actual: 25,
      stock_minimo: 5,
      categoria: "Pollo",
      unidad_medida: "KG",
    },
    {
      nombre: "Chuleta Ahumada de Cerdo",
      precio_venta: 138,
      costo_compra: 98,
      stock_actual: 15,
      stock_minimo: 3,
      categoria: "Cerdo",
      unidad_medida: "KG",
    },
  ],
  florerias: [
    {
      nombre: "Ramo de 12 Rosas Rojas",
      precio_venta: 260,
      costo_compra: 135,
      stock_actual: 10,
      stock_minimo: 2,
      categoria: "Ramos",
      unidad_medida: "PIEZA",
    },
    {
      nombre: "Girasol Individual con Follaje",
      precio_venta: 45,
      costo_compra: 22,
      stock_actual: 25,
      stock_minimo: 5,
      categoria: "Flores",
      unidad_medida: "PIEZA",
    },
    {
      nombre: "Florero de Vidrio Cilíndrico",
      precio_venta: 110,
      costo_compra: 55,
      stock_actual: 8,
      stock_minimo: 2,
      categoria: "Accesorios",
      unidad_medida: "PIEZA",
    },
  ],
  "tiendas-de-regalos": [
    {
      nombre: "Peluche Osito Mediano con Corazón",
      precio_venta: 185,
      costo_compra: 95,
      stock_actual: 12,
      stock_minimo: 2,
      categoria: "Peluches",
      unidad_medida: "PIEZA",
    },
    {
      nombre: "Taza de Cerámica con Mensaje",
      precio_venta: 75,
      costo_compra: 35,
      stock_actual: 20,
      stock_minimo: 4,
      categoria: "Tazas",
      unidad_medida: "PIEZA",
    },
    {
      nombre: "Bolsa de Regalo Holográfica Grande",
      precio_venta: 35,
      costo_compra: 15,
      stock_actual: 30,
      stock_minimo: 6,
      categoria: "Envoltura",
      unidad_medida: "PIEZA",
    },
  ],
  joyerias: [
    {
      nombre: "Cadena de Plata .925 Tejido Fígaro",
      precio_venta: 450,
      costo_compra: 240,
      stock_actual: 8,
      stock_minimo: 2,
      categoria: "Cadenas",
      unidad_medida: "PIEZA",
    },
    {
      nombre: "Aretes Broquel Circonia Plata .925",
      precio_venta: 180,
      costo_compra: 90,
      stock_actual: 15,
      stock_minimo: 3,
      categoria: "Aretes",
      unidad_medida: "PIEZA",
    },
    {
      nombre: "Anillo Ajustable Acero Inoxidable",
      precio_venta: 120,
      costo_compra: 50,
      stock_actual: 20,
      stock_minimo: 4,
      categoria: "Anillos",
      unidad_medida: "PIEZA",
    },
  ],
  refaccionarias: [
    {
      nombre: "Aceite Sintético para Motor 5W-30 1 L",
      precio_venta: 195,
      costo_compra: 130,
      stock_actual: 24,
      stock_minimo: 6,
      categoria: "Lubricantes",
      unidad_medida: "PIEZA",
      codigo_barras: "7501000123456",
    },
    {
      nombre: "Bujía Cobre Estándar",
      precio_venta: 58,
      costo_compra: 32,
      stock_actual: 40,
      stock_minimo: 8,
      categoria: "Encendido",
      unidad_medida: "PIEZA",
    },
    {
      nombre: "Limpiador de Carburador Spray 400 ml",
      precio_venta: 89,
      costo_compra: 50,
      stock_actual: 16,
      stock_minimo: 4,
      categoria: "Químicos",
      unidad_medida: "PIEZA",
    },
  ],
};

const DEFAULT_MUESTRA: ProductoMuestra[] = [
  {
    nombre: "Producto de Ejemplo 1",
    precio_venta: 49,
    costo_compra: 28,
    stock_actual: 20,
    stock_minimo: 4,
    categoria: "General",
    unidad_medida: "PIEZA",
  },
  {
    nombre: "Producto de Ejemplo 2",
    precio_venta: 120,
    costo_compra: 75,
    stock_actual: 15,
    stock_minimo: 3,
    categoria: "General",
    unidad_medida: "PIEZA",
  },
  {
    nombre: "Producto de Ejemplo 3",
    precio_venta: 250,
    costo_compra: 160,
    stock_actual: 10,
    stock_minimo: 2,
    categoria: "General",
    unidad_medida: "PIEZA",
  },
];

export function obtenerMuestrasPorGiro(giroSlug?: string | null): ProductoMuestra[] {
  if (!giroSlug) return DEFAULT_MUESTRA;
  const slug = giroSlug.toLowerCase().trim();
  
  if (CATALOGOS_POR_GIRO[slug]) return CATALOGOS_POR_GIRO[slug];
  if (slug.includes("mascota")) return CATALOGOS_POR_GIRO["tiendas-de-mascotas"];
  if (slug.includes("ropa") || slug.includes("boutique")) return CATALOGOS_POR_GIRO["tiendas-de-ropa"];
  if (slug.includes("ferreter")) return CATALOGOS_POR_GIRO["ferreterias"];
  if (slug.includes("farma")) return CATALOGOS_POR_GIRO["farmacias"];
  if (slug.includes("carne") || slug.includes("carni")) return CATALOGOS_POR_GIRO["carnicerias"];
  if (slug.includes("flor")) return CATALOGOS_POR_GIRO["florerias"];
  if (slug.includes("regalo") || slug.includes("detalle")) return CATALOGOS_POR_GIRO["tiendas-de-regalos"];
  if (slug.includes("joya") || slug.includes("plata")) return CATALOGOS_POR_GIRO["joyerias"];
  if (slug.includes("refaccion") || slug.includes("auto")) return CATALOGOS_POR_GIRO["refaccionarias"];
  if (slug.includes("verdu") || slug.includes("frut")) return CATALOGOS_POR_GIRO["verdulerias"];
  if (slug.includes("abarrote") || slug.includes("tiend") || slug.includes("mini")) return CATALOGOS_POR_GIRO["abarrotes"];

  return DEFAULT_MUESTRA;
}

/**
 * Inserta 3 productos muestra para el tenant dado si no tiene productos aún.
 */
export async function insertarProductosMuestra(
  tenantId: string,
  giroSlug?: string | null
): Promise<{ ok: boolean; count: number; error?: string }> {
  const supabase = createSupabaseBrowserClient();
  const muestras = obtenerMuestrasPorGiro(giroSlug);

  try {
    const baseSku = await generateNextSku(tenantId);
    const skuNum = parseInt(baseSku.replace(/\D/g, ""), 10) || 1;

    const filas = muestras.map((m, idx) => ({
      tenant_id: tenantId,
      nombre: m.nombre,
      descripcion: "Producto de muestra para probar tu punto de venta",
      codigo_barras: m.codigo_barras || null,
      sku: `PROD-${(skuNum + idx).toString().padStart(4, "0")}`,
      unidad_medida: m.unidad_medida || "PIEZA",
      precio_venta: m.precio_venta,
      costo_compra: m.costo_compra,
      stock_actual: m.stock_actual,
      stock_minimo: m.stock_minimo,
      categoria: m.categoria,
      es_servicio: false,
      permite_lotes: false,
      permite_variantes: false,
      imagen_url: null,
    }));

    const { data, error } = await supabase
      .from("productos")
      .insert(filas)
      .select("id");

    if (error) throw error;
    return { ok: true, count: data?.length ?? 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[catalogos-muestra] error al insertar muestras:", msg);
    return { ok: false, count: 0, error: msg };
  }
}

/**
 * Crea un producto express con campos mínimos (nombre y precio de venta).
 */
export async function crearProductoRapido(
  tenantId: string,
  datos: {
    nombre: string;
    precio_venta: number;
    costo_compra?: number;
    stock_actual?: number;
    categoria?: string;
  }
): Promise<{ ok: boolean; productoId?: string; error?: string }> {
  const supabase = createSupabaseBrowserClient();

  try {
    const sku = await generateNextSku(tenantId);
    const { data, error } = await supabase
      .from("productos")
      .insert({
        tenant_id: tenantId,
        nombre: datos.nombre.trim(),
        descripcion: null,
        codigo_barras: null,
        sku,
        unidad_medida: "PIEZA",
        precio_venta: Number(datos.precio_venta) || 0,
        costo_compra: Number(datos.costo_compra) || 0,
        stock_actual: Number(datos.stock_actual) || 10,
        stock_minimo: 2,
        categoria: datos.categoria?.trim() || "General",
        es_servicio: false,
        permite_lotes: false,
        permite_variantes: false,
        imagen_url: null,
      })
      .select("id")
      .single();

    if (error) throw error;
    return { ok: true, productoId: data.id as string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[catalogos-muestra] error al crear producto rápido:", msg);
    return { ok: false, error: msg };
  }
}
