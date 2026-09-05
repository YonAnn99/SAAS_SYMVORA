"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useCustomers, CreditPaymentDialog } from "@/features/customers";

export default function CustomersPage() {
  const t = useTranslations();
  const { tenantId } = useCurrentTenant();
  const [search, setSearch] = useState("");
  const {
    customers,
    loading,
    paymentDialogFor,
    setPaymentDialogFor,
    savingPayment,
    handleRegisterPayment,
  } = useCustomers(tenantId);

  const filtered = customers.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {t("customers.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("customers.subtitle")}
          </p>
        </div>
      </div>

      <div className="relative max-w-sm animate-fade-in-up stagger-2">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("customers.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <Card className="animate-fade-in-up stagger-3">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              {t("finances.customers")}
            </CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {customers.length} clientes
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <p className="text-sm text-muted-foreground">
                {t("customers.noCustomers")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wider">
                      {t("customers.name")}
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider">
                      {t("finances.balance")}
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider">
                      {t("finances.creditLimit")}
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider">
                      {t("common.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-sm">
                        {c.nombre}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.saldo_pendiente > 0 ? (
                          <Badge
                            variant="destructive"
                            className="text-[10px] px-1.5 py-0 font-mono"
                          >
                            ${c.saldo_pendiente.toFixed(2)}
                          </Badge>
                        ) : (
                          <span className="text-sm font-mono text-muted-foreground">
                            $0.00
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        ${c.limite_credito.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={c.saldo_pendiente <= 0}
                          onClick={() => setPaymentDialogFor(c)}
                        >
                          {t("finances.addPayment")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreditPaymentDialog
        cliente={paymentDialogFor}
        onOpenChange={(open) => !open && setPaymentDialogFor(null)}
        onConfirm={handleRegisterPayment}
        saving={savingPayment}
      />
    </div>
  );
}
