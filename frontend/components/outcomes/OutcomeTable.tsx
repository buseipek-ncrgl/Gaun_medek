"use client";

import Link from "next/link";
import { Edit, Trash2, CheckCircle2, AlertCircle, CheckSquare, Square } from "lucide-react";
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
import { type LearningOutcome } from "@/lib/api/learningOutcomeApi";
import { DeleteOutcomeDialog } from "./DeleteOutcomeDialog";
import { useState } from "react";

interface OutcomeTableProps {
  outcomes: (LearningOutcome & { course?: any; department?: any })[];
  onDelete?: () => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  /** Öğretmen: sadece görüntüleme, düzenleme/silme yok */
  readOnly?: boolean;
}

export function OutcomeTable({ outcomes, onDelete, selectedIds = new Set(), onToggleSelect, onToggleSelectAll, readOnly }: OutcomeTableProps) {
  const allSelected = outcomes.length > 0 && selectedIds.size === outcomes.length;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<LearningOutcome | null>(null);

  const handleDeleteClick = (outcome: LearningOutcome) => {
    setSelectedOutcome(outcome);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSuccess = () => {
    setDeleteDialogOpen(false);
    setSelectedOutcome(null);
    onDelete?.();
  };

  if (outcomes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-400" />
        <p className="text-lg font-medium">Öğrenme çıktısı bulunamadı</p>
        <p className="text-sm mt-2">Filtreleri değiştirerek tekrar deneyin</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:bg-gradient-to-r hover:from-brand-navy hover:to-[#0f3a6b]">
              {!readOnly && onToggleSelectAll != null && (
                <TableHead className="text-white font-bold w-12">
                  <button type="button" onClick={onToggleSelectAll} className="p-1 rounded hover:bg-white/20">
                    {allSelected ? <CheckSquare className="h-5 w-5 text-white" /> : <Square className="h-5 w-5 text-white" />}
                  </button>
                </TableHead>
              )}
              <TableHead className="text-white font-bold w-[120px]">ÖÇ Kodu</TableHead>
              <TableHead className="text-white font-bold">Açıklama</TableHead>
              <TableHead className="text-white font-bold w-[200px]">Ders</TableHead>
              <TableHead className="text-white font-bold w-[200px]">Bölüm</TableHead>
              <TableHead className="text-white font-bold text-center w-[150px]">Program Çıktıları</TableHead>
              {!readOnly && <TableHead className="text-white font-bold text-right w-[120px]">İşlemler</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {outcomes.map((outcome, index) => {
              const courseName = outcome.course?.name || "Bilinmeyen Ders";
              const departmentName = outcome.department?.name || 
                (typeof outcome.department === 'string' ? outcome.department : "Bilinmeyen Bölüm") ||
                "Bilinmeyen Bölüm";
              
              const mappedPOs = outcome.mappedProgramOutcomes || (outcome as any).programOutcomes || [];
              const hasMapping = mappedPOs.length > 0;
              
              return (
                <TableRow
                  key={outcome._id}
                  className={cn(
                    "hover:bg-brand-navy/5 dark:hover:bg-brand-navy/10 transition-colors",
                    index % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/50 dark:bg-slate-800/50"
                  )}
                >
                  {!readOnly && onToggleSelect != null && (
                    <TableCell className="w-12">
                      <button type="button" onClick={() => onToggleSelect(outcome._id)} className="p-1 rounded hover:bg-brand-navy/10">
                        {selectedIds.has(outcome._id) ? <CheckSquare className="h-5 w-5 text-brand-navy dark:text-slate-200" /> : <Square className="h-5 w-5 text-brand-navy/50 dark:text-slate-400" />}
                      </button>
                    </TableCell>
                  )}
                  <TableCell className="font-semibold">
                    <Badge variant="default" className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white shadow-md">
                      {outcome.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-slate-700 dark:text-slate-200">{outcome.description}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium text-brand-navy dark:text-slate-100">{courseName}</p>
                    {outcome.course?.code && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">{outcome.course.code}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{departmentName}</p>
                  </TableCell>
                  <TableCell className="text-center">
                    {hasMapping ? (
                      <div className="flex flex-col items-center gap-1">
                        <Badge 
                          variant="outline" 
                          className="font-medium border-green-500/30 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {mappedPOs.length} PÇ
                        </Badge>
                        <div className="flex flex-wrap gap-1 justify-center mt-1">
                          {mappedPOs.slice(0, 3).map((poCode: string, idx: number) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs border-brand-navy/30 text-brand-navy dark:text-slate-300"
                            >
                              {poCode}
                            </Badge>
                          ))}
                          {mappedPOs.length > 3 && (
                            <Badge
                              variant="outline"
                              className="text-xs border-brand-navy/30 text-brand-navy dark:text-slate-300"
                            >
                              +{mappedPOs.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Badge 
                        variant="outline" 
                        className="font-medium border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Eşleştirme yok
                      </Badge>
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          asChild
                          className="h-8 w-8 hover:bg-brand-navy/10 hover:border-brand-navy/50 transition-all"
                        >
                          <Link href={`/outcomes/${outcome._id}`}>
                            <Edit className="h-4 w-4 text-brand-navy dark:text-slate-200" />
                          </Link>
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDeleteClick(outcome)}
                          className="h-8 w-8 hover:bg-destructive/90 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedOutcome && (
        <DeleteOutcomeDialog
          outcomeId={selectedOutcome._id}
          outcomeCode={selectedOutcome.code}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </>
  );
}
