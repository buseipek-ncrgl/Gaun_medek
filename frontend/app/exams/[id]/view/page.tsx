"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { examApi, type Exam } from "@/lib/api/examApi";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { toast } from "sonner";
import { ArrowLeft, FileText, Upload, Edit, Target, ListOrdered, Loader2, CheckCircle2, AlertCircle, Info, Award, FileSpreadsheet } from "lucide-react";

export default function ExamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;
  const [exam, setExam] = useState<Exam | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (examId) {
      loadData();
    }
  }, [examId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const examData = await examApi.getById(examId);
      setExam(examData);

      const courseId =
        typeof examData.courseId === "object" && examData.courseId !== null
          ? examData.courseId._id
          : examData.courseId;
      if (courseId) {
        const courseData = await courseApi.getById(courseId);
        setCourse(courseData);
      }
    } catch (error: any) {
      toast.error("Sınav detayları yüklenemedi");
      router.push("/exams");
    } finally {
      setIsLoading(false);
    }
  };

  // All hooks must be called before any early returns
  const examTypeLabel = exam?.examType === "midterm" ? "Vize" : "Final";
  // Sınav bazlı ÖÇ eşleme kontrolü
  const mappedLOs = exam?.learningOutcomes || [];
  const totalMaxScore = exam?.maxScore ?? 100;

  // Soru sayısı: önce exam'dan (questionCount veya questions.length), yoksa course'dan
  const questionCount = useMemo(() => {
    if (!exam) return 0;
    const fromExam = exam.questionCount ?? (Array.isArray(exam.questions) ? exam.questions.length : 0);
    if (fromExam > 0) return fromExam;
    if (!course) return 0;
    if (exam.examType === "midterm") {
      return course.midtermExam?.questionCount || 0;
    }
    return course.finalExam?.questionCount || 0;
  }, [course, exam]);

  // Get questions from exam (if available) or create placeholder questions
  const questions = useMemo(() => {
    if (!exam) return [];
    if (exam.questions && Array.isArray(exam.questions) && exam.questions.length > 0) {
      return exam.questions;
    }
    // If no questions in exam, create placeholder array based on questionCount
    return Array.from({ length: questionCount }, (_, i) => ({
      questionNumber: i + 1,
      learningOutcomeCode: mappedLOs[i] || "",
    }));
  }, [exam, questionCount, mappedLOs]);

  // Calculate mapped and unmapped questions
  const mappedQuestions = useMemo(() => {
    return questions.filter((q: any) => {
      const loCode = q.learningOutcomeCode || "";
      return loCode.trim() !== "";
    });
  }, [questions]);

  const unmappedQuestions = useMemo(() => {
    return questions.filter((q: any) => {
      const loCode = q.learningOutcomeCode || "";
      return loCode.trim() === "";
    });
  }, [questions]);

  const mappingPercentage = useMemo(() => {
    if (questionCount === 0) return 0;
    return Math.round((mappedQuestions.length / questionCount) * 100);
  }, [mappedQuestions.length, questionCount]);

  // ÖÇ kodu -> açıklama (course.learningOutcomes)
  const loDescriptionByCode = useMemo(() => {
    const map: Record<string, string> = {};
    const los = course?.learningOutcomes;
    if (Array.isArray(los)) {
      los.forEach((lo: { code?: string; description?: string }) => {
        if (lo?.code) map[lo.code] = lo.description || "";
      });
    }
    return map;
  }, [course?.learningOutcomes]);

  // Soru başına max puan: course'dan veya totalMaxScore/questionCount
  const maxScorePerQuestionDisplay = useMemo(() => {
    const fromCourse = course && exam?.examType === "midterm"
      ? course.midtermExam?.maxScorePerQuestion
      : course && exam?.examType === "final"
      ? course.finalExam?.maxScorePerQuestion
      : undefined;
    if (fromCourse != null && fromCourse > 0) return String(fromCourse);
    if (questionCount > 0 && totalMaxScore > 0) return (totalMaxScore / questionCount).toFixed(1);
    return totalMaxScore > 0 ? String(totalMaxScore) : "-";
  }, [course, exam?.examType, questionCount, totalMaxScore]);

  // Early returns after all hooks
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Sınav bilgileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!exam) return null;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 px-3 py-4 sm:px-4 sm:py-6 md:px-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full min-w-0 space-y-4 sm:space-y-6">
        {/* Header */}
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern overflow-hidden">
          <CardContent className="p-3 sm:p-6">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex items-start sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push("/exams")}
                  className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 hover:bg-brand-navy/10"
                >
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-brand-navy dark:text-slate-200" />
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1 sm:mb-2">
                    <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-brand-navy dark:text-slate-100 break-words">
                      {exam.examCode}
                    </h1>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs sm:text-sm flex-shrink-0",
                        exam.examType === "midterm"
                          ? "bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white border-brand-navy"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      )}
                    >
                      {examTypeLabel}
                    </Badge>
                  </div>
                  {course && (
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
                      {course.code} - {course.name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => router.push(`/exams/${examId}`)}
                  className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm hover:bg-brand-navy/10 hover:border-brand-navy/50 transition-all"
                >
                  <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Düzenle
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/dashboard/exams/${examId}/upload`)}
                  className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm hover:bg-brand-navy/10 hover:border-brand-navy/50 transition-all"
                >
                  <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">Tek PDF</span>
                  <span className="sm:hidden">PDF</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/dashboard/exams/${examId}/batch-upload`)}
                  className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm hover:bg-brand-navy/10 hover:border-brand-navy/50 transition-all"
                >
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  <span className="hidden md:inline">Toplu Yükleme</span>
                  <span className="md:hidden">Toplu</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/dashboard/exams/${examId}/results`)}
                  className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm hover:bg-brand-navy/10 hover:border-brand-navy/50 transition-all"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  <span className="hidden md:inline">OBS Excel</span>
                  <span className="md:hidden">OBS</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern overflow-hidden">
            <CardContent className="p-1.5 sm:p-2">
              <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-slate-100/50 dark:bg-slate-800/50">
                <TabsTrigger 
                  value="overview" 
                  className={cn(
                    "text-xs sm:text-sm font-semibold py-2.5 sm:py-3 px-2 sm:px-4 rounded-lg transition-all min-w-0",
                    activeTab === "overview"
                      ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                      : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
                  )}
                >
                  <FileText className="h-4 w-4 mr-1.5 sm:mr-2 flex-shrink-0" />
                  <span className="truncate">Genel Bakış</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="questions" 
                  className={cn(
                    "text-xs sm:text-sm font-semibold py-2.5 sm:py-3 px-2 sm:px-4 rounded-lg transition-all min-w-0",
                    activeTab === "questions"
                      ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                      : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
                  )}
                >
                  <ListOrdered className="h-4 w-4 mr-1.5 sm:mr-2 flex-shrink-0" />
                  <span className="truncate">Sorular</span>
                </TabsTrigger>
              </TabsList>
            </CardContent>
          </Card>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-4 sm:mt-0">
            {/* Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-4 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                    <ListOrdered className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Toplam Soru</p>
                    <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                      {questionCount}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-4 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">ÖÇ Eşlemesi</p>
                    <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                      {mappedQuestions.length}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-4 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                    <Target className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Eşleme %</p>
                    <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                      {mappingPercentage}%
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-4 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Toplam Puan</p>
                    <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                      {totalMaxScore}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-4 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                    <Award className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Geçme Puanı</p>
                    <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                      {exam.passingScore != null ? exam.passingScore : 60}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Exam Information */}
            <div className="grid gap-4 md:grid-cols-2 min-w-0">
              <div className="space-y-3 sm:space-y-4 min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-1 h-6 sm:h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full flex-shrink-0"></div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 flex-shrink-0">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <h2 className="text-base sm:text-xl md:text-2xl font-bold text-brand-navy dark:text-slate-100 truncate">Sınav Bilgileri</h2>
                  </div>
                </div>
                <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern overflow-hidden">
                  <CardContent className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Ders</p>
                      <p className="text-sm sm:text-base font-semibold text-brand-navy dark:text-slate-100 break-words">
                        {course ? `${course.code} - ${course.name}` : "Bilinmeyen Ders"}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Sınav Türü</p>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-sm",
                            exam.examType === "midterm"
                              ? "bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white border-brand-navy"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                          )}
                        >
                          {examTypeLabel}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Sınav Kodu</p>
                        <p className="text-sm sm:text-base font-semibold text-brand-navy dark:text-slate-100">{exam.examCode}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Soru Sayısı</p>
                        <p className="text-sm sm:text-base font-semibold text-brand-navy dark:text-slate-100">{questionCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Soru Başına Max Puan</p>
                        <p className="text-sm sm:text-base font-semibold text-brand-navy dark:text-slate-100">
                          {maxScorePerQuestionDisplay}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Geçme Puanı</p>
                        <p className="text-sm sm:text-base font-semibold text-brand-navy dark:text-slate-100">
                          {exam.passingScore != null ? exam.passingScore : 60}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3 sm:space-y-4 min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-1 h-6 sm:h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full flex-shrink-0"></div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 flex-shrink-0">
                      <Target className="h-4 w-4 sm:h-5 sm:w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <h2 className="text-base sm:text-xl md:text-2xl font-bold text-brand-navy dark:text-slate-100 break-words">ÖÇ Eşleme Durumu</h2>
                  </div>
                </div>
                <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern overflow-hidden">
                  <CardContent className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-brand-navy dark:text-slate-100">Eşlenen Sorular</span>
                        </div>
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-500/30">
                          {mappedQuestions.length} / {questionCount}
                        </Badge>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-green-500 to-emerald-600 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${mappingPercentage}%` }}
                        />
                      </div>
                      {unmappedQuestions.length > 0 && (
                        <div className="flex items-center justify-between pt-2 border-t border-brand-navy/10 dark:border-slate-700/50">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            <span className="text-sm font-medium text-brand-navy dark:text-slate-100">Eşlenmemiş Sorular</span>
                          </div>
                          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-500/30">
                            {unmappedQuestions.length}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions" className="space-y-4 sm:space-y-6 mt-4 sm:mt-0">
            <div className="space-y-3 sm:space-y-4 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-1 h-6 sm:h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full flex-shrink-0"></div>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 flex-shrink-0">
                    <ListOrdered className="h-4 w-4 sm:h-5 sm:w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-xl md:text-2xl font-bold text-brand-navy dark:text-slate-100">Sorular ve ÖÇ Eşleşmeleri</h2>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Her soru için bağlı öğrenme çıktısı</p>
                  </div>
                </div>
              </div>

              <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern overflow-hidden">
                <CardContent className="p-3 sm:p-6">
                  {questions && questions.length > 0 ? (
                    <div className="space-y-3">
                      {questions
                        .slice()
                        .sort((a: any, b: any) => (a.questionNumber || 0) - (b.questionNumber || 0))
                        .map((q: any) => {
                          const hasMapping = q.learningOutcomeCode && q.learningOutcomeCode.trim() !== "";
                          return (
                            <div
                              key={q.questionNumber}
                              className={cn(
                                "group p-3 sm:p-4 border rounded-lg transition-all duration-300 hover:shadow-md min-w-0",
                                hasMapping
                                  ? "border-brand-navy/20 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 hover:border-brand-navy/50"
                                  : "border-amber-500/30 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 hover:border-amber-500/50"
                              )}
                            >
                              <div className="flex flex-col gap-3">
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                  <Badge 
                                    variant="default" 
                                    className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white shadow-md flex-shrink-0"
                                  >
                                    Soru {q.questionNumber}
                                  </Badge>
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-slate-600 dark:text-slate-400">ÖÇ:</span>
                                      {hasMapping ? (
                                        <Badge 
                                          variant="outline" 
                                          className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-500/30"
                                        >
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          {q.learningOutcomeCode}
                                        </Badge>
                                      ) : (
                                        <Badge 
                                          variant="outline" 
                                          className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                        >
                                          <AlertCircle className="h-3 w-3 mr-1" />
                                          Eşlenmemiş
                                        </Badge>
                                      )}
                                    </div>
                                    {hasMapping && loDescriptionByCode[q.learningOutcomeCode] && (
                                      <p className="text-xs text-slate-600 dark:text-slate-400 break-words w-full">
                                        {loDescriptionByCode[q.learningOutcomeCode]}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                  <span className="font-medium">Max Puan:</span>{" "}
                                  <span className="font-semibold text-brand-navy dark:text-slate-100">
                                    {maxScorePerQuestionDisplay}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                      <p className="text-lg font-medium">Soru bulunamadı</p>
                      <p className="text-sm mt-2">Sınav için henüz soru eklenmemiş</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
