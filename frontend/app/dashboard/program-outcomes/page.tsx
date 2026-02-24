"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Loader2, GraduationCap, Building2, Target, Info, ChevronDown, ChevronUp, CheckCircle2, CheckSquare, Square, Trash2, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { departmentApi, type Department } from "@/lib/api/departmentApi";
import { programApi, type Program } from "@/lib/api/programApi";
import { authApi } from "@/lib/api/authApi";
import { programOutcomeApi, type ProgramOutcome } from "@/lib/api/programOutcomeApi";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { ProgramOutcomeTable } from "@/components/programOutcomes/ProgramOutcomeTable";
import { learningOutcomeApi } from "@/lib/api/learningOutcomeApi";
import { parseOutcomeFile } from "@/lib/utils/outcomeImport";

export default function ProgramOutcomesPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [programOutcomes, setProgramOutcomes] = useState<ProgramOutcome[]>([]);
  const [filteredProgramOutcomes, setFilteredProgramOutcomes] = useState<ProgramOutcome[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [learningOutcomeCounts, setLearningOutcomeCounts] = useState<Record<string, number>>({});
  const [selectionExpanded, setSelectionExpanded] = useState(true);
  const [formExpanded, setFormExpanded] = useState(false);

  // New PO form
  const [newPOCode, setNewPOCode] = useState("");
  const [newPODescription, setNewPODescription] = useState("");

  const [selectedPCCodes, setSelectedPCCodes] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isImportingPO, setIsImportingPO] = useState(false);
  const poFileInputRef = useRef<HTMLInputElement>(null);
  const teacherProgramsRef = useRef<Program[]>([]);

  useEffect(() => {
    const init = async () => {
      const u = authApi.getStoredUser();
      if (u?.role === "teacher") {
        const opts = await authApi.getTeacherFilterOptions();
        if (opts) {
          const progs = opts.programs as Program[];
          teacherProgramsRef.current = progs;
          setDepartments(opts.departments as Department[]);
          setPrograms(progs);
          if (opts.departments.length === 1) setSelectedDepartmentId(opts.departments[0]._id);
          if (opts.programs.length === 1) setSelectedProgramId(opts.programs[0]._id);
        }
      } else {
        await loadDepartments();
        if (u?.role === "department_head" && u?.departmentId) {
          const raw = (u as { departmentId?: string | { _id?: string } }).departmentId;
          const id = raw != null && typeof raw === "object" && "_id" in raw
            ? String((raw as { _id: string })._id)
            : typeof raw === "string" ? raw : "";
          if (id) setSelectedDepartmentId(id);
        }
      }
    };
    init();
  }, []);

  useEffect(() => {
    const u = authApi.getStoredUser();
    if (u?.role === "teacher") {
      if (selectedDepartmentId) {
        const filtered = teacherProgramsRef.current.filter(
          (p) => (p as { department?: { _id: string } }).department?._id === selectedDepartmentId
        );
        setPrograms(filtered);
        if (!selectedProgramId || !filtered.some((p) => p._id === selectedProgramId)) setSelectedProgramId("");
      } else {
        setPrograms(teacherProgramsRef.current);
        setSelectedProgramId("");
      }
      return;
    }
    if (selectedDepartmentId) {
      loadPrograms(selectedDepartmentId);
    } else {
      setPrograms([]);
      setSelectedProgramId("");
      setProgramOutcomes([]);
      setFilteredProgramOutcomes([]);
    }
  }, [selectedDepartmentId]);

  useEffect(() => {
    if (selectedProgramId) {
      loadProgramOutcomes();
    } else {
      setProgramOutcomes([]);
      setFilteredProgramOutcomes([]);
    }
  }, [selectedProgramId]);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim() === "") {
      setFilteredProgramOutcomes(programOutcomes);
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = programOutcomes.filter((po) => {
      const code = (po.code || "").toLowerCase();
      const description = (po.description || "").toLowerCase();
      return code.includes(query) || description.includes(query);
    });
    setFilteredProgramOutcomes(filtered);
  }, [searchQuery, programOutcomes]);

  const loadDepartments = async () => {
    try {
      const data = await departmentApi.getAll();
      setDepartments(data);
    } catch (error: any) {
      toast.error("Bölümler yüklenemedi");
      console.error(error);
    }
  };

  const loadPrograms = async (deptId: string) => {
    try {
      setLoadingPrograms(true);
      const data = await programApi.getAll(deptId);
      setPrograms(data || []);
    } catch (error: any) {
      console.error("Programlar yüklenemedi:", error);
      setPrograms([]);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const loadProgramOutcomes = async () => {
    if (!selectedProgramId) return;
    try {
      setLoadingPOs(true);
      const data = await programOutcomeApi.getByProgram(selectedProgramId);
      setProgramOutcomes(data || []);
      setFilteredProgramOutcomes(data || []);
      await calculateLearningOutcomeCounts(data || []);
    } catch (error: any) {
      toast.error("Program çıktıları yüklenemedi");
      console.error(error);
      setProgramOutcomes([]);
      setFilteredProgramOutcomes([]);
    } finally {
      setLoadingPOs(false);
    }
  };

  const calculateLearningOutcomeCounts = async (pos: ProgramOutcome[]) => {
    try {
      const counts: Record<string, number> = {};
      
      pos.forEach((po) => {
        counts[po.code] = 0;
      });
      
      const { courseApi } = await import("@/lib/api/courseApi");
      const allCourses = await courseApi.getAll();
      const programCourses = allCourses.filter((c: any) => {
        const progId = typeof c.program === "object" && c.program !== null
          ? (c.program as any)._id
          : c.program;
        return progId === selectedProgramId;
      });

      for (const course of programCourses) {
        try {
          const outcomes = await learningOutcomeApi.getByCourse(course._id);
          for (const outcome of outcomes) {
            const mappedPOsRaw =
              (outcome as any).mappedProgramOutcomes ||
              (outcome as any).programOutcomes ||
              [];
            const mappedPOCodes = (Array.isArray(mappedPOsRaw) ? mappedPOsRaw : [])
              .map((mpo: any) =>
                typeof mpo === "string"
                  ? mpo
                  : mpo?.code
                    ? mpo.code
                    : mpo?._id
                      ? mpo._id
                      : ""
              )
              .map((c: string) => c?.trim().toLowerCase())
              .filter(Boolean);

            let fallbackPOCodes: string[] = [];
            if (mappedPOCodes.length === 0 && Array.isArray((course as any).learningOutcomes)) {
              const embeddedLO = (course as any).learningOutcomes.find(
                (lo: any) => lo.code === outcome.code
              );
              if (embeddedLO?.programOutcomes) {
                fallbackPOCodes = embeddedLO.programOutcomes
                  .map((po: any) => (typeof po === "string" ? po : po?.code || po?._id || ""))
                  .map((c: string) => c?.trim().toLowerCase())
                  .filter(Boolean);
              }
            }

            const allPOCodes = [...mappedPOCodes, ...fallbackPOCodes];

            for (const po of pos) {
              const poCodeNormalized = (po.code || "").trim().toLowerCase();
              if (allPOCodes.includes(poCodeNormalized)) {
                counts[po.code] = (counts[po.code] || 0) + 1;
              }
            }
          }
        } catch (e) {
          console.error(`Failed to load outcomes for course ${course._id}`);
        }
      }
      
      setLearningOutcomeCounts(counts);
    } catch (error) {
      console.error("Failed to calculate learning outcome counts:", error);
    }
  };

  const handleAddPO = async () => {
    if (!selectedProgramId) {
      toast.error("Lütfen önce bir program seçin");
      return;
    }
    if (!newPOCode.trim() || !newPODescription.trim()) {
      toast.error("PÇ kodu ve açıklama gereklidir");
      return;
    }

    try {
      setIsLoading(true);
      await programOutcomeApi.addToProgram(selectedProgramId, {
        code: newPOCode.trim(),
        description: newPODescription.trim(),
      });
      toast.success("Program çıktısı eklendi");
      setNewPOCode("");
      setNewPODescription("");
      setFormExpanded(false);
      await loadProgramOutcomes();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Program çıktısı eklenemedi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSuccess = () => {
    loadProgramOutcomes();
  };

  const handlePOFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedProgramId) return;
    const isExcel = /\.(xlsx?|xls)$/i.test(file.name);
    const isTxt = /\.(txt|csv)$/i.test(file.name);
    if (!isExcel && !isTxt) {
      toast.error("Lütfen .xls, .xlsx veya .txt/.csv dosyası seçin.");
      return;
    }
    try {
      setIsImportingPO(true);
      const rows = await parseOutcomeFile(file);
      if (rows.length === 0) {
        toast.error("Dosyada geçerli satır bulunamadı. Sütunlar: kod, açıklama (veya code, description).");
        return;
      }
      let added = 0;
      let skipped = 0;
      for (const row of rows) {
        try {
          await programOutcomeApi.addToProgram(selectedProgramId, {
            code: row.code.trim(),
            description: row.description.trim() || row.code.trim(),
          });
          added++;
        } catch (err: any) {
          if (err?.response?.status === 400) skipped++;
          else throw err;
        }
      }
      toast.success(`${added} PÇ eklendi.${skipped ? ` ${skipped} satır zaten mevcut olduğu için atlandı.` : ""}`);
      await loadProgramOutcomes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Dosya içe aktarılamadı.");
    } finally {
      setIsImportingPO(false);
    }
  };

  const togglePCSelect = (code: string) => {
    const next = new Set(selectedPCCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedPCCodes(next);
  };

  const togglePCSelectAll = () => {
    if (selectedPCCodes.size === filteredProgramOutcomes.length) setSelectedPCCodes(new Set());
    else setSelectedPCCodes(new Set(filteredProgramOutcomes.map((po) => po.code)));
  };

  const handleBulkDeletePCOutcomes = async () => {
    if (selectedPCCodes.size === 0 || !selectedProgramId) return;
    try {
      setIsBulkDeleting(true);
      for (const code of selectedPCCodes) {
        await programOutcomeApi.deleteFromProgram(selectedProgramId, code);
      }
      toast.success(`${selectedPCCodes.size} program çıktısı silindi`);
      setBulkDeleteDialogOpen(false);
      setSelectedPCCodes(new Set());
      loadProgramOutcomes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Toplu silme başarısız");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const selectedDepartment = departments.find((d) => d._id === selectedDepartmentId);
  const selectedProgram = programs.find((p) => p._id === selectedProgramId);
  const totalPOs = programOutcomes.length;
  const totalMappedLOs = Object.values(learningOutcomeCounts).reduce((sum, count) => sum + count, 0);
  const avgMappingsPerPO = totalPOs > 0 ? (totalMappedLOs / totalPOs).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Header - Outside Card */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Her program için program çıktılarını tanımlayın, yönetin ve öğrenme çıktıları ile eşleştirin</p>
            </div>
          </div>
        </div>

        {/* Stats Cards - Show when program is selected */}
        {selectedProgramId && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                  <Target className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Toplam PÇ</p>
                  <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                    {totalPOs}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                  <CheckCircle2 className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Eşlenen ÖÇ</p>
                  <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                    {totalMappedLOs}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                  <Info className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Ortalama Eşleme</p>
                  <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                    {avgMappingsPerPO}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Department and Program Selection - Collapsible */}
      <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
        <CardContent className="p-0">
          <div 
            className="p-4 cursor-pointer hover:bg-brand-navy/5 dark:hover:bg-brand-navy/10 transition-colors flex items-center justify-between"
            onClick={() => setSelectionExpanded(!selectionExpanded)}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand-navy dark:text-slate-200" />
              <span className="font-semibold text-brand-navy dark:text-slate-100">Bölüm ve Program Seç</span>
              {selectedDepartmentId && selectedProgramId && (
                <Badge variant="outline" className="text-xs border-brand-navy/30 text-brand-navy dark:text-slate-300">
                  {selectedDepartment?.name} / {selectedProgram?.name}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                setSelectionExpanded(!selectionExpanded);
              }}
            >
              {selectionExpanded ? (
                <ChevronUp className="h-4 w-4 text-brand-navy dark:text-slate-200" />
              ) : (
                <ChevronDown className="h-4 w-4 text-brand-navy dark:text-slate-200" />
              )}
            </Button>
          </div>

          {selectionExpanded && (
            <div className="px-4 pb-4 space-y-4 border-t border-brand-navy/10 dark:border-slate-700/50 pt-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Program çıktılarını yönetmek istediğiniz bölüm ve programı seçin
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department-select" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                    Bölüm <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    id="department-select"
                    value={selectedDepartmentId}
                    onChange={(e) => {
                      setSelectedDepartmentId(e.target.value);
                      setSelectedProgramId("");
                      setProgramOutcomes([]);
                      setFilteredProgramOutcomes([]);
                    }}
                    disabled={authApi.getStoredUser()?.role === "department_head"}
                    className="h-10 text-sm border-brand-navy/20 focus:border-brand-navy"
                  >
                    <option value="">Bölüm Seçin</option>
                    {departments.map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))}
                  </Select>
                  {authApi.getStoredUser()?.role === "department_head" && selectedDepartmentId && (
                    <p className="text-xs text-muted-foreground">Kendi bölümünüz otomatik seçildi.</p>
                  )}
                  {authApi.getStoredUser()?.role === "teacher" && (
                    <p className="text-xs text-muted-foreground">Sadece atandığınız bölüm ve programlar listelenir.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="program-select" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                    Program <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    id="program-select"
                    value={selectedProgramId}
                    onChange={(e) => setSelectedProgramId(e.target.value)}
                    disabled={!selectedDepartmentId || loadingPrograms}
                    className="h-10 text-sm border-brand-navy/20 focus:border-brand-navy"
                  >
                    <option value="">
                      {!selectedDepartmentId 
                        ? "Önce bölüm seçin" 
                        : loadingPrograms
                        ? "Yükleniyor..."
                        : "Program Seçin"}
                    </option>
                    {programs.map((prog) => (
                      <option key={prog._id} value={prog._id}>
                        {prog.name} {prog.code ? `(${prog.code})` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty State - When no department is selected */}
      {!selectedDepartmentId && (
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 flex items-center justify-center mb-4">
              <GraduationCap className="h-10 w-10 text-brand-navy dark:text-slate-200" />
            </div>
            <h3 className="text-xl font-semibold text-brand-navy dark:text-slate-100 mb-2">
              Program Çıktıları Yönetimi
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center max-w-md mb-4">
              Program çıktılarını görüntülemek ve yönetmek için lütfen yukarıdan bir bölüm ve program seçin.
            </p>
            <div className="flex items-start gap-2 p-4 bg-gradient-to-br from-brand-navy/5 to-brand-navy/10 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-lg border border-brand-navy/20 dark:border-slate-700/50 max-w-md">
              <Info className="h-5 w-5 text-brand-navy dark:text-slate-200 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-brand-navy dark:text-slate-200">
                <p className="font-medium mb-1">MEDEK Program Çıktıları</p>
                <p>
                  Program çıktıları (PÇ), mezunların sahip olması gereken yetkinlikleri tanımlar. 
                  Her bölüm için PÇ'leri tanımlayıp, öğrenme çıktıları (ÖÇ) ile eşleştirebilirsiniz.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedDepartmentId && (
        <>
          {/* Add New PO - Collapsible */}
          <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
            <CardContent className="p-0">
              <div 
                className="p-4 cursor-pointer hover:bg-brand-navy/5 dark:hover:bg-brand-navy/10 transition-colors flex items-center justify-between"
                onClick={() => setFormExpanded(!formExpanded)}
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  <span className="font-semibold text-brand-navy dark:text-slate-100">Yeni Program Çıktısı Ekle</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFormExpanded(!formExpanded);
                  }}
                >
                  {formExpanded ? (
                    <ChevronUp className="h-4 w-4 text-brand-navy dark:text-slate-200" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-brand-navy dark:text-slate-200" />
                  )}
                </Button>
              </div>

              {formExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-brand-navy/10 dark:border-slate-700/50 pt-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {selectedDepartment?.name} bölümü için yeni bir program çıktısı ekleyin
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="po-code" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                        PÇ Kodu <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="po-code"
                        value={newPOCode}
                        onChange={(e) => setNewPOCode(e.target.value.toUpperCase())}
                        placeholder="Örn: PÇ1"
                        disabled={isLoading || !selectedProgramId}
                        className="h-10 text-sm border-brand-navy/20 focus:border-brand-navy"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="po-description" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                        Açıklama <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="po-description"
                        value={newPODescription}
                        onChange={(e) => setNewPODescription(e.target.value)}
                        placeholder="Örn: Matematiksel analiz yapabilme"
                        disabled={isLoading || !selectedProgramId}
                        className="h-10 text-sm border-brand-navy/20 focus:border-brand-navy"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddPO}
                    disabled={isLoading || !newPOCode.trim() || !newPODescription.trim() || !selectedProgramId}
                    className="h-10 px-6 bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-brand-navy/90 hover:to-[#0f3a6b]/90 text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Ekleniyor...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Program Çıktısı Ekle
                      </>
                    )}
                  </Button>
                  <div className="border-t border-brand-navy/10 dark:border-slate-700/50 pt-4 mt-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Dosyadan toplu PÇ ekleyin (seçili programa göre)</p>
                    <input
                      ref={poFileInputRef}
                      type="file"
                      accept=".xls,.xlsx,.txt,.csv"
                      className="hidden"
                      onChange={handlePOFileSelect}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!selectedProgramId || isImportingPO}
                      onClick={() => poFileInputRef.current?.click()}
                      className="h-10"
                    >
                      {isImportingPO ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      XLS / TXT ile içe aktar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PO List */}
          {selectedProgramId && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                    <Target className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Program Çıktıları Listesi</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {selectedProgram?.name} programı için tanımlı program çıktıları. Her PÇ kodunun yanında kaç öğrenme çıktısına eşlendiği gösterilmektedir.
                    </p>
                  </div>
                </div>
              </div>

              {!loadingPOs && filteredProgramOutcomes.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <button type="button" onClick={togglePCSelectAll} className="flex items-center gap-2 text-sm font-medium text-brand-navy dark:text-slate-200 hover:opacity-80">
                    {selectedPCCodes.size === filteredProgramOutcomes.length ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                    {selectedPCCodes.size === filteredProgramOutcomes.length ? "Tümünü Kaldır" : "Tümünü Seç"}
                  </button>
                  <span className="text-xs text-slate-500">{selectedPCCodes.size > 0 && `${selectedPCCodes.size} seçili`}</span>
                </div>
              )}
              {selectedPCCodes.size > 0 && (
                <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-gradient-to-r from-brand-navy/5 to-brand-navy/10 dark:from-brand-navy/20 dark:to-brand-navy/10 mb-4">
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-brand-navy dark:text-slate-100">{selectedPCCodes.size} program çıktısı seçildi</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedPCCodes(new Set())}><X className="h-4 w-4 mr-1" />Seçimi Kaldır</Button>
                      <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)}><Trash2 className="h-4 w-4 mr-1" />Seçilenleri Sil</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="PÇ kodu veya açıklamaya göre ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border-brand-navy/20 focus:border-brand-navy"
                    />
                  </div>

                  {loadingPOs ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mr-3 text-brand-navy" />
                      Program çıktıları yükleniyor...
                    </div>
                  ) : (
                    <ProgramOutcomeTable
                      programOutcomes={filteredProgramOutcomes}
                      learningOutcomeCounts={learningOutcomeCounts}
                      programId={selectedProgramId}
                      onDelete={handleDeleteSuccess}
                      selectedCodes={selectedPCCodes}
                      onToggleSelect={togglePCSelect}
                      onToggleSelectAll={togglePCSelectAll}
                      readOnly={false}
                    />
                  )}
                </CardContent>
              </Card>

              <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
                <AlertDialogContent className="max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Seçili program çıktılarını sil</AlertDialogTitle>
                    <AlertDialogDescription>{selectedPCCodes.size} program çıktısı silinecek. Bu işlem geri alınamaz.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)} disabled={isBulkDeleting}>İptal</Button>
                    <Button variant="destructive" onClick={handleBulkDeletePCOutcomes} disabled={isBulkDeleting}>
                      {isBulkDeleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Siliniyor...</> : `${selectedPCCodes.size} PÇ Sil`}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </>
      )}
    </div>
  );
}
