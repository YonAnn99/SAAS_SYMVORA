export const LEGAL_DOCUMENT_VERSIONS = {
  terms: "v1.1-2026-08-12",
  privacy: "v1.1-2026-08-12",
  cookies: "v1.0-2026-08-12",
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENT_VERSIONS;
