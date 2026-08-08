import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const signupSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
});

export const tenantSchema = z.object({
  nombre_comercial: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres"),
  subdominio: z
    .string()
    .min(3, "El subdominio debe tener al menos 3 caracteres")
    .regex(
      /^[a-z0-9-]+$/,
      "Solo se permiten letras minúsculas, números y guiones"
    ),
  giro_comercial: z.enum([
    "ABARROTES",
    "VERDULERIA",
    "MASCOTAS",
    "ROPA",
    "FERRETERIA",
    "FARMACIA",
    "GENERAL",
  ]),
});

export const productSchema = z.object({
  codigo_barras: z.string().optional(),
  sku: z.string().optional(),
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional(),
  unidad_medida: z.enum(["PIEZA", "KG", "GRAMO", "LITRO", "SERVICIO"]),
  precio_venta: z.number().min(0, "El precio debe ser mayor a 0"),
  costo_compra: z.number().min(0, "El costo debe ser mayor a 0"),
  stock_actual: z.number().min(0, "El stock debe ser mayor a 0"),
  stock_minimo: z.number().min(0, "El stock mínimo debe ser mayor a 0"),
  es_servicio: z.boolean().default(false),
  categoria: z.string().optional(),
  proveedor_id: z.string().uuid().optional(),
});

export const customerSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Correo electrónico inválido").optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  limite_credito: z.number().min(0).default(0),
});

export const supplierSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  contact_name: z.string().optional(),
  email: z.string().email("Correo electrónico inválido").optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  tiempo_surtido: z.string().optional(),
  condiciones_comerciales: z.string().optional(),
});

export const cashRegisterOpenSchema = z.object({
  fondo_inicial: z.number().min(0, "El fondo inicial debe ser mayor a 0"),
  notas_apertura: z.string().optional(),
});

export const cashRegisterCloseSchema = z.object({
  saldo_real: z.number().min(0, "El saldo real debe ser mayor a 0"),
  notas_cierre: z.string().optional(),
});

export const cashMovementSchema = z.object({
  tipo: z.enum(["ENTRADA", "SALIDA"]),
  monto: z.number().min(0.01, "El monto debe ser mayor a 0"),
  descripcion: z.string().min(1, "La descripción es requerida"),
});

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  nombre: z.string(),
  cantidad: z.number().min(0.001),
  precioUnitario: z.number().min(0),
  descuento: z.number().min(0).default(0),
  unidad_medida: z.enum(["PIEZA", "KG", "GRAMO", "LITRO", "SERVICIO"]),
});

export const saleSchema = z.object({
  cliente_id: z.string().uuid().optional(),
  metodo_pago: z.enum(["EFECTIVO", "TARJETA", "TRANSFERENCIA", "CREDITO"]),
  monto_recibido: z.number().optional(),
  notas: z.string().optional(),
  items: z.array(cartItemSchema).min(1, "Agrega al menos un producto"),
});
