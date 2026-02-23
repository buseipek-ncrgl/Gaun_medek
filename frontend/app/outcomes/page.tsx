"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, X, Target, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, CheckSquare, Square, Trash2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { OutcomeTable } from "@/components/outcomes/OutcomeTable";
import { learningOutcomeApi, type LearningOutcome } from "@/lib/api/learningOutcomeApi";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { parseOutcomeFile } from "@/lib/utils/outcomeImport";
import { departmentApi, type Department } from "@/lib/api/departmentApi";
import { programApi, type Program } from "@/lib/api/programApi";
import { authApi } from "@/lib/api/authApi";

export default function OutcomesPage() {
  const router = useRouter();
  const [outcomes, setOutcomes] = useState<LearningOutcome[]>([]);
  const [filteredOutcomes, setFilteredOutcomes] = useState<LearningOutcome[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [filterType, setFilterType] = useState<"all" | "mapped" | "unmapped">("all");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [selectedOutcomes, setSelectedOutcomes] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isImportingLO, setIsImportingLO] = useState(false);
  const loFileInputRef = useRef<HTMLInputElement>(null);
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
      fetchAllOutcomes();
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
        loadCoursesByDepartment(selectedDepartmentId);
      } else {
        setPrograms(teacherProgramsRef.current);
        setSelectedProgramId("");
        setSelectedCourseId("");
        loadAllCourses();
      }
      return;
    }
    if (selectedDepartmentId) {
      loadPrograms(selectedDepartmentId);
      if (!selectedProgramId) {
        loadCoursesByDepartment(selectedDepartmentId);
      }
    } else {
      setPrograms([]);
      setSelectedProgramId("");
      setSelectedCourseId("");
      loadAllCourses();
    }
  }, [selectedDepartmentId]);

  useEffect(() => {
    if (selectedProgramId) {
      loadCoursesByProgram(selectedProgramId);
    } else if (selectedDepartmentId) {
      loadCoursesByDepartment(selectedDepartmentId);
    } else {
      loadAllCourses();
    }
  }, [selectedProgramId, selectedDepartmentId]);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedDepartmentId, selectedProgramId, selectedCourseId, filterType, outcomes]);

  const loadDepartments = async () => {
    try {
      const data = await departmentApi.getAll();
      setDepartments(data);
    } catch (error: any) {
      console.error("Bölümler yüklenemedi:", error);
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

  const loadAllCourses = async () => {
    try {
      const data = await courseApi.getAll();
      setCourses(data);
    } catch (error: any) {
      console.error("Dersler yüklenemedi:", error);
    }
  };

  const loadCoursesByDepartment = async (departmentId: string) => {
    try {
      const allCourses = await courseApi.getAll();
      const deptCourses = allCourses.filter((course: any) => {
        const deptId = typeof course.department === "object" && course.department !== null
          ? (course.department as any)._id
          : course.department;
        return deptId === departmentId;
      });
      setCourses(deptCourses);
      if (selectedCourseId && !deptCourses.find((c: any) => c._id === selectedCourseId)) {
        setSelectedCourseId("");
      }
    } catch (error: any) {
      console.error("Dersler yüklenemedi:", error);
    }
  };

  const loadCoursesByProgram = async (programId: string) => {
    try {
      const allCourses = await courseApi.getAll();
      const programCourses = allCourses.filter((course: any) => {
        const progId = typeof course.program === "object" && course.program !== null
          ? (course.program as any)._id
          : course.program;
        return progId === programId;
      });
      setCourses(programCourses);
      if (selectedCourseId && !programCourses.find((c: any) => c._id === selectedCourseId)) {
        setSelectedCourseId("");
      }
    } catch (error: any) {
      console.error("Dersler yüklenemedi:", error);
    }
  };

  const applyFilters = () => {
    let filtered = [...outcomes];

    // Filter by department
    if (selectedDepartmentId) {
      filtered = filtered.filter((outcome: any) => {
        const deptId = outcome.department?._id || outcome.department;
        return deptId === selectedDepartmentId;
      });
    }

    // Filter by program
    if (selectedProgramId) {
      filtered = filtered.filter((outcome: any) => {
        const course = outcome.course;
        if (!course) return false;
        const progId =
          typeof course.program === "object" && course.program !== null
            ? (course.program as any)._id
            : course.program;
        return progId === selectedProgramId;
      });
    }

    // Filter by course
    if (selectedCourseId) {
      filtered = filtered.filter((outcome: any) => {
        return outcome.course?._id === selectedCourseId;
      });
    }

    // Filter by mapping status
    if (filterType === "mapped") {
      filtered = filtered.filter((outcome: any) => {
        const mappedPOs = outcome.mappedProgramOutcomes || (outcome as any).programOutcomes || [];
        return mappedPOs.length > 0;
      });
    } else if (filterType === "unmapped") {
      filtered = filtered.filter((outcome: any) => {
        const mappedPOs = outcome.mappedProgramOutcomes || (outcome as any).programOutcomes || [];
        return mappedPOs.length === 0;
      });
    }

    // Filter by search query
    if (searchQuery && searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((outcome: any) => {
        const code = (outcome.code || "").toLowerCase();
        const description = (outcome.description || "").toLowerCase();
        const courseName = (outcome.course?.name || "").toLowerCase();
        const courseCode = (outcome.course?.code || "").toLowerCase();
        const departmentName = outcome.department?.name 
          ? (typeof outcome.department === 'string' 
            ? outcome.department.toLowerCase() 
            : outcome.department.name.toLowerCase())
          : "";
        
        return (
          code.includes(query) ||
          description.includes(query) ||
          courseName.includes(query) ||
          courseCode.includes(query) ||
          departmentName.includes(query)
        );
      });
    }

    setFilteredOutcomes(filtered);
  };

  const clearFilters = () => {
    setSelectedDepartmentId("");
    setSelectedProgramId("");
    setSelectedCourseId("");
    setSearchQuery("");
    setFilterType("all");
  };

  const fetchAllOutcomes = async () => {
    try {
      setIsLoading(true);
      const courses = await courseApi.getAll();
      const allOutcomes: (LearningOutcome & { course?: any; department?: any })[] = [];

      const courseMap = new Map();
      courses.forEach((course: any) => {
        courseMap.set(course._id, course);
      });

      for (const course of courses) {
        try {
          const courseOutcomes = await learningOutcomeApi.getByCourse(course._id);
          const enrichedOutcomes = courseOutcomes.map((outcome) => {
            const embeddedLO = (course as any).learningOutcomes?.find(
              (lo: any) => lo.code === outcome.code
            );
            
            const programOutcomes = embeddedLO?.programOutcomes || outcome.mappedProgramOutcomes || [];
            
            return {
              ...outcome,
              course: course,
              department: (course as any).department || (typeof (course as any).department === 'string' ? null : (course as any).department),
              mappedProgramOutcomes: programOutcomes,
            };
          });
          allOutcomes.push(...enrichedOutcomes);
        } catch (error) {
          console.error(`Failed to fetch outcomes for course ${course._id}`);
        }
      }

      setOutcomes(allOutcomes);
      setFilteredOutcomes(allOutcomes);
    } catch (error: any) {
      const errorMessage = error?.isNetworkError
        ? error.message || "Backend sunucusuna bağlanılamıyor. Lütfen backend'in çalıştığından emin olun."
        : error?.response?.data?.message || "Öğrenme çıktıları yüklenirken hata oluştu";
      toast.error(errorMessage);
      console.error("Outcomes fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate statistics
  const totalOutcomes = outcomes.length;
  const mappedOutcomes = outcomes.filter((outcome: any) => {
    const mappedPOs = outcome.mappedProgramOutcomes || (outcome as any).programOutcomes || [];
    return mappedPOs.length > 0;
  }).length;
  const unmappedOutcomes = totalOutcomes - mappedOutcomes;
  const mappingPercentage = totalOutcomes > 0 ? ((mappedOutcomes / totalOutcomes) * 100).toFixed(0) : "0";

  const hasActiveFilters = selectedDepartmentId || selectedProgramId || selectedCourseId || searchQuery.trim() !== "" || filterType !== "all";

  const toggleOutcomeSelect = (id: string) => {
    const next = new Set(selectedOutcomes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOutcomes(next);
  };

  const toggleOutcomeSelectAll = () => {
    if (selectedOutcomes.size === filteredOutcomes.length) setSelectedOutcomes(new Set());
    else setSelectedOutcomes(new Set(filteredOutcomes.map((o) => o._id)));
  };

  const handleLOFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedCourseId) return;
    const isExcel = /\.(xlsx?|xls)$/i.test(file.name);
    const isTxt = /\.(txt|csv)$/i.test(file.name);
    if (!isExcel && !isTxt) {
      toast.error("Lütfen .xls, .xlsx veya .txt/.csv dosyası seçin.");
      return;
    }
    try {
      setIsImportingLO(true);
      const rows = await parseOutcomeFile(file);
      if (rows.length === 0) {
        toast.error("Dosyada geçerli satır bulunamadı. Sütunlar: kod, açıklama (veya code, description).");
        return;
      }
      let added = 0;
      let skipped = 0;
      for (const row of rows) {
        try {
          await learningOutcomeApi.create({
            courseId: selectedCourseId,
            code: row.code.trim(),
            description: row.description.trim() || row.code.trim(),
          });
          added++;
        } catch (err: any) {
          if (err?.response?.status === 400) skipped++;
          else throw err;
        }
      }
      toast.success(`${added} ÖÇ eklendi.${skipped ? ` ${skipped} satır zaten mevcut olduğu için atlandı.` : ""}`);
      fetchAllOutcomes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Dosya içe aktarılamadı.");
    } finally {
      setIsImportingLO(false);
    }
  };

  const handleBulkDeleteOutcomes = async () => {
    if (selectedOutcomes.size === 0) return;
    try {
      setIsBulkDeleting(true);
      await Promise.all(Array.from(selectedOutcomes).map((id) => learningOutcomeApi.remove(id)));
      toast.success(`${selectedOutcomes.size} öğrenme çıktısı silindi`);
      setBulkDeleteDialogOpen(false);
      setSelectedOutcomes(new Set());
      fetchAllOutcomes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Toplu silme başarısız");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header - Outside Card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
             
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400">Tüm derslerin öğrenme çıktılarını görüntüleyin, yönetin ve program çıktıları ile eşleştirin</p>
              </div>
            </div>
          </div>
          {authApi.getStoredUser()?.role !== "teacher" && (
            <Button 
              onClick={() => router.push("/outcomes/new")}
              className="h-11 sm:h-12 px-4 sm:px-6 bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-brand-navy/90 hover:to-[#0f3a6b]/90 text-white shadow-lg hover:shadow-xl transition-all flex-shrink-0"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Yeni Öğrenme Çıktısı</span>
              <span className="sm:hidden">Yeni ÖÇ</span>
            </Button>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <Target className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Toplam ÖÇ</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {totalOutcomes}
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
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Eşleşen</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {mappedOutcomes}
                </p>
              </div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <AlertCircle className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Eşleşmeyen</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {unmappedOutcomes}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters Card - Collapsible */}
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
          <CardContent className="p-0">
            <div 
              className="p-4 cursor-pointer hover:bg-brand-navy/5 dark:hover:bg-brand-navy/10 transition-colors flex items-center justify-between"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
            >
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-brand-navy dark:text-slate-200" />
                <span className="font-semibold text-brand-navy dark:text-slate-100">Filtreler</span>
                {hasActiveFilters && (
                  <Badge variant="outline" className="text-xs border-brand-navy/30 text-brand-navy dark:text-slate-300">
                    Aktif
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  setFiltersExpanded(!filtersExpanded);
                }}
              >
                {filtersExpanded ? (
                  <ChevronUp className="h-4 w-4 text-brand-navy dark:text-slate-200" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-brand-navy dark:text-slate-200" />
                )}
              </Button>
            </div>

            {filtersExpanded && (
              <div className="px-4 pb-4 space-y-4 border-t border-brand-navy/10 dark:border-slate-700/50 pt-4">
                {/* Quick Filter Buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Hızlı Filtreler:</span>
                  <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilterType("all")}
                      className={cn(
                        "h-8 px-3 text-xs",
                        filterType === "all" 
                          ? "bg-white dark:bg-slate-600 text-brand-navy dark:text-white shadow-sm" 
                          : "text-slate-600 dark:text-slate-300"
                      )}
                    >
                      Tümü
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilterType("mapped")}
                      className={cn(
                        "h-8 px-3 text-xs",
                        filterType === "mapped" 
                          ? "bg-white dark:bg-slate-600 text-brand-navy dark:text-white shadow-sm" 
                          : "text-slate-600 dark:text-slate-300"
                      )}
                    >
                      Eşleşen
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilterType("unmapped")}
                      className={cn(
                        "h-8 px-3 text-xs",
                        filterType === "unmapped" 
                          ? "bg-white dark:bg-slate-600 text-brand-navy dark:text-white shadow-sm" 
                          : "text-slate-600 dark:text-slate-300"
                      )}
                    >
                      Eşleşmeyen
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Department Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="department-filter" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                      Bölüm
                    </Label>
                    <Select
                      id="department-filter"
                      value={selectedDepartmentId}
                      onChange={(e) => setSelectedDepartmentId(e.target.value)}
                      disabled={authApi.getStoredUser()?.role === "department_head"}
                      className="h-10 text-sm border-brand-navy/20 focus:border-brand-navy"
                    >
                      <option value="">Tüm Bölümler</option>
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

                  {/* Program Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="program-filter" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                      Program
                    </Label>
                    <Select
                      id="program-filter"
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
                          : "Tüm Programlar"}
                      </option>
                      {programs.map((prog) => (
                        <option key={prog._id} value={prog._id}>
                          {prog.name} {prog.code ? `(${prog.code})` : ""}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Course Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="course-filter" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                      Ders
                    </Label>
                    <Select
                      id="course-filter"
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="h-10 text-sm border-brand-navy/20 focus:border-brand-navy"
                      disabled={!selectedDepartmentId && departments.length > 0}
                    >
                      <option value="">Tüm Dersler</option>
                      {courses.map((course) => (
                        <option key={course._id} value={course._id}>
                          {course.code} - {course.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Search */}
                  <div className="space-y-2">
                    <Label htmlFor="search-input" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                      Arama
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="search-input"
                        placeholder="Kod, açıklama, ders..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 text-sm border-brand-navy/20 focus:border-brand-navy"
                      />
                    </div>
                  </div>
                </div>

                {/* ÖÇ import - seçili derse göre */}
                {authApi.getStoredUser()?.role !== "teacher" && (
                  <div className="border-t border-brand-navy/10 dark:border-slate-700/50 pt-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Seçili derse ÖÇ toplu ekleyin (bölüm/program/ders seçin, ardından dosya yükleyin)</p>
                    <input
                      ref={loFileInputRef}
                      type="file"
                      accept=".xls,.xlsx,.txt,.csv"
                      className="hidden"
                      onChange={handleLOFileSelect}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!selectedCourseId || isImportingLO}
                      onClick={() => loFileInputRef.current?.click()}
                      className="h-10"
                    >
                      {isImportingLO ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      XLS / TXT ile ÖÇ içe aktar
                    </Button>
                    {!selectedCourseId && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">İçe aktarmak için önce bir ders seçin.</p>
                    )}
                  </div>
                )}

                {/* Active Filters Badges */}
                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-brand-navy/10 dark:border-slate-700/50">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Aktif Filtreler:</span>
                    {selectedDepartmentId && (
                      <Badge variant="outline" className="text-xs border-brand-navy/30 text-brand-navy dark:text-slate-300">
                        Bölüm: {departments.find(d => d._id === selectedDepartmentId)?.name}
                        <button
                          onClick={() => setSelectedDepartmentId("")}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {selectedProgramId && (
                      <Badge variant="outline" className="text-xs border-brand-navy/30 text-brand-navy dark:text-slate-300">
                        Program: {programs.find(p => p._id === selectedProgramId)?.name || selectedProgramId}
                        <button
                          onClick={() => setSelectedProgramId("")}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {selectedCourseId && (
                      <Badge variant="outline" className="text-xs border-brand-navy/30 text-brand-navy dark:text-slate-300">
                        Ders: {courses.find(c => c._id === selectedCourseId)?.code}
                        <button
                          onClick={() => setSelectedCourseId("")}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {filterType !== "all" && (
                      <Badge variant="outline" className="text-xs border-brand-navy/30 text-brand-navy dark:text-slate-300">
                        {filterType === "mapped" ? "Eşleşen" : "Eşleşmeyen"}
                        <button
                          onClick={() => setFilterType("all")}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {searchQuery.trim() !== "" && (
                      <Badge variant="outline" className="text-xs border-brand-navy/30 text-brand-navy dark:text-slate-300">
                        Arama: "{searchQuery}"
                        <button
                          onClick={() => setSearchQuery("")}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-7 px-2 text-xs text-slate-600 dark:text-slate-400 hover:text-brand-navy dark:hover:text-brand-navy"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Tümünü Temizle
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Select all + bulk bar (öğretmen sadece görüntüleme) */}
      {authApi.getStoredUser()?.role !== "teacher" && !isLoading && filteredOutcomes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={toggleOutcomeSelectAll} className="flex items-center gap-2 text-sm font-medium text-brand-navy dark:text-slate-200 hover:opacity-80">
            {selectedOutcomes.size === filteredOutcomes.length ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
            {selectedOutcomes.size === filteredOutcomes.length ? "Tümünü Kaldır" : "Tümünü Seç"}
          </button>
          <span className="text-xs text-slate-500">{selectedOutcomes.size > 0 && `${selectedOutcomes.size} seçili`}</span>
        </div>
      )}
      {authApi.getStoredUser()?.role !== "teacher" && selectedOutcomes.size > 0 && (
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-gradient-to-r from-brand-navy/5 to-brand-navy/10 dark:from-brand-navy/20 dark:to-brand-navy/10">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-semibold text-brand-navy dark:text-slate-100">{selectedOutcomes.size} öğrenme çıktısı seçildi</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedOutcomes(new Set())}><X className="h-4 w-4 mr-1" />Seçimi Kaldır</Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)}><Trash2 className="h-4 w-4 mr-1" />Seçilenleri Sil</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table Card */}
      <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy mb-4"></div>
              <p>Öğrenme çıktıları yükleniyor...</p>
            </div>
          ) : (
            <OutcomeTable
              outcomes={filteredOutcomes}
              onDelete={fetchAllOutcomes}
              selectedIds={selectedOutcomes}
              onToggleSelect={toggleOutcomeSelect}
              onToggleSelectAll={toggleOutcomeSelectAll}
              readOnly={authApi.getStoredUser()?.role === "teacher"}
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Seçili öğrenme çıktılarını sil</AlertDialogTitle>
            <AlertDialogDescription>{selectedOutcomes.size} öğrenme çıktısı silinecek. Bu işlem geri alınamaz.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)} disabled={isBulkDeleting}>İptal</Button>
            <Button variant="destructive" onClick={handleBulkDeleteOutcomes} disabled={isBulkDeleting}>
              {isBulkDeleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Siliniyor...</> : `${selectedOutcomes.size} ÖÇ Sil`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
