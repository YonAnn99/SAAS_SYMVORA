"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Users, Shield, UserCog } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TenantMembership } from "@/lib/types/database";
import { useIsDemo } from "@/hooks/use-is-demo";
import { DemoRestrictedNotice } from "@/components/demo/demo-restricted-notice";
import { toast } from "sonner";

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#9F2F2D]/20 dark:text-[#F2A5A4]",
  ORG_ADMIN: "bg-[#E1F3FE] text-[#1F6C9F] dark:bg-[#1F6C9F]/20 dark:text-[#7BB8DA]",
  CAJERO: "bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]",
};

export default function UsersPage() {
  const t = useTranslations();
  const locale = useLocale();
  const isDemo = useIsDemo();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("CAJERO");
  const [inviting, setInviting] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    fetchMemberships();
    fetchTenantId();
  }, []);

  const fetchTenantId = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (data) {
      setTenantId(data.tenant_id);
    }
  };

  const fetchMemberships = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("tenant_memberships")
      .select(`
        *,
        user:user_id(email, raw_user_meta_data)
      `)
      .order("creado_en", { ascending: false });

    if (data) {
      setMemberships(data);
    }
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail || !tenantId) {
      toast.error("Por favor ingresa un email válido");
      return;
    }

    setInviting(true);
    try {
      const response = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          tenantId,
          locale,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al enviar invitación");
      }

      toast.success(`Invitación enviada a ${inviteEmail}`);
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("CAJERO");
      fetchMemberships(); // Refresh list
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al enviar invitación");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {isDemo && <DemoRestrictedNotice />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {t("users.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona los usuarios y permisos de tu organización
          </p>
        </div>
        <Button
          onClick={() => setShowInviteDialog(true)}
          size="sm"
          className="h-8 active:scale-[0.98] transition-transform"
          disabled={isDemo}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("users.addUser")}
        </Button>
      </div>

      {/* Role summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: t("users.roles.SUPER_ADMIN"), count: memberships.filter((m) => m.role === "SUPER_ADMIN").length, icon: Shield, idx: 2 },
          { title: t("users.roles.ORG_ADMIN"), count: memberships.filter((m) => m.role === "ORG_ADMIN").length, icon: UserCog, idx: 3 },
          { title: t("users.roles.CAJERO"), count: memberships.filter((m) => m.role === "CAJERO").length, icon: Users, idx: 4 },
        ].map((card) => (
          <Card key={card.title} className={`animate-fade-in-up stagger-${card.idx}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {card.title}
              </CardTitle>
              <card.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold tracking-tight font-mono">{card.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users table */}
      <Card className="animate-fade-in-up stagger-5">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium">{t("users.title")}</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {memberships.length} usuarios
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : memberships.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Users className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t("users.noUsers")}</p>
              <Button onClick={() => setShowInviteDialog(true)} size="sm" className="h-8 mt-1 active:scale-[0.98] transition-transform">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("users.addUser")}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">{t("common.email")}</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">{t("users.role")}</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">{t("users.lastAccess")}</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.map((membership) => (
                  <TableRow key={membership.id}>
                    <TableCell className="font-medium text-sm">
                      {membership.user?.email || "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${roleColors[membership.role]} text-[10px] px-1.5 py-0`}>
                        {t(`users.roles.${membership.role}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(membership.creado_en).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        {t("common.edit")}
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

      {/* Invite dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">{t("users.addUser")}</DialogTitle>
            <DialogDescription className="text-xs">
              Invita un nuevo usuario a tu organización
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">{t("common.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("users.role")}</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v || "CAJERO")}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORG_ADMIN">
                    {t("users.roles.ORG_ADMIN")}
                  </SelectItem>
                  <SelectItem value="CAJERO">
                    {t("users.roles.CAJERO")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowInviteDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" className="h-8 active:scale-[0.98] transition-transform" onClick={handleInvite} disabled={inviting}>
              {inviting ? t("common.loading") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
