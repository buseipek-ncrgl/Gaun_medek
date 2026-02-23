"use client";

import Link from "next/link";
import { Edit, Trash2, Upload, FileText, AlertTriangle, Eye, BarChart3, CheckCircle2, FileSpreadsheet, CheckSquare, Square } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type Exam } from "@/lib/api/examApi";
import { type Course } from "@/lib/api/courseApi";
import { DeleteExamDialog } from "./DeleteExamDialog";
import { useState } from "react";

interface ExamTableProps {
  exams: Exam[];
  courses: Record<string, Course>;
  onDelete?: () => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}

export function ExamTable({ exams, courses, onDelete, selectedIds = new Set(), onToggleSelect, onToggleSelectAll }: ExamTableProps) {
  const allSelected = exams.length > 0 && selectedIds.size === exams.length;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  const handleDeleteClick = (exam: Exam) => {
    setSelectedExam(exam);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSuccess = () => {
    setDeleteDialogOpen(false);
    setSelectedExam(null);
    onDelete?.();
  };

  const formatType = (type: string) => {
    const typeMap: Record<string, string> = {
      midterm: "Vize",
      final: "Final",
    };
    return typeMap[type] || type;
  };

  if (exams.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-slate-400" />
        <p className="text-lg font-medium">Henüz sınav eklenmemiş</p>
        <p className="text-sm mt-2">Yeni bir sınav oluşturarak başlayın</p>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-slate-500 dark:text-slate-400 px-3 py-2 sm:hidden">Tabloyu yatay kaydırarak tüm sütunları görebilirsiniz.</p>
      <div className="overflow-x-auto min-w-0 -mx-1 px-1">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:bg-gradient-to-r hover:from-brand-navy hover:to-[#0f3a6b]">
              {onToggleSelectAll != null && (
                <TableHead className="text-white font-bold w-10 sm:w-12 text-xs sm:text-sm">
                  <button type="button" onClick={onToggleSelectAll} className="p-1 rounded hover:bg-white/20">
                    {allSelected ? <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5 text-white" /> : <Square className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                  </button>
                </TableHead>
              )}
              <TableHead className="text-white font-bold min-w-[140px] sm:min-w-[200px] text-xs sm:text-sm">Ders</TableHead>
              <TableHead className="text-white font-bold min-w-[90px] sm:min-w-[120px] text-xs sm:text-sm">Sınav Kodu</TableHead>
              <TableHead className="text-white font-bold text-center min-w-[70px] sm:min-w-[100px] text-xs sm:text-sm">Tür</TableHead>
              <TableHead className="text-white font-bold text-center min-w-[70px] sm:min-w-[100px] text-xs sm:text-sm">ÖÇ</TableHead>
              <TableHead className="text-white font-bold text-center min-w-[70px] sm:min-w-[100px] text-xs sm:text-sm">Puan</TableHead>
              <TableHead className="text-white font-bold text-center min-w-[180px] sm:min-w-[240px] text-xs sm:text-sm">Puanlama</TableHead>
              <TableHead className="text-white font-bold text-right min-w-[120px] sm:min-w-[160px] text-xs sm:text-sm">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exams.map((exam, index) => {
              const courseId = typeof exam.courseId === 'string' 
                ? exam.courseId 
                : (exam.courseId as any)?._id || String(exam.courseId);
              const course = courses[courseId];
              // Sınav bazlı ÖÇ eşleme kontrolü
              const mappedLOs = exam.learningOutcomes || [];
              const hasNoMapping = mappedLOs.length === 0;
              const hasCompleteMapping = mappedLOs.length > 0;
              
              return (
                <TableRow
                  key={exam._id}
                  className={cn(
                    "hover:bg-brand-navy/5 dark:hover:bg-brand-navy/10 transition-colors",
                    index % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/50 dark:bg-slate-800/50",
                    hasNoMapping && "bg-amber-50/50 dark:bg-amber-900/10"
                  )}
                >
                  {onToggleSelect != null && (
                    <TableCell className="w-10 sm:w-12">
                      <button type="button" onClick={() => onToggleSelect(exam._id)} className="p-1 rounded hover:bg-brand-navy/10">
                        {selectedIds.has(exam._id) ? <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5 text-brand-navy dark:text-slate-200" /> : <Square className="h-4 w-4 sm:h-5 sm:w-5 text-brand-navy/50 dark:text-slate-400" />}
                      </button>
                    </TableCell>
                  )}
                  <TableCell className="min-w-[140px] sm:min-w-[200px]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <p className="text-xs sm:text-sm font-medium text-brand-navy dark:text-slate-100 truncate max-w-[180px] sm:max-w-none">
                          {course ? course.name : "Bilinmeyen Ders"}
                        </p>
                        {hasNoMapping && (
                          <Badge variant="outline" className="text-xs border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            ÖÇ Yok
                          </Badge>
                        )}
                        {hasCompleteMapping && (
                          <Badge variant="outline" className="text-xs border-green-500/30 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Tamam
                          </Badge>
                        )}
                      </div>
                      {course?.code && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{course.code}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-medium border-brand-navy/30 text-brand-navy dark:text-slate-300">
                      {exam.examCode}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={exam.examType === "midterm" ? "default" : "secondary"}
                      className={cn(
                        exam.examType === "midterm" 
                          ? "bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white shadow-md" 
                          : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                      )}
                    >
                      {formatType(exam.examType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-medium border-brand-navy/30 text-brand-navy dark:text-slate-300">
                      {mappedLOs.length} ÖÇ
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-medium text-brand-navy dark:text-slate-100">{exam.maxScore || 0}</span>
                  </TableCell>
                  <TableCell className="text-center min-w-[180px] sm:min-w-[240px]">
                    <div className="flex flex-col gap-1.5 sm:gap-2 items-center">
                      <Button
                        variant="default"
                        size="sm"
                        asChild
                        className="h-8 sm:h-9 px-2 sm:px-4 text-[10px] sm:text-xs font-semibold bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-brand-navy/90 hover:to-[#0f3a6b]/90 text-white shadow-md hover:shadow-lg transition-all w-full max-w-[200px]"
                      >
                        <Link href={`/dashboard/exams/${exam._id}/upload`}>
                          <Upload className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                          <span className="hidden sm:inline">Tek PDF Yükleme</span>
                          <span className="sm:hidden">PDF</span>
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 sm:h-9 px-2 sm:px-4 text-[10px] sm:text-xs font-semibold border-2 border-brand-navy/30 hover:bg-brand-navy/10 hover:border-brand-navy/50 w-full max-w-[200px] transition-all"
                      >
                        <Link href={`/dashboard/exams/${exam._id}/batch-upload`}>
                          <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                          <span className="hidden sm:inline">Toplu Yükleme</span>
                          <span className="sm:hidden">Toplu</span>
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 sm:h-9 px-2 sm:px-4 text-[10px] sm:text-xs font-semibold border-2 border-green-600/40 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-600/60 w-full max-w-[200px] transition-all text-green-700 dark:text-green-300"
                      >
                        <Link href={`/dashboard/exams/${exam._id}/results`}>
                          <FileSpreadsheet className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                          <span className="hidden sm:inline">OBS Excel Yükle</span>
                          <span className="sm:hidden">OBS</span>
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right min-w-[120px] sm:min-w-[160px]">
                    <div className="flex justify-end gap-1 sm:gap-2 flex-wrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8 hover:bg-brand-navy/10 transition-all"
                        title="Değerlendirme Sonuçları"
                      >
                        <Link href={`/dashboard/exams/${exam._id}/results`}>
                          <BarChart3 className="h-4 w-4 text-brand-navy dark:text-slate-200" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8 hover:bg-brand-navy/10 transition-all"
                        title="Detay"
                      >
                        <Link href={`/exams/${exam._id}/view`}>
                          <Eye className="h-4 w-4 text-brand-navy dark:text-slate-200" />
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        asChild
                        className="h-8 w-8 hover:bg-brand-navy/10 hover:border-brand-navy/50 transition-all"
                        title="Düzenle"
                      >
                        <Link href={`/exams/${exam._id}`}>
                          <Edit className="h-4 w-4 text-brand-navy dark:text-slate-200" />
                        </Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteClick(exam)}
                        className="h-8 w-8 hover:bg-destructive/90 transition-all"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedExam && (
        <DeleteExamDialog
          examId={selectedExam._id}
          examTitle={selectedExam.examCode}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </>
  );
}
