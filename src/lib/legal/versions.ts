export const LEGAL_DOCUMENT_VERSIONS = {
  terms: "v1.3-2026-10-06",
  privacy: "v1.5-2026-10-31",
  cookies: "v1.0-2026-08-12",
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENT_VERSIONS;
