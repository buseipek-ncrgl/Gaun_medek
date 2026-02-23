"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Shield, Building2, GraduationCap, Pencil, BookOpen } from "lucide-react";
import { authApi } from "@/lib/api/authApi";

type UserRow = {
  _id: string;
  email: string;
  name?: string;
  role: string;
  departmentId?: string | { _id: string; name: string; code?: string };
  assignedProgramIds?: string[] | { _id: string; name: string; code?: string }[];
  assignedCourseIds?: string[] | { _id: string; name: string; code?: string }[];
};

const roleLabels: Record<string, string> = {
  super_admin: "Süper Admin",
  department_head: "Bölüm Başkanı",
  teacher: "Öğretmen",
};

function deptName(d: UserRow["departmentId"]) {
  if (!d) return "—";
  return typeof d === "object" && d !== null ? (d as { name?: string }).name : "—";
}

function listDisplay(list: UserRow["assignedProgramIds"] | UserRow["assignedCourseIds"], nameKey: string) {
  if (!Array.isArray(list) || list.length === 0) return "—";
  const names = list.map((p) =>
    typeof p === "object" && p !== null ? (p as { name?: string; code?: string }).name || (p as { code?: string }).code : String(p)
  );
  return names.join(", ");
}

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = authApi.getStoredUser();
    if (u?.role !== "super_admin" && u?.role !== "department_head") {
      router.replace("/");
      return;
    }
    const load = async () => {
      try {
        const data = await authApi.getUsers();
        const list = Array.isArray(data) ? data : [];
        const found = list.find((x: UserRow) => x._id === id);
        setUser(found || null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, router]);

  const handleEdit = () => {
    router.push(`/admin/users?edit=${id}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/users")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Kullanıcı bulunamadı.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/users")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">Kullanıcı Detayı</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">{user.name || user.email}</p>
          </div>
        </div>
        <Button onClick={handleEdit} className="bg-brand-navy hover:bg-brand-navy/90">
          <Pencil className="h-4 w-4 mr-2" />
          Düzenle / Ders atama
        </Button>
      </div>

      <Card className="border border-brand-navy/20 dark:border-slate-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bilgiler
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Ad Soyad</p>
              <p className="font-medium text-brand-navy dark:text-slate-100">{user.name || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">E-posta</p>
              <p className="font-medium text-brand-navy dark:text-slate-100">{user.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Rol</p>
              <Badge
                variant="outline"
                className={
                  user.role === "super_admin"
                    ? "border-amber-500/50 bg-amber-50 dark:bg-amber-900/20"
                    : user.role === "department_head"
                    ? "border-blue-500/50 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-300"
                }
              >
                {user.role === "super_admin" && <Shield className="h-3 w-3 mr-1 inline" />}
                {user.role === "department_head" && <Building2 className="h-3 w-3 mr-1 inline" />}
                {user.role === "teacher" && <GraduationCap className="h-3 w-3 mr-1 inline" />}
                {roleLabels[user.role] || user.role}
              </Badge>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Bölüm</p>
              <p className="font-medium text-brand-navy dark:text-slate-100">{deptName(user.departmentId)}</p>
            </div>
          </div>

          {(user.role === "teacher" || user.role === "department_head") && (
            <>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2">Atanan programlar</p>
                <p className="text-sm text-brand-navy dark:text-slate-200">{listDisplay(user.assignedProgramIds, "name")}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" /> Atanan dersler
                </p>
                <p className="text-sm text-brand-navy dark:text-slate-200">{listDisplay(user.assignedCourseIds, "name")}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
