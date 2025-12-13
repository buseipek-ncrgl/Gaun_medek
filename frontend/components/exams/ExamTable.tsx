"use client";

import Link from "next/link";
import { Edit, Trash2, Upload, FileText, AlertTriangle, Eye } from "lucide-react";
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
import { type Exam } from "@/lib/api/examApi";
import { type Course } from "@/lib/api/courseApi";
import { DeleteExamDialog } from "./DeleteExamDialog";
import { useState } from "react";

interface ExamTableProps {
  exams: Exam[];
  courses: Record<string, Course>;
  onDelete?: () => void;
}

export function ExamTable({ exams, courses, onDelete }: ExamTableProps) {
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
      <div className="text-center py-8 text-slate-600 bg-slate-50 rounded-lg border-2 border-dashed">
        <p className="text-lg font-medium">Henüz sınav eklenmemiş</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Ders</TableHead>
              <TableHead className="w-[100px]">Sınav Kodu</TableHead>
              <TableHead className="w-[80px]">Tür</TableHead>
              <TableHead className="text-center w-[100px]">Soru</TableHead>
              <TableHead className="text-center w-[100px]">Max Puan</TableHead>
              <TableHead className="text-center w-[220px]">AI Puanlama</TableHead>
              <TableHead className="text-right w-[120px]">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exams.map((exam, index) => {
              const courseId = typeof exam.courseId === 'string' 
                ? exam.courseId 
                : (exam.courseId as any)?._id || String(exam.courseId);
              const course = courses[courseId];
              const questionCount = exam.questions?.length || exam.questionCount || 0;
              
              // Check if all questions have ÖÇ mapping
              const questionsWithLO = exam.questions?.filter(q => q.learningOutcomeCode && q.learningOutcomeCode.trim() !== "") || [];
              const hasIncompleteMapping = questionCount > 0 && questionsWithLO.length < questionCount;
              const hasNoMapping = questionCount > 0 && questionsWithLO.length === 0;
              
              return (
                <TableRow
                  key={exam._id}
                  className={`${index % 2 === 0 ? "bg-background" : "bg-muted/50"} ${hasNoMapping ? "bg-amber-50/50" : hasIncompleteMapping ? "bg-yellow-50/50" : ""}`}
                >
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700">
                          {course ? course.name : "Bilinmeyen Ders"}
                        </p>
                        {hasNoMapping && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            ÖÇ Yok
                          </Badge>
                        )}
                        {hasIncompleteMapping && (
                          <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300 bg-yellow-50">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Eksik ÖÇ
                          </Badge>
                        )}
                      </div>
                      {course?.code && (
                        <p className="text-xs text-muted-foreground">{course.code}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-medium">
                      {exam.examCode}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={exam.examType === "midterm" ? "default" : "secondary"}
                      className={exam.examType === "midterm" ? "bg-[#0a294e] text-white" : ""}
                    >
                      {formatType(exam.examType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-medium">
                      {questionCount} soru
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-medium">{exam.maxScorePerQuestion}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col gap-2 items-center">
                      <Button
                        variant="default"
                        size="sm"
                        asChild
                        className="h-9 px-4 text-xs font-semibold bg-[#0a294e] hover:bg-[#0a294e]/90 text-white shadow-sm hover:shadow-md transition-all w-full max-w-[180px]"
                      >
                        <Link href={`/dashboard/exams/${exam._id}/upload`}>
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          AI Puanlama
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-9 px-4 text-xs font-semibold border-2 hover:bg-slate-50 w-full max-w-[180px]"
                      >
                        <Link href={`/dashboard/exams/${exam._id}/batch-upload`}>
                          <FileText className="h-3.5 w-3.5 mr-1.5" />
                          Toplu Yükleme
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-8 w-8"
                      title="Detay"
                    >
                      <Link href={`/exams/${exam._id}/view`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        asChild
                        className="h-8 w-8"
                      >
                        <Link href={`/exams/${exam._id}`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteClick(exam)}
                        className="h-8 w-8"
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

