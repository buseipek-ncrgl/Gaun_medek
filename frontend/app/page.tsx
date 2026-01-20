"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Target, FileText, Users, GraduationCap, BarChart3, Plus, ArrowRight, Loader2 } from "lucide-react";
import { courseApi } from "@/lib/api/courseApi";
import { examApi } from "@/lib/api/examApi";
import { studentApi } from "@/lib/api/studentApi";
import { learningOutcomeApi } from "@/lib/api/learningOutcomeApi";
import { departmentApi } from "@/lib/api/departmentApi";
import { programOutcomeApi } from "@/lib/api/programOutcomeApi";

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalLearningOutcomes: 0,
    totalExams: 0,
    totalStudents: 0,
    totalDepartments: 0,
    totalProgramOutcomes: 0,
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);
      
      const [courses, exams, students, departments] = await Promise.all([
        courseApi.getAll().catch(() => []),
        examApi.getAll().catch(() => []),
        studentApi.getAll().catch(() => []),
        departmentApi.getAll().catch(() => []),
      ]);

      // Calculate total learning outcomes from LearningOutcome collection
      // This is more accurate than counting embedded arrays in courses
      const allLearningOutcomes = await learningOutcomeApi.getAll().catch(() => []);
      const totalLOs = allLearningOutcomes.length;
      
      console.log("📊 Dashboard Stats - Total Courses:", courses.length);
      console.log("📊 Dashboard Stats - Total ÖÇs:", totalLOs);

      // Calculate total program outcomes from all programs
      // Get all programs (without department filter to get all)
      const { programApi } = await import("@/lib/api/programApi");
      const allPrograms = await programApi.getAll().catch(() => []);
      
      // Count ALL program outcomes across all programs
      // Each program can have its own set of PÇs, so we count all of them
      let totalPOs = 0;
      allPrograms.forEach((program: any) => {
        if (program.programOutcomes && Array.isArray(program.programOutcomes)) {
          totalPOs += program.programOutcomes.length;
        }
      });
      
      console.log("📊 Dashboard Stats - Total Programs:", allPrograms.length);
      console.log("📊 Dashboard Stats - Total PÇs:", totalPOs);
      allPrograms.forEach((program: any) => {
        if (program.programOutcomes && Array.isArray(program.programOutcomes)) {
          console.log(`  - Program ${program.name}: ${program.programOutcomes.length} PÇ`);
        }
      });

      setStats({
        totalCourses: courses.length,
        totalLearningOutcomes: totalLOs,
        totalExams: exams.length,
        totalStudents: students.length,
        totalDepartments: departments.length,
        totalProgramOutcomes: totalPOs,
      });
    } catch (error: any) {
      console.error("Dashboard stats fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative h-16 w-16 flex-shrink-0">
              {logoError ? (
                <div className="h-16 w-16 rounded-full bg-brand-navy/20 dark:bg-brand-navy/30 flex items-center justify-center border-2 border-brand-navy/30">
                  <span className="text-brand-navy dark:text-white font-bold text-xl">NT</span>
                </div>
              ) : (
                <Image 
                  src="/logo.png" 
                  alt="NTMYO Logo" 
                  width={64}
                  height={64}
                  className="object-contain"
                  onError={() => setLogoError(true)}
                />
              )}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-brand-navy dark:text-slate-100 mb-2">
                NTMYO Ölçme Değerlendirme Yönetim Sistemi
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-400">
                Sistem genelinde özet bilgiler ve hızlı erişim
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide mb-2 transition-colors">Toplam Ders</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mb-2" />
                  ) : (
                    <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white mb-1 transition-colors">{stats.totalCourses}</p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">Aktif dersler</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-lg transition-all duration-300">
                  <BookOpen className="h-5 w-5 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide mb-2 transition-colors">Öğrenme Çıktıları</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mb-2" />
                  ) : (
                    <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white mb-1 transition-colors">{stats.totalLearningOutcomes}</p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">Tanımlı ÖÇ</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-lg transition-all duration-300">
                  <Target className="h-5 w-5 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide mb-2 transition-colors">Toplam Sınav</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mb-2" />
                  ) : (
                    <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white mb-1 transition-colors">{stats.totalExams}</p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">Oluşturulan sınavlar</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-lg transition-all duration-300">
                  <FileText className="h-5 w-5 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide mb-2 transition-colors">Öğrenciler</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mb-2" />
                  ) : (
                    <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white mb-1 transition-colors">{stats.totalStudents}</p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">Kayıtlı öğrenciler</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-lg transition-all duration-300">
                  <Users className="h-5 w-5 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide mb-2 transition-colors">Bölümler</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mb-2" />
                  ) : (
                    <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white mb-1 transition-colors">{stats.totalDepartments}</p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">Farklı bölüm</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-lg transition-all duration-300">
                  <GraduationCap className="h-5 w-5 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide mb-2 transition-colors">Program Çıktıları</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mb-2" />
                  ) : (
                    <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white mb-1 transition-colors">{stats.totalProgramOutcomes}</p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">Tanımlı PÇ</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-lg transition-all duration-300">
                  <BarChart3 className="h-5 w-5 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-1"
            onClick={() => router.push("/dashboard/courses")}>
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide mb-1 transition-colors">Derslerim</p>
                  <p className="text-lg font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">Dersleri Yönet</p>
                </div>
                <ArrowRight className="h-5 w-5 text-brand-navy dark:text-slate-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-1"
            onClick={() => router.push("/exams")}>
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide mb-1 transition-colors">Sınavlar</p>
                  <p className="text-lg font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">Sınavları Yönet</p>
                </div>
                <ArrowRight className="h-5 w-5 text-brand-navy dark:text-slate-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-1"
            onClick={() => router.push("/students")}>
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide mb-1 transition-colors">Öğrenciler</p>
                  <p className="text-lg font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">Öğrencileri Yönet</p>
                </div>
                <ArrowRight className="h-5 w-5 text-brand-navy dark:text-slate-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-1"
            onClick={() => router.push("/reports")}>
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide mb-1 transition-colors">Raporlar</p>
                  <p className="text-lg font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">Raporları Görüntüle</p>
                </div>
                <ArrowRight className="h-5 w-5 text-brand-navy dark:text-slate-200 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
            <div>
              <h2 className="text-xl font-bold text-brand-navy dark:text-slate-100">Hızlı Erişim</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Sık kullanılan işlemlere hızlıca erişin</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="group relative overflow-hidden h-auto p-4 justify-start border border-brand-navy/20 dark:border-slate-700 hover:border-brand-navy/50 transition-all duration-300 hover:shadow-md"
                onClick={() => router.push("/dashboard/courses")}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 group-hover:from-white/20 group-hover:to-white/10 transition-all duration-300 mr-3">
                  <Plus className="h-4 w-4 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
                <div className="text-left relative">
                  <p className="text-sm font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">Yeni Ders Oluştur</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">Yeni bir ders ekleyin</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="group relative overflow-hidden h-auto p-4 justify-start border border-brand-navy/20 dark:border-slate-700 hover:border-brand-navy/50 transition-all duration-300 hover:shadow-md"
                onClick={() => router.push("/exams/new")}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 group-hover:from-white/20 group-hover:to-white/10 transition-all duration-300 mr-3">
                  <Plus className="h-4 w-4 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
                <div className="text-left relative">
                  <p className="text-sm font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">Yeni Sınav Oluştur</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">Yeni bir sınav ekleyin</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="group relative overflow-hidden h-auto p-4 justify-start border border-brand-navy/20 dark:border-slate-700 hover:border-brand-navy/50 transition-all duration-300 hover:shadow-md"
                onClick={() => router.push("/students/new")}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 group-hover:from-white/20 group-hover:to-white/10 transition-all duration-300 mr-3">
                  <Plus className="h-4 w-4 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
                <div className="text-left relative">
                  <p className="text-sm font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">Yeni Öğrenci Ekle</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">Sisteme öğrenci ekleyin</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="group relative overflow-hidden h-auto p-4 justify-start border border-brand-navy/20 dark:border-slate-700 hover:border-brand-navy/50 transition-all duration-300 hover:shadow-md"
                onClick={() => router.push("/outcomes/new")}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 group-hover:from-white/20 group-hover:to-white/10 transition-all duration-300 mr-3">
                  <Plus className="h-4 w-4 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
                <div className="text-left relative">
                  <p className="text-sm font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">Yeni Öğrenme Çıktısı</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">ÖÇ tanımlayın</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="group relative overflow-hidden h-auto p-4 justify-start border border-brand-navy/20 dark:border-slate-700 hover:border-brand-navy/50 transition-all duration-300 hover:shadow-md"
                onClick={() => router.push("/dashboard/program-outcomes")}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 group-hover:from-white/20 group-hover:to-white/10 transition-all duration-300 mr-3">
                  <Plus className="h-4 w-4 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
                <div className="text-left relative">
                  <p className="text-sm font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">Program Çıktıları</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">PÇ yönetimi</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="group relative overflow-hidden h-auto p-4 justify-start border border-brand-navy/20 dark:border-slate-700 hover:border-brand-navy/50 transition-all duration-300 hover:shadow-md"
                onClick={() => router.push("/reports")}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 group-hover:from-white/20 group-hover:to-white/10 transition-all duration-300 mr-3">
                  <BarChart3 className="h-4 w-4 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
                <div className="text-left relative">
                  <p className="text-sm font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">Raporları Görüntüle</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">Analiz ve raporlar</p>
                </div>
              </Button>
            </div>
          </div>
      </div>
    </div>
  );
}

