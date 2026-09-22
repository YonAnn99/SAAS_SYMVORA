import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { cabecerasRateLimit, consumirRateLimit } from "@/lib/rate-limit";
import {
  errorDePhotoroom,
  SIN_LLAVE,
  SIN_RESPUESTA,
} from "@/features/inventory/photoroom-errores";

/**
 * Quita el fondo de la foto de un producto.
 *
 * POR QUE PASA POR EL SERVIDOR Y NO SE HACE EN EL NAVEGADOR. Dos razones, y
 * ninguna es de comodidad:
 *
 *  - La llave de PhotoRoom no puede pisar el navegador. Cualquiera la leeria
 *    del bundle y gastaria creditos a cuenta del negocio.
 *  - Hacerlo en el cliente con WebAssembly se evaluo y se descarto: la libreria
 *    mas conocida (`@imgly/background-removal-js`) es AGPL —incompatible con un
 *    SaaS propietario sin licencia comercial— y obliga a descargar unos 54 MB
 *    de runtime y modelo antes del primer recorte, sobre datos moviles y en
 *    mitad del alta de un producto.
 */

// PhotoRoom tarda segundos, no milisegundos. Sin presupuesto explicito, una
// llamada lenta deja la funcion ocupada hasta el tope por defecto.
export const maxDuration = 30;

// CADA LLAMADA SE FACTURA. Esto no es un adorno antiabuso: es el freno al
// gasto. 40 imagenes por hora y por negocio deja trabajar a quien esta dando de
// alta su catalogo de golpe, y acota lo que puede costar una tarde.
const LIMITE_POR_HORA = 40;
const VENTANA_SEGUNDOS = 3600;

const PHOTOROOM_URL = "https://sdk.photoroom.com/v1/segment";

// Limites de PhotoRoom, comprobados en su documentacion: 50 MB de archivo y
// 6.000 px en el lado mas largo. Nuestro tope de entrada son 15 MB
// (`IMAGEN_PRODUCTO`), asi que por peso no se llega nunca. Por resolucion solo
// se pasaria un telefono disparando a 50 MP reales (8160 px), que no es el modo
// por defecto de practicamente ningun movil; si ocurre, PhotoRoom responde 400 y
// el mensaje traducido invita a probar con otra foto o guardar la original.
// Acepta HEIC de entrada, asi que la foto del iPhone va tal cual.

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const imagen = form.get("imagen");
    const tenantId = form.get("tenant_id");

    if (!(imagen instanceof File) || typeof tenantId !== "string" || !tenantId) {
      return NextResponse.json(
        { error: "Faltan la imagen o el negocio." },
        { status: 400 }
      );
    }

    // `inventory.manage` y NO el del catalogo: `/products` es `permission: null`
    // a proposito, porque todo el equipo consulta productos para vender. Pero
    // este endpoint CUESTA DINERO por llamada, asi que se rige por el permiso
    // de crear y editar productos, que es quien de verdad sube fotos.
    const auth = await requireTenantAccess(request, {
      tenantId,
      permission: "inventory.manage",
    });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    const limite = await consumirRateLimit(
      `quitar-fondo:${tenantId}`,
      LIMITE_POR_HORA,
      VENTANA_SEGUNDOS
    );
    if (!limite.permitido) {
      return NextResponse.json(
        {
          error:
            "Ya se mejoraron muchas imágenes en la última hora. Espera un poco o guarda el producto con la foto original.",
        },
        { status: 429, headers: cabecerasRateLimit(limite) }
      );
    }

    const apiKey = process.env.PHOTOROOM_API_KEY;
    if (!apiKey) {
      // Se distingue de "el servicio fallo" a proposito: esto lo arregla quien
      // despliega añadiendo la variable, y conviene que el log lo diga claro.
      console.error("[quitar-fondo] falta PHOTOROOM_API_KEY en el entorno");
      return NextResponse.json({ error: SIN_LLAVE.mensaje }, { status: SIN_LLAVE.status });
    }

    const envio = new FormData();
    envio.append("image_file", imagen);
    // WEBP y no PNG: los dos conservan la transparencia, pero webp pesa bastante
    // menos y ademas es el formato en el que acabaremos guardando la imagen, asi
    // que evita una conversion de ida y vuelta.
    //
    // Transparencia y NO fondo blanco: el alfa sobrevive al webp final, y asi la
    // misma imagen se ve bien sobre la tarjeta clara del catalogo y sobre la
    // oscura del Punto de Venta. Un fondo blanco quemado seria un parche en el
    // tema oscuro.
    envio.append("format", "webp");

    let respuesta: Response;
    try {
      respuesta = await fetch(PHOTOROOM_URL, {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: envio,
        // Por debajo del `maxDuration` de la funcion: mejor un mensaje nuestro
        // que un corte seco de la plataforma.
        signal: AbortSignal.timeout(25000),
      });
    } catch (error) {
      console.error("[quitar-fondo] no hubo respuesta de PhotoRoom:", error);
      return NextResponse.json(
        { error: SIN_RESPUESTA.mensaje },
        { status: SIN_RESPUESTA.status }
      );
    }

    if (!respuesta.ok) {
      // El cuerpo se registra pero NO se devuelve: puede traer datos de la
      // cuenta o pistas sobre la llave.
      const detalle = await respuesta.text().catch(() => "");
      console.error(
        `[quitar-fondo] PhotoRoom respondió ${respuesta.status}:`,
        detalle.slice(0, 300)
      );
      const traducido = errorDePhotoroom(respuesta.status);
      return NextResponse.json(
        { error: traducido.mensaje },
        { status: traducido.status }
      );
    }

    const recorte = await respuesta.arrayBuffer();
    return new NextResponse(recorte, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        // Es una imagen de un solo uso, atada a una sesión de alta de producto.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[quitar-fondo] error inesperado:", error);
    return NextResponse.json(
      { error: "No se pudo mejorar la imagen. Guarda el producto con la foto original." },
      { status: 500 }
    );
  }
}
