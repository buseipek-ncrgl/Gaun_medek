"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Building2, Plus, Pencil, Trash2, CheckSquare, Square, X, Loader2 } from "lucide-react";
import { departmentApi, type Department } from "@/lib/api/departmentApi";
import { authApi } from "@/lib/api/authApi";

export default function AdminDepartmentsPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const load = async () => {
    try {
      const data = await departmentApi.getAll();
      setDepartments(data || []);
    } catch {
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const u = authApi.getStoredUser();
    if (u?.role !== "super_admin") {
      router.replace("/");
      return;
    }
    load();
  }, [router]);

  const openCreate = () => {
    setEditingDept(null);
    setFormCode("");
    setFormName("");
    setDialogOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditingDept(d);
    setFormCode(d.code || "");
    setFormName(d.name || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Bölüm adı zorunludur");
      return;
    }
    setSaving(true);
    try {
      if (editingDept) {
        await departmentApi.update(editingDept._id, { code: formCode.trim() || undefined, name: formName.trim() });
        toast.success("Bölüm güncellendi");
      } else {
        await departmentApi.create({ code: formCode.trim() || undefined, name: formName.trim() });
        toast.success("Bölüm eklendi");
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "İşlem başarısız");
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (d: Department) => {
    setDeptToDelete(d);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deptToDelete) return;
    setDeleting(true);
    try {
      await departmentApi.delete(deptToDelete._id);
      toast.success("Bölüm silindi");
      setDeleteDialogOpen(false);
      setDeptToDelete(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Silme başarısız");
    } finally {
      setDeleting(false);
    }
  };

  const toggleDeptSelect = (id: string) => {
    const next = new Set(selectedDepts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDepts(next);
  };

  const toggleDeptSelectAll = () => {
    if (selectedDepts.size === departments.length) setSelectedDepts(new Set());
    else setSelectedDepts(new Set(departments.map((d) => d._id)));
  };

  const handleBulkDeleteDepartments = async () => {
    if (selectedDepts.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedDepts).map((id) => departmentApi.delete(id)));
      toast.success(`${selectedDepts.size} bölüm silindi`);
      setBulkDeleteDialogOpen(false);
      setSelectedDepts(new Set());
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Toplu silme başarısız");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 min-w-0">Bölüm ekleyin, düzenleyin veya silin.</p>
        <Button onClick={openCreate} className="bg-brand-navy hover:bg-brand-navy/90 flex-shrink-0 w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Yeni Bölüm
        </Button>
      </div>

      {!loading && departments.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={toggleDeptSelectAll} className="flex items-center gap-2 text-sm font-medium text-brand-navy dark:text-slate-200 hover:opacity-80">
            {selectedDepts.size === departments.length ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
            {selectedDepts.size === departments.length ? "Tümünü Kaldır" : "Tümünü Seç"}
          </button>
          <span className="text-xs text-slate-500">{selectedDepts.size > 0 && `${selectedDepts.size} seçili`}</span>
        </div>
      )}
      {selectedDepts.size > 0 && (
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-gradient-to-r from-brand-navy/5 to-brand-navy/10">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-semibold text-brand-navy dark:text-slate-100">{selectedDepts.size} bölüm seçildi</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedDepts(new Set())}><X className="h-4 w-4 mr-1" />Seçimi Kaldır</Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)}><Trash2 className="h-4 w-4 mr-1" />Seçilenleri Sil</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-brand-navy/20 dark:border-slate-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Bölüm Listesi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : departments.length === 0 ? (
            <p className="text-slate-500 py-8 text-center">Bölüm bulunamadı. Yeni bölüm ekleyin.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <button type="button" onClick={toggleDeptSelectAll} className="p-1 rounded hover:bg-white/20">
                      {selectedDepts.size === departments.length ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                    </button>
                  </TableHead>
                  <TableHead>Kod</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead className="w-[120px] text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((d) => (
                  <TableRow key={d._id}>
                    <TableCell className="w-12">
                      <button type="button" onClick={() => toggleDeptSelect(d._id)} className="p-1 rounded hover:bg-brand-navy/10">
                        {selectedDepts.has(d._id) ? <CheckSquare className="h-5 w-5 text-brand-navy" /> : <Square className="h-5 w-5 text-brand-navy/50" />}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono">{d.code || "—"}</TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(d)} title="Düzenle">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => openDelete(d)} title="Sil">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? "Bölümü Düzenle" : "Yeni Bölüm Ekle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kod (isteğe bağlı)</Label>
              <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="Örn: BIL" />
            </div>
            <div className="space-y-2">
              <Label>Bölüm adı *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Bölüm adı" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bölümü sil</AlertDialogTitle>
            <AlertDialogDescription>
              {deptToDelete?.name} bölümü silinecek. İlişkili programlar da silinir. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>İptal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Siliniyor..." : "Sil"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Seçili bölümleri sil</AlertDialogTitle>
            <AlertDialogDescription>{selectedDepts.size} bölüm silinecek. İlişkili programlar da silinir. Bu işlem geri alınamaz.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)} disabled={isBulkDeleting}>İptal</Button>
            <Button variant="destructive" onClick={handleBulkDeleteDepartments} disabled={isBulkDeleting}>
              {isBulkDeleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Siliniyor...</> : `${selectedDepts.size} Bölümü Sil`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
