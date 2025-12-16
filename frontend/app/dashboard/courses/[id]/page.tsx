"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Edit, FileText, Target, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { programOutcomeApi, type ProgramOutcome } from "@/lib/api/programOutcomeApi";
import { examApi, type Exam } from "@/lib/api/examApi";
import { studentApi, type Student } from "@/lib/api/studentApi";
import { LearningOutcomeMapping } from "@/components/courses/LearningOutcomeMapping";
import { MudekMatrixView } from "@/components/courses/MudekMatrixView";

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (courseId) {
      loadCourse();
    }
  }, [courseId]);

  const loadCourse = async () => {
    try {
      setIsLoading(true);
      const [courseData, examsData] = await Promise.all([
        courseApi.getById(courseId),
        examApi.getByCourse(courseId).catch(() => []) // If fails, return empty array
      ]);
      setCourse(courseData);
      setExams(examsData);

      // Load students if course has students
      if (courseData.students && courseData.students.length > 0) {
        try {
          const allStudents = await studentApi.getAll();
          const courseStudentNumbers = courseData.students.map(s => s.studentNumber);
          const relevantStudents = allStudents.filter(s => 
            courseStudentNumbers.includes(s.studentNumber)
          );
          setStudents(relevantStudents);
        } catch (error) {
          console.error("Failed to load students:", error);
          // Don't show error, just log it
        }
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Ders bilgileri yüklenemedi");
      router.push("/dashboard/courses");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return null;
  }

  const department = (course as any).department;
  const departmentId = typeof department === "object" ? department?._id : null;
  const departmentName = typeof department === "object" ? department?.name : department || "Bilinmiyor";
  
  // Get program info from course
  const program = (course as any).program;
  const programId = typeof program === "object" && program !== null ? program?._id : (typeof program === "string" ? program : null);
  const programName = typeof program === "object" && program !== null 
    ? (program?.name || program?.nameEn || null)
    : null;
  const programCode = typeof program === "object" && program !== null 
    ? (program?.code || null)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push("/dashboard/courses")}
                  className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 hover:bg-brand-navy/10"
                >
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-brand-navy dark:text-slate-200" />
                </Button>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100 truncate mb-2">{course.name}</h1>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Kod:</span>
                      <span className="font-semibold text-brand-navy dark:text-slate-200">{course.code}</span>
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Bölüm:</span>
                      <span className="font-semibold text-brand-navy dark:text-slate-200">{departmentName}</span>
                    </span>
                    {programName && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Program:</span>
                          <span className="font-semibold text-brand-navy dark:text-slate-200">
                            {programName}{programCode ? ` (${programCode})` : ""}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button
                onClick={() => router.push(`/dashboard/courses/edit/${courseId}`)}
                className="h-11 sm:h-12 px-4 sm:px-6 bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-brand-navy/90 hover:to-[#0f3a6b]/90 text-white text-sm sm:text-base w-full sm:w-auto shadow-lg hover:shadow-xl transition-all"
              >
                <Edit className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Düzenle
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
            <CardContent className="p-2">
              <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-slate-100/50 dark:bg-slate-800/50">
                <TabsTrigger 
                  value="overview" 
                  className={cn(
                    "text-xs sm:text-sm md:text-base font-semibold py-3 px-4 rounded-lg transition-all",
                    activeTab === "overview"
                      ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                      : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
                  )}
                >
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span className="hidden sm:inline">Genel Bakış</span>
                  <span className="sm:hidden">Genel</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="mapping" 
                  className={cn(
                    "text-xs sm:text-sm md:text-base font-semibold py-3 px-4 rounded-lg transition-all",
                    activeTab === "mapping"
                      ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                      : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
                  )}
                >
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span className="hidden sm:inline">ÖÇ → PÇ Eşlemesi</span>
                  <span className="sm:hidden">Eşleme</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="matrix" 
                  className={cn(
                    "text-xs sm:text-sm md:text-base font-semibold py-3 px-4 rounded-lg transition-all",
                    activeTab === "matrix"
                      ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                      : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
                  )}
                >
                  <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span className="hidden sm:inline">MEDEK Matrisi</span>
                  <span className="sm:hidden">Matris</span>
                </TabsTrigger>
              </TabsList>
            </CardContent>
          </Card>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                      <FileText className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Ders Bilgileri</h2>
                  </div>
                </div>
                <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
                  <CardContent className="p-5 space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Ders Adı</p>
                    <p className="text-lg font-semibold">{course.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ders Kodu</p>
                    <p className="text-lg font-semibold">{course.code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bölüm</p>
                    <p className="text-lg font-semibold">{departmentName}</p>
                  </div>
                  {programName && (
                    <div>
                      <p className="text-sm text-muted-foreground">Program</p>
                      <p className="text-lg font-semibold">
                        {programName}{programCode ? ` (${programCode})` : ""}
                      </p>
                    </div>
                  )}
                  {(course as any).semester && (
                    <div>
                      <p className="text-sm text-muted-foreground">Dönem</p>
                      <p className="text-lg font-semibold">{(course as any).semester}</p>
                    </div>
                  )}
                  {course.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">Açıklama</p>
                      <p className="text-lg">{course.description}</p>
                    </div>
                  )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                      <Target className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">İstatistikler</h2>
                  </div>
                </div>
                <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
                  <CardContent className="p-5 space-y-4">
                  <div className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                        <Target className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Öğrenme Çıktısı</p>
                        <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                          {course.learningOutcomes?.length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                        <Users className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Öğrenci Sayısı</p>
                        <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                          {course.students?.length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                        <FileText className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Toplam Sınav</p>
                        <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                          {exams.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </div>
            </div>

            {/* Exams List */}
            {exams.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                      <FileText className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Sınavlar</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Bu derse ait tüm sınavların listesi</p>
                    </div>
                  </div>
                </div>
                <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
                <CardContent>
                  <div className="space-y-4">
                    {exams.filter(e => e.examType === "midterm").length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-brand-navy dark:text-slate-200 mb-3">Vize Sınavları</p>
                        <div className="flex flex-wrap gap-2">
                          {exams
                            .filter(e => e.examType === "midterm")
                            .map((exam) => (
                              <Badge 
                                key={exam._id} 
                                variant="outline" 
                                className="text-sm px-3 py-1.5 border-brand-navy/20 hover:border-brand-navy/40 hover:bg-brand-navy/5 transition-all"
                              >
                                {exam.examCode}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}
                    {exams.filter(e => e.examType === "final").length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-brand-navy dark:text-slate-200 mb-3">Final Sınavları</p>
                        <div className="flex flex-wrap gap-2">
                          {exams
                            .filter(e => e.examType === "final")
                            .map((exam) => (
                              <Badge 
                                key={exam._id} 
                                variant="outline" 
                                className="text-sm px-3 py-1.5 border-brand-navy/20 hover:border-brand-navy/40 hover:bg-brand-navy/5 transition-all"
                              >
                                {exam.examCode}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              </div>
            )}

            {/* Students List */}
            {course.students && course.students.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                      <Users className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Öğrenci Listesi</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Bu derse kayıtlı {course.students.length} öğrenci</p>
                    </div>
                  </div>
                </div>
                <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-2 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
                    {course.students.map((courseStudent, index) => {
                      const student = students.find(s => s.studentNumber === courseStudent.studentNumber);
                      const studentId = student?._id;
                      const studentName = student?.name || courseStudent.fullName || courseStudent.studentNumber;
                      
                      return (
                        <div
                          key={index}
                          className="group p-3 sm:p-4 border border-brand-navy/20 dark:border-slate-700/50 rounded-lg hover:border-brand-navy/50 hover:shadow-md transition-all duration-300 flex items-center justify-between gap-2 cursor-pointer bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800"
                          onClick={() => {
                            if (studentId) {
                              router.push(`/students/${studentId}`);
                            } else {
                              router.push(`/students?search=${courseStudent.studentNumber}`);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs sm:text-sm font-semibold text-brand-navy dark:text-slate-200">
                                {index + 1}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm sm:text-base text-brand-navy dark:text-slate-100 truncate">{studentName}</p>
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">{courseStudent.studentNumber}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (studentId) {
                                router.push(`/students/${studentId}`);
                              } else {
                                router.push(`/students?search=${courseStudent.studentNumber}`);
                              }
                            }}
                            className="text-brand-navy hover:text-brand-navy/80 hover:bg-brand-navy/10 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 flex-shrink-0"
                          >
                            Detay
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              </div>
            )}

            {/* Learning Outcomes List */}
            {course.learningOutcomes && course.learningOutcomes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                      <Target className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Öğrenme Çıktıları (ÖÇ)</h2>
                  </div>
                </div>
                <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-4">
                    {course.learningOutcomes.map((lo, index) => (
                      <div
                        key={index}
                        className="group p-4 border border-brand-navy/20 dark:border-slate-700/50 rounded-xl hover:border-brand-navy/50 hover:shadow-md transition-all duration-300 bg-white/50 dark:bg-slate-800/50"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          <Badge variant="default" className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white text-sm sm:text-base px-3 py-1.5 w-fit">
                            {lo.code}
                          </Badge>
                          <p className="text-sm sm:text-base md:text-lg flex-1 break-words text-brand-navy dark:text-slate-100">{lo.description}</p>
                        </div>
                        {(lo as any).programOutcomes && (lo as any).programOutcomes.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-brand-navy/20 dark:border-slate-700/50">
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-2 font-medium">İlişkili Program Çıktıları:</p>
                            <div className="flex flex-wrap gap-2">
                              {(lo as any).programOutcomes.map((poCode: string) => (
                                <Badge key={poCode} variant="outline" className="text-xs sm:text-sm border-brand-navy/20 hover:border-brand-navy/40">
                                  {poCode}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              </div>
            )}
          </TabsContent>

          {/* ÖÇ → PÇ Mapping Tab */}
          <TabsContent value="mapping">
            {departmentId ? (
              <LearningOutcomeMapping
                courseId={courseId}
                course={course}
                departmentId={departmentId}
                onUpdate={loadCourse}
              />
            ) : (
              <Card className="border-2 border-yellow-200">
                <CardContent className="p-8 text-center">
                  <p className="text-lg text-muted-foreground">
                    Bu ders için bölüm bilgisi bulunamadı. ÖÇ → PÇ eşlemesi yapabilmek için lütfen dersi düzenleyip bölüm seçin.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* MEDEK Matrix Tab */}
          <TabsContent value="matrix">
            {departmentId ? (
              <MudekMatrixView
                courseId={courseId}
                course={course}
                departmentId={departmentId}
                onUpdate={loadCourse}
              />
            ) : (
              <Card className="border-2 border-yellow-200">
                <CardContent className="p-8 text-center">
                  <p className="text-lg text-muted-foreground">
                    Bu ders için bölüm bilgisi bulunamadı. MEDEK matrisi görüntülemek için lütfen dersi düzenleyip bölüm seçin.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


