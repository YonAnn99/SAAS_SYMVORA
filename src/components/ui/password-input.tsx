"use client";

import { useState } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function getPasswordChecks(password: string) {
  return [
    { label: "Mínimo 8 caracteres", met: password.length >= 8 },
    { label: "1 letra mayúscula", met: /[A-Z]/.test(password) },
    { label: "1 letra minúscula", met: /[a-z]/.test(password) },
    { label: "1 número", met: /[0-9]/.test(password) },
    { label: "1 carácter especial (!@#$%^&*)", met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];
}

interface PasswordInputProps {
  id?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showChecklist?: boolean;
  className?: string;
  required?: boolean;
}

export function PasswordInput({
  id,
  placeholder,
  value,
  onChange,
  showChecklist = false,
  className,
  required,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const checks = getPasswordChecks(value);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
      {showChecklist && value.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {checks.map((check) => (
            <div
              key={check.label}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors",
                check.met ? "text-emerald-500" : "text-muted-foreground/60"
              )}
            >
              <div
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors",
                  check.met
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-muted-foreground/30"
                )}
              >
                {check.met && <Check className="h-2.5 w-2.5" />}
              </div>
              {check.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
