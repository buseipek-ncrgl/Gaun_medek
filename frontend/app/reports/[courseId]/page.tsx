"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  Users,
  FileText,
  Target,
  TrendingUp,
  BarChart3,
  GraduationCap,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LOAchievementTable } from "@/components/reports/LOAchievementTable";
import { POAchievementTable } from "@/components/reports/POAchievementTable";
import { LOProgressCard } from "@/components/reports/LOProgressCard";
import { POProgressCard } from "@/components/reports/POProgressCard";
import { StudentComparisonChart } from "@/components/reports/StudentComparisonChart";
import { HeatmapChart } from "@/components/reports/HeatmapChart";
import { LOAchievementBarChart } from "@/components/reports/LOAchievementBarChart";
import { POAchievementBarChart } from "@/components/reports/POAchievementBarChart";
import { CourseSummaryCard } from "@/components/reports/CourseSummaryCard";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { examApi, type Exam } from "@/lib/api/examApi";
import { studentApi, type Student } from "@/lib/api/studentApi";
import {
  getLOAchievement,
  getPOAchievement,
  getStudentAchievements,
  type LOAchievement,
  type POAchievement,
} from "@/lib/api/assessmentApi";
import { type LOAchievement as ScoreLOAchievement } from "@/lib/api/scoreApi";

export default function CourseReportPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loAchievements, setLOAchievements] = useState<LOAchievement[]>([]);
  const [poAchievements, setPOAchievements] = useState<POAchievement[]>([]);
  const [studentAchievements, setStudentAchievements] = useState<Record<string, Record<string, number>>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (courseId) {
      fetchReportData();
    }
  }, [courseId]);

  const fetchReportData = async () => {
    try {
      setIsLoading(true);

      // Fetch basic course data
      const [courseData, examsData] = await Promise.all([
        courseApi.getById(courseId),
        examApi.getByCourse(courseId),
      ]);

      setCourse(courseData);
      setExams(examsData);

      // Get students from course (embedded in course model)
      const courseStudents = courseData.students || [];
      const studentNumbers = courseStudents.map((s) => s.studentNumber);
      const allStudents = await studentApi.getAll();
      const relevantStudents = allStudents.filter((s) =>
        studentNumbers.includes(s.studentNumber)
      );
      setStudents(relevantStudents);

      // Fetch aggregated achievements using new assessment API
      const [loData, poData, studentAchievementsData] = await Promise.all([
        getLOAchievement(courseId),
        getPOAchievement(courseId),
        getStudentAchievements(courseId),
      ]);

      console.log('📊 ÖÇ Başarı Verileri:', loData);
      console.log('📈 PÇ Başarı Verileri:', poData);
      console.log('📚 Course Learning Outcomes (Raw):', courseData.learningOutcomes);
      console.log('📚 Course Learning Outcomes (with PÇ mappings):', courseData.learningOutcomes?.map(lo => ({
        code: lo.code,
        description: lo.description,
        programOutcomes: lo.programOutcomes || lo.relatedProgramOutcomes || [],
        hasProgramOutcomes: !!(lo.programOutcomes || lo.relatedProgramOutcomes)
      })));
      
      // ÖÇ başarı verilerindeki PÇ eşleştirmelerini kontrol et
      loData.forEach(lo => {
        const relatedPOs = (lo as any).relatedProgramOutcomes || [];
        console.log(`🔍 ÖÇ ${lo.code} -> PÇ'ler:`, relatedPOs, relatedPOs.length > 0 ? '✅' : '❌ BOŞ');
      });

      setLOAchievements(loData);
      setPOAchievements(poData);
      setStudentAchievements(studentAchievementsData);
      
      console.log('📊 Öğrenci Başarı Matrisi:', studentAchievementsData);
      console.log('📊 Öğrenci Başarı Matrisi - Öğrenci sayısı:', Object.keys(studentAchievementsData).length);
      if (Object.keys(studentAchievementsData).length > 0) {
        const firstStudent = Object.keys(studentAchievementsData)[0];
        console.log(`📊 Öğrenci Başarı Matrisi - İlk öğrenci (${firstStudent}):`, studentAchievementsData[firstStudent]);
      }
    } catch (error: any) {
      toast.error("Rapor verileri yüklenemedi");
      console.error(error);
      router.push("/reports");
    } finally {
      setIsLoading(false);
    }
  };

  // Convert student achievements from studentNumber-based to studentId-based format
  const convertStudentAchievements = (
    achievements: Record<string, Record<string, number>>,
    students: Student[],
    learningOutcomes: any[]
  ): Record<string, ScoreLOAchievement[]> => {
    const result: Record<string, ScoreLOAchievement[]> = {};
    
    students.forEach((student) => {
      const studentAchievements = achievements[student.studentNumber] || {};
      result[student._id] = learningOutcomes.map((lo) => ({
        learningOutcome: {
          _id: lo.code || lo._id || "",
          code: lo.code || "",
          description: lo.description || "",
        },
        achievedPercentage: studentAchievements[lo.code] || 0,
        totalScoreEarned: 0, // Not needed for display
        totalMaxScore: 0, // Not needed for display
      }));
    });
    
    return result;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#0a294e] mx-auto mb-4" />
              <p className="text-muted-foreground">Rapor verileri yükleniyor...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return null;
  }

  const department = typeof course.department === 'object' && course.department !== null
    ? course.department.name
    : course.department || "Bilinmiyor";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/reports")}
                className="px-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Geri
              </Button>
              <div className="p-2 bg-[#0a294e] rounded-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  {course.code} - {course.name}
                </h1>
                <p className="text-muted-foreground text-base mt-1">
                  MÜDEK Akreditasyon Raporu
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/reports")}
              className="h-11 px-6"
            >
              Raporlara Dön
            </Button>
          </div>
        </div>

      {/* Course Summary Card */}
      <CourseSummaryCard
        loAchievements={loAchievements}
        poAchievements={poAchievements}
        course={course}
      />

      {/* Course Info Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2 border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Ders Kodu</p>
                <p className="text-2xl font-bold text-slate-900">{course.code}</p>
                <p className="text-sm text-muted-foreground mt-1">{course.name}</p>
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
                <p className="text-sm font-medium text-muted-foreground mb-1">Öğrenciler</p>
                <p className="text-2xl font-bold text-slate-900">{students.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Kayıtlı öğrenciler</p>
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
                <p className="text-sm font-medium text-muted-foreground mb-1">Sınavlar</p>
                <p className="text-2xl font-bold text-slate-900">{exams.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Toplam sınav</p>
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
                <p className="text-sm font-medium text-muted-foreground mb-1">Öğrenme Çıktıları</p>
                <p className="text-2xl font-bold text-slate-900">{course.learningOutcomes?.length || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Toplam ÖÇ</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-lg">
                <Target className="h-6 w-6 text-slate-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LO Achievement Bar Chart */}
      {loAchievements.length > 0 && (
        <LOAchievementBarChart achievements={loAchievements} />
      )}

      {/* LO Achievement Table */}
      <Card className="rounded-xl shadow-sm border-2 border-slate-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
          <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
            <TrendingUp className="h-5 w-5 text-[#0a294e]" />
            Öğrenme Çıktıları (ÖÇ) Başarı Detayları
          </CardTitle>
          <CardDescription className="text-sm">
            Her öğrenme çıktısı için tüm öğrenciler üzerinden ortalama başarı yüzdeleri
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {loAchievements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-medium">Henüz öğrenme çıktısı başarı verisi yok</p>
              <p className="text-sm mt-2">Sınav puanları eklendikten sonra burada görünecektir</p>
            </div>
          ) : (
            <LOAchievementTable achievements={loAchievements} />
          )}
        </CardContent>
      </Card>

      {/* LO Progress Cards */}
      {loAchievements.length > 0 && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>ÖÇ Başarı Özeti</CardTitle>
            <CardDescription>Öğrenme çıktıları başarılarının görsel gösterimi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loAchievements.map((achievement) => (
                <LOProgressCard key={achievement.code} achievement={achievement} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PO Achievement Bar Chart */}
      {poAchievements.length > 0 && (
        <POAchievementBarChart achievements={poAchievements} />
      )}

      {/* PO Achievement Table */}
      <Card className="rounded-xl shadow-sm border-2 border-slate-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
          <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
            <BarChart3 className="h-5 w-5 text-[#0a294e]" />
            Program Çıktıları (PÇ) Başarı Detayları
          </CardTitle>
          <CardDescription className="text-sm">
            Her program çıktısı için ortalama başarı yüzdeleri
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {poAchievements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-medium">Henüz program çıktısı başarı verisi yok</p>
              <p className="text-sm mt-2">Öğrenme çıktıları ve sınav puanları eklendikten sonra burada görünecektir</p>
            </div>
          ) : (
            <POAchievementTable achievements={poAchievements} />
          )}
        </CardContent>
      </Card>

      {/* PO Progress Cards */}
      {poAchievements.length > 0 && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>PÇ Başarı Özeti</CardTitle>
            <CardDescription>Program çıktıları başarılarının görsel gösterimi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {poAchievements.map((achievement) => (
                <POProgressCard key={achievement.code} achievement={achievement} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student Comparison Chart */}
      {students.length > 0 && loAchievements.length > 0 && course.learningOutcomes && (
        <StudentComparisonChart
          students={students}
          studentAchievements={convertStudentAchievements(studentAchievements, students, course.learningOutcomes)}
        />
      )}

      {/* Heatmap Chart */}
      {students.length > 0 && course.learningOutcomes && course.learningOutcomes.length > 0 && (
        <HeatmapChart
          students={students}
          learningOutcomes={course.learningOutcomes.map((lo) => ({
            _id: lo.code,
            code: lo.code,
          }))}
          studentAchievements={convertStudentAchievements(studentAchievements, students, course.learningOutcomes)}
        />
      )}
      </div>
    </div>
  );
}

