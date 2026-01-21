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
import { type POAchievement } from "@/lib/api/assessmentApi";

interface POAchievementTableProps {
  achievements: POAchievement[];
}

export function POAchievementTable({ achievements }: POAchievementTableProps) {
  if (achievements.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Program çıktısı verisi bulunamadı
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
            <TableHead>PÇ Kodu</TableHead>
            <TableHead>Açıklama</TableHead>
            <TableHead className="text-center">Katkıda Bulunan ÖÇ</TableHead>
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
                  {/* PÇ açıklaması backend'den gelmiyor, sadece code var */}
                  Program Çıktısı {achievement.code}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{achievement.contributingLOCount}</Badge>
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

