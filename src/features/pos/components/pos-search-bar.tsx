"use client";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PosSearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  onSearchSubmit: () => void;
}

export function PosSearchBar({
  search,
  onSearchChange,
  onKeyDown,
  categories,
  selectedCategory,
  onCategoryChange,
  onSearchSubmit,
}: PosSearchBarProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 animate-fade-in-up stagger-1">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("pos.barcodePlaceholder")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="pl-8 h-9"
        />
      </div>
      {categories.length > 0 && (
        <Select
          value={selectedCategory}
          onValueChange={(v) => onCategoryChange(v ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-40 h-9">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button className="h-9" size="sm" onClick={onSearchSubmit}>
        {t("pos.addItem")}
      </Button>
    </div>
  );
}