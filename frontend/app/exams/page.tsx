"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, X, FileText, Calendar, Upload, ChevronDown, ChevronUp, Info, CheckSquare, Square, Trash2, Loader2 } from "lucide-react";
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
import { ExamTable } from "@/components/exams/ExamTable";
import { examApi, type Exam } from "@/lib/api/examApi";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { departmentApi, type Department } from "@/lib/api/departmentApi";
import { programApi, type Program } from "@/lib/api/programApi";
import { authApi } from "@/lib/api/authApi";

export default function ExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [filteredExams, setFilteredExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Record<string, Course>>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedExamType, setSelectedExamType] = useState("");
  const [filterType, setFilterType] = useState<"all" | "midterm" | "final">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [aiInfoExpanded, setAiInfoExpanded] = useState(false);
  const [selectedExams, setSelectedExams] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
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
      fetchAllExams();
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
      if (!selectedProgramId) loadCoursesByDepartment(selectedDepartmentId);
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
  }, [selectedProgramId]);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedDepartmentId, selectedProgramId, selectedCourseId, selectedExamType, filterType, exams, courses]);

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
      const coursesMap: Record<string, Course> = {};
      data.forEach((course) => {
        coursesMap[course._id] = course;
      });
      setCourses(coursesMap);
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
      const coursesMap: Record<string, Course> = {};
      deptCourses.forEach((course) => {
        coursesMap[course._id] = course;
      });
      setCourses(coursesMap);
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
      const coursesMap: Record<string, Course> = {};
      programCourses.forEach((course) => {
        coursesMap[course._id] = course;
      });
      setCourses(coursesMap);
      if (selectedCourseId && !programCourses.find((c: any) => c._id === selectedCourseId)) {
        setSelectedCourseId("");
      }
    } catch (error: any) {
      console.error("Dersler yüklenemedi:", error);
    }
  };

  const applyFilters = () => {
    let filtered = [...exams];

    // Filter by quick filter type
    if (filterType === "midterm") {
      filtered = filtered.filter((exam) => exam.examType === "midterm");
    } else if (filterType === "final") {
      filtered = filtered.filter((exam) => exam.examType === "final");
    }

    // Filter by department
    if (selectedDepartmentId) {
      filtered = filtered.filter((exam) => {
        const courseId =
          typeof exam.courseId === "object" && exam.courseId !== null
            ? exam.courseId._id
            : exam.courseId;
        const course = courseId ? courses[courseId] : undefined;
        if (!course) return false;
        const deptId =
          typeof course.department === "object" && course.department !== null
            ? course.department._id
            : course.department;
        return deptId === selectedDepartmentId;
      });
    }

    // Filter by program
    if (selectedProgramId) {
      filtered = filtered.filter((exam) => {
        const courseId =
          typeof exam.courseId === "object" && exam.courseId !== null
            ? exam.courseId._id
            : exam.courseId;
        const course = courseId ? courses[courseId] : undefined;
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
      filtered = filtered.filter((exam) => {
        const courseId =
          typeof exam.courseId === "object" && exam.courseId !== null
            ? exam.courseId._id
            : exam.courseId;
        return courseId === selectedCourseId;
      });
    }

    // Filter by exam type
    if (selectedExamType) {
      filtered = filtered.filter((exam) => exam.examType === selectedExamType);
    }

    // Filter by search query
    if (searchQuery && searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((exam) => {
        const courseId =
          typeof exam.courseId === "object" && exam.courseId !== null
            ? exam.courseId._id
            : exam.courseId;
        const course = courseId ? courses[courseId] : undefined;
        const courseName = course
          ? `${course.code} ${course.name}`.toLowerCase()
          : "";
        const examCode = exam.examCode?.toLowerCase() || "";
        const examType = exam.examType || "";
        return courseName.includes(query) || examCode.includes(query) || examType.includes(query);
      });
    }

    setFilteredExams(filtered);
  };

  const clearFilters = () => {
    setSelectedDepartmentId("");
    setSelectedProgramId("");
    setSelectedCourseId("");
    setSelectedExamType("");
    setSearchQuery("");
    setFilterType("all");
  };

  const hasActiveFilters = selectedDepartmentId || selectedProgramId || selectedCourseId || selectedExamType || searchQuery.trim() !== "" || filterType !== "all";

  const toggleExamSelect = (id: string) => {
    const next = new Set(selectedExams);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedExams(next);
  };

  const toggleExamSelectAll = () => {
    if (selectedExams.size === filteredExams.length) setSelectedExams(new Set());
    else setSelectedExams(new Set(filteredExams.map((e) => e._id)));
  };

  const handleBulkDeleteExams = async () => {
    if (selectedExams.size === 0) return;
    try {
      setIsBulkDeleting(true);
      await Promise.all(Array.from(selectedExams).map((id) => examApi.remove(id)));
      toast.success(`${selectedExams.size} sınav silindi`);
      setBulkDeleteDialogOpen(false);
      setSelectedExams(new Set());
      fetchAllExams();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Toplu silme başarısız");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const fetchAllExams = async () => {
    try {
      setIsLoading(true);
      const examsData = await examApi.getAll();
      setExams(examsData);
      await loadAllCourses();
    } catch (error: any) {
      toast.error("Sınavlar yüklenemedi");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate statistics
  const totalExams = exams.length;
  const midtermCount = exams.filter(e => e.examType === "midterm").length;
  const finalCount = exams.filter(e => e.examType === "final").length;
  // Calculate total questions from exam.questionCount or exam.questions.length
  // Also check course data if exam doesn't have questionCount
  const totalQuestions = exams.reduce((sum, exam) => {
    const examQuestionCount = exam.questionCount || exam.questions?.length || 0;
    // If exam doesn't have questionCount, try to get it from course
    if (examQuestionCount === 0) {
      const courseId = typeof exam.courseId === "object" && exam.courseId !== null
        ? exam.courseId._id
        : exam.courseId;
      const course = courseId ? courses[courseId] : undefined;
      if (course) {
        const courseQuestionCount = exam.examType === "midterm"
          ? course.midtermExam?.questionCount || 0
          : course.finalExam?.questionCount || 0;
        return sum + courseQuestionCount;
      }
    }
    return sum + examQuestionCount;
  }, 0);

  return (
    <div className="min-w-0 w-full px-3 py-4 sm:px-4 sm:py-6 md:px-6 overflow-x-hidden space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-brand-navy dark:text-slate-100 truncate">Sınavlar</h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">Sınavları ve sorularını yönetin, puanları görüntüleyin</p>
          </div>
          <Button 
            onClick={() => router.push("/exams/new")} 
            className="h-10 sm:h-12 px-4 sm:px-6 bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-brand-navy/90 hover:to-[#0f3a6b]/90 text-white shadow-lg hover:shadow-xl transition-all flex-shrink-0 w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Yeni Sınav Oluştur</span>
            <span className="sm:hidden">Yeni Sınav</span>
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-4 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Toplam Sınav</p>
                <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {totalExams}
                </p>
              </div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-4 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Vize</p>
                <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {midtermCount}
                </p>
              </div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-4 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Final</p>
                <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {finalCount}
                </p>
              </div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-4 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Toplam Soru</p>
                <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {totalQuestions}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Filters Card - Collapsible */}
      <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern overflow-hidden">
        <CardContent className="p-0">
          <div 
            className="p-3 sm:p-4 cursor-pointer hover:bg-brand-navy/5 dark:hover:bg-brand-navy/10 transition-colors flex items-center justify-between"
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
            <div className="px-3 sm:px-4 pb-4 space-y-4 border-t border-brand-navy/10 dark:border-slate-700/50 pt-4">
              {/* Quick Filter Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex-shrink-0">Hızlı Filtreler:</span>
                <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
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
                    onClick={() => setFilterType("midterm")}
                    className={cn(
                      "h-8 px-3 text-xs",
                      filterType === "midterm" 
                        ? "bg-white dark:bg-slate-600 text-brand-navy dark:text-white shadow-sm" 
                        : "text-slate-600 dark:text-slate-300"
                    )}
                  >
                    Vize
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilterType("final")}
                    className={cn(
                      "h-8 px-3 text-xs",
                      filterType === "final" 
                        ? "bg-white dark:bg-slate-600 text-brand-navy dark:text-white shadow-sm" 
                        : "text-slate-600 dark:text-slate-300"
                    )}
                  >
                    Final
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
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
                    <p className="text-xs text-muted-foreground">Sadece atandığınız bölüm ve programlar.</p>
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
                    {Object.values(courses).map((course) => (
                      <option key={course._id} value={course._id}>
                        {course.code} - {course.name}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Exam Type Filter */}
                <div className="space-y-2">
                  <Label htmlFor="exam-type-filter" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                    Sınav Tipi
                  </Label>
                  <Select
                    id="exam-type-filter"
                    value={selectedExamType}
                    onChange={(e) => setSelectedExamType(e.target.value)}
                    className="h-10 text-sm border-brand-navy/20 focus:border-brand-navy"
                  >
                    <option value="">Tüm Tipler</option>
                    <option value="midterm">Vize</option>
                    <option value="final">Final</option>
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
                      placeholder="Sınav kodu, ders ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-10 text-sm border-brand-navy/20 focus:border-brand-navy"
                    />
                  </div>
                </div>
              </div>

              {/* Active Filters Badges */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-brand-navy/10 dark:border-slate-700/50">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Aktif Filtreler:</span>
                  {filterType !== "all" && (
                    <Badge variant="outline" className="text-xs border-brand-navy/30 text-brand-navy dark:text-slate-300">
                      {filterType === "midterm" ? "Vize" : "Final"}
                      <button
                        onClick={() => setFilterType("all")}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
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
                      Ders: {courses[selectedCourseId]?.code}
                      <button
                        onClick={() => setSelectedCourseId("")}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {selectedExamType && (
                    <Badge variant="outline" className="text-xs border-brand-navy/30 text-brand-navy dark:text-slate-300">
                      Tip: {selectedExamType === "midterm" ? "Vize" : "Final"}
                      <button
                        onClick={() => setSelectedExamType("")}
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

      {/* Puanlama Bilgi Kartı - Collapsible */}
      <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern overflow-hidden">
        <CardContent className="p-0">
          <div 
            className="p-3 sm:p-4 cursor-pointer hover:bg-brand-navy/5 dark:hover:bg-brand-navy/10 transition-colors flex items-center justify-between"
            onClick={() => setAiInfoExpanded(!aiInfoExpanded)}
          >
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-brand-navy dark:text-slate-200" />
              <span className="font-semibold text-brand-navy dark:text-slate-100">Puanlama Sistemi</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                setAiInfoExpanded(!aiInfoExpanded);
              }}
            >
              {aiInfoExpanded ? (
                <ChevronUp className="h-4 w-4 text-brand-navy dark:text-slate-200" />
              ) : (
                <ChevronDown className="h-4 w-4 text-brand-navy dark:text-slate-200" />
              )}
            </Button>
          </div>

          {aiInfoExpanded && (
            <div className="px-3 sm:px-4 pb-4 space-y-3 border-t border-brand-navy/10 dark:border-slate-700/50 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-br from-brand-navy/5 to-brand-navy/10 dark:from-brand-navy/10 dark:to-brand-navy/20 border border-brand-navy/20 dark:border-slate-700/50">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15">
                    <Upload className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div>
                    <p className="font-semibold text-brand-navy dark:text-slate-100 mb-1">Tek PDF Puanlama</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Tek PDF yükleyin, puanlama işlemini başlatın</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-br from-brand-navy/5 to-brand-navy/10 dark:from-brand-navy/10 dark:to-brand-navy/20 border border-brand-navy/20 dark:border-slate-700/50">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15">
                    <FileText className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div>
                    <p className="font-semibold text-brand-navy dark:text-slate-100 mb-1">Toplu Yükleme</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Çoklu PDF yükleyin, toplu işlem yapın</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exams List */}
      <div className="space-y-3 sm:space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-1 h-6 sm:h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full flex-shrink-0"></div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 flex-shrink-0">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-brand-navy dark:text-slate-200" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-xl md:text-2xl font-bold text-brand-navy dark:text-slate-100">Sınav Listesi</h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">
                  {filteredExams.length !== totalExams ? `${filteredExams.length} / ${totalExams} sınav` : "Sistemdeki tüm sınavlar"}
                </p>
              </div>
            </div>
          </div>
          {!isLoading && filteredExams.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button type="button" onClick={toggleExamSelectAll} className="flex items-center gap-2 text-sm font-medium text-brand-navy dark:text-slate-200 hover:opacity-80">
                {selectedExams.size === filteredExams.length ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                {selectedExams.size === filteredExams.length ? "Tümünü Kaldır" : "Tümünü Seç"}
              </button>
              <span className="text-xs text-slate-500">{selectedExams.size > 0 && `${selectedExams.size} seçili`}</span>
            </div>
          )}
        </div>

        {selectedExams.size > 0 && (
          <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-gradient-to-r from-brand-navy/5 to-brand-navy/10 dark:from-brand-navy/20 dark:to-brand-navy/10 overflow-hidden">
            <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
              <p className="text-sm font-semibold text-brand-navy dark:text-slate-100">{selectedExams.size} sınav seçildi</p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setSelectedExams(new Set())} className="flex-1 sm:flex-none"><X className="h-4 w-4 mr-1" />Seçimi Kaldır</Button>
                <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)} className="flex-1 sm:flex-none"><Trash2 className="h-4 w-4 mr-1" />Seçilenleri Sil</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern overflow-hidden">
          <CardContent className="p-0 min-w-0">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy mb-4"></div>
                <p>Sınavlar yükleniyor...</p>
              </div>
            ) : (
              <ExamTable
                exams={filteredExams}
                courses={courses}
                onDelete={fetchAllExams}
                selectedIds={selectedExams}
                onToggleSelect={toggleExamSelect}
                onToggleSelectAll={toggleExamSelectAll}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Seçili sınavları sil</AlertDialogTitle>
            <AlertDialogDescription>{selectedExams.size} sınav silinecek. Bu işlem geri alınamaz.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-48 overflow-y-auto py-2">
            <ul className="text-sm text-muted-foreground space-y-1">
              {Array.from(selectedExams).slice(0, 8).map((id) => {
                const e = exams.find((x) => x._id === id);
                return e ? <li key={id}>• {e.examCode}</li> : null;
              })}
              {selectedExams.size > 8 && <li>... ve {selectedExams.size - 8} sınav daha</li>}
            </ul>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)} disabled={isBulkDeleting}>İptal</Button>
            <Button variant="destructive" onClick={handleBulkDeleteExams} disabled={isBulkDeleting}>
              {isBulkDeleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Siliniyor...</> : `${selectedExams.size} Sınavı Sil`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
