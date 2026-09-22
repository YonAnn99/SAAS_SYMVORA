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

    // WEBP y no PNG: pesa bastante menos y es el formato en el que acabaremos
    // guardando la imagen, asi que evita una conversion de ida y vuelta.
    envio.append("format", "webp");

    // FONDO BLANCO SOLIDO. Es el estandar de catalogo —Amazon y Google Shopping
    // lo exigen— y es lo que hace que veinte fotos tomadas con teléfonos
    // distintos, sobre mostradores distintos, se vean como UN MISMO catalogo.
    // Esa uniformidad era el objetivo de toda esta funcion.
    //
    // `bg_color` viene en el plan Basic que ya pagamos ($0.02 por imagen): es un
    // campo mas en la misma llamada, sin costo adicional. La iluminacion y la
    // sombra de estudio existen, pero viven en el Image Editing API a $0.10 —
    // cinco veces mas— y se pospusieron a proposito: la descripcion de su
    // "AI Relight" esta escrita para fotos de PERSONAS (quitar imperfecciones,
    // blanquear dientes), asi que su beneficio sobre mercancia no esta
    // demostrado y no se paga 5x por algo sin comprobar.
    //
    // EL `#` NO ES OPCIONAL. Esta API documenta el valor como "a hex code
    // (`#FF00FF`) or a HTML color (`red`, `green`...)". Sin la almohadilla
    // responde 400 con `The value set for bg_color=FFFFFF is not valid`, que es
    // exactamente lo que rompio esta funcion en produccion el 2026-09-22.
    //
    // La trampa: el Image Editing API expresa LO MISMO como `background.color`
    // y ahi SI va sin `#`. Son dos APIs distintas con dos formatos distintos
    // para el mismo concepto, y su documentacion esta en paginas separadas. Si
    // algun dia se migra a ese otro endpoint, hay que quitar el `#`.
    envio.append("bg_color", "#FFFFFF");

    // Solo los pixeles que vamos a usar. Por defecto devuelve `full` (36 MP) y
    // despues `cropToSquareWebP` lo deja en 800x800 = 0,64 MP: estariamos
    // esperando —y bajando por datos moviles— unas 56 veces mas imagen de la
    // que acaba guardada. `medium` son 1,5 MP, que en 4:3 (1414x1060) y en 16:9
    // (1632x918) sobran para el recorte cuadrado.
    //
    // NO ABARATA la llamada: se factura por peticion, no por tamaño. Lo que
    // recorta es la espera del comerciante con el telefono en el mostrador,
    // que es donde de verdad se usa esto. Si alguna vez se ve blando, `hd`
    // (4 MP) sigue siendo 9 veces menos que `full`.
    envio.append("size", "medium");

    // `crop` (el tercer parametro de esta API) se queda en su `false` por
    // defecto a proposito: recorta hasta el borde del objeto y dejaria el
    // producto pegado a los cuatro lados. El encuadre lo hacemos nosotros.

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
      //
      // LEE ESTE LOG ANTES DE CULPAR A LA FOTO. Al usuario le llega "No se pudo
      // procesar esa foto. Intenta con otra", pero un 400 tambien lo provoca un
      // parametro NUESTRO mal formado, y entonces ninguna foto va a funcionar.
      // Ya paso con `bg_color` sin `#`: el comerciante estuvo probando fotos
      // distintas contra un fallo que no estaba en ninguna de ellas. El detalle
      // que PhotoRoom manda aqui dice cual es el parametro; el mensaje de la
      // pantalla no puede.
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
        // EN QUE MODO SE PROCESO. El sandbox marca TODAS las imagenes con marca
        // de agua, y esa llave puede estar tambien en produccion mientras se
        // prueba. Sin este aviso, un comerciante guardaria en su catalogo una
        // foto con la marca de PhotoRoom encima sin que nada se lo dijera.
        //
        // Se deduce de la propia llave (las de sandbox empiezan por `sandbox_`)
        // y NO de una segunda variable de entorno: una sola fuente, imposible
        // de desincronizar. El dia que se pegue la llave live, el aviso de la
        // pantalla desaparece solo.
        //
        // Viaja como cabecera y no como endpoint aparte para no añadir una
        // peticion: acompaña a la imagen que ya se estaba pidiendo.
        "X-Photoroom-Modo": apiKey.startsWith("sandbox_") ? "sandbox" : "live",
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
