"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { type Student } from "@/lib/api/studentApi";
import { type StudentLOAchievement } from "@/lib/api/assessmentApi";

interface StudentComparisonChartProps {
  students: Student[];
  studentAchievements: Record<string, StudentLOAchievement[]>;
}

export function StudentComparisonChart({
  students,
  studentAchievements,
}: StudentComparisonChartProps) {
  // Calculate overall LO achievement for each student
  const studentData = students.map((student) => {
    const achievements = studentAchievements[student._id] || [];
    const overallPercentage =
      achievements.length > 0
        ? achievements.reduce((sum, a) => sum + a.achievedPercentage, 0) /
          achievements.length
        : 0;
    return {
      studentNumber: student.studentNumber,
      name: student.name,
      percentage: overallPercentage,
    };
  });

  const maxPercentage = Math.max(...studentData.map((d) => d.percentage), 100);

  if (studentData.length === 0) {
    return (
      <Card className="border-2 border-slate-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
          <CardTitle className="text-xl text-slate-900">Öğrenci Karşılaştırması</CardTitle>
          <CardDescription className="text-sm">Öğrenciler için genel ÖÇ başarı oranları</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <p className="text-lg font-medium">Öğrenci verisi bulunamadı</p>
            <p className="text-sm mt-2">Sınav puanları eklendikten sonra burada görünecektir</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm border-2 border-slate-200">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
        <CardTitle className="text-xl text-slate-900">Öğrenci Karşılaştırması</CardTitle>
        <CardDescription className="text-sm">Öğrenciler için genel ÖÇ başarı oranları</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {studentData.map((data, index) => {
            const widthPercentage = maxPercentage > 0 ? (data.percentage / maxPercentage) * 100 : 0;
            const color =
              data.percentage >= 80
                ? "bg-green-500"
                : data.percentage >= 60
                ? "bg-yellow-500"
                : "bg-red-500";

            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{data.studentNumber}</span>
                    <span className="text-muted-foreground text-xs">
                      {data.name}
                    </span>
                  </div>
                  <span
                    className={`font-semibold ${
                      data.percentage >= 80
                        ? "text-green-600"
                        : data.percentage >= 60
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {data.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full transition-all ${color}`}
                    style={{ width: `${widthPercentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

