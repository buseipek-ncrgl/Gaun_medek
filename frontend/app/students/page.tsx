"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X, Users, Building2, GraduationCap, ChevronDown, ChevronUp, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentTable } from "@/components/students/StudentTable";
import { cn } from "@/lib/utils";
import { studentApi, type Student } from "@/lib/api/studentApi";
import { departmentApi, type Department } from "@/lib/api/departmentApi";
import { programApi, type Program } from "@/lib/api/programApi";
import { courseApi, type Course } from "@/lib/api/courseApi";

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedClassLevel, setSelectedClassLevel] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  useEffect(() => {
    fetchAllStudents();
    loadDepartments();
    loadAllCourses();
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      // Find department ID from name
      const department = departments.find(d => d.name === selectedDepartment);
      if (department) {
        loadPrograms(department._id);
        if (!selectedProgramId) {
          loadCoursesByDepartment(department.name);
        }
      } else {
        setPrograms([]);
        setSelectedProgramId("");
      }
    } else {
      setPrograms([]);
      setSelectedProgramId("");
      setSelectedCourseId("");
      loadAllCourses();
    }
  }, [selectedDepartment, departments]);

  useEffect(() => {
    if (selectedProgramId) {
      loadCoursesByProgram(selectedProgramId);
    } else if (selectedDepartment) {
      const department = departments.find(d => d.name === selectedDepartment);
      if (department) {
        loadCoursesByDepartment(department.name);
      }
    } else {
      loadAllCourses();
    }
  }, [selectedProgramId, selectedDepartment, departments]);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedDepartment, selectedProgramId, selectedCourseId, selectedClassLevel, students, courses]);

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

  const loadCoursesByDepartment = async (departmentName: string) => {
    try {
      const allCourses = await courseApi.getAll();
      const department = departments.find(d => d.name === departmentName);
      if (department) {
        const deptCourses = allCourses.filter((course: any) => {
          const deptId = typeof course.department === "object" && course.department !== null
            ? (course.department as any)._id
            : course.department;
          return deptId === department._id;
        });
        setCourses(deptCourses);
        if (selectedCourseId && !deptCourses.find((c: any) => c._id === selectedCourseId)) {
          setSelectedCourseId("");
        }
      } else {
        setCourses(allCourses);
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

  const fetchAllStudents = async () => {
    try {
      setIsLoading(true);
      const data = await studentApi.getAll();
      setStudents(data);
      setFilteredStudents(data);
    } catch (error: any) {
      const errorMessage = error?.isNetworkError
        ? error.message || "Backend sunucusuna bağlanılamıyor. Lütfen backend'in çalıştığından emin olun."
        : error?.response?.data?.message || "Öğrenciler yüklenirken hata oluştu";
      toast.error(errorMessage);
      console.error("Students fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...students];

    // Filter by department
    if (selectedDepartment) {
      filtered = filtered.filter((student) => student.department === selectedDepartment);
    }

    // Filter by class level
    if (selectedClassLevel) {
      filtered = filtered.filter((student) => student.classLevel?.toString() === selectedClassLevel);
    }

    // Filter by search query
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (student) =>
          student.name.toLowerCase().includes(query) ||
          student.studentNumber.toLowerCase().includes(query)
      );
    }

    setFilteredStudents(filtered);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedDepartment("");
    setSelectedProgramId("");
    setSelectedClassLevel("");
    setSelectedCourseId("");
  };

  const hasActiveFilters = searchQuery.trim() !== "" || selectedDepartment !== "" || selectedProgramId !== "" || selectedClassLevel !== "" || selectedCourseId !== "";

  // Statistics
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const uniqueDepartments = new Set(students.map(s => s.department).filter(Boolean)).size;
    const uniqueClassLevels = new Set(students.map(s => s.classLevel).filter(Boolean)).size;
    
    return {
      totalStudents,
      uniqueDepartments,
      uniqueClassLevels,
    };
  }, [students]);

  // Get unique class levels
  const classLevels = useMemo(() => {
    const levels = new Set(students.map(s => s.classLevel).filter(Boolean).sort((a, b) => (a || 0) - (b || 0)));
    return Array.from(levels);
  }, [students]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Öğrenciler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              
              <div>
                
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
                  Öğrencileri yönetin ve akademik performanslarını görüntüleyin
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => router.push("/students/new")}
            className="h-10 sm:h-11 px-4 sm:px-6 bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-[#0f3a6b] hover:to-brand-navy text-white shadow-md transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Yeni Öğrenci Ekle</span>
            <span className="sm:hidden">Yeni Öğrenci</span>
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <Users className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Toplam Öğrenci</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {stats.totalStudents}
                </p>
              </div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <Building2 className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Farklı Bölüm</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {stats.uniqueDepartments}
                </p>
              </div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <GraduationCap className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Sınıf Seviyesi</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {stats.uniqueClassLevels}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
          <CardContent className="p-0">
            <div
              className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-brand-navy/5 transition-colors"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
            >
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                    <Search className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-brand-navy dark:text-slate-100">Filtreler ve Arama</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Öğrencileri bölüm, program, ders, sınıf seviyesi veya arama terimi ile filtreleyin
                    </p>
                  </div>
                </div>
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
                  <ChevronUp className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                )}
              </Button>
            </div>
            {filtersExpanded && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {/* Department Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="department-filter" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                      Bölüm
                    </Label>
                    <Select
                      id="department-filter"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="h-10 sm:h-11 text-sm border-brand-navy/20 focus:border-brand-navy/50"
                    >
                      <option value="">Tüm Bölümler</option>
                      {departments.map((dept) => (
                        <option key={dept._id} value={dept.name}>
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
                      disabled={!selectedDepartment || loadingPrograms}
                      className="h-10 sm:h-11 text-sm border-brand-navy/20 focus:border-brand-navy/50"
                    >
                      <option value="">
                        {!selectedDepartment 
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
                      disabled={!selectedDepartment && departments.length > 0}
                      className="h-10 sm:h-11 text-sm border-brand-navy/20 focus:border-brand-navy/50"
                    >
                      <option value="">Tüm Dersler</option>
                      {courses.map((course) => (
                        <option key={course._id} value={course._id}>
                          {course.code} - {course.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Class Level Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="class-level-filter" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                      Sınıf Seviyesi
                    </Label>
                    <Select
                      id="class-level-filter"
                      value={selectedClassLevel}
                      onChange={(e) => setSelectedClassLevel(e.target.value)}
                      className="h-10 sm:h-11 text-sm border-brand-navy/20 focus:border-brand-navy/50"
                    >
                      <option value="">Tüm Seviyeler</option>
                      {classLevels.map((level) => (
                        <option key={level} value={level?.toString()}>
                          {level}. Sınıf
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Search Bar */}
                  <div className="relative space-y-2">
                    <Label htmlFor="search" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                      Arama
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="search"
                        placeholder="İsim veya öğrenci numarası..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 sm:h-11 text-sm border-brand-navy/20 focus:border-brand-navy/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Active Filters Badges */}
                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-brand-navy/10 dark:border-slate-700/50">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Aktif Filtreler:</span>
                    {selectedDepartment && (
                      <Badge variant="outline" className="bg-brand-navy/10 text-brand-navy border-brand-navy/30 text-xs">
                        Bölüm: {selectedDepartment}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDepartment("");
                          }}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {selectedProgramId && (
                      <Badge variant="outline" className="bg-brand-navy/10 text-brand-navy border-brand-navy/30 text-xs">
                        Program: {programs.find(p => p._id === selectedProgramId)?.name || selectedProgramId}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProgramId("");
                          }}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {selectedCourseId && (
                      <Badge variant="outline" className="bg-brand-navy/10 text-brand-navy border-brand-navy/30 text-xs">
                        Ders: {courses.find(c => c._id === selectedCourseId)?.code || selectedCourseId}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCourseId("");
                          }}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {selectedClassLevel && (
                      <Badge variant="outline" className="bg-brand-navy/10 text-brand-navy border-brand-navy/30 text-xs">
                        Sınıf: {selectedClassLevel}. Sınıf
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClassLevel("");
                          }}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {searchQuery.trim() !== "" && (
                      <Badge variant="outline" className="bg-brand-navy/10 text-brand-navy border-brand-navy/30 text-xs">
                        Arama: "{searchQuery}"
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearchQuery("");
                          }}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFilters();
                      }}
                      className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Temizle
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Students List */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                <Users className="h-5 w-5 text-brand-navy dark:text-slate-200" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Öğrenci Listesi</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {filteredStudents.length !== students.length 
                    ? `${filteredStudents.length} / ${students.length} öğrenci gösteriliyor`
                    : `Sistemdeki tüm öğrenciler (${students.length})`}
                </p>
              </div>
            </div>
          </div>

          <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
            <CardContent className="p-4 sm:p-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-lg font-medium">
                    {hasActiveFilters ? "Filtrelerinize uygun öğrenci bulunamadı" : "Henüz öğrenci eklenmemiş"}
                  </p>
                  <p className="text-sm mt-2">
                    {hasActiveFilters ? "Farklı filtreler deneyin" : "İlk öğrencinizi ekleyerek başlayın"}
                  </p>
                </div>
              ) : (
                <StudentTable students={filteredStudents} courses={courses} onDelete={fetchAllStudents} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
