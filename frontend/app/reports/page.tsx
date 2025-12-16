"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileText, ArrowRight, BarChart3, BookOpen, Users, Target, GraduationCap, Search, ExternalLink, Loader2, ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { departmentApi, type Department } from "@/lib/api/departmentApi";
import { programApi, type Program } from "@/lib/api/programApi";
import { examApi } from "@/lib/api/examApi";

export default function ReportsPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [quickFilter, setQuickFilter] = useState<"all" | "withReport" | "withoutReport">("all");

  useEffect(() => {
    fetchCourses();
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
    }
  }, [selectedDepartmentId]);

  useEffect(() => {
    if (selectedProgramId) {
      loadCoursesByProgram(selectedProgramId);
    } else if (selectedDepartmentId) {
      loadCoursesByDepartment(selectedDepartmentId);
    }
  }, [selectedProgramId]);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedDepartmentId, selectedProgramId, selectedCourseId, courses, quickFilter]);

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
      console.log("🔍 [Reports Page] Loading programs for department:", deptId);
      const data = await programApi.getAll(deptId);
      console.log("📦 [Reports Page] Programs received:", data);
      setPrograms(data || []);
      console.log(`✅ [Reports Page] ${data?.length || 0} program(s) loaded`);
    } catch (error: any) {
      console.error("❌ [Reports Page] Programlar yüklenemedi:", error);
      console.error("Error details:", error.response?.data || error.message);
      setPrograms([]);
    } finally {
      setLoadingPrograms(false);
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
      // Reset course selection if selected course is not in new list
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
      // Reset course selection if selected course is not in new list
      if (selectedCourseId && !programCourses.find((c: any) => c._id === selectedCourseId)) {
        setSelectedCourseId("");
      }
    } catch (error: any) {
      console.error("Dersler yüklenemedi:", error);
    }
  };

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const data = await courseApi.getAll();
      
      // Fetch exam counts for each course
      const coursesWithStats = await Promise.all(
        data.map(async (course) => {
          try {
            let courseId: string;
            if (typeof course._id === 'string') {
              courseId = course._id;
            } else {
              courseId = String(course._id || '');
            }
            
            if (!courseId || courseId === 'undefined' || courseId === 'null' || courseId === '[object Object]') {
              return {
                ...course,
                examCount: 0,
                learningOutcomesCount: course.learningOutcomes?.length || 0,
                studentsCount: course.students?.length || 0,
              };
            }
            
            const exams = await examApi.getByCourse(courseId).catch(() => []);
            
            return {
              ...course,
              examCount: exams.length,
              learningOutcomesCount: course.learningOutcomes?.length || 0,
              studentsCount: course.students?.length || 0,
            };
          } catch (error) {
            return {
              ...course,
              examCount: 0,
              learningOutcomesCount: course.learningOutcomes?.length || 0,
              studentsCount: course.students?.length || 0,
            };
          }
        })
      );
      
      setCourses(coursesWithStats);
      setFilteredCourses(coursesWithStats);
    } catch (error: any) {
      toast.error("Dersler yüklenirken hata oluştu");
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

    // Filter by course
    if (selectedCourseId) {
      filtered = filtered.filter((course) => {
        return course._id === selectedCourseId;
      });
    }

    // Filter by search query
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (course) =>
          course.name.toLowerCase().includes(query) ||
          course.code.toLowerCase().includes(query) ||
          ((course as any).semester || "").toLowerCase().includes(query)
      );
    }

    // Quick filter
    if (quickFilter === "withReport") {
      filtered = filtered.filter((course) => (course.examCount || 0) > 0);
    } else if (quickFilter === "withoutReport") {
      filtered = filtered.filter((course) => (course.examCount || 0) === 0);
    }

    setFilteredCourses(filtered);
  };

  // Statistics
  const stats = useMemo(() => {
    return {
      totalCourses: courses.length,
      totalWithReports: courses.filter(c => {
        const examCount = c.examCount ?? 0;
        return examCount > 0;
      }).length,
    };
  }, [courses]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedDepartmentId) count++;
    if (selectedProgramId) count++;
    if (selectedCourseId) count++;
    if (searchQuery.trim() !== "") count++;
    if (quickFilter !== "all") count++;
    return count;
  }, [selectedDepartmentId, selectedProgramId, selectedCourseId, searchQuery, quickFilter]);

  const clearAllFilters = () => {
    setSelectedDepartmentId("");
    setSelectedProgramId("");
    setSelectedCourseId("");
    setSearchQuery("");
    setQuickFilter("all");
  };

  const handleViewReport = (courseId: string) => {
    router.push(`/reports/${courseId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
              <BarChart3 className="h-5 w-5 text-brand-navy dark:text-slate-200" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">MEDEK Raporları</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Dersler için kapsamlı akreditasyon raporları oluşturun ve görüntüleyin
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <BookOpen className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Toplam Ders</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                    {stats.totalCourses}
                  </p>
                )}
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
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Toplam Rapor</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                    {stats.totalWithReports}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                  <Filter className="h-4 w-4 text-brand-navy dark:text-slate-200" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-brand-navy dark:text-slate-100">Filtreler ve Arama</CardTitle>
                  <CardDescription className="text-xs">
                    Dersleri bölüm, program, ders veya arama terimi ile filtreleyin
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className="h-8 w-8 p-0"
              >
                {filtersExpanded ? (
                  <ChevronUp className="h-4 w-4 text-brand-navy" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-brand-navy" />
                )}
              </Button>
            </div>
          </CardHeader>
          {filtersExpanded && (
            <CardContent className="space-y-4 pt-0">
              {/* Quick Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-brand-navy/70 dark:text-slate-400">Hızlı Filtreler:</span>
                <Button
                  variant={quickFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter("all")}
                  className={`h-7 text-xs ${quickFilter === "all" ? "bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white" : ""}`}
                >
                  Tümü
                </Button>
                <Button
                  variant={quickFilter === "withReport" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter("withReport")}
                  className={`h-7 text-xs ${quickFilter === "withReport" ? "bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white" : ""}`}
                >
                  Rapor Hazır
                </Button>
                <Button
                  variant={quickFilter === "withoutReport" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter("withoutReport")}
                  className={`h-7 text-xs ${quickFilter === "withoutReport" ? "bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white" : ""}`}
                >
                  Rapor Yok
                </Button>
              </div>

              {/* Active Filters */}
              {activeFiltersCount > 0 && (
                <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-brand-navy/10">
                  <span className="text-xs font-medium text-brand-navy/70 dark:text-slate-400">
                    Aktif Filtreler ({activeFiltersCount}):
                  </span>
                  {selectedDepartmentId && (
                    <Badge variant="secondary" className="text-xs">
                      Bölüm: {departments.find(d => d._id === selectedDepartmentId)?.name}
                      <button
                        onClick={() => {
                          setSelectedDepartmentId("");
                          setSelectedProgramId("");
                          setSelectedCourseId("");
                        }}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {selectedProgramId && (
                    <Badge variant="secondary" className="text-xs">
                      Program: {programs.find(p => p._id === selectedProgramId)?.name}
                      <button
                        onClick={() => {
                          setSelectedProgramId("");
                          setSelectedCourseId("");
                        }}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {selectedCourseId && (
                    <Badge variant="secondary" className="text-xs">
                      Ders: {courses.find(c => c._id === selectedCourseId)?.code}
                      <button
                        onClick={() => setSelectedCourseId("")}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {searchQuery.trim() !== "" && (
                    <Badge variant="secondary" className="text-xs">
                      Arama: {searchQuery}
                      <button
                        onClick={() => setSearchQuery("")}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {quickFilter !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      {quickFilter === "withReport" ? "Rapor Hazır" : "Rapor Yok"}
                      <button
                        onClick={() => setQuickFilter("all")}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-6 text-xs text-brand-navy hover:text-destructive"
                  >
                    Tümünü Temizle
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Department Filter */}
                <div className="space-y-2">
                  <Label htmlFor="department-filter" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                    Bölüm
                  </Label>
                  <select
                    id="department-filter"
                    value={selectedDepartmentId}
                    onChange={(e) => setSelectedDepartmentId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-brand-navy/20 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:border-brand-navy/50 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                  >
                    <option value="">Tüm Bölümler</option>
                    {departments.map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Program Filter */}
                <div className="space-y-2">
                  <Label htmlFor="program-filter" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                    Program
                  </Label>
                  <select
                    id="program-filter"
                    value={selectedProgramId}
                    onChange={(e) => setSelectedProgramId(e.target.value)}
                    disabled={!selectedDepartmentId || loadingPrograms}
                    className="flex h-10 w-full rounded-md border border-brand-navy/20 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:border-brand-navy/50 focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:bg-slate-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed"
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
                  </select>
                </div>

                {/* Course Filter */}
                <div className="space-y-2">
                  <Label htmlFor="course-filter" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                    Ders
                  </Label>
                  <select
                    id="course-filter"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    disabled={!selectedDepartmentId && departments.length > 0}
                    className="flex h-10 w-full rounded-md border border-brand-navy/20 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:border-brand-navy/50 focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:bg-slate-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed"
                  >
                    <option value="">Tüm Dersler</option>
                    {courses.map((course) => (
                      <option key={course._id} value={course._id}>
                        {course.code} - {course.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Bar */}
                <div className="relative space-y-2">
                  <Label htmlFor="search" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                    Arama
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Ders adı, kodu veya dönem..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-10 text-sm border-brand-navy/20 focus:border-brand-navy/50"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Courses Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border-2 border-slate-200">
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <Card className="border border-dashed border-brand-navy/30 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <div className="p-4 rounded-full bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 w-fit mx-auto mb-4">
                <FileText className="h-8 w-8 text-brand-navy/60 dark:text-slate-400" />
              </div>
              <p className="text-lg font-semibold text-brand-navy dark:text-slate-100 mb-2">
                {searchQuery || selectedDepartmentId || activeFiltersCount > 0
                  ? "Filtrelerinize uygun ders bulunamadı"
                  : "Henüz ders bulunmamaktadır"}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {searchQuery || selectedDepartmentId || activeFiltersCount > 0
                  ? "Farklı filtreler deneyin veya filtreleri temizleyin"
                  : "İlk dersinizi oluşturarak başlayın"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map((course) => {
              const department = typeof course.department === 'object' && course.department !== null
                ? course.department.name
                : course.department || "Bilinmiyor";
              
              const hasReport = (course.examCount || 0) > 0;
              
              return (
                <Card
                  key={course._id}
                  className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                  onClick={() => handleViewReport(course._id)}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <CardContent className="p-5 relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="font-mono text-xs border-brand-navy/30 group-hover:border-white/50 group-hover:bg-white/20 group-hover:text-white transition-colors">
                            {course.code}
                          </Badge>
                          {hasReport ? (
                            <Badge className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white text-xs group-hover:bg-white/20 group-hover:text-white transition-colors">
                              Rapor Hazır
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 group-hover:bg-white/20 group-hover:text-white transition-colors">
                              Rapor Yok
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-brand-navy dark:text-slate-100 mb-1 line-clamp-2 group-hover:text-white transition-colors">
                          {course.name}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 group-hover:text-white/80 transition-colors">
                          {department}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-brand-navy/60 dark:text-slate-400 flex-shrink-0 mt-1 group-hover:text-white transition-colors" />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-brand-navy/10 dark:border-slate-700/50 group-hover:border-white/20 transition-colors">
                      <div className="text-center">
                        <p className="text-xs text-brand-navy/70 dark:text-slate-400 mb-1 group-hover:text-white/80 transition-colors">ÖÇ</p>
                        <p className="text-sm font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                          {course.learningOutcomesCount || 0}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-brand-navy/70 dark:text-slate-400 mb-1 group-hover:text-white/80 transition-colors">Sınav</p>
                        <p className="text-sm font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                          {course.examCount || 0}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-brand-navy/70 dark:text-slate-400 mb-1 group-hover:text-white/80 transition-colors">Öğrenci</p>
                        <p className="text-sm font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                          {course.studentsCount || 0}
                        </p>
                      </div>
                    </div>

                    <Button
                      className="w-full mt-4 bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-[#0f3a6b] hover:to-brand-navy text-white shadow-lg group-hover:shadow-xl transition-all duration-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewReport(course._id);
                      }}
                    >
                      Raporu Görüntüle
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

