"use client";

import { Edit, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
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
import { type ProgramOutcome } from "@/lib/api/programOutcomeApi";
import { DeleteProgramOutcomeDialog } from "./DeleteProgramOutcomeDialog";
import { EditProgramOutcomeDialog } from "./EditProgramOutcomeDialog";
import { useState } from "react";

interface ProgramOutcomeTableProps {
  programOutcomes: ProgramOutcome[];
  learningOutcomeCounts: Record<string, number>;
  programId?: string;
  onDelete?: () => void;
}

export function ProgramOutcomeTable({
  programOutcomes,
  learningOutcomeCounts,
  programId,
  onDelete,
}: ProgramOutcomeTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProgramOutcome, setSelectedProgramOutcome] = useState<ProgramOutcome | null>(null);

  const handleDeleteClick = (programOutcome: ProgramOutcome) => {
    setSelectedProgramOutcome(programOutcome);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (programOutcome: ProgramOutcome) => {
    setSelectedProgramOutcome(programOutcome);
    setEditDialogOpen(true);
  };

  const handleDeleteSuccess = () => {
    setDeleteDialogOpen(false);
    setSelectedProgramOutcome(null);
    onDelete?.();
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    setSelectedProgramOutcome(null);
    onDelete?.();
  };

  if (programOutcomes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-400" />
        <p className="text-lg font-medium">Program çıktısı bulunamadı</p>
        <p className="text-sm mt-2">Yeni bir program çıktısı ekleyerek başlayın</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:bg-gradient-to-r hover:from-brand-navy hover:to-[#0f3a6b]">
              <TableHead className="text-white font-bold w-[120px]">PÇ Kodu</TableHead>
              <TableHead className="text-white font-bold">Açıklama</TableHead>
              <TableHead className="text-white font-bold text-center w-[180px]">Öğrenme Çıktıları</TableHead>
              <TableHead className="text-white font-bold text-right w-[120px]">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {programOutcomes.map((programOutcome, index) => {
              const loCount = learningOutcomeCounts[programOutcome.code] || 0;
              const hasMapping = loCount > 0;
              
              return (
                <TableRow
                  key={`${programOutcome.code}-${index}`}
                  className={cn(
                    "hover:bg-brand-navy/5 dark:hover:bg-brand-navy/10 transition-colors",
                    index % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/50 dark:bg-slate-800/50"
                  )}
                >
                  <TableCell className="font-semibold">
                    <Badge variant="default" className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white shadow-md">
                      {programOutcome.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-slate-700 dark:text-slate-200">{programOutcome.description}</p>
                  </TableCell>
                  <TableCell className="text-center">
                    {hasMapping ? (
                      <div className="flex flex-col items-center gap-1">
                        <Badge 
                          variant="outline" 
                          className="font-medium border-green-500/30 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {loCount} ÖÇ
                        </Badge>
                        <div className="w-full max-w-[120px] bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                          <div
                            className="bg-gradient-to-r from-green-500 to-emerald-600 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (loCount / 10) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <Badge 
                        variant="outline" 
                        className="font-medium border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Eşleşme yok
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEditClick(programOutcome)}
                        className="h-8 w-8 hover:bg-brand-navy/10 hover:border-brand-navy/50 transition-all"
                      >
                        <Edit className="h-4 w-4 text-brand-navy dark:text-slate-200" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteClick(programOutcome)}
                        className="h-8 w-8 hover:bg-destructive/90 transition-all"
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

      {selectedProgramOutcome && programId && (
        <>
          <EditProgramOutcomeDialog
            programId={programId}
            programOutcome={selectedProgramOutcome}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onSuccess={handleEditSuccess}
          />
          <DeleteProgramOutcomeDialog
            programId={programId}
            programOutcomeCode={selectedProgramOutcome.code}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onSuccess={handleDeleteSuccess}
          />
        </>
      )}
    </>
  );
}
