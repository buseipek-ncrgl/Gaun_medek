"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type LOAchievement } from "@/lib/api/assessmentApi";

interface LOAchievementTableProps {
  achievements: LOAchievement[];
}

export function LOAchievementTable({ achievements }: LOAchievementTableProps) {
  if (achievements.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Öğrenme çıktısı verisi bulunamadı
      </div>
    );
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 50) return "bg-green-500"; // 50 puan eşiği
    return "bg-red-500";
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ÖÇ Kodu</TableHead>
            <TableHead>Açıklama</TableHead>
            <TableHead className="text-center">Öğrenci Sayısı</TableHead>
            <TableHead className="text-center">Toplam Max Puan</TableHead>
            <TableHead className="text-center">Ortalama Başarı %</TableHead>
            <TableHead>Görsel</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {achievements.map((achievement, index) => {
            const percentage = Math.round(achievement.achievedPercentage * 100) / 100;
            return (
              <TableRow
                key={achievement.code}
                className={index % 2 === 0 ? "bg-background" : "bg-muted/50"}
              >
                <TableCell className="font-medium">
                  <Badge variant="secondary">{achievement.code}</Badge>
                </TableCell>
                <TableCell className="max-w-md">
                  {achievement.description}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {achievement.studentCount}
                </TableCell>
                <TableCell className="text-center font-medium">
                  {achievement.totalMaxScore.toFixed(1)}
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className={`font-semibold ${
                      percentage >= 50
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {percentage.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${getProgressColor(percentage)}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

