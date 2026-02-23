"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Target, FileText, Users, GraduationCap, BarChart3, Plus, ArrowRight, Loader2, User } from "lucide-react";
import { courseApi } from "@/lib/api/courseApi";
import { examApi } from "@/lib/api/examApi";
import { studentApi } from "@/lib/api/studentApi";
import { learningOutcomeApi } from "@/lib/api/learningOutcomeApi";
import { departmentApi } from "@/lib/api/departmentApi";
import { programApi, type Program } from "@/lib/api/programApi";
import { programOutcomeApi } from "@/lib/api/programOutcomeApi";
import { authApi } from "@/lib/api/authApi";

type ProgramWithOutcomes = Program & { programOutcomes?: unknown[] };

type MeUser = {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
  departmentId?: { name?: string; code?: string; programs?: { name?: string; code?: string }[] } | string;
  assignedProgramIds?: { name?: string; code?: string }[] | string[];
  assignedCourseIds?: { name?: string; code?: string }[] | string[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalLearningOutcomes: 0,
    totalExams: 0,
    totalStudents: 0,
    totalDepartments: 0,
    totalPrograms: 0,
    totalProgramOutcomes: 0,
  });
  const [departmentProgramCount, setDepartmentProgramCount] = useState<number | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const me = await authApi.getMe();
        if (me) setUser(me as MeUser);
        else setUser(authApi.getStoredUser() as MeUser);
      } catch {
        setUser(authApi.getStoredUser() as MeUser);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, [user?.role, user?._id]);

  // Bölüm başkanı için kendi bölümündeki program sayısı
  useEffect(() => {
    if (user?.role !== "department_head" || !user?.departmentId) {
      setDepartmentProgramCount(null);
      return;
    }
    const deptId = typeof user.departmentId === "object" && user.departmentId !== null
      ? (user.departmentId as { _id?: string })._id
      : String(user.departmentId);
    if (!deptId) return;
    programApi.getAll(deptId).then((list) => setDepartmentProgramCount(list.length)).catch(() => setDepartmentProgramCount(0));
  }, [user?.role, user?.departmentId]);

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);
      const me = user ?? (await authApi.getMe().catch(() => null)) ?? authApi.getStoredUser();
      const role = (me as MeUser)?.role;

      const [courses, exams, students, departments] = await Promise.all([
        courseApi.getAll().catch(() => []),
        examApi.getAll().catch(() => []),
        studentApi.getAll().catch(() => []),
        departmentApi.getAll().catch(() => []),
      ]);

      // ÖÇ sayısı: kullanıcının gördüğü derslerdeki öğrenme çıktıları (zaten rol filtrelı courses)
      const totalLOs = (courses as { learningOutcomes?: unknown[] }[]).reduce(
        (sum, c) => sum + (c.learningOutcomes?.length ?? 0),
        0
      );

      // PÇ sayısı: rol göre kullanıcının alanındaki program çıktıları
      let totalPOs = 0;
      let programsForPO: ProgramWithOutcomes[] = [];
      if (role === "department_head" && (me as MeUser)?.departmentId) {
        const deptId = typeof (me as MeUser).departmentId === "object" && (me as MeUser).departmentId !== null
          ? ((me as MeUser).departmentId as { _id?: string })._id
          : String((me as MeUser).departmentId);
        if (deptId) {
          programsForPO = (await programApi.getAll(deptId).catch(() => [])) as ProgramWithOutcomes[];
        }
      } else if (role === "teacher") {
        const programIds = new Set(
          (courses as { program?: { _id?: string } | string }[])
            .map((c) => (c.program && typeof c.program === "object" ? c.program._id : c.program))
            .filter(Boolean) as string[]
        );
        const allPrograms = (await programApi.getAll().catch(() => [])) as ProgramWithOutcomes[];
        programsForPO = allPrograms.filter((p) => p._id && programIds.has(p._id));
      } else {
        programsForPO = (await programApi.getAll().catch(() => [])) as ProgramWithOutcomes[];
      }
      programsForPO.forEach((program) => {
        if (program.programOutcomes && Array.isArray(program.programOutcomes)) {
          totalPOs += program.programOutcomes.length;
        }
      });

      setStats({
        totalCourses: courses.length,
        totalLearningOutcomes: totalLOs,
        totalExams: exams.length,
        totalStudents: students.length,
        totalDepartments: departments.length,
        totalPrograms: programsForPO.length,
        totalProgramOutcomes: totalPOs,
      });
    } catch (error: any) {
      console.error("Dashboard stats fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = user?.name?.trim() || user?.email || "Kullanıcı";
  const isTeacherOrHead = user?.role === "teacher" || user?.role === "department_head";
  const deptName = user?.departmentId && typeof user.departmentId === "object" && user.departmentId !== null
    ? (user.departmentId as { name?: string }).name || "—"
    : "—";
  const programNames = (() => {
    if (!user) return "";
    const progs = (user.departmentId as { programs?: { name?: string; code?: string }[] })?.programs;
    if (Array.isArray(progs) && progs.length) return progs.map((p) => p?.name || p?.code || "").filter(Boolean).join(", ");
    const assigned = user.assignedProgramIds;
    if (Array.isArray(assigned) && assigned.length) return assigned.map((p) => typeof p === "object" && p ? (p.name || p.code || "") : "").filter(Boolean).join(", ");
    return "";
  })();

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 min-w-0">
        {/* Hoş geldiniz + kullanıcı adı; öğretmen/bölüm başkanında bölüm ve program */}
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-modern">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                  <User className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">
                    Hoş geldiniz, {displayName}
                  </h2>
                  {isTeacherOrHead && (deptName !== "—" || programNames) && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {deptName !== "—" && <span>Bölüm: {deptName}</span>}
                      {deptName !== "—" && programNames && " · "}
                      {programNames && <span>Program: {programNames}</span>}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-brand-navy dark:text-slate-100 mb-1 sm:mb-2 break-words">
            Naci Topçuoğlu Meslek Yüksekokulu Ölçme Değerlendirme Yönetim Sistemi
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Sistem genelinde özet bilgiler ve hızlı erişim
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
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

          {/* Yöneticide: Bölümler; Bölüm başkanında: Programlar; Öğretmende: bu kart yok */}
          {user?.role === "super_admin" && (
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
          )}
          {user?.role === "department_head" && (
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <CardContent className="relative p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide mb-2 transition-colors">Programlar</p>
                  {departmentProgramCount === null ? (
                    <Skeleton className="h-8 w-16 mb-2" />
                  ) : (
                    <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white mb-1 transition-colors">{departmentProgramCount}</p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">Bölümünüzdeki programlar</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-lg transition-all duration-300">
                  <GraduationCap className="h-5 w-5 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
              </div>
            </CardContent>
          </Card>
          )}

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* Öğretmende yok: Yeni Ders / Yeni Öğrenci / Yeni ÖÇ / PÇ. Sadece Dersleri Görüntüle, Yeni Sınav, Raporlar */}
              {user?.role !== "teacher" && (
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
              )}

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

              {user?.role !== "teacher" && (
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
              )}

              {user?.role !== "teacher" && (
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
              )}

              {user?.role !== "teacher" && (
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
              )}

              {user?.role === "teacher" && (
              <Button
                variant="outline"
                className="group relative overflow-hidden h-auto p-4 justify-start border border-brand-navy/20 dark:border-slate-700 hover:border-brand-navy/50 transition-all duration-300 hover:shadow-md"
                onClick={() => router.push("/dashboard/courses")}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 group-hover:from-white/20 group-hover:to-white/10 transition-all duration-300 mr-3">
                  <BookOpen className="h-4 w-4 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
                </div>
                <div className="text-left relative">
                  <p className="text-sm font-semibold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">Dersleri Görüntüle</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 transition-colors">Atanmış derslerinizi görün</p>
                </div>
              </Button>
              )}

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

