"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExamForm } from "@/components/exams/ExamForm";
import { examApi, type Exam } from "@/lib/api/examApi";
import { Upload, FileText, ArrowLeft } from "lucide-react";

export default function EditExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;
  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (examId) {
      fetchExamData();
    }
  }, [examId]);

  const fetchExamData = async () => {
    try {
      setIsLoading(true);
      const examData = await examApi.getById(examId);
      setExam(examData);
    } catch (error: any) {
      toast.error("Sınav verileri yüklenemedi");
      router.push("/exams");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-3 py-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-navy border-t-transparent" />
          <p className="text-sm text-muted-foreground">Sınav bilgileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return null;
  }

  return (
    <div className="min-w-0 w-full px-3 py-4 sm:px-4 sm:py-6 md:px-6 space-y-4 sm:space-y-6 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="w-fit px-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Geri
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/exams/${examId}/upload`)}
            className="flex-1 sm:flex-none"
          >
            <Upload className="h-4 w-4 mr-2" />
            Puanlama
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/exams/${examId}/batch-upload`)}
            className="flex-1 sm:flex-none"
          >
            <FileText className="h-4 w-4 mr-2" />
            Toplu Yükleme
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">Sınav Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <ExamForm
            mode="edit"
            examId={examId}
            initialData={exam}
            onSuccess={(updatedExam) => {
              if (updatedExam) setExam(updatedExam);
              else fetchExamData();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

