"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, X, FileText, Calendar, Upload, ChevronDown, ChevronUp, Info } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExamTable } from "@/components/exams/ExamTable";
import { examApi, type Exam } from "@/lib/api/examApi";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { departmentApi, type Department } from "@/lib/api/departmentApi";
import { programApi, type Program } from "@/lib/api/programApi";

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

  useEffect(() => {
    fetchAllExams();
    loadDepartments();
  }, []);

  useEffect(() => {
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
  }, [selectedProgramId]);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedDepartmentId, selectedProgramId, selectedCourseId, selectedExamType, filterType, exams, courses]);

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
  const totalQuestions = exams.reduce((sum, exam) => sum + (exam.questions?.length || exam.questionCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header - Outside Card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400">Sınavları ve sorularını yönetin, puanları görüntüleyin</p>
              </div>
            </div>
          </div>
          <Button 
            onClick={() => router.push("/exams/new")} 
            className="h-11 sm:h-12 px-4 sm:px-6 bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-brand-navy/90 hover:to-[#0f3a6b]/90 text-white shadow-lg hover:shadow-xl transition-all flex-shrink-0"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Yeni Sınav Oluştur</span>
            <span className="sm:hidden">Yeni Sınav</span>
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <FileText className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Toplam Sınav</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {totalExams}
                </p>
              </div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <Calendar className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Vize Sınavları</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {midtermCount}
                </p>
              </div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <FileText className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Final Sınavları</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {finalCount}
                </p>
              </div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <FileText className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Toplam Soru</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {totalQuestions}
                </p>
              </div>
            </div>
          </Card>
        </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {/* Department Filter */}
                <div className="space-y-2">
                  <Label htmlFor="department-filter" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                    Bölüm
                  </Label>
                  <Select
                    id="department-filter"
                    value={selectedDepartmentId}
                    onChange={(e) => setSelectedDepartmentId(e.target.value)}
                    className="h-10 text-sm border-brand-navy/20 focus:border-brand-navy"
                  >
                    <option value="">Tüm Bölümler</option>
                    {departments.map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))}
                  </Select>
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

      {/* AI Puanlama Bilgi Kartı - Collapsible */}
      <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
        <CardContent className="p-0">
          <div 
            className="p-4 cursor-pointer hover:bg-brand-navy/5 dark:hover:bg-brand-navy/10 transition-colors flex items-center justify-between"
            onClick={() => setAiInfoExpanded(!aiInfoExpanded)}
          >
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-brand-navy dark:text-slate-200" />
              <span className="font-semibold text-brand-navy dark:text-slate-100">AI Puanlama Sistemi</span>
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
            <div className="px-4 pb-4 space-y-3 border-t border-brand-navy/10 dark:border-slate-700/50 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-br from-brand-navy/5 to-brand-navy/10 dark:from-brand-navy/10 dark:to-brand-navy/20 border border-brand-navy/20 dark:border-slate-700/50">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15">
                    <Upload className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div>
                    <p className="font-semibold text-brand-navy dark:text-slate-100 mb-1">AI Puanlama</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Tek PDF yükleyin, AI otomatik okusun</p>
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
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  💡 <strong>Önemli:</strong> 4 siyah marker kare gerekli, AI otomatik puan okur
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exams List */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
              <FileText className="h-5 w-5 text-brand-navy dark:text-slate-200" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Sınav Listesi</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Sistemdeki tüm sınavlar. Puanlama için "AI Puanlama" veya "Toplu Yükleme" butonlarını kullanın.
                {filteredExams.length !== totalExams && (
                  <span className="ml-2">
                    ({filteredExams.length} / {totalExams} sınav gösteriliyor)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy mb-4"></div>
                <p>Sınavlar yükleniyor...</p>
              </div>
            ) : (
              <ExamTable exams={filteredExams} courses={courses} onDelete={fetchAllExams} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
