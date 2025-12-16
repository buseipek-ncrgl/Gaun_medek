"use client";

import Link from "next/link";
import { Edit, Trash2, Calendar, Users, Target, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type Course } from "@/lib/api/courseApi";

interface CourseCardProps {
  course: Course;
  onDelete: (course: Course) => void;
}

export function CourseCard({ course, onDelete }: CourseCardProps) {
  const semester = course.semester || "-";
  const departmentName = (course as any).department?.name || (typeof (course as any).department === "string" ? (course as any).department : "(Eski kayıt – bölüm seçilmemiş)");
  const learningOutcomeCount = course.learningOutcomes?.length || 0;
  const studentCount = course.students?.length || 0;
  const examCount = course.examCount || 0;
  const midtermExams = course.midtermExams || [];
  const finalExams = course.finalExams || [];
  const updatedAt = course.updatedAt
    ? new Date(course.updatedAt).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

  // Show exams if there are any
  const hasExams = examCount > 0;

  return (
    <Card className="group relative overflow-hidden rounded-xl shadow-modern hover:shadow-lg transition-all duration-300 border border-brand-navy/20 dark:border-slate-700/50 bg-white dark:bg-slate-800/95 hover:border-brand-navy/50 h-full flex flex-col min-w-0 hover:-translate-y-1">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <CardContent className="relative p-4 sm:p-6 flex flex-col flex-1 min-w-0">
        <div className="space-y-4 sm:space-y-5 flex-1 min-w-0">
          {/* Course Header */}
          <div className="pb-3 sm:pb-4 border-b border-slate-200 dark:border-slate-700 group-hover:border-white/20">
            <h3 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white mb-2 line-clamp-2 break-words transition-colors">
              {course.name}
            </h3>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 group-hover:text-white/80 font-semibold break-words transition-colors">
              {course.code}
            </p>
          </div>

          {/* Course Details - Better Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="flex items-start gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 group-hover:from-white/20 group-hover:to-white/10 transition-all duration-300">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 mb-1 transition-colors">Dönem</p>
                <p className="text-sm font-semibold text-brand-navy dark:text-slate-300 group-hover:text-white truncate transition-colors" title={semester}>
                  {semester}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 group-hover:from-white/20 group-hover:to-white/10 transition-all duration-300">
                <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 mb-1 transition-colors">Öğrenme Çıktısı</p>
                <p className="text-sm font-semibold text-brand-navy dark:text-slate-300 group-hover:text-white transition-colors">
                  {learningOutcomeCount} adet
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 group-hover:from-white/20 group-hover:to-white/10 transition-all duration-300">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 mb-1 transition-colors">Öğrenci</p>
                <p className="text-sm font-semibold text-brand-navy dark:text-slate-300 group-hover:text-white transition-colors">
                  {studentCount} kişi
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 group-hover:from-white/20 group-hover:to-white/10 transition-all duration-300">
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 mb-1 transition-colors">Sınav</p>
                <p className="text-sm font-semibold text-brand-navy dark:text-slate-300 group-hover:text-white transition-colors">
                  {examCount} adet
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 group-hover:from-white/20 group-hover:to-white/10 transition-all duration-300 flex items-center justify-center">
                <span className="text-xs sm:text-sm">🏛️</span>
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 mb-1 transition-colors">Bölüm</p>
                <p className="text-sm font-semibold text-brand-navy dark:text-slate-300 group-hover:text-white truncate transition-colors" title={departmentName}>
                  {departmentName}
                </p>
              </div>
            </div>
          </div>

          {/* Exam Codes - Show all exams */}
          {hasExams && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700 group-hover:border-white/20">
              {midtermExams.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 whitespace-nowrap font-medium transition-colors">Vize:</span>
                  {midtermExams.map((exam, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs px-1.5 sm:px-2 py-0.5 h-5 whitespace-nowrap border-brand-navy/20 group-hover:border-white/30 group-hover:bg-white/10 group-hover:text-white transition-colors">
                      {exam.examCode}
                    </Badge>
                  ))}
                </div>
              )}
              {finalExams.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/70 whitespace-nowrap font-medium transition-colors">Final:</span>
                  {finalExams.map((exam, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs px-1.5 sm:px-2 py-0.5 h-5 whitespace-nowrap border-brand-navy/20 group-hover:border-white/30 group-hover:bg-white/10 group-hover:text-white transition-colors">
                      {exam.examCode}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons - Responsive */}
          <div className="flex flex-col sm:flex-row gap-2 pt-3 sm:pt-4 border-t border-slate-200 dark:border-slate-700 group-hover:border-white/20 mt-auto">
            <Button
              asChild
              variant="default"
              size="default"
              className="flex-1 h-10 sm:h-11 text-sm sm:text-base font-semibold bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-brand-navy/90 hover:to-[#0f3a6b]/90 text-white min-w-0 group-hover:from-white/20 group-hover:to-white/10 group-hover:text-white group-hover:border-white/30 transition-all"
            >
              <Link href={`/dashboard/courses/${course._id}`} className="flex items-center justify-center min-w-0">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0 text-white" />
                <span className="truncate">Detay</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="default"
              className="flex-1 h-10 sm:h-11 text-sm sm:text-base font-semibold min-w-0 border-brand-navy/20 group-hover:border-white/30 group-hover:bg-white/10 group-hover:text-white transition-all"
            >
              <Link href={`/dashboard/courses/edit/${course._id}`} className="flex items-center justify-center min-w-0">
                <Edit className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0 text-foreground group-hover:text-white transition-colors" />
                <span className="truncate">Düzenle</span>
              </Link>
            </Button>
            <Button
              variant="destructive"
              size="default"
              onClick={() => onDelete(course)}
              className="h-10 sm:h-11 text-sm sm:text-base font-semibold px-3 sm:px-4 flex-shrink-0 group-hover:bg-red-600/20 group-hover:border-red-500/30 group-hover:text-red-300 transition-all"
            >
              <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-foreground group-hover:text-red-300 transition-colors" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

