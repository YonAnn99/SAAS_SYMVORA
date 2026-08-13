"use client";

import { motion } from "motion/react";
import { WhatsAppLogo } from "./whatsapp-logo";

const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5215512345678";
const WHATSAPP_MESSAGE =
  "Hola, me interesa SYMVORA para mi negocio. ¿Pueden darme más información?";

function buildWhatsAppUrl() {
  const text = encodeURIComponent(WHATSAPP_MESSAGE);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

export function WhatsAppFab() {
  return (
    <motion.a
      href={buildWhatsAppUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 1.5, type: "spring", stiffness: 300, damping: 22 }}
      whileHover={{ scale: 1.1, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 hover:shadow-xl transition-colors flex items-center justify-center"
    >
      <span
        className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-30"
        aria-hidden="true"
      />
      <WhatsAppLogo
        size={28}
        className="relative text-white"
        aria-hidden="true"
      />
    </motion.a>
  );
}
