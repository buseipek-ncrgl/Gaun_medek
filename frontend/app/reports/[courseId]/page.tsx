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
  Download,
  Printer,
  Home,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  const [activeTab, setActiveTab] = useState("overview");

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="p-4 rounded-full bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 w-fit mx-auto mb-4">
                <Loader2 className="h-8 w-8 animate-spin text-brand-navy dark:text-slate-200" />
              </div>
              <p className="text-brand-navy/70 dark:text-slate-400">Rapor verileri yükleniyor...</p>
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

  // Calculate statistics
  const avgLOAchievement = loAchievements.length > 0
    ? loAchievements.reduce((sum, lo) => sum + lo.achievedPercentage, 0) / loAchievements.length
    : 0;
  const avgPOAchievement = poAchievements.length > 0
    ? poAchievements.reduce((sum, po) => sum + po.achievedPercentage, 0) / poAchievements.length
    : 0;
  const loAboveThreshold = loAchievements.filter(lo => lo.achievedPercentage >= 60).length;
  const poAboveThreshold = poAchievements.filter(po => po.achievedPercentage >= 60).length;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    toast.info("PDF export özelliği yakında eklenecek");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/reports")}
            className="h-7 px-2 text-xs hover:text-brand-navy"
          >
            <Home className="h-3 w-3 mr-1" />
            Raporlar
          </Button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-brand-navy dark:text-slate-200 font-medium">{course.code}</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
              <BarChart3 className="h-5 w-5 text-brand-navy dark:text-slate-200" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100 truncate">
                {course.code} - {course.name}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                MEDEK Akreditasyon Raporu
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="h-9 px-3 text-sm border-brand-navy/20 hover:border-brand-navy/50"
            >
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-9 px-3 text-sm border-brand-navy/20 hover:border-brand-navy/50"
            >
              <Printer className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Yazdır</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/reports")}
              className="h-9 px-3 text-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Geri</span>
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <Users className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Öğrenciler</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {students.length}
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
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Sınavlar</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {exams.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <Target className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Öğrenme Çıktıları</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {course.learningOutcomes?.length || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <TrendingUp className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Ortalama Başarı</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {avgLOAchievement.toFixed(1)}%
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Course Summary Card */}
        <CourseSummaryCard
          loAchievements={loAchievements}
          poAchievements={poAchievements}
          course={course}
        />

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg">
            <TabsTrigger
              value="overview"
              className={`${
                activeTab === "overview"
                  ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                  : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
              } transition-all`}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Genel Bakış</span>
              <span className="sm:hidden">Genel</span>
            </TabsTrigger>
            <TabsTrigger
              value="lo"
              className={`${
                activeTab === "lo"
                  ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                  : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
              } transition-all`}
            >
              <Target className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">ÖÇ Analizi</span>
              <span className="sm:hidden">ÖÇ</span>
            </TabsTrigger>
            <TabsTrigger
              value="po"
              className={`${
                activeTab === "po"
                  ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                  : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
              } transition-all`}
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">PÇ Analizi</span>
              <span className="sm:hidden">PÇ</span>
            </TabsTrigger>
            <TabsTrigger
              value="students"
              className={`${
                activeTab === "students"
                  ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                  : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
              } transition-all`}
            >
              <Users className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Öğrenci Karşılaştırması</span>
              <span className="sm:hidden">Öğrenci</span>
            </TabsTrigger>
            <TabsTrigger
              value="heatmap"
              className={`${
                activeTab === "heatmap"
                  ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                  : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
              } transition-all`}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Heatmap</span>
              <span className="sm:hidden">Map</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-4">
            {/* Course Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-xl">
                    <BookOpen className="h-6 w-6 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 uppercase tracking-wide mb-1">Ders Kodu</p>
                    <p className="text-lg font-bold text-brand-navy dark:text-slate-100 truncate">{course.code}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-1">{course.name}</p>
                  </div>
                </div>
              </Card>

              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-xl">
                    <Target className="h-6 w-6 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 uppercase tracking-wide mb-1">Başarılı ÖÇ</p>
                    <p className="text-lg font-bold text-brand-navy dark:text-slate-100">
                      {loAboveThreshold} / {loAchievements.length}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">≥60% eşiği</p>
                  </div>
                </div>
              </Card>

              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-xl">
                    <GraduationCap className="h-6 w-6 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 uppercase tracking-wide mb-1">Başarılı PÇ</p>
                    <p className="text-lg font-bold text-brand-navy dark:text-slate-100">
                      {poAboveThreshold} / {poAchievements.length}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">≥60% eşiği</p>
                  </div>
                </div>
              </Card>

              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 uppercase tracking-wide mb-1">PÇ Ortalama</p>
                    <p className="text-lg font-bold text-brand-navy dark:text-slate-100">
                      {avgPOAchievement.toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Ortalama başarı</p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* LO Analysis Tab */}
          <TabsContent value="lo" className="space-y-4 sm:space-y-6 mt-4">
            {/* LO Achievement Bar Chart */}
            {loAchievements.length > 0 && (
              <LOAchievementBarChart achievements={loAchievements} />
            )}

            {/* LO Achievement Table */}
            <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern rounded-xl">
              <CardHeader className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white rounded-t-xl">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <TrendingUp className="h-5 w-5" />
                  Öğrenme Çıktıları (ÖÇ) Başarı Detayları
                </CardTitle>
                <CardDescription className="text-white/80 text-sm">
                  Her öğrenme çıktısı için tüm öğrenciler üzerinden ortalama başarı yüzdeleri
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {loAchievements.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="p-4 rounded-full bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 w-fit mx-auto mb-4">
                      <Target className="h-8 w-8 text-brand-navy/60 dark:text-slate-400" />
                    </div>
                    <p className="text-lg font-semibold text-brand-navy dark:text-slate-100">Henüz öğrenme çıktısı başarı verisi yok</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Sınav puanları eklendikten sonra burada görünecektir</p>
                  </div>
                ) : (
                  <LOAchievementTable achievements={loAchievements} />
                )}
              </CardContent>
            </Card>

            {/* LO Progress Cards */}
            {loAchievements.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                      <Target className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">ÖÇ Başarı Özeti</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Öğrenme çıktıları başarılarının görsel gösterimi</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {loAchievements.map((achievement) => (
                    <LOProgressCard key={achievement.code} achievement={achievement} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* PO Analysis Tab */}
          <TabsContent value="po" className="space-y-4 sm:space-y-6 mt-4">
            {/* PO Achievement Bar Chart */}
            {poAchievements.length > 0 && (
              <POAchievementBarChart achievements={poAchievements} />
            )}

            {/* PO Achievement Table */}
            <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern rounded-xl">
              <CardHeader className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white rounded-t-xl">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BarChart3 className="h-5 w-5" />
                  Program Çıktıları (PÇ) Başarı Detayları
                </CardTitle>
                <CardDescription className="text-white/80 text-sm">
                  Her program çıktısı için ortalama başarı yüzdeleri
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {poAchievements.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="p-4 rounded-full bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 w-fit mx-auto mb-4">
                      <GraduationCap className="h-8 w-8 text-brand-navy/60 dark:text-slate-400" />
                    </div>
                    <p className="text-lg font-semibold text-brand-navy dark:text-slate-100">Henüz program çıktısı başarı verisi yok</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Öğrenme çıktıları ve sınav puanları eklendikten sonra burada görünecektir</p>
                  </div>
                ) : (
                  <POAchievementTable achievements={poAchievements} />
                )}
              </CardContent>
            </Card>

            {/* PO Progress Cards */}
            {poAchievements.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                      <GraduationCap className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">PÇ Başarı Özeti</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Program çıktıları başarılarının görsel gösterimi</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {poAchievements.map((achievement) => (
                    <POProgressCard key={achievement.code} achievement={achievement} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Student Comparison Tab */}
          <TabsContent value="students" className="space-y-4 sm:space-y-6 mt-4">
            {students.length > 0 && loAchievements.length > 0 && course.learningOutcomes ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                      <Users className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Öğrenci Karşılaştırması</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Öğrencilerin ÖÇ başarılarının karşılaştırmalı analizi</p>
                    </div>
                  </div>
                </div>
                <StudentComparisonChart
                  students={students}
                  studentAchievements={convertStudentAchievements(studentAchievements, students, course.learningOutcomes)}
                />
              </div>
            ) : (
              <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern rounded-xl">
                <CardContent className="p-12 text-center">
                  <div className="p-4 rounded-full bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 w-fit mx-auto mb-4">
                    <Users className="h-8 w-8 text-brand-navy/60 dark:text-slate-400" />
                  </div>
                  <p className="text-lg font-semibold text-brand-navy dark:text-slate-100">Öğrenci karşılaştırma verisi yok</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Öğrenci ve sınav verileri eklendikten sonra burada görünecektir</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Heatmap Tab */}
          <TabsContent value="heatmap" className="space-y-4 sm:space-y-6 mt-4">
            {students.length > 0 && course.learningOutcomes && course.learningOutcomes.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                      <BarChart3 className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Öğrenci-ÖÇ Başarı Heatmap</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Öğrencilerin ÖÇ başarılarının görsel haritası</p>
                    </div>
                  </div>
                </div>
                <HeatmapChart
                  students={students}
                  learningOutcomes={course.learningOutcomes.map((lo) => ({
                    _id: lo.code,
                    code: lo.code,
                  }))}
                  studentAchievements={convertStudentAchievements(studentAchievements, students, course.learningOutcomes)}
                />
              </div>
            ) : (
              <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern rounded-xl">
                <CardContent className="p-12 text-center">
                  <div className="p-4 rounded-full bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 w-fit mx-auto mb-4">
                    <BarChart3 className="h-8 w-8 text-brand-navy/60 dark:text-slate-400" />
                  </div>
                  <p className="text-lg font-semibold text-brand-navy dark:text-slate-100">Heatmap verisi yok</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Öğrenci ve ÖÇ verileri eklendikten sonra burada görünecektir</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}

