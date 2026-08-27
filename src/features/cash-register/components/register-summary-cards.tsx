"use client";

import { useTranslations } from "next-intl";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RegisterSummaryCardsProps {
  activeRegisterFondoInicial: number;
  totalVentas: number;
  totalEntradas: number;
  totalSalidas: number;
  saldoEsperado: number;
}

export function RegisterSummaryCards({
  activeRegisterFondoInicial,
  totalVentas,
  totalEntradas,
  totalSalidas,
  saldoEsperado,
}: RegisterSummaryCardsProps) {
  const t = useTranslations();

  const cards = [
    {
      title: t("pos.initialFund"),
      value: `$${activeRegisterFondoInicial.toFixed(2)}`,
      icon: Wallet,
      color: "",
    },
    {
      title: "Ventas",
      value: `+$${totalVentas.toFixed(2)}`,
      icon: ArrowUpCircle,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      title: t("finances.movementTypes.ENTRADA"),
      value: `+$${totalEntradas.toFixed(2)}`,
      icon: ArrowUpCircle,
      color: "text-[#346538] dark:text-[#7BC67E]",
    },
    {
      title: t("finances.movementTypes.SALIDA"),
      value: `-$${totalSalidas.toFixed(2)}`,
      icon: ArrowDownCircle,
      color: "text-[#9F2F2D] dark:text-[#F2A5A4]",
    },
    {
      title: t("finances.balance"),
      value: `$${saldoEsperado.toFixed(2)}`,
      icon: Wallet,
      color: "",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-5">
      {cards.map((card, i) => (
        <Card
          key={card.title}
          className={`animate-fade-in-up stagger-${i + 2}`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {card.title}
            </CardTitle>
            <card.icon
              className={`h-3.5 w-3.5 ${card.color || "text-muted-foreground"}`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-lg font-semibold tracking-tight font-mono ${card.color}`}
            >
              {card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}