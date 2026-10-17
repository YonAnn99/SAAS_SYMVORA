/**
 * Cartel imprimible (tamaño carta) del registro con QR (migracion 121): logo,
 * nombre del negocio, el premio, el QR grande y tres pasos. Se pega en el
 * mostrador; el cliente lo escanea con la camara de su celular.
 *
 * jsPDF y qrcode se cargan con `import()` al descargar, como los PDF de
 * ordenes de compra: no pesan en la pestaña de lealtad.
 */
import { textoPremioCartel } from "./lealtad";

export interface DatosCartel {
  negocio: string;
  programa: string;
  premio: string;
  sellosMeta: number;
  /** URL de la pagina de registro (`urlAlta`). */
  url: string;
  /** Color del acento ya resuelto (`paletaDeTarjeta`). */
  acento: string;
  logoUrl: string | null;
}

const ANCHO = 215.9;
const CENTRO = ANCHO / 2;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * El logo como PNG: jsPDF no lee webp (el formato de los logos). Si la imagen
 * no carga (CORS, red), el cartel sale sin logo.
 */
async function logoComoPng(url: string): Promise<{ datos: string; ancho: number; alto: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((ok, falla) => {
      img.onload = () => ok();
      img.onerror = () => falla(new Error("logo"));
      img.src = url;
    });
    const lado = 600;
    const escala = Math.min(lado / img.naturalWidth, lado / img.naturalHeight, 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { datos: canvas.toDataURL("image/png"), ancho: canvas.width, alto: canvas.height };
  } catch {
    return null;
  }
}

export async function generarCartelLealtad(datos: DatosCartel): Promise<Blob> {
  const [{ jsPDF }, { default: QRCode }, logo] = await Promise.all([
    import("jspdf"),
    import("qrcode"),
    datos.logoUrl ? logoComoPng(datos.logoUrl) : Promise.resolve(null),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const acento = rgb(datos.acento);

  // Franjas del color del negocio arriba y abajo.
  doc.setFillColor(...acento);
  doc.rect(0, 0, ANCHO, 12, "F");
  doc.rect(0, 267.4, ANCHO, 12, "F");

  let y = 26;
  if (logo) {
    const alto = 26;
    const ancho = Math.min(70, (logo.ancho / logo.alto) * alto);
    doc.addImage(logo.datos, "PNG", CENTRO - ancho / 2, y, ancho, (logo.alto / logo.ancho) * ancho);
    y += alto + 10;
  } else {
    y += 8;
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(17);
  doc.setFontSize(24);
  doc.text(doc.splitTextToSize(datos.negocio, 180), CENTRO, y, { align: "center" });
  y += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(100);
  doc.text(doc.splitTextToSize(datos.programa, 180), CENTRO, y, { align: "center" });

  y += 17;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...acento);
  doc.text("¡Obtén tu tarjeta de lealtad!", CENTRO, y, { align: "center" });
  y += 11;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(15);
  doc.setTextColor(40);
  const premio = doc.splitTextToSize(textoPremioCartel(datos.sellosMeta, datos.premio), 170) as string[];
  doc.text(premio, CENTRO, y, { align: "center" });
  y += premio.length * 6.5 + 6;

  // QR grande y con margen blanco: se escanea desde lejos.
  const qr = await QRCode.toDataURL(datos.url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 1200,
    color: { dark: "#0F172A", light: "#FFFFFF" },
  });
  const lado = 100;
  doc.setDrawColor(...acento);
  doc.setLineWidth(1.2);
  doc.roundedRect(CENTRO - lado / 2 - 4, y - 4, lado + 8, lado + 8, 4, 4, "S");
  doc.addImage(qr, "PNG", CENTRO - lado / 2, y, lado, lado);
  y += lado + 16;

  // Tres pasos en columnas.
  const pasos = ["Escanea con la cámara de tu celular", "Escribe tu nombre y tu celular", "Suma un sello en cada compra"];
  const columna = 60;
  pasos.forEach((paso, i) => {
    const x = CENTRO + (i - 1) * columna;
    doc.setFillColor(...acento);
    doc.circle(x, y, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255);
    doc.text(String(i + 1), x, y + 1.6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.text(doc.splitTextToSize(paso, 50), x, y + 11, { align: "center" });
  });

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Gratis, sin crear cuenta y sin descargar apps · Tarjeta digital por SYMVORA", CENTRO, 260, {
    align: "center",
  });

  return doc.output("blob");
}
