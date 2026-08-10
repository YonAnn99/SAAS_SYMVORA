"use client";

import { useState, createContext, useContext, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionContextValue {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

const AccordionContext = createContext<AccordionContextValue>({
  activeIndex: 0,
  setActiveIndex: () => {},
});

interface AccordionProps {
  children: React.ReactNode;
  defaultIndex?: number;
  className?: string;
}

export function Accordion({ children, defaultIndex = 0, className }: AccordionProps) {
  const [activeIndex, setActiveIndex] = useState(defaultIndex);

  return (
    <AccordionContext.Provider value={{ activeIndex, setActiveIndex }}>
      <div className={cn("w-full", className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  children: React.ReactNode;
  title: string;
  index: number;
  className?: string;
}

export function AccordionItem({ children, title, index, className }: AccordionItemProps) {
  const { activeIndex, setActiveIndex } = useContext(AccordionContext);
  const isOpen = activeIndex === index;

  const toggle = useCallback(() => {
    setActiveIndex(isOpen ? -1 : index);
  }, [isOpen, index, setActiveIndex]);

  return (
    <div className={cn("border-b border-gray-200", className)}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between py-3 text-left"
        style={{ background: "none", border: "none", padding: "12px 0", cursor: "pointer" }}
      >
        <span style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a1a" }}>
          {title}
        </span>
        <ChevronDown
          className="h-4 w-4 text-gray-500 transition-transform duration-200"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />
      </button>
      <div
        style={{
          overflow: "hidden",
          transition: "max-height 0.3s ease, opacity 0.2s ease",
          maxHeight: isOpen ? "500px" : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div style={{ paddingBottom: "12px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
