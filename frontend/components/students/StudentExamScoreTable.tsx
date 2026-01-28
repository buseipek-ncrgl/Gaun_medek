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
import { type Score } from "@/lib/api/scoreApi";

interface StudentExamScoreTableProps {
  scores: Score[];
}

export function StudentExamScoreTable({ scores }: StudentExamScoreTableProps) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "-";
    }
  };

  const formatType = (type: string) => {
    const typeMap: Record<string, string> = {
      midterm: "Vize",
      final: "Final",
      makeup: "Bütünleme",
    };
    return typeMap[type] || type;
  };

  const getExamTitle = (score: Score): string => {
    if (typeof score.examId === "string") return "Bilinmeyen Sınav";
    return score.examId.title || "Bilinmeyen Sınav";
  };

  const getExamType = (score: Score): string => {
    if (typeof score.examId === "string") return "-";
    return score.examId.type || "-";
  };

  const getQuestionNumber = (score: Score): number => {
    if (typeof score.questionId === "string") return 0;
    return score.questionId.number || 0;
  };

  const getMaxScore = (score: Score): number => {
    if (typeof score.questionId === "string") return 0;
    return score.questionId.maxScore || 0;
  };

  const getLearningOutcomeCode = (score: Score): string => {
    if (typeof score.questionId === "string") return "-";
    const lo = score.questionId.mappedLearningOutcome;
    if (typeof lo === "string") return "-";
    if (!lo) return "-";
    return lo.code || "-";
  };

  const getExamId = (score: Score): string => {
    if (typeof score.examId === "string") return score.examId;
    return score.examId._id;
  };

  // Group scores by exam
  const groupedScores = scores.reduce((acc, score) => {
    const examId = getExamId(score);
    if (!acc[examId]) {
      acc[examId] = [];
    }
    acc[examId].push(score);
    return acc;
  }, {} as Record<string, Score[]>);

  if (scores.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
        <p className="text-lg font-medium">Bu öğrenci için henüz sınav puanı bulunmamaktadır</p>
        <p className="text-sm mt-2">Sınav puanları puanlama veya manuel giriş ile eklendikten sonra burada görünecektir</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedScores).map(([examId, examScores]) => {
        const firstScore = examScores[0];
        const examTitle = getExamTitle(firstScore);
        const examType = getExamType(firstScore);
        const examDate = firstScore.createdAt ? formatDate(firstScore.createdAt) : "-";

        // Calculate total score for this exam
        const totalScore = examScores.reduce((sum, s) => sum + s.scoreValue, 0);
        const totalMaxScore = examScores.reduce((sum, s) => sum + getMaxScore(s), 0);
        const examPercentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

        return (
          <div key={examId} className="rounded-lg border-2 border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900">{examTitle}</span>
                  <Badge 
                    variant={examType === "midterm" ? "default" : "secondary"}
                    className={examType === "midterm" ? "bg-[#0a294e] text-white" : ""}
                  >
                    {formatType(examType)}
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Toplam Puan</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {totalScore} / {totalMaxScore} (%{examPercentage})
                    </p>
                  </div>
                  {examDate !== "-" && (
                    <span className="text-sm text-muted-foreground">{examDate}</span>
                  )}
                </div>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold text-slate-900">Soru No</TableHead>
                  <TableHead className="font-semibold text-slate-900">Puan / Max Puan</TableHead>
                  <TableHead className="font-semibold text-slate-900">Öğrenme Çıktısı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examScores.map((score, index) => {
                  const questionNumber = getQuestionNumber(score);
                  const maxScore = getMaxScore(score);
                  const loCode = getLearningOutcomeCode(score);
                  const percentage = maxScore > 0 ? Math.round((score.scoreValue / maxScore) * 100) : 0;

                  return (
                    <TableRow
                      key={score._id}
                      className={index % 2 === 0 ? "bg-background hover:bg-slate-50" : "bg-muted/30 hover:bg-slate-50"}
                    >
                      <TableCell className="font-medium text-slate-900">{questionNumber || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{score.scoreValue}</span>
                          <span className="text-muted-foreground">/ {maxScore}</span>
                          <Badge 
                            variant={percentage >= 50 ? "default" : percentage >= 40 ? "secondary" : "destructive"} // 50 puan eşiği
                            className="text-xs"
                          >
                            %{percentage}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {loCode !== "-" ? (
                          <Badge variant="outline" className="font-medium">{loCode}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}

