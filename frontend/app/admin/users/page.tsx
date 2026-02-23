"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Users, Shield, Building2, GraduationCap, Pencil, CheckSquare, Square, Trash2, X, Loader2, Eye, UserPlus } from "lucide-react";
import { authApi } from "@/lib/api/authApi";
import { departmentApi, Department } from "@/lib/api/departmentApi";
import { courseApi, Course } from "@/lib/api/courseApi";
import { programApi, Program } from "@/lib/api/programApi";

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

export default function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "teacher" as string,
    departmentId: "" as string,
    assignedProgramIds: [] as string[],
    assignedCourseIds: [] as string[],
  });
  const [editSaving, setEditSaving] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const didOpenFromQuery = useRef(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "teacher" as string,
    departmentId: "" as string,
    assignedProgramIds: [] as string[],
    assignedCourseIds: [] as string[],
  });
  const [createSaving, setCreateSaving] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userFilterRole, setUserFilterRole] = useState("");
  const [userFilterDepartmentId, setUserFilterDepartmentId] = useState("");

  const currentUser = authApi.getStoredUser();
  const isDeptHead = currentUser?.role === "department_head";
  const isSuperAdmin = currentUser?.role === "super_admin";

  useEffect(() => {
    if (!isSuperAdmin && !isDeptHead) {
      router.replace("/dashboard/courses");
      return;
    }
    const load = async () => {
      try {
        const [usersData, deptsData] = await Promise.all([
          authApi.getUsers(),
          (isSuperAdmin || isDeptHead) ? departmentApi.getAll() : Promise.resolve([]),
        ]);
        setUsers(Array.isArray(usersData) ? usersData : []);
        if (Array.isArray(deptsData)) setDepartments(deptsData);
        if (isDeptHead && currentUser?.departmentId) {
          const raw = (currentUser as { departmentId?: string | { _id?: string } }).departmentId;
          const id = raw != null && typeof raw === "object" && "_id" in raw
            ? String((raw as { _id: string })._id)
            : typeof raw === "string" ? raw : "";
          if (id) setUserFilterDepartmentId(id);
        }
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router, isSuperAdmin, isDeptHead]);

  const openEdit = (row: UserRow) => {
    setEditingUser(row);
    const deptId = isDeptHead && currentUser?.departmentId
      ? (typeof currentUser.departmentId === "object" && currentUser.departmentId !== null
          ? (currentUser.departmentId as { _id: string })._id
          : (currentUser.departmentId as string)) || ""
      : (typeof row.departmentId === "object" && row.departmentId !== null
          ? (row.departmentId as { _id: string })._id
          : (row.departmentId as string) || "");
    const programIds = Array.isArray(row.assignedProgramIds)
      ? row.assignedProgramIds.map((p) => (typeof p === "object" && p !== null ? (p as { _id: string })._id : p))
      : [];
    const courseIds = Array.isArray(row.assignedCourseIds)
      ? row.assignedCourseIds.map((c) => (typeof c === "object" && c !== null ? (c as { _id: string })._id : c))
      : [];
    setEditForm({
      name: row.name || "",
      email: row.email || "",
      role: row.role || "teacher",
      departmentId: deptId,
      assignedProgramIds: programIds,
      assignedCourseIds: courseIds,
    });
    setEditOpen(true);
  };

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || users.length === 0 || didOpenFromQuery.current) return;
    const row = users.find((u) => u._id === editId);
    if (row) {
      didOpenFromQuery.current = true;
      router.replace("/admin/users", { scroll: false });
      openEdit(row);
    }
  }, [users, searchParams]);

  useEffect(() => {
    if (!editOpen && !createOpen) return;
    const load = async () => {
      try {
        if (isDeptHead && currentUser?.departmentId) {
          const deptId = typeof currentUser.departmentId === "object" && currentUser.departmentId !== null
            ? (currentUser.departmentId as { _id: string })._id
            : String(currentUser.departmentId);
          const [depts, crs] = await Promise.all([
            departmentApi.getAll(),
            courseApi.getAll().then((list) => list.filter((c: Course) => (c.department as { _id?: string })?._id === deptId || (typeof c.department === "string" && c.department === deptId))),
          ]);
          setDepartments(depts || []);
          setCourses(crs || []);
        } else {
          const [depts, crs] = await Promise.all([departmentApi.getAll(), courseApi.getAll()]);
          setDepartments(depts || []);
          setCourses(crs || []);
        }
      } catch {
        setDepartments([]);
        setCourses([]);
      }
    };
    load();
  }, [editOpen, createOpen, isDeptHead, currentUser?.departmentId]);

  useEffect(() => {
    if (!editOpen || !editForm.departmentId) {
      if (!createOpen || !createForm.departmentId) setPrograms([]);
      return;
    }
    programApi.getAll(editForm.departmentId).then(setPrograms).catch(() => setPrograms([]));
  }, [editOpen, editForm.departmentId]);

  useEffect(() => {
    if (createOpen && createForm.departmentId) {
      programApi.getAll(createForm.departmentId).then(setPrograms).catch(() => setPrograms([]));
    } else if (createOpen) {
      setPrograms([]);
    }
  }, [createOpen, createForm.departmentId]);

  const saveEdit = async () => {
    if (!editingUser) return;
    setEditSaving(true);
    try {
      const payload: Parameters<typeof authApi.updateUser>[1] = isDeptHead
        ? {
            assignedProgramIds: editForm.assignedProgramIds,
            assignedCourseIds: editForm.assignedCourseIds,
          }
        : {
            name: editForm.name.trim() || undefined,
            email: editForm.email.trim() || undefined,
            role: editForm.role,
            departmentId: editForm.departmentId || null,
            assignedProgramIds: editForm.role === "teacher" ? editForm.assignedProgramIds : [],
            assignedCourseIds: editForm.role === "teacher" ? editForm.assignedCourseIds : [],
          };
      await authApi.updateUser(editingUser._id, payload);
      const data = await authApi.getUsers();
      setUsers(Array.isArray(data) ? data : []);
      setEditOpen(false);
      setEditingUser(null);
      toast.success("Kullanıcı güncellendi.");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Güncellenemedi.");
    } finally {
      setEditSaving(false);
    }
  };

  const toggleProgram = (programId: string) => {
    setEditForm((prev) => ({
      ...prev,
      assignedProgramIds: prev.assignedProgramIds.includes(programId)
        ? prev.assignedProgramIds.filter((id) => id !== programId)
        : [...prev.assignedProgramIds, programId],
    }));
  };

  const toggleCourse = (courseId: string) => {
    setEditForm((prev) => ({
      ...prev,
      assignedCourseIds: prev.assignedCourseIds.includes(courseId)
        ? prev.assignedCourseIds.filter((id) => id !== courseId)
        : [...prev.assignedCourseIds, courseId],
    }));
  };

  const openCreate = () => {
    setCreateForm({
      email: "",
      password: "",
      name: "",
      role: "teacher",
      departmentId: "",
      assignedProgramIds: [],
      assignedCourseIds: [],
    });
    setCreateOpen(true);
  };

  const toggleCreateProgram = (programId: string) => {
    setCreateForm((prev) => ({
      ...prev,
      assignedProgramIds: prev.assignedProgramIds.includes(programId)
        ? prev.assignedProgramIds.filter((id) => id !== programId)
        : [...prev.assignedProgramIds, programId],
    }));
  };

  const toggleCreateCourse = (courseId: string) => {
    setCreateForm((prev) => ({
      ...prev,
      assignedCourseIds: prev.assignedCourseIds.includes(courseId)
        ? prev.assignedCourseIds.filter((id) => id !== courseId)
        : [...prev.assignedCourseIds, courseId],
    }));
  };

  const saveCreate = async () => {
    if (!createForm.email.trim()) {
      toast.error("E-posta girin.");
      return;
    }
    if (!createForm.password || createForm.password.length < 6) {
      toast.error("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    setCreateSaving(true);
    try {
      await authApi.createUser({
        email: createForm.email.trim(),
        password: createForm.password,
        name: createForm.name.trim() || undefined,
        role: createForm.role,
        departmentId: createForm.departmentId || null,
        assignedProgramIds: createForm.role === "teacher" ? createForm.assignedProgramIds : [],
        assignedCourseIds: createForm.role === "teacher" ? createForm.assignedCourseIds : [],
      });
      const data = await authApi.getUsers();
      setUsers(Array.isArray(data) ? data : []);
      setCreateOpen(false);
      toast.success("Kullanıcı oluşturuldu.");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Oluşturulamadı.");
    } finally {
      setCreateSaving(false);
    }
  };

  const deptName = (d: UserRow["departmentId"]) => {
    if (!d) return "—";
    return typeof d === "object" && d !== null ? (d as { name?: string }).name : "—";
  };

  const getUserDeptId = (row: UserRow) => {
    const d = row.departmentId;
    if (!d) return "";
    return typeof d === "object" && d !== null ? (d as { _id?: string })._id ?? "" : String(d);
  };

  const filteredUsers = useMemo(() => {
    let list = users;
    const q = userSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          (u.email || "").toLowerCase().includes(q) ||
          (u.name || "").toLowerCase().includes(q)
      );
    }
    if (userFilterRole) list = list.filter((u) => u.role === userFilterRole);
    if (userFilterDepartmentId) list = list.filter((u) => getUserDeptId(u) === userFilterDepartmentId);
    return list;
  }, [users, userSearchQuery, userFilterRole, userFilterDepartmentId]);

  const assignedProgramsDisplay = (row: UserRow) => {
    const list = row.assignedProgramIds;
    if (!Array.isArray(list) || list.length === 0) return "—";
    const names = list.map((p) =>
      typeof p === "object" && p !== null ? (p as { name?: string }).name : p
    );
    return names.join(", ");
  };

  const assignedCoursesDisplay = (row: UserRow) => {
    const list = row.assignedCourseIds;
    if (!Array.isArray(list) || list.length === 0) return "—";
    const names = list.map((c) =>
      typeof c === "object" && c !== null ? (c as { name?: string }).name : c
    );
    return names.join(", ");
  };

  const coursesForDepartment = editForm.departmentId
    ? courses.filter(
        (c) =>
          (c.department as { _id?: string })?._id === editForm.departmentId ||
          (typeof c.department === "string" && c.department === editForm.departmentId)
      )
    : courses;

  const coursesForCreate = createForm.departmentId
    ? courses.filter(
        (c) =>
          (c.department as { _id?: string })?._id === createForm.departmentId ||
          (typeof c.department === "string" && c.department === createForm.departmentId)
      )
    : courses;

  const toggleUserSelect = (id: string) => {
    const next = new Set(selectedUsers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUsers(next);
  };

  const toggleUserSelectAll = () => {
    const ids = filteredUsers.map((u) => u._id);
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => selectedUsers.has(id));
    if (allSelected) setSelectedUsers((prev) => { const s = new Set(prev); ids.forEach((id) => s.delete(id)); return s; });
    else setSelectedUsers((prev) => { const s = new Set(prev); ids.forEach((id) => s.add(id)); return s; });
  };

  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.size === 0) return;
    const toDelete = Array.from(selectedUsers).filter((id) => id !== currentUser?._id);
    if (toDelete.length === 0) {
      toast.error("Kendi hesabınızı seçemezsiniz.");
      return;
    }
    setIsBulkDeleting(true);
    try {
      await Promise.all(toDelete.map((id) => authApi.deleteUser(id)));
      toast.success(`${toDelete.length} kullanıcı silindi`);
      setBulkDeleteDialogOpen(false);
      setSelectedUsers(new Set());
      const data = await authApi.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Toplu silme başarısız");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 min-w-0">
          {isDeptHead ? "Kendi bölümünüzdeki öğretmenlere program ve ders atayın." : "Bölüm başkanı ve öğretmen atamaları: bölüm, program, ders."}
        </p>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          {isSuperAdmin && (
            <Button onClick={openCreate} className="bg-brand-navy hover:bg-brand-navy/90">
              <UserPlus className="h-4 w-4 mr-2" />
              Yeni Kullanıcı
            </Button>
          )}
          {!loading && filteredUsers.length > 0 && isSuperAdmin && (
            <>
              <button type="button" onClick={toggleUserSelectAll} className="flex items-center gap-2 text-sm font-medium text-brand-navy dark:text-slate-200 hover:opacity-80">
                {filteredUsers.every((u) => selectedUsers.has(u._id)) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                {filteredUsers.every((u) => selectedUsers.has(u._id)) ? "Tümünü Kaldır" : "Tümünü Seç"}
              </button>
              <span className="text-xs text-slate-500">{selectedUsers.size > 0 && `${selectedUsers.size} seçili`}</span>
            </>
          )}
        </div>
      </div>

      {selectedUsers.size > 0 && isSuperAdmin && (
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-gradient-to-r from-brand-navy/5 to-brand-navy/10">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-semibold text-brand-navy dark:text-slate-100">{selectedUsers.size} kullanıcı seçildi</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedUsers(new Set())}><X className="h-4 w-4 mr-1" />Seçimi Kaldır</Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)}><Trash2 className="h-4 w-4 mr-1" />Seçilenleri Sil</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-brand-navy/20 dark:border-slate-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Kullanıcı Listesi
          </CardTitle>
          {!loading && users.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Input
                placeholder="E-posta veya ad ile ara..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="max-w-xs h-9"
              />
              {isSuperAdmin && (
                <select
                  className="flex h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  value={userFilterRole}
                  onChange={(e) => setUserFilterRole(e.target.value)}
                >
                  <option value="">Tüm roller</option>
                  <option value="super_admin">Süper Admin</option>
                  <option value="department_head">Bölüm Başkanı</option>
                  <option value="teacher">Öğretmen</option>
                </select>
              )}
              {(isSuperAdmin || isDeptHead) && (
                <>
                  <select
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-80"
                    value={userFilterDepartmentId}
                    onChange={(e) => setUserFilterDepartmentId(e.target.value)}
                    disabled={isDeptHead}
                  >
                    <option value="">Tüm bölümler</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>{d.name} {d.code ? `(${d.code})` : ""}</option>
                    ))}
                  </select>
                  {isDeptHead && userFilterDepartmentId && (
                    <span className="text-xs text-muted-foreground self-center">Kendi bölümünüz seçili</span>
                  )}
                </>
              )}
              {(userSearchQuery || (isSuperAdmin && userFilterRole) || userFilterDepartmentId) && (
                <Button variant="ghost" size="sm" onClick={() => { setUserSearchQuery(""); setUserFilterRole(""); setUserFilterDepartmentId(""); }}>
                  Filtreleri temizle
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : filteredUsers.length === 0 ? (
            <p className="text-slate-500 py-8 text-center">
              {users.length === 0
                ? (isDeptHead ? "Bölümünüze ait öğretmen bulunamadı." : "Henüz kullanıcı yok. Yeni Kullanıcı ile ekleyebilirsiniz.")
                : "Arama veya filtreye uygun kullanıcı yok."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isSuperAdmin && (
                    <TableHead className="w-12">
                      <button type="button" onClick={toggleUserSelectAll} className="p-1 rounded hover:bg-white/20">
                        {filteredUsers.every((u) => selectedUsers.has(u._id)) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                      </button>
                    </TableHead>
                  )}
                  <TableHead>E-posta</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Bölüm</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Atanan dersler</TableHead>
                  <TableHead className="w-[100px]">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((row) => (
                  <TableRow key={row._id}>
                    {isSuperAdmin && (
                      <TableCell className="w-12">
                        {row._id !== currentUser?._id ? (
                          <button type="button" onClick={() => toggleUserSelect(row._id)} className="p-1 rounded hover:bg-brand-navy/10">
                            {selectedUsers.has(row._id) ? <CheckSquare className="h-5 w-5 text-brand-navy" /> : <Square className="h-5 w-5 text-brand-navy/50" />}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{row.email}</TableCell>
                    <TableCell>{row.name || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.role === "super_admin"
                            ? "border-amber-500/50 bg-amber-50 dark:bg-amber-900/20"
                            : row.role === "department_head"
                            ? "border-blue-500/50 bg-blue-50 dark:bg-blue-900/20"
                            : "border-slate-300"
                        }
                      >
                        {row.role === "super_admin" && <Shield className="h-3 w-3 mr-1 inline" />}
                        {row.role === "department_head" && <Building2 className="h-3 w-3 mr-1 inline" />}
                        {row.role === "teacher" && <GraduationCap className="h-3 w-3 mr-1 inline" />}
                        {roleLabels[row.role] || row.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{deptName(row.departmentId)}</TableCell>
                    <TableCell className="max-w-[160px] truncate" title={assignedProgramsDisplay(row)}>
                      {assignedProgramsDisplay(row)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={assignedCoursesDisplay(row)}>
                      {assignedCoursesDisplay(row)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" asChild title="Detay">
                          <Link href={`/admin/users/${row._id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Düzenle / Ders atama">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Seçili kullanıcıları sil</AlertDialogTitle>
            <AlertDialogDescription>
              {Array.from(selectedUsers).filter((id) => id !== currentUser?._id).length} kullanıcı silinecek. Kendi hesabınız silinmez. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)} disabled={isBulkDeleting}>İptal</Button>
            <Button variant="destructive" onClick={handleBulkDeleteUsers} disabled={isBulkDeleting}>
              {isBulkDeleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Siliniyor...</> : "Seçilenleri Sil"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Yeni kullanıcı dialog - sadece süper admin */}
      {isSuperAdmin && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen} size="large">
          <DialogContent onClose={() => setCreateOpen(false)}>
            <DialogHeader>
              <DialogTitle>Yeni Kullanıcı Ekle</DialogTitle>
              <p className="text-sm text-muted-foreground">E-posta, şifre, rol ve isteğe bağlı bölüm/ders ataması.</p>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>E-posta *</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="ornek@universite.edu.tr"
                />
              </div>
              <div className="grid gap-2">
                <Label>Şifre * (en az 6 karakter)</Label>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-2">
                <Label>Ad Soyad</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ad Soyad"
                />
              </div>
              <div className="grid gap-2">
                <Label>Rol</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={createForm.role}
                  onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value, assignedProgramIds: [], assignedCourseIds: [] }))}
                >
                  <option value="super_admin">Süper Admin</option>
                  <option value="department_head">Bölüm Başkanı</option>
                  <option value="teacher">Öğretmen</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Bölüm</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={createForm.departmentId}
                  onChange={(e) => setCreateForm((p) => ({ ...p, departmentId: e.target.value, assignedProgramIds: [], assignedCourseIds: [] }))}
                >
                  <option value="">— Bölüm seçin —</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} {d.code ? `(${d.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {createForm.role === "teacher" && (
                <>
                  <div className="grid gap-2">
                    <Label>Program (seçilen bölüme göre)</Label>
                    {createForm.departmentId ? (
                      <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                        {programs.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Bu bölümde program yok.</p>
                        ) : (
                          programs.map((pr) => (
                            <label key={pr._id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={createForm.assignedProgramIds.includes(pr._id)}
                                onChange={() => toggleCreateProgram(pr._id)}
                                className="rounded border-input"
                              />
                              <span className="text-sm">{pr.name} {pr.code ? `(${pr.code})` : ""}</span>
                            </label>
                          ))
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Önce bölüm seçin.</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>Atanan dersler</Label>
                    <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                      {coursesForCreate.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {createForm.departmentId ? "Bu bölümde ders yok." : "Bölüm seçerseniz dersler listelenir."}
                        </p>
                      ) : (
                        coursesForCreate.map((c) => (
                          <label key={c._id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={createForm.assignedCourseIds.includes(c._id)}
                              onChange={() => toggleCreateCourse(c._id)}
                              className="rounded border-input"
                            />
                            <span className="text-sm">{c.name} {c.code ? `(${c.code})` : ""}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
              <Button onClick={saveCreate} disabled={createSaving}>
                {createSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Oluşturuluyor…</> : "Kullanıcı Oluştur"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen} size="large">
        <DialogContent onClose={() => setEditOpen(false)}>
          <DialogHeader>
            <DialogTitle>Kullanıcı düzenle {isSuperAdmin && "/ Ders atama"}</DialogTitle>
            {isSuperAdmin && (
              <p className="text-sm text-muted-foreground">Rol, bölüm, program ve atanan dersleri güncelleyebilirsiniz.</p>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!isDeptHead && (
              <>
                <div className="grid gap-2">
                  <Label>Ad Soyad</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ad Soyad"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>E-posta</Label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="E-posta"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Rol</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editForm.role}
                    onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                  >
                    <option value="super_admin">Süper Admin</option>
                    <option value="department_head">Bölüm Başkanı</option>
                    <option value="teacher">Öğretmen</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Bölüm</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editForm.departmentId}
                    onChange={(e) => setEditForm((p) => ({ ...p, departmentId: e.target.value, assignedProgramIds: [] }))}
                  >
                    <option value="">— Bölüm seçin —</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} {d.code ? `(${d.code})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Bölüm başkanı için hangi bölüme başkan atanacak; öğretmen için hangi bölüme bağlı.
                  </p>
                </div>
              </>
            )}
            {(editForm.role === "teacher" || isDeptHead) && (
              <>
                <div className="grid gap-2">
                  <Label>Program (öğretmen — {isDeptHead ? "bölümünüze göre" : "seçilen bölüme göre"})</Label>
                  {editForm.departmentId ? (
                    <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                      {programs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Bu bölümde program yok.</p>
                      ) : (
                        programs.map((pr) => (
                          <label key={pr._id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.assignedProgramIds.includes(pr._id)}
                              onChange={() => toggleProgram(pr._id)}
                              className="rounded border-input"
                            />
                            <span className="text-sm">{pr.name} {pr.code ? `(${pr.code})` : ""}</span>
                          </label>
                        ))
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Önce bölüm seçin.</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Atanan dersler (öğretmen — birden fazla seçebilirsiniz)</Label>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {coursesForDepartment.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {editForm.departmentId ? "Bu bölümde ders yok." : "Bölüm seçerseniz dersler listelenir."}
                      </p>
                    ) : (
                      coursesForDepartment.map((c) => (
                    <label key={c._id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.assignedCourseIds.includes(c._id)}
                        onChange={() => toggleCourse(c._id)}
                        className="rounded border-input"
                      />
                        <span className="text-sm">{c.name} {c.code ? `(${c.code})` : ""}</span>
                      </label>
                    ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              İptal
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
