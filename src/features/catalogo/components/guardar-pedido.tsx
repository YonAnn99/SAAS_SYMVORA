"use client";

import { useEffect } from "react";
import { almacenDelNavegador, guardarPedido } from "../mis-pedidos";

/**
 * Al abrir la página de seguimiento, el navegador recuerda el pedido para «Mis pedidos» del catálogo. Cubre el caso
 * de quien llega desde el enlace que le mandó el negocio por WhatsApp. No pinta nada.
 */
export function GuardarPedido({
  slug,
  codigo,
  folio,
  creado,
}: {
  slug: string;
  codigo: string;
  folio: number;
  creado: string;
}) {
  useEffect(() => {
    guardarPedido(almacenDelNavegador(), slug, { codigo, folio, creado });
  }, [slug, codigo, folio, creado]);
  return null;
}
