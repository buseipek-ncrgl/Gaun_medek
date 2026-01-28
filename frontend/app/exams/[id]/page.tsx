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
      <div className="space-y-6">
        <p className="text-muted-foreground">Sınav bilgileri yükleniyor...</p>
      </div>
    );
  }

  if (!exam) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="px-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Geri
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/exams/${examId}/upload`)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Puanlama
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/exams/${examId}/batch-upload`)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Toplu Yükleme
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sınav Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <ExamForm
            mode="edit"
            examId={examId}
            initialData={exam}
            onSuccess={fetchExamData}
          />
        </CardContent>
      </Card>
    </div>
  );
}

