"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
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
import Link from "next/link";
import { BookMarked, Plus, Pencil, Trash2, CheckSquare, Square, X, Loader2, Search, Eye, BookOpen } from "lucide-react";
import { programApi, type Program } from "@/lib/api/programApi";
import { departmentApi, type Department } from "@/lib/api/departmentApi";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { authApi } from "@/lib/api/authApi";

export default function AdminProgramsPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDepartmentId, setFormDepartmentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [programSearchQuery, setProgramSearchQuery] = useState("");
  const [programFilterDepartmentId, setProgramFilterDepartmentId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailProgram, setDetailProgram] = useState<Program | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);

  const loadPrograms = async () => {
    try {
      const data = await programApi.getAll();
      setPrograms(data || []);
    } catch {
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const data = await departmentApi.getAll();
      setDepartments(data || []);
    } catch {
      setDepartments([]);
    }
  };

  useEffect(() => {
    const u = authApi.getStoredUser();
    if (u?.role !== "super_admin") {
      router.replace("/");
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const [_, __, coursesData] = await Promise.all([
          loadPrograms(),
          loadDepartments(),
          courseApi.getAll().catch(() => []),
        ]);
        setCourses(Array.isArray(coursesData) ? coursesData : []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const deptName = (d: Program["department"]) => {
    if (!d) return "—";
    return typeof d === "object" && d !== null ? (d as { name?: string }).name : String(d);
  };

  const getDeptId = (p: Program) => {
    const d = p.department;
    if (!d) return "";
    return typeof d === "object" && d !== null ? (d as { _id?: string })._id || "" : String(d);
  };

  const getCourseProgramId = (c: Course) => {
    const p = c.program;
    if (!p) return "";
    return typeof p === "object" && p !== null ? (p as { _id?: string })._id ?? "" : String(p);
  };

  const openDetail = (p: Program) => {
    setDetailProgram(p);
    setDetailOpen(true);
  };

  const detailProgramCourses = useMemo(() => {
    if (!detailProgram) return [];
    return courses.filter((c) => getCourseProgramId(c) === detailProgram._id);
  }, [courses, detailProgram]);

  const filteredPrograms = useMemo(() => {
    let list = programs;
    const q = programSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.code || "").toLowerCase().includes(q)
      );
    }
    if (programFilterDepartmentId) list = list.filter((p) => getDeptId(p) === programFilterDepartmentId);
    return list;
  }, [programs, programSearchQuery, programFilterDepartmentId]);

  /** Bölüme göre grupla: bölüm adı altında programlar. Sıra: bölüm adına göre. */
  const groupedByDepartment = useMemo(() => {
    const map = new Map<string, { departmentId: string; departmentName: string; programs: Program[] }>();
    const noDeptKey = "__no_dept__";
    for (const p of filteredPrograms) {
      const deptId = getDeptId(p);
      const deptNameStr = deptName(p.department);
      const key = deptId || noDeptKey;
      if (!map.has(key)) map.set(key, { departmentId: deptId, departmentName: deptId ? (deptNameStr ?? "—") : "— Bölüm yok", programs: [] });
      map.get(key)!.programs.push(p);
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => (a.departmentName === "— Bölüm yok" ? 1 : b.departmentName === "— Bölüm yok" ? -1 : a.departmentName.localeCompare(b.departmentName)));
    return arr;
  }, [filteredPrograms]);

  const openCreate = () => {
    setEditingProgram(null);
    setFormCode("");
    setFormName("");
    setFormDepartmentId(departments[0]?._id || "");
    setDialogOpen(true);
  };

  const openEdit = (p: Program) => {
    setEditingProgram(p);
    setFormCode(p.code || "");
    setFormName(p.name || "");
    setFormDepartmentId(getDeptId(p) || departments[0]?._id || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formCode.trim() || !formName.trim()) {
      toast.error("Kod ve ad zorunludur");
      return;
    }
    if (!formDepartmentId && !editingProgram) {
      toast.error("Bölüm seçin");
      return;
    }
    setSaving(true);
    try {
      if (editingProgram) {
        await programApi.update(editingProgram._id, {
          code: formCode.trim(),
          name: formName.trim(),
          ...(formDepartmentId ? { departmentId: formDepartmentId } : {}),
        });
        toast.success("Program güncellendi");
      } else {
        await programApi.create({
          code: formCode.trim(),
          name: formName.trim(),
          departmentId: formDepartmentId,
        });
        toast.success("Program eklendi");
      }
      setDialogOpen(false);
      loadPrograms();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "İşlem başarısız");
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (p: Program) => {
    setProgramToDelete(p);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!programToDelete) return;
    setDeleting(true);
    try {
      await programApi.delete(programToDelete._id);
      toast.success("Program silindi");
      setDeleteDialogOpen(false);
      setProgramToDelete(null);
      loadPrograms();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Silme başarısız");
    } finally {
      setDeleting(false);
    }
  };

  const toggleProgramSelect = (id: string) => {
    const next = new Set(selectedPrograms);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPrograms(next);
  };

  const toggleProgramSelectAll = () => {
    const ids = filteredPrograms.map((p) => p._id);
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => selectedPrograms.has(id));
    if (allSelected) setSelectedPrograms((prev) => { const s = new Set(prev); ids.forEach((id) => s.delete(id)); return s; });
    else setSelectedPrograms((prev) => { const s = new Set(prev); ids.forEach((id) => s.add(id)); return s; });
  };

  const toggleProgramSelectAllInGroup = (programIds: string[]) => {
    if (programIds.length === 0) return;
    const allSelected = programIds.every((id) => selectedPrograms.has(id));
    if (allSelected) setSelectedPrograms((prev) => { const s = new Set(prev); programIds.forEach((id) => s.delete(id)); return s; });
    else setSelectedPrograms((prev) => { const s = new Set(prev); programIds.forEach((id) => s.add(id)); return s; });
  };

  const handleBulkDeletePrograms = async () => {
    if (selectedPrograms.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedPrograms).map((id) => programApi.delete(id)));
      toast.success(`${selectedPrograms.size} program silindi`);
      setBulkDeleteDialogOpen(false);
      setSelectedPrograms(new Set());
      loadPrograms();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Toplu silme başarısız");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 min-w-0">Program ekleyin, düzenleyin veya silin.</p>
        <Button onClick={openCreate} className="bg-brand-navy hover:bg-brand-navy/90 flex-shrink-0 w-full sm:w-auto" disabled={departments.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Program
        </Button>
      </div>

      {!loading && filteredPrograms.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={toggleProgramSelectAll} className="flex items-center gap-2 text-sm font-medium text-brand-navy dark:text-slate-200 hover:opacity-80">
            {filteredPrograms.every((p) => selectedPrograms.has(p._id)) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
            {filteredPrograms.every((p) => selectedPrograms.has(p._id)) ? "Tümünü Kaldır" : "Tümünü Seç"}
          </button>
          <span className="text-xs text-slate-500">{selectedPrograms.size > 0 && `${selectedPrograms.size} seçili`}</span>
        </div>
      )}
      {selectedPrograms.size > 0 && (
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-gradient-to-r from-brand-navy/5 to-brand-navy/10">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-semibold text-brand-navy dark:text-slate-100">{selectedPrograms.size} program seçildi</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedPrograms(new Set())}><X className="h-4 w-4 mr-1" />Seçimi Kaldır</Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)}><Trash2 className="h-4 w-4 mr-1" />Seçilenleri Sil</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-brand-navy/20 dark:border-slate-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5" />
            Program Listesi
          </CardTitle>
          {!loading && programs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Kod veya ad ile ara..."
                  value={programSearchQuery}
                  onChange={(e) => setProgramSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <select
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={programFilterDepartmentId}
                onChange={(e) => setProgramFilterDepartmentId(e.target.value)}
              >
                <option value="">Tüm bölümler</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name} {d.code ? `(${d.code})` : ""}</option>
                ))}
              </select>
              {(programSearchQuery || programFilterDepartmentId) && (
                <Button variant="ghost" size="sm" onClick={() => { setProgramSearchQuery(""); setProgramFilterDepartmentId(""); }}>
                  Filtreleri temizle
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : groupedByDepartment.length === 0 ? (
            <p className="text-slate-500 py-8 text-center">
              {programs.length === 0 ? "Program bulunamadı. Önce bölüm ekleyin, sonra program ekleyin." : "Arama veya filtreye uygun program yok."}
            </p>
          ) : (
            <div className="space-y-6">
              {groupedByDepartment.map((group) => (
                <div key={group.departmentId || "__no_dept__"}>
                  <h3 className="text-sm font-semibold text-brand-navy dark:text-slate-200 border-b border-brand-navy/20 dark:border-slate-600 pb-2 mb-3">
                    {group.departmentName}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <button
                            type="button"
                            onClick={() => toggleProgramSelectAllInGroup(group.programs.map((p) => p._id))}
                            className="p-1 rounded hover:bg-white/20"
                            title={group.programs.every((p) => selectedPrograms.has(p._id)) ? "Seçimi kaldır" : "Bu bölümdekileni seç"}
                          >
                            {group.programs.every((p) => selectedPrograms.has(p._id)) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                          </button>
                        </TableHead>
                        <TableHead>Kod</TableHead>
                        <TableHead>Ad</TableHead>
                        <TableHead className="w-[140px] text-right">İşlemler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.programs.map((p) => (
                        <TableRow key={p._id}>
                          <TableCell className="w-12">
                            <button type="button" onClick={() => toggleProgramSelect(p._id)} className="p-1 rounded hover:bg-brand-navy/10">
                              {selectedPrograms.has(p._id) ? <CheckSquare className="h-5 w-5 text-brand-navy" /> : <Square className="h-5 w-5 text-brand-navy/50" />}
                            </button>
                          </TableCell>
                          <TableCell className="font-mono">{p.code}</TableCell>
                          <TableCell>{p.name}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-0 shrink-0">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(p)} title="Detay / Dersler">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} title="Düzenle">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => openDelete(p)} title="Sil">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Program detayı – programa ait dersler */}
      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) setDetailProgram(null); }}>
        <DialogContent onClose={() => { setDetailOpen(false); setDetailProgram(null); }} className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookMarked className="h-5 w-5" />
              Program detayı
            </DialogTitle>
          </DialogHeader>
          {detailProgram && (
            <div className="space-y-4 py-2">
              <div className="grid gap-2 text-sm">
                <p><span className="font-semibold text-muted-foreground">Kod:</span> <span className="font-mono">{detailProgram.code}</span></p>
                <p><span className="font-semibold text-muted-foreground">Ad:</span> {detailProgram.name}</p>
                <p><span className="font-semibold text-muted-foreground">Bölüm:</span> {deptName(detailProgram.department)}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <BookOpen className="h-4 w-4" />
                  Bu programa ait dersler ({detailProgramCourses.length})
                </h4>
                {detailProgramCourses.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Bu programa atanmış ders yok.</p>
                ) : (
                  <ul className="border rounded-md divide-y divide-border max-h-60 overflow-y-auto">
                    {detailProgramCourses.map((c) => (
                      <li key={c._id} className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-muted/50">
                        <span className="text-sm font-mono">{c.code}</span>
                        <span className="text-sm flex-1 truncate">{c.name}</span>
                        <Button variant="ghost" size="sm" asChild className="shrink-0">
                          <Link href={`/dashboard/courses/${c._id}`}>Derse git</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProgram ? "Programı Düzenle" : "Yeni Program Ekle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bölüm *</Label>
              <Select
                value={formDepartmentId}
                onChange={(e) => setFormDepartmentId(e.target.value)}
                disabled={!!editingProgram}
              >
                <option value="">Bölüm seçin</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name} {d.code ? `(${d.code})` : ""}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kod *</Label>
              <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="Örn: BILP" />
            </div>
            <div className="space-y-2">
              <Label>Program adı *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Program adı" />
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
            <AlertDialogTitle>Programı sil</AlertDialogTitle>
            <AlertDialogDescription>
              {programToDelete?.name} ({programToDelete?.code}) silinecek. Bu işlem geri alınamaz.
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
            <AlertDialogTitle>Seçili programları sil</AlertDialogTitle>
            <AlertDialogDescription>{selectedPrograms.size} program silinecek. Bu işlem geri alınamaz.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)} disabled={isBulkDeleting}>İptal</Button>
            <Button variant="destructive" onClick={handleBulkDeletePrograms} disabled={isBulkDeleting}>
              {isBulkDeleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Siliniyor...</> : `${selectedPrograms.size} Programı Sil`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
