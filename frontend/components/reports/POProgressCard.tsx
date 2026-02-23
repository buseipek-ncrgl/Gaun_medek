"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type POAchievement } from "@/lib/api/assessmentApi";

interface POProgressCardProps {
  achievement: POAchievement;
  /** Sınav geçme puanı (0-100). Yoksa 60 kullanılır. */
  passingThreshold?: number;
}

export function POProgressCard({ achievement, passingThreshold = 60 }: POProgressCardProps) {
  const percentage = Math.round(achievement.achievedPercentage * 100) / 100;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = (pct: number) => {
    if (pct >= passingThreshold) return "text-green-600 dark:text-green-400 stroke-green-500 dark:stroke-green-400";
    return "text-red-600 dark:text-red-400 stroke-red-500 dark:stroke-red-400";
  };

  return (
    <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Badge variant="secondary" className="text-sm font-semibold">
            {achievement.code}
          </Badge>
          <span className={`text-2xl font-bold ${getColor(percentage)}`}>
            {percentage.toFixed(1)}%
          </span>
        </div>

        <div className="flex items-center justify-center mb-4">
          <div className="relative">
            <svg width="120" height="120" className="transform -rotate-90">
              <circle
                cx="60"
                cy="60"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-gray-200 dark:text-slate-700"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className={`transition-all duration-500 ${getColor(percentage).split(" ")[1]}`}
                style={{
                  stroke: percentage >= passingThreshold ? "#22c55e" : "#ef4444"
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-bold ${getColor(percentage)}`}>
                {percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground">Katkıda Bulunan ÖÇ:</span>
          <Badge variant="outline">{achievement.contributingLOCount}</Badge>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 text-center">
          Program Çıktısı {achievement.code}
        </p>
      </CardContent>
    </Card>
  );
}

