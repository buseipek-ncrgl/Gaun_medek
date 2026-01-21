"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";
import { type Student } from "@/lib/api/studentApi";
import { type LOAchievement } from "@/lib/api/scoreApi";

interface HeatmapChartProps {
  students: Student[];
  learningOutcomes: { _id: string; code: string }[];
  studentAchievements: Record<string, LOAchievement[]>;
}

export function HeatmapChart({
  students,
  learningOutcomes,
  studentAchievements,
}: HeatmapChartProps) {
  const getHeatmapColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-500";
    // 50 puan eşiği: >=50 yeşil, <50 kırmızı
    if (percentage >= 50) return "bg-green-500";
    return "bg-red-500";
  };

  const getTextColor = (percentage: number) => {
    if (percentage >= 50) return "text-white"; // 50 puan eşiği
    return "text-white";
  };

  const getCellValue = (studentId: string, loCode: string): number => {
    const achievements = studentAchievements[studentId] || [];
    const achievement = achievements.find(
      (a) => a.learningOutcome.code === loCode || a.learningOutcome._id === loCode
    );
    return achievement ? achievement.achievedPercentage : 0;
  };

  if (students.length === 0 || learningOutcomes.length === 0) {
    return (
      <Card className="border-2 border-slate-200 dark:border-slate-700">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b border-slate-200 dark:border-slate-700">
          <CardTitle className="text-xl text-slate-900 dark:text-foreground">ÖÇ - Öğrenci Başarı Matrisi</CardTitle>
          <CardDescription className="text-sm">
            Her öğrenme çıktısı için öğrenci bazında başarı yüzdeleri
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 text-slate-400 dark:text-foreground" />
            <p className="text-lg font-medium">Veri bulunamadı</p>
            <p className="text-sm mt-2">Öğrenci ve öğrenme çıktısı verileri eklendikten sonra burada görünecektir</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm border-2 border-slate-200 dark:border-slate-700">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b border-slate-200 dark:border-slate-700">
        <CardTitle className="text-xl text-slate-900 dark:text-foreground">ÖÇ - Öğrenci Başarı Matrisi</CardTitle>
        <CardDescription className="text-sm">
          Her öğrenme çıktısı için öğrenci bazında başarı yüzdeleri
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-border p-2 text-left font-medium bg-muted/50 dark:bg-muted text-foreground sticky left-0 z-10">
                    ÖÇ / Öğrenci
                  </th>
                  {students.map((student) => (
                    <th
                      key={student._id}
                      className="border border-border p-2 text-xs font-medium bg-muted/50 dark:bg-muted text-foreground min-w-[80px]"
                    >
                      <div className="flex flex-col">
                        <span>{student.studentNumber}</span>
                        <span className="text-muted-foreground text-[10px] truncate max-w-[80px]">
                          {student.name}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {learningOutcomes.map((lo, loIndex) => (
                  <tr key={lo._id} className={loIndex % 2 === 0 ? "bg-background" : "bg-muted/50"}>
                    <td className="border border-border p-2 font-medium bg-muted/50 dark:bg-muted text-foreground sticky left-0 z-10">
                      {lo.code}
                    </td>
                    {students.map((student) => {
                      const value = getCellValue(student._id, lo.code);
                      return (
                        <td
                          key={student._id}
                          className={`border border-border p-2 text-center ${getHeatmapColor(value)} ${getTextColor(value)}`}
                        >
                          <span className="font-semibold text-xs">
                            {value.toFixed(0)}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-500 rounded flex-shrink-0" />
            <span className="text-foreground whitespace-nowrap">0-40%</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-orange-500 rounded flex-shrink-0" />
            <span className="text-foreground whitespace-nowrap">40-60%</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-yellow-500 rounded flex-shrink-0" />
            <span className="text-foreground whitespace-nowrap">60-80%</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded flex-shrink-0" />
            <span className="text-foreground whitespace-nowrap">80-100%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

