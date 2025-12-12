"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileText, ArrowRight, BarChart3, BookOpen, Users, Target, GraduationCap, Search, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { departmentApi, type Department } from "@/lib/api/departmentApi";
import { examApi } from "@/lib/api/examApi";

export default function ReportsPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
    loadDepartments();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedDepartmentId, courses]);

  const loadDepartments = async () => {
    try {
      const data = await departmentApi.getAll();
      setDepartments(data);
    } catch (error: any) {
      console.error("Bölümler yüklenemedi:", error);
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

    setFilteredCourses(filtered);
  };

  // Statistics
  const stats = useMemo(() => {
    return {
      totalCourses: courses.length,
      totalWithReports: courses.filter(c => (c.examCount || 0) > 0).length,
      totalStudents: courses.reduce((sum, c) => sum + (c.studentsCount || 0), 0),
      totalLOs: courses.reduce((sum, c) => sum + (c.learningOutcomesCount || 0), 0),
    };
  }, [courses]);

  const handleViewReport = (courseId: string) => {
    router.push(`/reports/${courseId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#0a294e] rounded-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">MÜDEK Raporları</h1>
          </div>
          <p className="text-muted-foreground text-base ml-14">
            Dersler için kapsamlı akreditasyon raporları oluşturun ve görüntüleyin
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-2 border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Toplam Ders</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    <p className="text-3xl font-bold text-slate-900">{stats.totalCourses}</p>
                  )}
                </div>
                <div className="p-3 bg-[#0a294e]/10 rounded-lg">
                  <BookOpen className="h-6 w-6 text-[#0a294e]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Rapor Hazır</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    <p className="text-3xl font-bold text-slate-900">{stats.totalWithReports}</p>
                  )}
                </div>
                <div className="p-3 bg-slate-100 rounded-lg">
                  <FileText className="h-6 w-6 text-slate-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Toplam Öğrenci</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    <p className="text-3xl font-bold text-slate-900">{stats.totalStudents}</p>
                  )}
                </div>
                <div className="p-3 bg-slate-100 rounded-lg">
                  <Users className="h-6 w-6 text-slate-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Toplam ÖÇ</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mb-1" />
                  ) : (
                    <p className="text-3xl font-bold text-slate-900">{stats.totalLOs}</p>
                  )}
                </div>
                <div className="p-3 bg-slate-100 rounded-lg">
                  <Target className="h-6 w-6 text-slate-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-2 border-slate-200">
          <CardHeader>
            <CardTitle>Filtreler ve Arama</CardTitle>
            <CardDescription>
              Dersleri bölüm veya arama terimi ile filtreleyin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Department Filter */}
              <div className="space-y-2">
                <label htmlFor="department-filter" className="text-sm font-medium">
                  Bölüm
                </label>
                <select
                  id="department-filter"
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className="flex h-10 w-full rounded-md border-2 border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#0a294e] focus:outline-none"
                >
                  <option value="">Tüm Bölümler</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Bar */}
              <div className="relative space-y-2">
                <label htmlFor="search" className="text-sm font-medium">
                  Arama
                </label>
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground z-10 mt-2" />
                <Input
                  id="search"
                  placeholder="Ders adı, kodu veya dönem..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-10 text-base rounded-lg border-2 bg-white focus:border-[#0a294e] shadow-sm"
                />
              </div>
            </div>
          </CardContent>
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
          <Card className="border-2 border-dashed border-slate-300">
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-medium text-slate-700 mb-2">
                {searchQuery || selectedDepartmentId
                  ? "Filtrelerinize uygun ders bulunamadı"
                  : "Henüz ders bulunmamaktadır"}
              </p>
              <p className="text-sm text-muted-foreground">
                {searchQuery || selectedDepartmentId
                  ? "Farklı filtreler deneyin"
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
              
              return (
                <Card
                  key={course._id}
                  className="border-2 border-slate-200 hover:border-[#0a294e] transition-all hover:shadow-lg cursor-pointer"
                  onClick={() => handleViewReport(course._id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {course.code}
                          </Badge>
                          {course.examCount > 0 && (
                            <Badge variant="default" className="bg-[#0a294e] text-white text-xs">
                              Rapor Hazır
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-slate-900 mb-1 line-clamp-2">
                          {course.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-3">
                          {department}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">ÖÇ</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {course.learningOutcomesCount || 0}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Sınav</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {course.examCount || 0}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Öğrenci</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {course.studentsCount || 0}
                        </p>
                      </div>
                    </div>

                    <Button
                      className="w-full mt-4 bg-[#0a294e] hover:bg-[#0a294e]/90 text-white"
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

