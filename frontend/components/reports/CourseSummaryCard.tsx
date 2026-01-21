"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { type LOAchievement, type POAchievement } from "@/lib/api/assessmentApi";
import { type Course } from "@/lib/api/courseApi";

interface CourseSummaryCardProps {
  loAchievements: LOAchievement[];
  poAchievements: POAchievement[];
  course?: Course | null;
}

export function CourseSummaryCard({
  loAchievements,
  poAchievements,
  course,
}: CourseSummaryCardProps) {
  const calculateAverage = (achievements: Array<{ achievedPercentage: number }>) => {
    if (achievements.length === 0) return 0;
    const sum = achievements.reduce(
      (acc, a) => acc + a.achievedPercentage,
      0
    );
    return sum / achievements.length;
  };

  // Calculate total unique PÇ count from Course's learningOutcomes
  const totalPCCount = course?.learningOutcomes?.reduce((uniquePCs, lo) => {
    const pcs = lo.programOutcomes || lo.relatedProgramOutcomes || [];
    pcs.forEach((pc: string) => {
      if (pc && !uniquePCs.has(pc)) {
        uniquePCs.add(pc);
      }
    });
    return uniquePCs;
  }, new Set<string>()).size || 0;

  // Use totalPCCount if poAchievements is empty, otherwise use poAchievements.length
  const displayPCCount = poAchievements.length > 0 ? poAchievements.length : totalPCCount;

  const avgLO = calculateAverage(loAchievements);
  const avgPO = calculateAverage(poAchievements);

  const loAboveThreshold = loAchievements.filter(
    (a) => a.achievedPercentage >= 50 // 50 puan eşiği
  ).length;
  const poAboveThreshold = poAchievements.filter(
    (a) => a.achievedPercentage >= 50 // 50 puan eşiği
  ).length;

  const loSuccessRate = loAchievements.length > 0
    ? (loAboveThreshold / loAchievements.length) * 100
    : 0;
  const poSuccessRate = displayPCCount > 0
    ? (poAboveThreshold / displayPCCount) * 100
    : 0;

  const getStatusColor = (percentage: number) => {
    if (percentage >= 50) return "bg-green-500"; // 50 puan eşiği
    return "bg-red-500";
  };

  const getStatusText = (percentage: number) => {
    if (percentage >= 50) return "Başarılı"; // 50 puan eşiği
    return "Başarısız";
  };

  const getTrendIcon = (percentage: number) => {
    if (percentage >= 50) return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />; // 50 puan eşiği
    return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
  };

  return (
    <Card className="border-2 border-[#0a294e]/20 dark:border-slate-700">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl md:text-2xl text-[#0a294e] dark:text-foreground">Ders Genel Başarı Özeti</CardTitle>
        <CardDescription className="text-xs sm:text-sm md:text-base">
          Öğrenme Çıktıları ve Program Çıktıları için genel performans göstergeleri
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* ÖÇ Özeti */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base sm:text-lg font-semibold">Öğrenme Çıktıları (ÖÇ)</h3>
              <Badge variant="outline" className="text-xs sm:text-sm">
                {loAchievements.length} ÖÇ
              </Badge>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between p-2 sm:p-3 bg-blue-50 rounded-lg">
                <span className="text-xs sm:text-sm font-medium">Ortalama Başarı</span>
                <div className="flex items-center gap-1 sm:gap-2">
                  {getTrendIcon(avgLO)}
                  <span className="text-base sm:text-lg font-bold">{avgLO.toFixed(1)}%</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${getStatusColor(avgLO)}`}
                  style={{ width: `${Math.min(avgLO, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Durum:</span>
                <Badge
                  className={
                    avgLO >= 50
                      ? "bg-green-500"
                      : "bg-red-500"
                  }
                >
                  {getStatusText(avgLO)}
                </Badge>
              </div>
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  <strong>{loAboveThreshold}</strong> / {loAchievements.length} ÖÇ hedef eşiğini (≥50%) geçti
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Başarı oranı: {loSuccessRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* PÇ Özeti */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base sm:text-lg font-semibold">Program Çıktıları (PÇ)</h3>
              <Badge variant="outline" className="text-xs sm:text-sm">
                {displayPCCount} PÇ
              </Badge>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between p-2 sm:p-3 bg-purple-50 dark:bg-slate-800 rounded-lg">
                <span className="text-xs sm:text-sm font-medium text-foreground">Ortalama Başarı</span>
                <div className="flex items-center gap-1 sm:gap-2">
                  {getTrendIcon(avgPO)}
                  <span className="text-base sm:text-lg font-bold text-foreground">{avgPO.toFixed(1)}%</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${getStatusColor(avgPO)}`}
                  style={{ width: `${Math.min(avgPO, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Durum:</span>
                <Badge
                  className={
                    avgPO >= 50
                      ? "bg-green-500 text-xs sm:text-sm"
                      : "bg-red-500 text-xs sm:text-sm"
                  }
                >
                  {getStatusText(avgPO)}
                </Badge>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs sm:text-sm text-muted-foreground break-words">
                  <strong>{poAboveThreshold}</strong> / {displayPCCount} PÇ hedef eşiğini (≥50%) geçti
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Başarı oranı: {poSuccessRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

