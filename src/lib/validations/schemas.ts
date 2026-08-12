import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

const passwordValidation = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "Debe contener al menos 1 letra mayúscula")
  .regex(/[a-z]/, "Debe contener al menos 1 letra minúscula")
  .regex(/[0-9]/, "Debe contener al menos 1 número")
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Debe contener al menos 1 carácter especial");

export const signupSchema = z
  .object({
    nombre: z.string().min(1, "El nombre es requerido"),
    segundo_nombre: z.string().optional(),
    apellido_paterno: z.string().min(1, "El apellido paterno es requerido"),
    apellido_materno: z.string().min(1, "El apellido materno es requerido"),
    nombre_establecimiento: z.string().min(2, "El nombre del establecimiento es requerido"),
    giro_comercial: z.enum([
      "ABARROTES",
      "VERDULERIA",
      "MASCOTAS",
      "ROPA",
      "FERRETERIA",
      "FARMACIA",
      "GENERAL",
    ]),
    email: z.string().email("Correo electrónico inválido"),
    password: passwordValidation,
    password_confirm: z.string(),
    color_primario: z.string().optional(),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: "Las contraseñas no coinciden",
    path: ["password_confirm"],
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

export const facturaLineaSchema = z.object({
  producto_id: z.string().uuid().optional(),
  descripcion: z.string().min(1, "La descripción es requerida"),
  clave_prod_serv: z.string().min(1, "La clave de producto SAT es requerida"),
  clave_unidad: z.string().min(1, "La clave de unidad SAT es requerida"),
  unidad: z.string().min(1, "La unidad es requerida"),
  cantidad: z.number().min(0.0001, "La cantidad debe ser mayor a 0"),
  precio_unitario: z.number().min(0, "El precio debe ser mayor o igual a 0"),
  descuento: z.number().min(0).default(0),
});

export const facturaCreateSchema = z.object({
  tenant_id: z.string().uuid("ID de tenant inválido"),
  cliente_id: z.string().uuid("Selecciona un cliente válido"),
  venta_id: z.string().uuid().optional(),
  forma_pago: z.string().min(1, "La forma de pago es requerida"),
  metodo_pago: z.enum(["PUE", "PPD"]),
  notas: z.string().optional(),
  lineas: z
    .array(facturaLineaSchema)
    .min(1, "Agrega al menos un concepto"),
});

export const facturaStampSchema = z.object({
  factura_id: z.string().uuid("ID de factura inválido"),
});

export const facturaCancelSchema = z.object({
  factura_id: z.string().uuid("ID de factura inválido"),
  motivo: z
    .string()
    .min(10, "El motivo debe tener al menos 10 caracteres")
    .max(500, "El motivo no puede exceder 500 caracteres"),
  folio_sustitucion: z.string().optional(),
});

export const tenantFiscalConfigSchema = z.object({
  rfc: z
    .string()
    .min(12, "El RFC debe tener al menos 12 caracteres")
    .max(13, "El RFC no puede exceder 13 caracteres")
    .regex(
      /^[A-Z&]{3,4}\d{6}[A-Z\d]{3}$/,
      "Formato de RFC inválido"
    ),
  razon_social: z
    .string()
    .min(3, "La razón social debe tener al menos 3 caracteres")
    .max(150, "La razón social no puede exceder 150 caracteres"),
  regimen_fiscal: z.string().min(1, "El régimen fiscal es requerido"),
  codigo_postal: z
    .string()
    .length(5, "El código postal debe tener 5 dígitos")
    .regex(/^\d{5}$/, "El código postal solo debe contener números"),
});

export const clienteFiscalSchema = z.object({
  rfc: z
    .string()
    .min(12, "El RFC debe tener al menos 12 caracteres")
    .max(13, "El RFC no puede exceder 13 caracteres")
    .regex(
      /^[A-Z&]{3,4}\d{6}[A-Z\d]{3}$/,
      "Formato de RFC inválido"
    )
    .optional()
    .or(z.literal("")),
  razon_social: z.string().optional(),
  regimen_fiscal_receptor: z.string().optional(),
  uso_cfdi: z.string().optional(),
  codigo_postal: z
    .string()
    .length(5, "El código postal debe tener 5 dígitos")
    .regex(/^\d{5}$/, "El código postal solo debe contener números")
    .optional()
    .or(z.literal("")),
});
