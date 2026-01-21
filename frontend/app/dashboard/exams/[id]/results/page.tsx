"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { examApi, type ExamAnalysisResponse, type Exam } from "@/lib/api/examApi";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { studentExamResultApi } from "@/lib/api/studentExamResultApi";
import { Bar, BarChart, CartesianGrid, Legend, Radar, RadarChart, PolarGrid, PolarAngleAxis, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Download, Loader2, ArrowLeft, FileText, Users, TrendingUp, Target, GraduationCap, Search, Filter, X, CheckCircle2, AlertCircle, BarChart3, FileSpreadsheet } from "lucide-react";

type QuestionRow = ExamAnalysisResponse["questionAnalysis"][number];
type OutcomeRow = ExamAnalysisResponse["learningOutcomeAnalysis"][number];
type ProgramRow = ExamAnalysisResponse["programOutcomeAnalysis"][number];

interface StudentResult {
  _id: string;
  studentNumber: string;
  totalScore: number; // Genel puan (soru bazlı değil)
  maxScore: number;
  percentage: number;
  outcomePerformance: Record<string, number>;
  programOutcomePerformance: Record<string, number>;
  createdAt: string;
}

export default function ExamResultsPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  const [analysis, setAnalysis] = useState<ExamAnalysisResponse | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("students");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "fail">("all");

  useEffect(() => {
    if (examId) {
      load();
      loadResults();
      loadExam();
    }
  }, [examId]);

  const load = async () => {
    try {
      setIsLoading(true);
      const data = await examApi.getAnalysis(examId);
      setAnalysis(data);
    } catch (error: any) {
      toast.error("Sonuçlar yüklenemedi");
    } finally {
      setIsLoading(false);
    }
  };

  const loadResults = async () => {
    try {
      const results = await studentExamResultApi.getByExam(examId);
      // Convert StudentExamResult to StudentResult format
      const convertedResults: StudentResult[] = results.map((r) => ({
        _id: r._id,
        studentNumber: r.studentNumber,
        totalScore: r.totalScore,
        maxScore: r.maxScore,
        percentage: r.percentage,
        outcomePerformance: r.outcomePerformance,
        programOutcomePerformance: r.programOutcomePerformance,
        createdAt: r.createdAt,
      }));
      setStudentResults(convertedResults);
    } catch (error: any) {
      console.error("Öğrenci sonuçları yüklenemedi:", error);
    }
  };

  const loadExam = async () => {
    try {
      const examData = await examApi.getById(examId);
      setExam(examData);
      
      // Load course information
      if (examData.courseId) {
        const courseId = typeof examData.courseId === "object" && examData.courseId !== null
          ? examData.courseId._id
          : examData.courseId;
        if (courseId) {
          try {
            const courseData = await courseApi.getById(courseId);
            setCourse(courseData);
          } catch (error) {
            console.error("Ders bilgileri yüklenemedi:", error);
          }
        }
      }
    } catch (error: any) {
      console.error("Sınav bilgileri yüklenemedi:", error);
    }
  };

  // questionData kaldırıldı - artık soru bazlı analiz yok, genel puan kullanılıyor
  // const questionData = useMemo<QuestionRow[]>(() => analysis?.questionAnalysis || [], [analysis]);
  const outcomeData = useMemo<OutcomeRow[]>(() => analysis?.learningOutcomeAnalysis || [], [analysis]);
  const programData = useMemo<ProgramRow[]>(() => analysis?.programOutcomeAnalysis || [], [analysis]);

  // Statistics calculations
  const stats = useMemo(() => {
    if (!studentResults.length) {
      return {
        totalStudents: 0,
        averageScore: 0,
        successRate: 0,
        highestScore: 0,
        lowestScore: 0,
      };
    }

    // Calculate max total from exam data (genel puan sistemi)
    let maxTotal = 0;
    
    if (exam) {
      maxTotal = exam.maxScore || 0;
    }
    
    // Fallback: use maxScore from first student result if available
    if (maxTotal === 0 && studentResults.length > 0 && studentResults[0].maxScore > 0) {
      maxTotal = studentResults[0].maxScore;
    }
    
    const scores = studentResults.map((result) => {
      return { 
        totalScore: result.totalScore || 0, 
        percentage: result.percentage || (maxTotal > 0 ? (result.totalScore / maxTotal) * 100 : 0) 
      };
    });

    const totalScore = scores.reduce((sum, s) => sum + s.totalScore, 0);
    const averageScore = totalScore / scores.length;
    const averagePercentage = scores.reduce((sum, s) => sum + s.percentage, 0) / scores.length;
    const successCount = scores.filter((s) => s.percentage >= 50).length; // 50 puan eşiği
    const successRate = scores.length > 0 ? (successCount / scores.length) * 100 : 0;
    const highestScore = Math.max(...scores.map((s) => s.totalScore));
    const lowestScore = Math.min(...scores.map((s) => s.totalScore));

    return {
      totalStudents: studentResults.length,
      averageScore: Math.round(averageScore * 10) / 10,
      successRate: Math.round(successRate * 10) / 10,
      highestScore,
      lowestScore,
      averagePercentage: Math.round(averagePercentage * 10) / 10,
    };
  }, [studentResults, exam]);

  // Filtered student results
  const filteredStudentResults = useMemo(() => {
    let filtered = studentResults;

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter((result) =>
        result.studentNumber.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter (50 puan eşiği: >=50 yeşil, <50 kırmızı)
    if (filterStatus !== "all") {
      filtered = filtered.filter((result) => {
        const percentage = result.percentage || 0;
        if (filterStatus === "success") return percentage >= 50; // 50 ve üzeri yeşil
        if (filterStatus === "fail") return percentage < 50; // 50 altı kırmızı
        return true;
      });
    }

    return filtered;
  }, [studentResults, searchQuery, filterStatus, exam]);

  const handleExport = () => window.print();

  const hasActiveFilters = searchQuery.trim() !== "" || filterStatus !== "all";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Sınav sonuçları yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const examTypeLabel = exam?.examType === "midterm" ? "Vize" : exam?.examType === "final" ? "Final" : "";

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
                  onClick={() => router.back()}
                  className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 hover:bg-brand-navy/10"
                >
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-brand-navy dark:text-slate-200" />
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap mb-2">
                    <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                        <BarChart3 className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                      </div>
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-brand-navy dark:text-slate-100">
                        Sınav Sonuçları
                      </h1>
                    </div>
                    {exam && (
                      <>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs sm:text-sm",
                            exam.examType === "midterm"
                              ? "bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white border-brand-navy"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                          )}
                        >
                          {examTypeLabel}
                        </Badge>
                        <Badge variant="outline" className="text-xs sm:text-sm">
                          {exam.examCode}
                        </Badge>
                      </>
                    )}
                  </div>
                  <div className="ml-12 space-y-1">
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                      Soru → ÖÇ → PÇ başarı analizleri
                    </p>
                    {course && (
                      <p className="text-sm font-semibold text-brand-navy dark:text-slate-200">
                        Ders: {course.code} - {course.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleExport}
                  className="h-10 sm:h-11 px-4 sm:px-6 bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-[#0f3a6b] hover:to-brand-navy text-white shadow-md transition-all"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">PDF Oluştur</span>
                  <span className="sm:hidden">PDF</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <TrendingUp className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Ortalama Puan</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {stats.averageScore}
                </p>
              </div>
            </div>
          </Card>
          {/* Başarı Oranı kartı kaldırıldı */}
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">En Yüksek</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {stats.highestScore}
                </p>
              </div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                <TrendingUp className="h-6 w-6 text-amber-600 dark:text-amber-400 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">En Düşük</p>
                <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {stats.lowestScore}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
            <CardContent className="p-2">
              <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-slate-100/50 dark:bg-slate-800/50">
                <TabsTrigger 
                  value="students" 
                  className={cn(
                    "text-xs sm:text-sm md:text-base font-semibold py-3 px-4 rounded-lg transition-all",
                    activeTab === "students"
                      ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                      : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
                  )}
                >
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span>Öğrenci Sonuçları</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="questions" 
                  className={cn(
                    "text-xs sm:text-sm md:text-base font-semibold py-3 px-4 rounded-lg transition-all",
                    activeTab === "questions"
                      ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                      : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
                  )}
                >
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span>ÖÇ Analizi</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="outcomes" 
                  className={cn(
                    "text-xs sm:text-sm md:text-base font-semibold py-3 px-4 rounded-lg transition-all",
                    activeTab === "outcomes"
                      ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                      : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
                  )}
                >
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span>ÖÇ Analizi</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="programs" 
                  className={cn(
                    "text-xs sm:text-sm md:text-base font-semibold py-3 px-4 rounded-lg transition-all",
                    activeTab === "programs"
                      ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                      : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
                  )}
                >
                  <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span>PÇ Analizi</span>
                </TabsTrigger>
              </TabsList>
            </CardContent>
          </Card>

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-6">
            {/* Filter Section */}
            <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Öğrenci numarası ile ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-10 sm:h-11 border-brand-navy/20 focus:border-brand-navy/50"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={filterStatus === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterStatus("all")}
                      className={cn(
                        "h-10 sm:h-11",
                        filterStatus === "all"
                          ? "bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white"
                          : "hover:bg-brand-navy/10"
                      )}
                    >
                      Tümü
                    </Button>
                    <Button
                      variant={filterStatus === "success" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterStatus("success")}
                      className={cn(
                        "h-10 sm:h-11",
                        filterStatus === "success"
                          ? "bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white"
                          : "hover:bg-brand-navy/10"
                      )}
                    >
                      Başarılı (≥50%)
                    </Button>
                    <Button
                      variant={filterStatus === "fail" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterStatus("fail")}
                      className={cn(
                        "h-10 sm:h-11",
                        filterStatus === "fail"
                          ? "bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white"
                          : "hover:bg-brand-navy/10"
                      )}
                    >
                      Başarısız ({'<50%'})
                    </Button>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchQuery("");
                          setFilterStatus("all");
                        }}
                        className="h-10 sm:h-11 text-slate-600 hover:text-slate-900"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Temizle
                      </Button>
                    )}
                  </div>
                </div>
                {hasActiveFilters && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {searchQuery && (
                      <Badge variant="outline" className="bg-brand-navy/10 text-brand-navy border-brand-navy/30">
                        Arama: {searchQuery}
                      </Badge>
                    )}
                    {filterStatus !== "all" && (
                      <Badge variant="outline" className="bg-brand-navy/10 text-brand-navy border-brand-navy/30">
                        Filtre: {filterStatus === "success" ? "Başarılı (≥50)" : "Başarısız (<50)"}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Student Results Table */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                    <Users className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Öğrenci Sonuçları</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {filteredStudentResults.length} öğrenci gösteriliyor
                    </p>
                  </div>
                </div>
              </div>

              <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
                <CardContent className="p-0">
                  {filteredStudentResults.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                      <p className="text-lg font-medium">Sonuç bulunamadı</p>
                      <p className="text-sm mt-2">
                        {hasActiveFilters ? "Filtreleri temizleyip tekrar deneyin" : "Henüz sonuç kaydı yok"}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-brand-navy hover:to-[#0f3a6b]">
                            <TableHead className="sticky left-0 z-20 bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white min-w-[100px] sm:min-w-[120px]">
                              <span className="text-xs sm:text-sm font-semibold">Öğrenci No</span>
                            </TableHead>
                            <TableHead className="text-center text-white min-w-[100px] sm:min-w-[120px]">
                              <span className="text-xs sm:text-sm font-semibold">Genel Puan</span>
                            </TableHead>
                            <TableHead className="text-center text-white min-w-[80px] sm:min-w-[100px]">
                              <span className="text-xs sm:text-sm font-semibold">Yüzde</span>
                            </TableHead>
                            <TableHead className="text-center text-white min-w-[80px] sm:min-w-[100px]">
                              <span className="text-xs sm:text-sm font-semibold">Durum</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredStudentResults.map((result) => {
                            const totalScore = result.totalScore || 0;
                            const maxTotal = result.maxScore || exam?.maxScore || 0;
                            const percentage = result.percentage || (maxTotal > 0 ? Math.round((totalScore / maxTotal) * 100) : 0);

                            return (
                              <TableRow key={result._id} className="hover:bg-brand-navy/5 dark:hover:bg-slate-800/50 transition-colors">
                                <TableCell className="font-medium sticky left-0 z-20 bg-white dark:bg-slate-900 text-xs sm:text-sm border-r border-brand-navy/10">
                                  {result.studentNumber}
                                </TableCell>
                                <TableCell className="text-center font-semibold p-2 sm:p-4">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-sm sm:text-base text-brand-navy dark:text-slate-100 font-bold">{totalScore}</span>
                                    <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">/{maxTotal}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center p-2 sm:p-4">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs sm:text-sm font-semibold",
                                      percentage >= 50
                                        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-500/30"
                                        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-500/30"
                                    )}
                                  >
                                    %{percentage}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center p-2 sm:p-4">
                                  <Badge
                                    variant={percentage >= 50 ? "default" : "destructive"}
                                    className={cn(
                                      "text-xs sm:text-sm",
                                      percentage >= 50
                                        ? "bg-green-600 hover:bg-green-700"
                                        : "bg-red-600 hover:bg-red-700"
                                    )}
                                  >
                                    {percentage >= 50 ? "Başarılı" : "Başarısız"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                    <FileText className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Öğrenme Çıktıları (ÖÇ) Analizi</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Sınav bazlı öğrenme çıktıları başarı analizi</p>
                  </div>
                </div>
              </div>

              <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-brand-navy hover:to-[#0f3a6b]">
                          <TableHead className="text-white">ÖÇ Kodu</TableHead>
                          <TableHead className="text-white">Açıklama</TableHead>
                          <TableHead className="text-white text-center">Başarı %</TableHead>
                          <TableHead className="text-white text-center">Öğrenci Sayısı</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outcomeData.map((outcome) => {
                          const successColor = outcome.success >= 50 ? "green" : "red"; // 50 puan eşiği
                          return (
                            <TableRow key={outcome.code} className="hover:bg-brand-navy/5 dark:hover:bg-slate-800/50 transition-colors">
                              <TableCell className="font-semibold text-brand-navy dark:text-slate-100">
                                {outcome.code}
                              </TableCell>
                              <TableCell className="text-slate-700 dark:text-slate-300">
                                {outcome.description || "-"}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      successColor === "green"
                                        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-500/30"
                                        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-500/30"
                                    )}
                                  >
                                    %{outcome.success.toFixed(1)}
                                  </Badge>
                                  <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                    <div
                                      className={cn(
                                        "h-2 rounded-full transition-all",
                                        successColor === "green"
                                          ? "bg-green-500"
                                          : "bg-red-500"
                                      )}
                                      style={{ width: `${Math.min(outcome.success, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-slate-600 dark:text-slate-400">
                                {studentResults.length}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {outcomeData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Henüz öğrenme çıktısı analizi yok
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Outcomes Tab */}
          <TabsContent value="outcomes" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                    <Target className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">ÖÇ Başarı Analizi</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Öğrenme çıktılarına göre başarı analizi</p>
                  </div>
                </div>
              </div>

              <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
                <CardContent className="p-4 sm:p-6 h-64 sm:h-72">
                  {outcomeData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                        <p className="text-lg font-medium">ÖÇ verisi yok</p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={outcomeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="code" stroke="#64748b" />
                        <YAxis domain={[0, 100]} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(255, 255, 255, 0.95)",
                            border: "1px solid #0a294e",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="success" name="Başarı %" fill="#0a294e" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Outcome Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {outcomeData.map((outcome) => {
                  const successColor = outcome.success >= 60 ? "green" : outcome.success >= 40 ? "amber" : "red";
                  return (
                    <Card
                      key={outcome.code}
                      className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern hover:border-brand-navy/50 hover:shadow-lg transition-all"
                    >
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline" className="bg-brand-navy/10 text-brand-navy border-brand-navy/30">
                            {outcome.code}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              successColor === "green"
                                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-500/30"
                                : successColor === "amber"
                                ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-500/30"
                            )}
                          >
                            {outcome.success}%
                          </Badge>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                          <div
                            className={cn(
                              "h-2 rounded-full transition-all",
                              successColor === "green"
                                ? "bg-green-500"
                                : successColor === "amber"
                                ? "bg-amber-500"
                                : "bg-red-500"
                            )}
                            style={{ width: `${outcome.success}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* Programs Tab */}
          <TabsContent value="programs" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                    <GraduationCap className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">PÇ Başarı Analizi</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Program çıktılarına göre başarı analizi</p>
                  </div>
                </div>
              </div>

              <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
                <CardContent className="p-4 sm:p-6 h-64 sm:h-72">
                  {programData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                        <p className="text-lg font-medium">PÇ verisi yok</p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={programData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="code" stroke="#64748b" />
                        <Radar
                          name="Başarı %"
                          dataKey="success"
                          stroke="#0a294e"
                          fill="#0a294e"
                          fillOpacity={0.4}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(255, 255, 255, 0.95)",
                            border: "1px solid #0a294e",
                            borderRadius: "8px",
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Program Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {programData.map((program) => {
                  const successColor = program.success >= 50 ? "green" : "red"; // 50 puan eşiği
                  return (
                    <Card
                      key={program.code}
                      className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern hover:border-brand-navy/50 hover:shadow-lg transition-all"
                    >
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline" className="bg-brand-navy/10 text-brand-navy border-brand-navy/30">
                            {program.code}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              successColor === "green"
                                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-500/30"
                                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-500/30"
                            )}
                          >
                            {program.success}%
                          </Badge>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                          <div
                            className={cn(
                              "h-2 rounded-full transition-all",
                              successColor === "green"
                                ? "bg-green-500"
                                : "bg-red-500"
                            )}
                            style={{ width: `${program.success}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
