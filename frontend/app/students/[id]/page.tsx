"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { User, Hash, Building2, GraduationCap, Edit, BookOpen, ExternalLink, ArrowLeft, FileText, Target, TrendingUp, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { StudentForm } from "@/components/students/StudentForm";
import { StudentExamScoreTable } from "@/components/students/StudentExamScoreTable";
import { StudentLOAchievementCard } from "@/components/students/StudentLOAchievementCard";
import { StudentPOAchievementCard } from "@/components/students/StudentPOAchievementCard";
import { studentApi, type Student } from "@/lib/api/studentApi";
import { scoreApi, type Score, type LOAchievement, type POAchievement } from "@/lib/api/scoreApi";
import { examApi } from "@/lib/api/examApi";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { studentExamResultApi, type QuestionScoreItem } from "@/lib/api/studentExamResultApi";

function StudentDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = params.id as string;
  const isEditMode = searchParams.get("edit") === "true";

  const [student, setStudent] = useState<Student | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [examResults, setExamResults] = useState<any[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [loAchievements, setLOAchievements] = useState<LOAchievement[]>([]);
  const [poAchievements, setPOAchievements] = useState<POAchievement[]>([]);
  const [questionScoresByExamId, setQuestionScoresByExamId] = useState<Record<string, QuestionScoreItem[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (studentId) {
      fetchStudentData();
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId && selectedCourseId && selectedCourseId.trim() !== "") {
      fetchAchievements();
    } else {
      setLOAchievements([]);
      setPOAchievements([]);
    }
  }, [studentId, selectedCourseId]);

  const fetchStudentData = async () => {
    try {
      setIsLoading(true);
      const [studentData, scoresData, coursesData] = await Promise.all([
        studentApi.getById(studentId),
        scoreApi.getByStudent(studentId),
        courseApi.getAll(),
      ]);

      setStudent(studentData);
      setScores(scoresData);
      setCourses(coursesData);

      // Fetch exam results and soru bazlı puanlar
      if (studentData?.studentNumber) {
        try {
          const resultsData = await examApi.getExamResultsByStudent(studentData.studentNumber);
          setExamResults(resultsData);
          const studentNum = studentData.studentNumber;
          const scoresMap: Record<string, QuestionScoreItem[]> = {};
          await Promise.all(
            (resultsData || []).map(async (r: any) => {
              const eid = typeof r.examId === "object" && r.examId?._id ? r.examId._id : r.examId;
              if (!eid) return;
              try {
                const data = await studentExamResultApi.getQuestionScores(eid, studentNum);
                if (data.questionScores?.length) scoresMap[eid] = data.questionScores;
              } catch {
                // ignore
              }
            })
          );
          setQuestionScoresByExamId(scoresMap);
        } catch (error) {
          console.error("Failed to load exam results", error);
        }
      }

      // Set first enrolled course as default if available
      const enrolled = coursesData.filter((course) => {
        const courseStudents = course.students || [];
        return courseStudents.some(
          (s) => s.studentNumber === studentData.studentNumber
        );
      });
      if (enrolled.length > 0 && !selectedCourseId) {
        setSelectedCourseId(enrolled[0]._id);
      }
    } catch (error: any) {
      toast.error("Öğrenci verileri yüklenirken hata oluştu");
      router.push("/students");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAchievements = async () => {
    if (!selectedCourseId || !studentId || selectedCourseId.trim() === "") {
      setLOAchievements([]);
      setPOAchievements([]);
      return;
    }

    try {
      console.log("Fetching achievements for student:", studentId, "course:", selectedCourseId);
      const [loData, poData] = await Promise.all([
        scoreApi.calculateLOAchievement(studentId, selectedCourseId),
        scoreApi.calculatePOAchievement(studentId, selectedCourseId),
      ]);

      console.log("LO Achievements:", loData);
      console.log("PO Achievements:", poData);

      setLOAchievements(Array.isArray(loData) ? loData : []);
      setPOAchievements(Array.isArray(poData) ? poData : []);
    } catch (error: any) {
      console.error("Failed to load achievements", error);
      console.error("Error details:", error.response?.data || error.message);
      toast.error(error?.response?.data?.message || "ÖÇ ve PÇ başarıları yüklenirken hata oluştu");
      setLOAchievements([]);
      setPOAchievements([]);
    }
  };

  const handleEditSuccess = (updatedStudent?: Student) => {
    if (updatedStudent) {
      setStudent(updatedStudent);
    } else {
      fetchStudentData();
    }
    router.replace(`/students/${studentId}`);
  };

  // Find courses where this student is enrolled
  const enrolledCourses = useMemo(() => {
    if (!student) return [];
    return courses.filter((course) => {
      const courseStudents = course.students || [];
      return courseStudents.some(
        (s) => s.studentNumber === student.studentNumber
      );
    });
  }, [courses, student]);

  // Get program name for student from enrolled courses
  const studentProgram = useMemo(() => {
    if (!student || enrolledCourses.length === 0) return null;
    
    const firstCourse = enrolledCourses[0];
    const program = (firstCourse as any).program;
    
    if (!program) return null;
    
    if (typeof program === "object" && program !== null) {
      return program.name || program.nameEn || program.code || null;
    }
    
    return null;
  }, [enrolledCourses, student]);

  const selectedCourse = courses.find((c) => c._id === selectedCourseId);

  // Statistics calculations
  const stats = useMemo(() => {
    if (!examResults.length) {
      return {
        totalExams: 0,
        averageScore: 0,
        successRate: 0,
        totalCourses: enrolledCourses.length,
      };
    }

    const scores = examResults.map((result: any) => {
      const exam = typeof result.examId === 'object' ? result.examId : null;
      // Artık questionScores yok, sadece totalScore var
      const totalScore = result.totalScore || 0;
      const totalMaxScore = result.maxScore || exam?.maxScore || 100;
      const percentage = result.percentage || (totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0);
      return { totalScore, totalMaxScore, percentage };
    });

    const totalScore = scores.reduce((sum, s) => sum + s.totalScore, 0);
    const totalMaxScore = scores.reduce((sum, s) => sum + s.totalMaxScore, 0);
    const averageScore = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
    const successCount = scores.filter((s) => s.percentage >= 50).length; // 50 puan eşiği
    const successRate = scores.length > 0 ? (successCount / scores.length) * 100 : 0;

    return {
      totalExams: examResults.length,
      averageScore: Math.round(averageScore * 10) / 10,
      successRate: Math.round(successRate * 10) / 10,
      totalCourses: enrolledCourses.length,
    };
  }, [examResults, enrolledCourses]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Öğrenci verileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return null;
  }

  if (isEditMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 px-3 py-4 sm:px-4 sm:py-6 md:px-6 overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 min-w-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/students/${studentId}`)} className="h-9 w-9 hover:bg-brand-navy/10 flex-shrink-0">
              <ArrowLeft className="h-4 w-4 text-brand-navy dark:text-slate-200" />
            </Button>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Öğrenci bilgilerini güncelleyin
            </p>
          </div>

          <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
            <CardContent className="p-4 sm:p-6">
              <StudentForm
                mode="edit"
                studentId={studentId}
                initialData={student}
                onSuccess={handleEditSuccess}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 px-3 py-4 sm:px-4 sm:py-6 md:px-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/students")}
              className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 hover:bg-brand-navy/10"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-brand-navy dark:text-slate-200" />
            </Button>
            <div className="w-1 h-7 sm:h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full flex-shrink-0"></div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 flex-shrink-0">
                <User className="h-5 w-5 text-brand-navy dark:text-slate-200" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-brand-navy dark:text-slate-100 truncate">
                  {student.name}
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
                  {student.studentNumber}
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(`/students/${studentId}?edit=true`)}
            className="h-9 sm:h-10 w-full sm:w-auto px-4 sm:px-6 hover:bg-brand-navy/10 hover:border-brand-navy/50 transition-all flex-shrink-0"
          >
            <Edit className="mr-2 h-4 w-4" />
            Düzenle
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-3 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Toplam Sınav</p>
                <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {stats.totalExams}
                </p>
              </div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-3 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Ortalama Puan</p>
                <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {stats.averageScore}%
                </p>
              </div>
            </div>
          </Card>
          {/* Başarı Oranı Kartı - Şimdilik yorum satırında */}
          {/* <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <CheckCircle2 className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Başarı Oranı</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {stats.successRate}%
                </p>
              </div>
            </div>
          </Card> */}
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-3 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1 col-span-2 lg:col-span-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Toplam Ders</p>
                <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {stats.totalCourses}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Student Info Card */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-1 h-7 sm:h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full flex-shrink-0"></div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 flex-shrink-0">
                <User className="h-5 w-5 text-brand-navy dark:text-slate-200" />
              </div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-brand-navy dark:text-slate-100">Öğrenci Bilgileri</h2>
            </div>
          </div>
          <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
            <CardContent className="p-4 sm:p-5 md:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-lg">
                    <User className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">İsim</p>
                    <p className="font-semibold text-brand-navy dark:text-slate-100">{student.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-lg">
                    <Hash className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Öğrenci Numarası</p>
                    <p className="font-semibold text-brand-navy dark:text-slate-100">{student.studentNumber}</p>
                  </div>
                </div>
                {student.department && (
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-lg">
                      <Building2 className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Bölüm</p>
                      <p className="font-semibold text-brand-navy dark:text-slate-100">{student.department}</p>
                    </div>
                  </div>
                )}
                {studentProgram && (
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-lg">
                      <GraduationCap className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Program</p>
                      <p className="font-semibold text-brand-navy dark:text-slate-100">{studentProgram}</p>
                    </div>
                  </div>
                )}
                {student.classLevel && (
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-lg">
                      <GraduationCap className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Sınıf Seviyesi</p>
                      <p className="font-semibold text-brand-navy dark:text-slate-100">{student.classLevel}. Sınıf</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enrolled Courses Card */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-1 h-7 sm:h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full flex-shrink-0"></div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 flex-shrink-0">
                <BookOpen className="h-5 w-5 text-brand-navy dark:text-slate-200" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-brand-navy dark:text-slate-100">Kayıtlı Olduğu Dersler</h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Bu öğrencinin kayıtlı olduğu dersler ({enrolledCourses.length} ders)
                </p>
              </div>
            </div>
          </div>
          <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
            <CardContent className="p-3 sm:p-4 md:p-6">
              {enrolledCourses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-lg font-medium">Bu öğrenci henüz hiçbir derse kayıtlı değil</p>
                  <p className="text-sm mt-2">
                    Ders oluştururken öğrenci listesine eklendiğinde burada görünecektir
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {enrolledCourses.map((course) => {
                    const department = typeof course.department === 'object' && course.department !== null
                      ? course.department.name
                      : course.department || "Bilinmiyor";
                    
                    return (
                      <Card
                        key={course._id}
                        className="group border border-brand-navy/20 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 cursor-pointer"
                        onClick={() => router.push(`/dashboard/courses/${course._id}`)}
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                        <CardContent className="relative p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="font-mono text-xs bg-brand-navy/10 text-brand-navy border-brand-navy/30 group-hover:bg-white/20 group-hover:text-white group-hover:border-white/30 transition-colors">
                                  {course.code}
                                </Badge>
                                {course.semester && (
                                  <Badge variant="secondary" className="text-xs group-hover:bg-white/20 group-hover:text-white transition-colors">
                                    {course.semester}
                                  </Badge>
                                )}
                              </div>
                              <h3 className="font-semibold text-brand-navy dark:text-slate-100 mb-1 line-clamp-2 break-words group-hover:text-white transition-colors">
                                {course.name}
                              </h3>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 group-hover:text-white/80 transition-colors">
                                {department}
                              </p>
                            </div>
                            <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors flex-shrink-0 mt-1" />
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-brand-navy/10 dark:border-slate-700/50 group-hover:border-white/20 transition-colors">
                            <span className="group-hover:text-white/80 transition-colors">
                              <span className="font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                                {course.learningOutcomes?.length || 0}
                              </span>{" "}
                              ÖÇ
                            </span>
                            <span className="group-hover:text-white/80 transition-colors">
                              <span className="font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                                {course.students?.length || 0}
                              </span>{" "}
                              Öğrenci
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Exam Score Table */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-1 h-7 sm:h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full flex-shrink-0"></div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 flex-shrink-0">
                <FileText className="h-5 w-5 text-brand-navy dark:text-slate-200" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-brand-navy dark:text-slate-100">Sınav Sonuçları</h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Bu öğrencinin tüm sınav sonuçları
                  {examResults.length > 0 && ` (${examResults.length} sınav sonucu)`}
                </p>
              </div>
            </div>
          </div>
          <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
            <CardContent className="p-3 sm:p-4 md:p-6">
              {examResults.length > 0 ? (
                <div className="space-y-4">
                  {examResults.map((result: any) => {
                    const exam = typeof result.examId === 'object' ? result.examId : null;
                    const course = typeof result.courseId === 'object' ? result.courseId : null;
                    const totalScore = result.totalScore || 0;
                    const totalMaxScore = result.maxScore || exam?.maxScore || 100;
                    const percentage = result.percentage || (totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0);
                    const passingScore = exam?.passingScore != null ? Number(exam.passingScore) : 60;
                    const successColor = percentage >= passingScore ? "green" : percentage >= (passingScore - 20) ? "amber" : "red";
                    
                    return (
                      <div
                        key={result._id}
                        className="group border border-brand-navy/20 dark:border-slate-700/50 rounded-lg p-4 sm:p-5 space-y-3 bg-white/50 dark:bg-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg text-brand-navy dark:text-slate-100">
                                {exam?.examCode || "Bilinmeyen Sınav"}
                              </h3>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  exam?.examType === "midterm"
                                    ? "bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white border-brand-navy"
                                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                )}
                              >
                                {exam?.examType === "midterm" ? "Vize" : "Final"}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                              {course ? `${course.code} - ${course.name}` : "Bilinmeyen Ders"}
                            </p>
                            {result.createdAt && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(result.createdAt).toLocaleDateString("tr-TR", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric"
                                })}
                              </p>
                            )}
                          </div>
                          <div className="text-right sm:text-left sm:min-w-[120px]">
                            <div className="flex items-center gap-2 justify-end sm:justify-start mb-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-sm font-semibold",
                                  successColor === "green"
                                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-500/30"
                                    : successColor === "amber"
                                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-500/30"
                                )}
                              >
                                {percentage}%
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {totalScore.toFixed(1)} / {totalMaxScore}
                            </p>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-2">
                              <div
                                className={cn(
                                  "h-2 rounded-full transition-all",
                                  successColor === "green"
                                    ? "bg-green-500"
                                    : successColor === "amber"
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                                )}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Soru bazlı puanlar (her sorudan kaç puan alındığı) */}
                        {(() => {
                          const examIdStr = typeof result.examId === "object" && result.examId?._id ? result.examId._id : result.examId;
                          const qScores = examIdStr ? questionScoresByExamId[examIdStr] : undefined;
                          if (!qScores?.length) return null;
                          return (
                            <div className="border-t border-brand-navy/10 dark:border-slate-700/50 pt-3 mt-3">
                              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Soru bazlı puanlar</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                {qScores.map((q) => (
                                  <span key={q.questionNumber} className="text-slate-700 dark:text-slate-300">
                                    Soru {q.questionNumber}: <strong>{Number(q.scoreValue ?? 0).toFixed(1)}</strong> / {q.maxScore}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        {result.outcomePerformance && Object.keys(result.outcomePerformance).length > 0 && (
                          <div className="border-t border-brand-navy/10 dark:border-slate-700/50 pt-3">
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Öğrenme Çıktısı Performansı:</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(result.outcomePerformance).map(([loCode, success]: [string, any]) => {
                                const passThreshold = exam?.passingScore != null ? Number(exam.passingScore) : 60;
                                const loColor = success >= passThreshold ? "green" : success >= (passThreshold - 20) ? "amber" : "red";
                                return (
                                  <div
                                    key={loCode}
                                    className={cn(
                                      "text-center border rounded-lg px-3 py-1.5 transition-all",
                                      loColor === "green"
                                        ? "bg-green-50 dark:bg-green-900/10 border-green-500/30"
                                        : loColor === "amber"
                                        ? "bg-amber-50 dark:bg-amber-900/10 border-amber-500/30"
                                        : "bg-red-50 dark:bg-red-900/10 border-red-500/30"
                                    )}
                                  >
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      {loCode}
                                    </p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">
                                      {typeof success === 'number' ? success.toFixed(1) : success}%
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <StudentExamScoreTable scores={scores} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Course Selection for Achievements - Şimdilik yorum satırında */}
        {/* {courses.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                  <Target className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">ÖÇ ve PÇ Başarıları</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Öğrenme Çıktısı ve Program Çıktısı başarılarını görüntülemek için bir ders seçin
                  </p>
                </div>
              </div>
            </div>
            <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-2">
                  <Label htmlFor="course-select" className="text-sm font-medium text-brand-navy dark:text-slate-200">
                    Ders Seçimi
                  </Label>
                  <Select
                    id="course-select"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="h-10 sm:h-11 text-sm border-brand-navy/20 focus:border-brand-navy/50"
                  >
                    <option value="">Bir ders seçin</option>
                    {courses.map((course) => (
                      <option key={course._id} value={course._id}>
                        {course.code} - {course.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        )} */}

        {/* LO Achievement - Şimdilik yorum satırında */}
        {/* {selectedCourseId && selectedCourseId.trim() !== "" && (
          <StudentLOAchievementCard
            achievements={loAchievements}
            courseName={selectedCourse?.name}
          />
        )} */}

        {/* PO Achievement - Şimdilik yorum satırında */}
        {/* {selectedCourseId && selectedCourseId.trim() !== "" && (
          <StudentPOAchievementCard
            achievements={poAchievements}
            courseName={selectedCourse?.name}
          />
        )} */}
      </div>
    </div>
  );
}

export default function StudentDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
      </div>
    }>
      <StudentDetailContent />
    </Suspense>
  );
}
