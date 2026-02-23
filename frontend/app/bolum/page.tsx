"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, BookOpen, FileText, BarChart3, ArrowRight } from "lucide-react";
import { courseApi } from "@/lib/api/courseApi";
import { examApi } from "@/lib/api/examApi";
import { authApi } from "@/lib/api/authApi";

export default function BolumPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ courses: 0, exams: 0 });

  useEffect(() => {
    const user = authApi.getStoredUser();
    if (user?.role !== "department_head") {
      router.replace("/dashboard/courses");
      return;
    }
    const load = async () => {
      try {
        const [courses, exams] = await Promise.all([
          courseApi.getAll().catch(() => []),
          examApi.getAll().catch(() => []),
        ]);
        setStats({ courses: courses.length, exams: exams.length });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const links = [
    { name: "Dersler", href: "/dashboard/courses", icon: BookOpen },
    { name: "Sınavlar", href: "/exams", icon: FileText },
    { name: "Raporlar", href: "/reports", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30">
            <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-brand-navy dark:text-slate-100">
              Bölüm Paneli
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Bölümünüze ait dersler, sınavlar ve raporlar
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border border-brand-navy/20 dark:border-slate-700/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Ders</p>
                  {loading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="text-2xl font-bold">{stats.courses}</p>}
                </div>
                <BookOpen className="h-10 w-10 text-brand-navy/70" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-brand-navy/20 dark:border-slate-700/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Sınav</p>
                  {loading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="text-2xl font-bold">{stats.exams}</p>}
                </div>
                <FileText className="h-10 w-10 text-brand-navy/70" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-brand-navy/20 dark:border-slate-700/50">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100 mb-4">Hızlı Erişim</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {links.map((item) => (
                <Button
                  key={item.href}
                  variant="outline"
                  className="h-auto py-3 px-4 justify-start gap-3 border-brand-navy/20 hover:bg-brand-navy/10"
                  onClick={() => router.push(item.href)}
                >
                  <item.icon className="h-5 w-5 text-brand-navy" />
                  <span>{item.name}</span>
                  <ArrowRight className="h-4 w-4 ml-auto opacity-60" />
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
