"use client";

import { SALES_WHATSAPP } from "@/lib/contact";
import * as m from "motion/react-m";
import { WhatsAppLogo } from "./whatsapp-logo";

const WHATSAPP_NUMBER = SALES_WHATSAPP;
const WHATSAPP_MESSAGE =
  "Hola, me interesa SYMVORA para mi negocio. ¿Pueden darme más información?";

function buildWhatsAppUrl() {
  const text = encodeURIComponent(WHATSAPP_MESSAGE);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

export function WhatsAppFab() {
  return (
    <m.a
      href={buildWhatsAppUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 1.5, type: "spring", stiffness: 300, damping: 22 }}
      whileHover={{ scale: 1.1, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className="absolute bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center"
    >
      <span
        className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30"
        aria-hidden="true"
      />
      {/* El llenado va en un circulo interior: el efecto necesita
          `overflow: hidden`, y en el enlace recortaria el anillo que late. */}
      <span className="btn-llenado [--llenado:#128C7E] [--llenado-texto:#FFFFFF] !absolute inset-0 rounded-full bg-[#25D366] text-white flex items-center justify-center">
        <WhatsAppLogo size={28} aria-hidden="true" />
      </span>
    </m.a>
  );
}
