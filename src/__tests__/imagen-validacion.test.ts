import { describe, expect, it } from "vitest";
import {
  IMAGEN_LOGO,
  IMAGEN_PRODUCTO,
  MB,
  validarImagenElegida,
} from "@/lib/imagen-validacion";

/**
 * Estos test cubren los dos fallos que hacian imposible tomar la foto con la
 * camara del celular. No son casos de borde: eran el camino normal.
 */

function archivo(type: string, mb: number): File {
  // `File` con el tamaño falseado: crear 6 MB de verdad en un test es tirar
  // memoria para comprobar una comparacion numerica.
  const f = new File([""], "foto", { type });
  Object.defineProperty(f, "size", { value: Math.round(mb * MB) });
  return f;
}

describe("el tamaño de una foto de celular", () => {
  it("acepta una foto de 6 MB como imagen de producto", () => {
    // EL FALLO QUE EVITA: el tope de 2 MB se medía sobre el archivo crudo,
    // antes de convertirlo a webp de 800x800. Una foto de celular pesa entre 3
    // y 8 MB, así que TODA foto tomada con la cámara se rechazaba — aunque el
    // webp final pesara 100 KB.
    expect(validarImagenElegida(archivo("image/jpeg", 6), IMAGEN_PRODUCTO).ok).toBe(true);
  });

  it("sigue rechazando esa misma foto como logo del negocio", () => {
    // El logo se sube sin recortar ni escalar, así que su límite de entrada SÍ
    // es su límite de salida. Los dos casos comparten componente y no pueden
    // compartir límite.
    const r = validarImagenElegida(archivo("image/jpeg", 6), IMAGEN_LOGO);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("tamano");
  });

  it("rechaza una imagen desmesurada incluso en productos", () => {
    // 15 MB cubre cualquier cámara de teléfono; por encima es un escaneo o un
    // error, y conviene pararlo antes de intentar decodificarlo en el canvas.
    expect(validarImagenElegida(archivo("image/jpeg", 40), IMAGEN_PRODUCTO).ok).toBe(false);
  });

  it("acepta justo en el límite y rechaza un byte más", () => {
    const justo = new File([""], "f", { type: "image/jpeg" });
    Object.defineProperty(justo, "size", { value: 2 * MB });
    expect(validarImagenElegida(justo, IMAGEN_LOGO).ok).toBe(true);

    const pasado = new File([""], "f", { type: "image/jpeg" });
    Object.defineProperty(pasado, "size", { value: 2 * MB + 1 });
    expect(validarImagenElegida(pasado, IMAGEN_LOGO).ok).toBe(false);
  });
});

describe("los formatos que entrega cada teléfono", () => {
  it("acepta el HEIC del iPhone", () => {
    // EL FALLO QUE EVITA: los iPhone con "Alta eficiencia" —el ajuste por
    // defecto— entregan `image/heic`, y la lista solo admitía JPEG, PNG y SVG.
    // La foto salía con "Formato no válido" pese a que Safari sabe
    // decodificarla en canvas.
    expect(validarImagenElegida(archivo("image/heic", 4), IMAGEN_PRODUCTO).ok).toBe(true);
    expect(validarImagenElegida(archivo("image/heif", 4), IMAGEN_PRODUCTO).ok).toBe(true);
  });

  it("acepta el JPEG de Android y el PNG de una captura", () => {
    expect(validarImagenElegida(archivo("image/jpeg", 3), IMAGEN_PRODUCTO).ok).toBe(true);
    expect(validarImagenElegida(archivo("image/png", 1), IMAGEN_PRODUCTO).ok).toBe(true);
  });

  it("no acepta SVG como imagen de producto", () => {
    // El bucket `product-images` no lista SVG en sus `allowed_mime_types`
    // (migración 045): aceptarlo aquí era admitir algo que el servidor habría
    // rechazado después.
    const r = validarImagenElegida(archivo("image/svg+xml", 0.1), IMAGEN_PRODUCTO);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("formato");
  });

  it("sigue aceptando SVG como logo, que es donde sí sirve", () => {
    expect(validarImagenElegida(archivo("image/svg+xml", 0.1), IMAGEN_LOGO).ok).toBe(true);
  });

  it("rechaza lo que no es una imagen", () => {
    expect(validarImagenElegida(archivo("application/pdf", 1), IMAGEN_PRODUCTO).ok).toBe(false);
    expect(validarImagenElegida(archivo("", 1), IMAGEN_PRODUCTO).ok).toBe(false);
  });
});

describe("el mensaje de error", () => {
  it("se queja del formato antes que del tamaño", () => {
    // Un PDF de 40 MB tiene dos problemas. Decir "excede el tamaño" mandaría a
    // comprimir un archivo que nunca iba a servir.
    const r = validarImagenElegida(archivo("application/pdf", 40), IMAGEN_PRODUCTO);
    expect(r.motivo).toBe("formato");
  });

  it("nombra los formatos que sí valen, sin el prefijo técnico", () => {
    const r = validarImagenElegida(archivo("application/pdf", 1), IMAGEN_PRODUCTO);
    expect(r.mensaje).toContain("JPEG");
    expect(r.mensaje).toContain("HEIC");
    expect(r.mensaje).not.toContain("image/");
  });

  it("dice el límite real de cada pantalla, no uno fijo", () => {
    expect(validarImagenElegida(archivo("image/jpeg", 40), IMAGEN_PRODUCTO).mensaje).toContain("15MB");
    expect(validarImagenElegida(archivo("image/jpeg", 40), IMAGEN_LOGO).mensaje).toContain("2MB");
  });
});
