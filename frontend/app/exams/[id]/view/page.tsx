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
import { ArrowLeft, FileText, Upload, Edit, Target, ListOrdered, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";

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

  const examTypeLabel = exam.examType === "midterm" ? "Vize" : "Final";
  // Sınav bazlı ÖÇ eşleme kontrolü
  const mappedLOs = exam.learningOutcomes || [];
  const totalMaxScore = exam.maxScore || 0;

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
                  onClick={() => router.push("/exams")}
                  className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 hover:bg-brand-navy/10"
                >
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-brand-navy dark:text-slate-200" />
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap mb-2">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-brand-navy dark:text-slate-100 truncate">
                      {exam.examCode}
                    </h1>
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
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
                    {course && (
                      <>
                        <span className="font-medium">Ders:</span>
                        <span className="font-semibold text-brand-navy dark:text-slate-200">
                          {course.code} - {course.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => router.push(`/exams/${examId}`)}
                  className="h-10 sm:h-11 px-4 sm:px-6 hover:bg-brand-navy/10 hover:border-brand-navy/50 transition-all"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Düzenle
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/exams/${examId}/upload`)}
                  className="h-10 sm:h-11 px-4 sm:px-6 hover:bg-brand-navy/10 hover:border-brand-navy/50 transition-all"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Tek PDF Yükleme
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/exams/${examId}/batch-upload`)}
                  className="h-10 sm:h-11 px-4 sm:px-6 hover:bg-brand-navy/10 hover:border-brand-navy/50 transition-all"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Toplu Yükleme
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
            <CardContent className="p-2">
              <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-slate-100/50 dark:bg-slate-800/50">
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
                  <span>Genel Bakış</span>
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
                  <ListOrdered className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span>Sorular</span>
                </TabsTrigger>
              </TabsList>
            </CardContent>
          </Card>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                    <ListOrdered className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Toplam Soru</p>
                    <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                      {questionCount}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
                    <CheckCircle2 className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">ÖÇ Eşlemesi</p>
                    <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                      {mappedQuestions.length}
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
                    <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Eşleme %</p>
                    <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                      {mappingPercentage}%
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
                    <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Toplam Puan</p>
                    <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                      {totalMaxScore}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Exam Information */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                      <FileText className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Sınav Bilgileri</h2>
                  </div>
                </div>
                <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Ders</p>
                      <p className="text-base sm:text-lg font-semibold text-brand-navy dark:text-slate-100">
                        {course ? `${course.code} - ${course.name}` : "Bilinmeyen Ders"}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
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
                        <p className="text-sm sm:text-base font-semibold text-brand-navy dark:text-slate-100">{exam.maxScorePerQuestion}</p>
                      </div>
                    </div>
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
                    <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">ÖÇ Eşleme Durumu</h2>
                  </div>
                </div>
                <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
                  <CardContent className="p-5 space-y-4">
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
          <TabsContent value="questions" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                    <ListOrdered className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Sorular ve ÖÇ Eşleşmeleri</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Her soru için bağlı öğrenme çıktısı</p>
                  </div>
                </div>
              </div>

              <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
                <CardContent className="p-4 sm:p-6">
                  {exam.questions && exam.questions.length > 0 ? (
                    <div className="space-y-3">
                      {exam.questions
                        .slice()
                        .sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0))
                        .map((q) => {
                          const hasMapping = q.learningOutcomeCode && q.learningOutcomeCode.trim() !== "";
                          return (
                            <div
                              key={q.questionNumber}
                              className={cn(
                                "group p-4 border rounded-lg transition-all duration-300 hover:shadow-md",
                                hasMapping
                                  ? "border-brand-navy/20 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 hover:border-brand-navy/50"
                                  : "border-amber-500/30 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 hover:border-amber-500/50"
                              )}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1">
                                  <Badge 
                                    variant="default" 
                                    className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white shadow-md flex-shrink-0"
                                  >
                                    Soru {q.questionNumber}
                                  </Badge>
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
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-sm text-slate-600 dark:text-slate-400">
                                    <span className="font-medium">Max Puan:</span>{" "}
                                    <span className="font-semibold text-brand-navy dark:text-slate-100">{exam.maxScorePerQuestion}</span>
                                  </div>
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
