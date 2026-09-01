export type SuggestionCategoria = "general" | "bug" | "mejora" | "feature";
export type SuggestionPrioridad = "baja" | "media" | "alta";

export interface SuggestionFormData {
  categoria: SuggestionCategoria;
  prioridad: SuggestionPrioridad;
  titulo: string;
  descripcion: string;
}

export const SUGGESTION_CATEGORIAS: { value: SuggestionCategoria; label: string }[] = [
  { value: "general", label: "General" },
  { value: "bug", label: "Bug" },
  { value: "mejora", label: "Mejora" },
  { value: "feature", label: "Feature" },
];

export const SUGGESTION_PRIORIDADES: { value: SuggestionPrioridad; label: string }[] = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];
