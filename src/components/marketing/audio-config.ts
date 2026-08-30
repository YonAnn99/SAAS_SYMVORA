export interface AudioSection {
  id: string;
  label: string;
  src: string;
}

export const NARRATION_SECTIONS: AudioSection[] = [
  {
    id: "benefits",
    label: "Diseñado para quien tiene prisa",
    src: "/audio/landing/disenado-para-quien-tiene-prisa.mp3",
  },
  {
    id: "why-choose-us",
    label: "Por qué elegirnos",
    src: "/audio/landing/por-que-elegirnos.mp3",
  },
  {
    id: "features",
    label: "Todo lo que tu negocio necesita",
    src: "/audio/landing/todo-lo-que-tu-negocio-necesita.mp3",
  },
];

export const SECTION_ID_SET = new Set(
  NARRATION_SECTIONS.map((s) => s.id)
);
