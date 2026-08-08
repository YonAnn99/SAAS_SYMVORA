"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const PALETTES = [
  { id: "coral", name: "Coral", colors: ["#E07A5F", "#F2CC8F", "#81B29A"] },
  { id: "ocean", name: "Azul Océano", colors: ["#0077B6", "#00B4D8", "#90E0EF"] },
  { id: "forest", name: "Verde Bosque", colors: ["#2D6A4F", "#52B788", "#95D5B2"] },
  { id: "lavender", name: "Lavanda", colors: ["#7B2D8E", "#C77DFF", "#E0AAFF"] },
  { id: "amber", name: "Ámbar", colors: ["#E07A5F", "#F4A261", "#E9C46A"] },
  { id: "rose", name: "Rosa", colors: ["#D1495B", "#ED7E8C", "#F4B9C0"] },
  { id: "teal", name: "Turquesa", colors: ["#0DB39E", "#16DB93", "#A7C957"] },
  { id: "charcoal", name: "Carbón", colors: ["#3D405B", "#5C5470", "#8E99A4"] },
];

interface ColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
  label?: string;
  className?: string;
}

export function ColorPicker({ value, onChange, label, className }: ColorPickerProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <p className="text-sm font-medium text-foreground">{label}</p>
      )}
      <div className="grid grid-cols-4 gap-2">
        {PALETTES.map((palette) => {
          const isSelected = value === palette.colors[0];
          return (
            <button
              key={palette.id}
              type="button"
              onClick={() => onChange(isSelected ? null : palette.colors[0])}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="flex gap-0.5">
                {palette.colors.map((color) => (
                  <div
                    key={color}
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground leading-none">
                {palette.name}
              </span>
              {isSelected && (
                <div className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-2.5 w-2.5" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
