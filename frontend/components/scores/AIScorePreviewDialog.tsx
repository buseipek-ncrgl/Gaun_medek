"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { scoreApi, type SubmitScoreDto } from "@/lib/api/scoreApi";
import { studentApi } from "@/lib/api/studentApi";
import { questionApi } from "@/lib/api/questionApi";

export interface AIScoreRow {
  studentNumber: string;
  examId: string;
  questionId: string;
  scoreValue: number;
  studentId?: string;
  maxScore?: number;
  isValid?: boolean;
  error?: string;
}

interface AIScorePreviewDialogProps {
  rows: AIScoreRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AIScorePreviewDialog({
  rows,
  open,
  onOpenChange,
  onSuccess,
}: AIScorePreviewDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [validatedRows, setValidatedRows] = useState<AIScoreRow[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Validate rows when dialog opens or rows change
  useEffect(() => {
    if (open && rows.length > 0) {
      setValidatedRows([]);
      validateRows();
    }
  }, [open, rows.length]);

  const validateRows = async () => {
    setIsValidating(true);
    const validated: AIScoreRow[] = [];

    for (const row of rows) {
      const validatedRow: AIScoreRow = { ...row, isValid: true };

      // Validate student
      try {
        const student = await studentApi.getByNumber(row.studentNumber);
        validatedRow.studentId = student._id;
      } catch {
        validatedRow.isValid = false;
        validatedRow.error = "Student not found";
      }

      // Validate question and get maxScore
      try {
        const question = await questionApi.getById(row.questionId);
        validatedRow.maxScore = question.maxScore;
        if (row.scoreValue > question.maxScore) {
          validatedRow.isValid = false;
          validatedRow.error = `Score exceeds max (${question.maxScore})`;
        }
      } catch {
        validatedRow.isValid = false;
        validatedRow.error = "Question not found";
      }

      validated.push(validatedRow);
    }

    setValidatedRows(validated);
    setIsValidating(false);
  };

  const handleApproveAndSave = async () => {
    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of validatedRows) {
      if (!row.isValid || !row.studentId) {
        errorCount++;
        continue;
      }

      try {
        await scoreApi.submit({
          studentId: row.studentId,
          examId: row.examId,
          questionId: row.questionId,
          scoreValue: row.scoreValue,
        } as SubmitScoreDto);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error("Failed to save score:", error);
      }
    }

    setIsSaving(false);

    if (errorCount === 0) {
      toast.success(`Successfully saved ${successCount} scores`);
      onOpenChange(false);
      onSuccess?.();
    } else {
      toast.error(`Saved ${successCount} scores, ${errorCount} failed`);
    }
  };

  const validCount = validatedRows.filter((r) => r.isValid).length;
  const invalidCount = validatedRows.filter((r) => !r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Puan Önizleme</DialogTitle>
          <DialogDescription>
            {isValidating
              ? "Puanlar kontrol ediliyor..."
              : `Kaydetmeden önce puanları kontrol edin. ${validCount} geçerli, ${invalidCount} geçersiz.`}
          </DialogDescription>
        </DialogHeader>

        {isValidating ? (
          <div className="text-center py-8 text-muted-foreground">
            Validating scores...
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Number</TableHead>
                <TableHead>Question ID</TableHead>
                <TableHead>Score / Max Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {validatedRows.map((row, index) => (
                <TableRow
                  key={index}
                  className={index % 2 === 0 ? "bg-background" : "bg-muted/50"}
                >
                  <TableCell className="font-medium">
                    {row.studentNumber}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.questionId.substring(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{row.scoreValue}</span>
                    {row.maxScore !== undefined && (
                      <span className="text-muted-foreground"> / {row.maxScore}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.isValid ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Valid
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="mr-1 h-3 w-3" />
                        Invalid
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-destructive">
                    {row.error || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )}

        {invalidCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              Some rows have validation errors. Invalid rows will be skipped when saving.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleApproveAndSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Approve and Save All"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

