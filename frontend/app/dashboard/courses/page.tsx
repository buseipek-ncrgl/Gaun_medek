"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Loader2, BookOpen, Filter, X, ChevronDown, ChevronUp, Trash2, CheckSquare, Square, Users, FileText, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseCard } from "@/components/courses/CourseCard";
import { CreateCourseModal } from "@/components/courses/CreateCourseModal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { examApi } from "@/lib/api/examApi";
import { departmentApi, type Department } from "@/lib/api/departmentApi";
import { programApi, type Program } from "@/lib/api/programApi";
import { authApi } from "@/lib/api/authApi";

/** Ders ekleme/düzenleme/silme sadece yönetici ve bölüm başkanında. Öğretmen sadece görüntüleyebilir. */
function canManageCourses(role: string | undefined): boolean {
  return role === "super_admin" || role === "department_head";
}

export default function DashboardCoursesPage() {
  const router = useRouter();
  const user = authApi.getStoredUser();
  const canAdd = canManageCourses(user?.role);
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
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
      fetchCourses();
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
        if (selectedProgramId && !filtered.some((p) => p._id === selectedProgramId)) setSelectedProgramId("");
      } else {
        setPrograms(teacherProgramsRef.current);
        setSelectedProgramId("");
      }
      return;
    }
    if (selectedDepartmentId) {
      loadPrograms(selectedDepartmentId);
      if (selectedProgramId) setSelectedProgramId("");
    } else {
      setPrograms([]);
      setSelectedProgramId("");
    }
  }, [selectedDepartmentId]);

  const loadDepartments = async () => {
    try {
      const data = await departmentApi.getAll();
      setDepartments(data || []);
    } catch (error: any) {
      console.error("Bölümler yüklenemedi:", error);
    }
  };

  const loadPrograms = async (deptId: string) => {
    try {
      setLoadingPrograms(true);
      console.log("🔍 [Courses Page] Loading programs for department:", deptId);
      const data = await programApi.getAll(deptId);
      console.log("📦 [Courses Page] Programs received:", data);
      setPrograms(data || []);
      console.log(`✅ [Courses Page] ${data?.length || 0} program(s) loaded`);
    } catch (error: any) {
      console.error("❌ [Courses Page] Programlar yüklenemedi:", error);
      console.error("Error details:", error.response?.data || error.message);
      setPrograms([]);
    } finally {
      setLoadingPrograms(false);
    }
  };

  // Refresh courses when page becomes visible (user returns from another page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCourses();
      }
    };

    // Listen for learning outcome deletion events
    const handleLearningOutcomeDeleted = () => {
      fetchCourses();
    };

    // Listen for exam creation/update events
    const handleExamCreated = () => {
      fetchCourses();
    };

    const handleExamUpdated = () => {
      fetchCourses();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('learningOutcomeDeleted', handleLearningOutcomeDeleted);
    window.addEventListener('examCreated', handleExamCreated);
    window.addEventListener('examUpdated', handleExamUpdated);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('learningOutcomeDeleted', handleLearningOutcomeDeleted);
      window.removeEventListener('examCreated', handleExamCreated);
      window.removeEventListener('examUpdated', handleExamUpdated);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedDepartmentId, selectedProgramId, courses]);

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const data = await courseApi.getAll();
      
      // Fetch exam counts for each course
      const coursesWithCounts = await Promise.all(
        data.map(async (course) => {
          try {
            // Ensure course._id is a string
            let courseId: string;
            if (typeof course._id === 'string') {
              courseId = course._id;
            } else if (course._id && typeof course._id === 'object' && '_id' in course._id) {
              courseId = String((course._id as any)._id);
            } else {
              courseId = String(course._id || '');
            }
            
            if (!courseId || courseId === 'undefined' || courseId === 'null' || courseId === '[object Object]') {
              console.error('Invalid course ID:', course._id, course);
              return {
                ...course,
                learningOutcomesCount: course.learningOutcomes?.length || 0,
                studentsCount: course.students?.length || 0,
                examCount: 0,
                midtermExams: [],
                finalExams: [],
              };
            }
            
            const exams = await examApi.getByCourse(courseId);
            const midtermExams = exams.filter(e => e.examType === "midterm");
            const finalExams = exams.filter(e => e.examType === "final");
            
            return {
              ...course,
              learningOutcomesCount: course.learningOutcomes?.length || 0,
              studentsCount: course.students?.length || 0,
              examCount: exams.length,
              midtermExams: midtermExams,
              finalExams: finalExams,
            };
          } catch (error) {
            console.error(`Failed to fetch exams for course ${course._id}:`, error);
            return {
              ...course,
              learningOutcomesCount: course.learningOutcomes?.length || 0,
              studentsCount: course.students?.length || 0,
              examCount: 0,
              midtermExams: [],
              finalExams: [],
            };
          }
        })
      );
      
      setCourses(coursesWithCounts);
      setFilteredCourses(coursesWithCounts);
    } catch (error: any) {
      toast.error("Dersler yüklenemedi");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...courses];

    // Filter by department
    if (selectedDepartmentId) {
      filtered = filtered.filter((course) => {
        const deptId = typeof course.department === 'object' && course.department !== null 
          ? course.department._id 
          : course.department;
        return deptId === selectedDepartmentId;
      });
    }

    // Filter by program
    if (selectedProgramId) {
      filtered = filtered.filter((course) => {
        const progId =
          typeof course.program === "object" && course.program !== null
            ? (course.program as any)._id
            : course.program;
        return progId === selectedProgramId;
      });
    }

    // Filter by search query
    if (searchQuery && searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (course) =>
          course.name.toLowerCase().includes(query) ||
          course.code.toLowerCase().includes(query) ||
          ((course as any).semester || "").toLowerCase().includes(query)
      );
    }

    setFilteredCourses(filtered);
  };

  const clearFilters = () => {
    setSelectedDepartmentId("");
    setSelectedProgramId("");
    setSearchQuery("");
  };

  const hasActiveFilters = selectedDepartmentId || selectedProgramId || searchQuery.trim() !== "";

  const handleDeleteClick = (course: Course) => {
    setSelectedCourse(course);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCourse) return;

    try {
      setIsDeleting(true);
      await courseApi.remove(selectedCourse._id);
      toast.success("Ders başarıyla silindi");
      setDeleteDialogOpen(false);
      setSelectedCourse(null);
      fetchCourses();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Ders silinirken bir hata oluştu"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSelectedCourse(null);
  };

  // Bulk selection handlers
  const toggleCourseSelection = (courseId: string) => {
    const newSelected = new Set(selectedCourses);
    if (newSelected.has(courseId)) {
      newSelected.delete(courseId);
    } else {
      newSelected.add(courseId);
    }
    setSelectedCourses(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCourses.size === filteredCourses.length) {
      setSelectedCourses(new Set());
    } else {
      setSelectedCourses(new Set(filteredCourses.map(c => c._id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCourses.size === 0) return;

    try {
      setIsDeleting(true);
      const deletePromises = Array.from(selectedCourses).map(id => courseApi.remove(id));
      await Promise.all(deletePromises);
      toast.success(`${selectedCourses.size} ders başarıyla silindi`);
      setBulkDeleteDialogOpen(false);
      setSelectedCourses(new Set());
      fetchCourses();
    } catch (error: any) {
      toast.error("Dersler silinirken bir hata oluştu");
    } finally {
      setIsDeleting(false);
    }
  };

  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Calculate stats
  const totalCourses = courses.length;
  const totalStudents = courses.reduce((sum, course) => sum + (course.students?.length || 0), 0);
  const totalExams = courses.reduce((sum, course) => sum + (course.examCount || 0), 0);
  const totalLearningOutcomes = courses.reduce((sum, course) => sum + (course.learningOutcomes?.length || 0), 0);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 min-w-0">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-base text-slate-600 dark:text-slate-400">
                Oluşturduğunuz derslerin listesi ve yönetimi
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Stats Card - Toplam Ders */}
              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 w-full sm:w-auto sm:min-w-[220px]">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardContent className="relative px-5 py-0 h-11 sm:h-12 flex items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-lg transition-all duration-300 flex-shrink-0">
                      <BookOpen className="h-4 w-4 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors whitespace-nowrap">Toplam Ders</p>
                      <p className="text-lg font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">{totalCourses}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {canAdd && (
                <Button
                  size="lg"
                  onClick={() => setCreateModalOpen(true)}
                  className="w-full sm:w-auto h-11 sm:h-12 text-sm sm:text-base px-4 sm:px-6 font-semibold bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-brand-navy/90 hover:to-[#0f3a6b]/90 text-white shadow-lg hover:shadow-xl transition-all"
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span className="hidden sm:inline">Yeni Ders Oluştur</span>
                  <span className="sm:hidden">Yeni Ders</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div>
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
              >
                <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                  <Filter className="h-4 w-4 text-brand-navy dark:text-slate-200" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-brand-navy dark:text-slate-100">Filtreler</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Dersleri bölüm, program veya arama ile filtreleyin
                  </CardDescription>
                </div>
                {filtersExpanded ? (
                  <ChevronUp className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                )}
              </button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 px-3 text-xs hover:bg-brand-navy/10 hover:text-brand-navy dark:hover:bg-brand-navy/20 ml-2"
                >
                  <X className="h-3 w-3 mr-1" />
                  Temizle
                </Button>
              )}
            </div>
          </CardHeader>
          {filtersExpanded && (
            <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Department Filter */}
              <div className="space-y-2">
                <Label htmlFor="department-filter" className="text-sm font-medium">
                  Bölüm
                </Label>
                <Select
                  id="department-filter"
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  disabled={user?.role === "department_head"}
                  className="h-10 text-sm"
                >
                  <option value="">Tüm Bölümler</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name}
                    </option>
                  ))}
                </Select>
                {user?.role === "department_head" && selectedDepartmentId && (
                  <p className="text-xs text-muted-foreground">Kendi bölümünüz otomatik seçildi.</p>
                )}
                {user?.role === "teacher" && (
                  <p className="text-xs text-muted-foreground">Sadece atandığınız bölüm ve programlar.</p>
                )}
              </div>

              {/* Program Filter */}
              <div className="space-y-2">
                <Label htmlFor="program-filter" className="text-sm font-medium">
                  Program
                </Label>
                <Select
                  id="program-filter"
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                  disabled={!selectedDepartmentId || loadingPrograms}
                  className="h-10 text-sm"
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

              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search-input" className="text-sm font-medium">
                  Arama
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-input"
                    placeholder="Ders ara… (ad, kod veya dönem)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Active Filters Badges */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">Aktif Filtreler:</span>
                {selectedDepartmentId && (
                  <Badge variant="secondary" className="text-xs">
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
                  <Badge variant="secondary" className="text-xs">
                    Program: {programs.find(p => p._id === selectedProgramId)?.name || selectedProgramId}
                    <button
                      onClick={() => setSelectedProgramId("")}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {searchQuery.trim() !== "" && (
                  <Badge variant="secondary" className="text-xs">
                    Arama: "{searchQuery}"
                    <button
                      onClick={() => setSearchQuery("")}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
          )}
        </Card>
        </div>

        {/* Select All Bar - Below Filters (sadece yönetici/bölüm başkanı) */}
        {!isLoading && filteredCourses.length > 0 && canAdd && (
          <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-brand-navy/10">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-medium text-brand-navy dark:text-slate-200 hover:opacity-80 transition-opacity"
            >
              {selectedCourses.size === filteredCourses.length ? (
                <CheckSquare className="h-5 w-5 text-brand-navy dark:text-slate-200" />
              ) : (
                <Square className="h-5 w-5 text-brand-navy dark:text-slate-200" />
              )}
              <span>
                {selectedCourses.size === filteredCourses.length ? "Tümünü Kaldır" : "Tümünü Seç"}
              </span>
            </button>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {selectedCourses.size > 0 && `${selectedCourses.size} ders seçili`}
            </p>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {selectedCourses.size > 0 && (
          <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-gradient-to-r from-brand-navy/5 to-brand-navy/10 dark:from-brand-navy/20 dark:to-brand-navy/10 shadow-modern">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-brand-navy/10 dark:bg-brand-navy/20">
                    <CheckSquare className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-brand-navy dark:text-slate-100">
                      {selectedCourses.size} ders seçildi
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Toplu işlemler için seçili dersler
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCourses(new Set())}
                    className="h-9 px-4 text-sm border-brand-navy/20 hover:bg-brand-navy/10"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Seçimi Kaldır
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    className="h-9 px-4 text-sm"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Seçilenleri Sil
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredCourses.length === 0 && (
          <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 flex items-center justify-center mb-6">
                <BookOpen className="h-10 w-10 text-brand-navy dark:text-slate-200" />
              </div>
              <h3 className="text-xl font-bold text-brand-navy dark:text-slate-100 mb-2">
                {hasActiveFilters
                  ? "Filtre kriterlerinize uygun ders bulunamadı"
                  : "Henüz ders oluşturmadınız"}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                {hasActiveFilters
                  ? "Farklı bir filtre veya arama terimi deneyin"
                  : canAdd ? "İlk dersinizi oluşturarak başlayın" : "Atanmış dersleriniz burada listelenir"}
              </p>
              {!hasActiveFilters && canAdd && (
                <Button
                  size="lg"
                  onClick={() => setCreateModalOpen(true)}
                  className="h-12 text-base px-6 font-semibold bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-brand-navy/90 hover:to-[#0f3a6b]/90 text-white shadow-lg hover:shadow-xl transition-all"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Yeni Ders Oluştur
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Course Cards Grid - Responsive */}
        {!isLoading && filteredCourses.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredCourses.map((course) => (
              <div key={course._id} className="relative">
                {canAdd && (
                  <div className="absolute top-3 right-3 z-10">
                    <button
                      onClick={() => toggleCourseSelection(course._id)}
                      className="p-1.5 rounded-md bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-brand-navy/20 shadow-md hover:bg-brand-navy/10 transition-all"
                    >
                      {selectedCourses.has(course._id) ? (
                        <CheckSquare className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                      ) : (
                        <Square className="h-5 w-5 text-brand-navy/50 dark:text-slate-400" />
                      )}
                    </button>
                  </div>
                )}
                <CourseCard
                  course={course}
                  onDelete={handleDeleteClick}
                  canEdit={canAdd}
                  canDelete={canAdd}
                />
              </div>
            ))}
          </div>
        )}

        {/* Create Course Modal */}
        <CreateCourseModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onSuccess={() => {
            fetchCourses();
            setCreateModalOpen(false);
          }}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent onClose={handleDeleteCancel} className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl">
                Dersi Sil
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                Bu işlemi geri alamazsınız. Ders ve tüm ilişkili sınav verileri
                silinecek.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {selectedCourse && (
              <div className="my-4 p-4 bg-muted rounded-lg">
                <p className="text-lg font-semibold">{selectedCourse.name}</p>
                <p className="text-sm text-muted-foreground">
                  Kod: {selectedCourse.code}
                </p>
              </div>
            )}
            <AlertDialogFooter>
              <Button
                variant="outline"
                size="lg"
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="h-12 text-base px-6"
              >
                İptal
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="h-12 text-base px-6"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Siliniyor...
                  </>
                ) : (
                  "Sil"
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
          <AlertDialogContent onClose={() => setBulkDeleteDialogOpen(false)} className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl">
                Seçili Dersleri Sil
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                {selectedCourses.size} ders silinecek. Bu işlemi geri alamazsınız. Dersler ve tüm ilişkili sınav verileri silinecek.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4 p-4 bg-muted rounded-lg max-h-48 overflow-y-auto">
              <p className="text-sm font-semibold mb-2">Silinecek dersler:</p>
              <ul className="space-y-1">
                {Array.from(selectedCourses).map((courseId) => {
                  const course = courses.find(c => c._id === courseId);
                  return course ? (
                    <li key={courseId} className="text-sm text-muted-foreground">
                      • {course.name} ({course.code})
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
            <AlertDialogFooter>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setBulkDeleteDialogOpen(false)}
                disabled={isDeleting}
                className="h-12 text-base px-6"
              >
                İptal
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="h-12 text-base px-6"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Siliniyor...
                  </>
                ) : (
                  `${selectedCourses.size} Dersi Sil`
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// Skeleton Component for Loading State
function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-6 w-1/2" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
      </div>
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-12 flex-1" />
      </div>
    </div>
  );
}
