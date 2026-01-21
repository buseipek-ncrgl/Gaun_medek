"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ExamAnalysisResponse,
  examApi,
  type Exam,
} from "@/lib/api/examApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";

type QuestionRow = ExamAnalysisResponse["questionAnalysis"][number];
type OutcomeRow = ExamAnalysisResponse["learningOutcomeAnalysis"][number];
type ProgramRow = ExamAnalysisResponse["programOutcomeAnalysis"][number];

export default function ExamAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  const [analysis, setAnalysis] = useState<ExamAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (examId) {
      loadAnalysis();
    }
  }, [examId]);

  const loadAnalysis = async () => {
    try {
      setIsLoading(true);
      const data = await examApi.getAnalysis(examId);
      setAnalysis(data);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Sınav analizi yüklenemedi. Lütfen daha sonra tekrar deneyin."
      );
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const questionData = useMemo<QuestionRow[]>(() => {
    return analysis?.questionAnalysis || [];
  }, [analysis]);

  const outcomeData = useMemo<OutcomeRow[]>(() => {
    return analysis?.learningOutcomeAnalysis || [];
  }, [analysis]);

  const programData = useMemo<ProgramRow[]>(() => {
    return analysis?.programOutcomeAnalysis || [];
  }, [analysis]);

  const handleExportPdf = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Analiz yükleniyor...
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sınav Analizi</h1>
          <p className="text-muted-foreground">
            Genel puan bazlı otomatik NTMYO raporu
          </p>
        </div>
        <Button onClick={handleExportPdf} className="h-11 px-5">
          <Download className="h-4 w-4 mr-2" />
          PDF olarak indir
        </Button>
      </div>

      {/* A) Soru Düzeyi Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle>Soru Bazlı Analiz</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border border-border text-sm">
            <thead className="bg-slate-50 dark:bg-muted">
              <tr>
                <th className="p-2 border border-border text-foreground">Soru</th>
                <th className="p-2 border border-border text-foreground">ÖÇ</th>
                <th className="p-2 border border-border text-foreground">Ortalama</th>
                <th className="p-2 border border-border text-foreground">Başarı %</th>
                <th className="p-2 border border-border text-foreground">Cevap Veren</th>
              </tr>
            </thead>
            <tbody>
              {questionData.map((q) => (
                <tr key={q.questionNumber} className="text-center">
                  <td className="border border-border p-2 text-foreground">{q.questionNumber}</td>
                  <td className="border border-border p-2 text-foreground">{q.learningOutcomeCode || "-"}</td>
                  <td className="border border-border p-2 text-foreground">{q.averageScore}</td>
                  <td className="border border-border p-2 text-foreground">{q.successRate}%</td>
                  <td className="border border-border p-2 text-foreground">{q.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* B) ÖÇ Grafiği */}
      <Card>
        <CardHeader>
          <CardTitle>Öğrenme Çıktısı (ÖÇ) Başarı Grafiği</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {outcomeData.length === 0 ? (
            <p className="text-muted-foreground">ÖÇ verisi bulunamadı.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outcomeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="code" 
                  tick={{ fill: "hsl(var(--foreground))" }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  tick={{ fill: "hsl(var(--foreground))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                  itemStyle={{
                    color: "hsl(var(--foreground))",
                  }}
                  labelStyle={{
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend 
                  wrapperStyle={{ color: "hsl(var(--foreground))" }}
                  iconType="square"
                />
                <Bar 
                  dataKey="success" 
                  name="Başarı %" 
                  fill="#6366f1"
                  style={{ fillOpacity: 1, opacity: 1 }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* C) PÇ Radar Grafiği */}
      <Card>
        <CardHeader>
          <CardTitle>Program Çıktısı (PÇ) Başarı Radar Grafiği</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {programData.length === 0 ? (
            <p className="text-muted-foreground">PÇ verisi bulunamadı.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={programData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis 
                  dataKey="code" 
                  tick={{ fill: "hsl(var(--foreground))" }}
                />
                <Radar
                  name="Başarı %"
                  dataKey="success"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.4}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                  itemStyle={{
                    color: "hsl(var(--foreground))",
                  }}
                  labelStyle={{
                    color: "hsl(var(--foreground))",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* D) Özet */}
      <Card>
        <CardHeader>
          <CardTitle>Özet ve Öneriler</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-700 leading-relaxed">
            {analysis.summary?.recommendations || "Öneri bulunamadı."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

