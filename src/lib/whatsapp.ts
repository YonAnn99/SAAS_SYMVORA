export function normalizePhoneMx(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `52${digits}`; // 10 dígitos locales -> asume México
  return digits; // ya trae código de país u otro formato; se envía tal cual
}

export function buildWhatsAppLink(message: string, phone?: string | null): string {
  const text = encodeURIComponent(message);
  const normalized = normalizePhoneMx(phone);
  return normalized
    ? `https://wa.me/${normalized}?text=${text}`
    : `https://wa.me/?text=${text}`;
}
