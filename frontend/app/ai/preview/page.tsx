"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentDetectionCard } from "@/components/ai/StudentDetectionCard";
import { AIScorePreviewToolbar } from "@/components/ai/AIScorePreviewToolbar";
import { type AIProcessResponse } from "@/lib/api/aiApi";
import { examApi } from "@/lib/api/examApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function AIPreviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [data, setData] = useState<AIProcessResponse | null>(null);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [studentNumber, setStudentNumber] = useState<string>("");
  const [examId, setExamId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    // Load data from localStorage (stored by AI page)
    if (sessionId) {
      const storedData = localStorage.getItem(`ai_session_${sessionId}`);
      if (storedData) {
        const parsed: AIProcessResponse = JSON.parse(storedData);
        setData(parsed);
        setTotalScore(parsed.totalScore);
        setStudentNumber(parsed.studentNumber);
        
        // Find exam by examCode
        findExamByCode(parsed.examId);
      }
    }
  }, [sessionId]);

  const findExamByCode = async (examCode: string) => {
    try {
      const { examApi } = await import("@/lib/api/examApi");
      const exam = await examApi.getByExamCode(examCode);
      if (exam) {
        setExamId(exam._id);
      }
    } catch (error) {
      console.error("Failed to find exam by code", error);
    }
  };

  const handleApproveAndSave = async () => {
    if (!studentNumber) {
      toast.error("Öğrenci numarası gerekli");
      return;
    }

    if (!examId) {
      toast.error("Sınav bulunamadı");
      return;
    }

    if (totalScore < 0) {
      toast.error("Geçersiz puan");
      return;
    }

    setShowSaveDialog(true);
  };

  const handleConfirmSave = async () => {
    if (!data || !examId || !studentNumber) {
      toast.error("Eksik bilgi");
      return;
    }

    setIsSaving(true);

    try {
      // PDF'i base64'e çevir (localStorage'da saklanmış olabilir)
      // Şimdilik sadece totalScore'u gönder
      await examApi.submitScore(examId, studentNumber, null); // PDF null, sadece totalScore kullanılacak
      
      toast.success("Puan başarıyla kaydedildi");
      router.push(`/dashboard/exams/${examId}/results`);
    } catch (error: any) {
      console.error("Failed to save score:", error);
      toast.error(error.response?.data?.message || "Puan kaydedilemedi");
    } finally {
      setIsSaving(false);
      setShowSaveDialog(false);
    }
  };

  const handleClearAll = () => {
    setTotalScore(0);
  };

  const handleDiscard = () => {
    if (confirm("Are you sure you want to discard all changes?")) {
      router.push("/ai");
    }
  };

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Score Preview</h2>
          <p className="text-muted-foreground">Loading preview data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Score Mapping Preview</h2>
        <p className="text-muted-foreground">
          Review and edit AI-detected scores before saving
        </p>
      </div>

      <StudentDetectionCard
        studentNumber={data.studentNumber}
        examId={data.examId}
        onStudentChange={setStudentNumber}
        onExamChange={setExamId}
      />

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Genel Puan</CardTitle>
          <CardDescription>
            AI tarafından tespit edilen genel puanı kontrol edin ve düzenleyin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Toplam Puan</label>
              <input
                type="number"
                value={totalScore}
                onChange={(e) => setTotalScore(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                min="0"
                step="0.01"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Öğrenci Numarası: <strong>{studentNumber}</strong></p>
              <p>Sınav Kodu: <strong>{data.examId}</strong></p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AIScorePreviewToolbar
        onApproveAndSave={handleApproveAndSave}
        onClearAll={handleClearAll}
        onDiscard={handleDiscard}
        isSaving={isSaving}
        disabled={!studentNumber || !examId}
      />

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Save</DialogTitle>
            <DialogDescription>
              Genel puan ({totalScore}) kaydedilecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <button
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={() => setShowSaveDialog(false)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
              onClick={handleConfirmSave}
            >
              Save All Scores
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AIPreviewPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Score Preview</h2>
          <p className="text-muted-foreground">Loading preview data...</p>
        </div>
      </div>
    }>
      <AIPreviewPageContent />
    </Suspense>
  );
}

