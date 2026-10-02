"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { aE164 } from "@/lib/telefono";

/**
 * Celular del usuario con sesion (`contacto_usuarios`, migracion 099): lo usan
 * Mi perfil y el aviso de /billing para quien aun no lo tiene (cuentas creadas
 * antes de que el registro lo pidiera).
 */

export interface ContactoUsuario {
  telefono: string;
  pais: string;
  avisos_whatsapp: boolean;
  verificado_en: string | null;
}

export type ResultadoGuardar = { ok: true } | { ok: false; error: string };

export function useContactoUsuario(activo = true) {
  const [contacto, setContacto] = useState<ContactoUsuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    const cargar = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (vigente) setCargando(false);
        return;
      }
      const { data } = await supabase
        .from("contacto_usuarios")
        .select("telefono, pais, avisos_whatsapp, verificado_en")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (!vigente) return;
      setContacto(data ?? null);
      setCargando(false);
    };
    void cargar();
    return () => {
      vigente = false;
    };
  }, [activo]);

  /** Guarda (o crea) el celular; `avisos` solo cambia si se pasa. */
  const guardar = useCallback(
    async (pais: string, numero: string, avisos?: boolean): Promise<ResultadoGuardar> => {
      const telefono = aE164(pais, numero);
      if (!telefono) {
        return { ok: false, error: "Ingresa un número celular válido (10 dígitos en México)" };
      }
      const supabase = createSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return { ok: false, error: "Tu sesión expiró; vuelve a entrar" };

      const avisosWhatsapp = avisos ?? contacto?.avisos_whatsapp ?? true;
      const { data, error } = await supabase
        .from("contacto_usuarios")
        .upsert({
          user_id: auth.user.id,
          telefono,
          pais,
          avisos_whatsapp: avisosWhatsapp,
          // El consentimiento se registra la primera vez que da su numero.
          ...(contacto ? {} : { consentimiento_en: new Date().toISOString() }),
        })
        .select("telefono, pais, avisos_whatsapp, verificado_en")
        .single();
      if (error) return { ok: false, error: error.message };
      setContacto(data);
      return { ok: true };
    },
    [contacto]
  );

  /** Enciende o apaga los avisos por WhatsApp sin tocar el numero. */
  const cambiarAvisos = useCallback(
    async (avisos: boolean): Promise<ResultadoGuardar> => {
      if (!contacto) return { ok: false, error: "Primero guarda tu celular" };
      const supabase = createSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return { ok: false, error: "Tu sesión expiró; vuelve a entrar" };
      const anterior = contacto;
      setContacto({ ...contacto, avisos_whatsapp: avisos });
      const { error } = await supabase
        .from("contacto_usuarios")
        .update({ avisos_whatsapp: avisos })
        .eq("user_id", auth.user.id);
      if (error) {
        setContacto(anterior);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    },
    [contacto]
  );

  return { contacto, cargando, guardar, cambiarAvisos };
}
