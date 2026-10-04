"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TelefonoInput } from "@/components/ui/telefono-input";
import { useContactoUsuario, type ContactoUsuario } from "@/hooks/use-contacto-usuario";
import { desdeE164 } from "@/lib/telefono";
import { AVISOS_CELULAR_ACTIVOS } from "@/lib/avisos-celular-flag";

type Guardar = ReturnType<typeof useContactoUsuario>["guardar"];

/**
 * Celular del usuario en Mi perfil: editarlo y encender o apagar los avisos
 * al celular (SMS o WhatsApp). Las cuentas creadas antes de que el registro lo pidiera lo ven
 * vacio, con la invitacion a agregarlo.
 *
 * El interruptor y las leyendas de avisos solo salen con el servicio dado de
 * alta (`AVISOS_CELULAR_ACTIVOS`): antes no se promete lo que aun no llega.
 */
export function CelularPerfil() {
  const { contacto, cargando, guardar, cambiarAvisos } = useContactoUsuario();

  if (cargando) return <div className="h-[92px]" aria-hidden />;

  return (
    <div className="space-y-2">
      {/* `key`: el formulario arranca con el numero guardado y se reinicia si cambia. */}
      <FormularioCelular key={contacto?.telefono ?? "nuevo"} contacto={contacto} guardar={guardar} />

      {!AVISOS_CELULAR_ACTIVOS ? null : contacto ? (
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <span className="flex items-center gap-2 text-xs">
            <MessageCircle className="h-3.5 w-3.5 text-primary" />
            Recibir avisos de mi cuenta en mi celular
          </span>
          <Switch
            checked={contacto.avisos_whatsapp}
            onCheckedChange={async (v) => {
              const r = await cambiarAvisos(v);
              if (!r.ok) toast.error(r.error);
            }}
          />
        </label>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Agrega tu celular para recibir avisos de tu cuenta, como tus cortes de caja, por SMS o
          WhatsApp.
        </p>
      )}
    </div>
  );
}

/**
 * Aviso de /billing para el dueño que aun no tiene celular. No pinta nada
 * mientras carga ni si ya lo tiene.
 */
export function AvisoCelularFaltante() {
  const { contacto, cargando, guardar } = useContactoUsuario();
  if (cargando || contacto) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <MessageCircle className="h-5 w-5 shrink-0 text-primary mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">Agrega tu celular</p>
          {AVISOS_CELULAR_ACTIVOS && (
            <p className="text-xs text-muted-foreground">
              Te enviaremos avisos de tu cuenta, como tus cortes de caja, por SMS o WhatsApp, y podremos
              darte soporte directo. Puedes desactivarlo en Mi perfil.
            </p>
          )}
        </div>
      </div>
      <FormularioCelular contacto={null} guardar={guardar} sinEtiqueta />
    </div>
  );
}

function FormularioCelular({
  contacto,
  guardar,
  sinEtiqueta,
}: {
  contacto: ContactoUsuario | null;
  guardar: Guardar;
  sinEtiqueta?: boolean;
}) {
  const inicial = desdeE164(contacto?.telefono, contacto?.pais);
  const [pais, setPais] = useState(inicial.pais);
  const [numero, setNumero] = useState(inicial.numero);
  const [guardando, setGuardando] = useState(false);

  const sinCambios = !!contacto && pais === inicial.pais && numero.replace(/\D/g, "") === inicial.numero;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    const r = await guardar(pais, numero);
    setGuardando(false);
    if (r.ok) toast.success("Celular guardado");
    else toast.error(r.error);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      {!sinEtiqueta && (
        <Label htmlFor="perfil-celular" className="text-xs font-medium">
          Número celular
        </Label>
      )}
      <div className="flex gap-2">
        <TelefonoInput
          id="perfil-celular"
          pais={pais}
          numero={numero}
          onPaisChange={setPais}
          onNumeroChange={setNumero}
          placeholder="10 dígitos"
          className="[&_input]:h-8 [&_input]:text-sm [&_button]:h-8"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={guardando || sinCambios || !numero.trim()}
          className="h-8 px-3 text-xs shrink-0 cursor-pointer"
        >
          {guardando ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
