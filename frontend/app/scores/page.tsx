"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreTable } from "@/components/scores/ScoreTable";
import { BulkScoreEntry } from "@/components/scores/BulkScoreEntry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { examApi, type Exam } from "@/lib/api/examApi";
import { scoreApi, type Score } from "@/lib/api/scoreApi";

export default function ScoresPage() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [scores, setScores] = useState<Score[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("bulk");

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      fetchScores();
    } else {
      setScores([]);
    }
  }, [selectedExamId]);

  const fetchExams = async () => {
    try {
      setIsLoadingExams(true);
      const data = await examApi.getAll();
      setExams(data);
    } catch (error: any) {
      toast.error("Sınavlar yüklenemedi");
      console.error(error);
    } finally {
      setIsLoadingExams(false);
    }
  };

  const fetchScores = async () => {
    try {
      setIsLoading(true);
      const data = await scoreApi.getByExam(selectedExamId);
      setScores(data);
    } catch (error: any) {
      toast.error("Puanlar yüklenemedi");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedExam = exams.find((e) => e._id === selectedExamId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            Öğrenci sınav puanlarını görüntüleyin ve yönetin
          </p>
        </div>
        <Button onClick={() => router.push("/scores/upload")}>
          <Upload className="mr-2 h-4 w-4" />
          Toplu Puan Yükleme
        </Button>
      </div>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Sınav Seç</CardTitle>
          <CardDescription>
            Puanları görüntülemek ve yönetmek için bir sınav seçin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            disabled={isLoadingExams}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Bir sınav seçin...</option>
            {exams.map((exam) => (
              <option key={exam._id} value={exam._id}>
                {exam.examCode} ({exam.examType === "midterm" ? "Vize" : "Final"})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {selectedExamId && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>
              Puanlar: {selectedExam?.examCode || "Yükleniyor..."}
            </CardTitle>
            <CardDescription>
              {selectedExam && `Sınav Türü: ${selectedExam.examType === "midterm" ? "Vize" : "Final"}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Puanlar yükleniyor...
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="bulk">Toplu Puan Girişi</TabsTrigger>
                  <TabsTrigger value="view">Puan Görüntüleme</TabsTrigger>
                </TabsList>
                <TabsContent value="bulk" className="mt-4">
                  <BulkScoreEntry examId={selectedExamId} onUpdate={fetchScores} />
                </TabsContent>
                <TabsContent value="view" className="mt-4">
                  <ScoreTable scores={scores} onUpdate={fetchScores} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

