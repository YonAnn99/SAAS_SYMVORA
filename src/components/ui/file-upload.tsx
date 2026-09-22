"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { Camera, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  IMAGEN_LOGO,
  validarImagenElegida,
  type OpcionesImagen,
} from "@/lib/imagen-validacion";

/**
 * Zona de subida de imagen, compartida por CUATRO pantallas: la foto del
 * producto y tres del logo del negocio.
 *
 * Por eso todo lo configurable entra como prop CON EL VALOR DE HOY POR DEFECTO.
 * Los limites de una foto de producto y los de un logo no son los mismos —una
 * foto de celular pesa 6 MB y se convierte a un webp de 800x800; un logo se
 * sube tal cual—, pero cambiar el defecto habria alterado en silencio las tres
 * pantallas de logo.
 */

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  preview: string | null;
  label?: string;
  dragDropText?: string;
  maxSizeText?: string;
  className?: string;
  /** Limites y formatos. Por defecto, los del logo: lo que habia antes. */
  opciones?: OpcionesImagen;
  /** Qué ofrece el selector del sistema. */
  accept?: string;
  /**
   * Muestra un boton "Tomar foto" que abre la camara, solo en pantallas
   * pequeñas. Ver la nota de `inputCamaraRef` sobre por que es un input aparte.
   */
  allowCamera?: boolean;
}

export function FileUpload({
  onFileSelect,
  onFileRemove,
  preview,
  label,
  dragDropText,
  maxSizeText,
  className,
  opciones = IMAGEN_LOGO,
  accept = ".jpg,.jpeg,.png,.svg",
  allowCamera = false,
}: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * La camara necesita SU PROPIO input, no `capture` en el de siempre.
   *
   * `capture` manda directo a la camara y se lleva por delante la galeria, que
   * es de donde salen las fotos que el cliente ya tiene. Con dos inputs
   * conviven las dos vias.
   */
  const inputCamaraRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      const resultado = validarImagenElegida(file, opciones);
      if (!resultado.ok) {
        setError(resultado.mensaje ?? "No se pudo usar esa imagen.");
        return;
      }
      setError(null);
      onFileSelect(file);
    },
    [onFileSelect, opciones]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
      // Sin esto, tomar una foto, descartarla y volver a tomar OTRA IGUAL no
      // dispara `change`: el valor del input no habria cambiado.
      e.target.value = "";
    },
    [validateAndSelect]
  );

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <p className="text-sm font-medium text-foreground">{label}</p>
      )}
      {preview ? (
        <div className="relative inline-block">
          <Image
            src={preview}
            alt="Preview"
            width={80}
            height={80}
            className="h-20 w-20 rounded-lg object-cover border border-border"
          />
          <button
            type="button"
            onClick={onFileRemove}
            className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs hover:opacity-80 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {dragDropText || "Arrastra tu logo aquí o haz clic para seleccionar"}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {maxSizeText || "Máximo 2MB · JPG, PNG, SVG"}
            </p>
          </button>

          {/* Solo en móvil: en un escritorio sin cámara el botón sería una
              promesa vacía, y arrastrar el archivo ya es más cómodo. */}
          {allowCamera && (
            <button
              type="button"
              onClick={() => inputCamaraRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted md:hidden"
            >
              <Camera className="h-4 w-4" />
              Tomar foto
            </button>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />
      {allowCamera && (
        <input
          ref={inputCamaraRef}
          type="file"
          // `environment` es la cámara trasera: se está fotografiando un
          // producto sobre el mostrador, no a quien lo captura.
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          className="hidden"
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
