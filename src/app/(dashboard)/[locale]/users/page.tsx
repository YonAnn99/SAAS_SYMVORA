"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
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

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-800",
  ORG_ADMIN: "bg-blue-100 text-blue-800",
  CAJERO: "bg-green-100 text-green-800",
};

export default function UsersPage() {
  const t = useTranslations();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("CAJERO");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchMemberships();
  }, []);

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
    setInviting(true);
    // TODO: Implement invite with Supabase Auth
    // This would typically send an invite email
    setInviting(false);
    setShowInviteDialog(false);
    setInviteEmail("");
    setInviteRole("CAJERO");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {t("users.title")}
          </h2>
          <p className="text-muted-foreground">
            Gestiona los usuarios y permisos de tu organización
          </p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("users.addUser")}
        </Button>
      </div>

      {/* Role summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("users.roles.SUPER_ADMIN")}
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {memberships.filter((m) => m.role === "SUPER_ADMIN").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("users.roles.ORG_ADMIN")}
            </CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {memberships.filter((m) => m.role === "ORG_ADMIN").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("users.roles.CAJERO")}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {memberships.filter((m) => m.role === "CAJERO").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("users.title")}</CardTitle>
          <CardDescription>
            {memberships.length} usuarios en la organización
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[400px] items-center justify-center">
              {t("common.loading")}
            </div>
          ) : memberships.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <Users className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">{t("users.noUsers")}</p>
              <Button onClick={() => setShowInviteDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("users.addUser")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.email")}</TableHead>
                  <TableHead>{t("users.role")}</TableHead>
                  <TableHead>{t("users.lastAccess")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.map((membership) => (
                  <TableRow key={membership.id}>
                    <TableCell className="font-medium">
                      {membership.user?.email || "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge className={roleColors[membership.role]}>
                        {t(`users.roles.${membership.role}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(membership.creado_en).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        {t("common.edit")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.addUser")}</DialogTitle>
            <DialogDescription>
              Invita un nuevo usuario a tu organización
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("users.role")}</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v || "CAJERO")}>
                <SelectTrigger>
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
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? t("common.loading") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
