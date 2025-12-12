"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { examApi } from "@/lib/api/examApi";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { type Exam } from "@/lib/api/examApi";

type StatusStep =
  | "idle"
  | "pdf"
  | "markers"
  | "crop"
  | "gemini"
  | "save"
  | "done"
  | "error";

export default function ExamUploadPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [studentNumber, setStudentNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusStep>("idle");
  const [scores, setScores] = useState<
    Array<{ questionNumber: number; score: number; learningOutcomeCode: string | null }>
  >([]);
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [maxTotalScore, setMaxTotalScore] = useState<number | null>(null);
  const [percentage, setPercentage] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (examId) {
      loadExam();
    }
  }, [examId]);

  const loadExam = async () => {
    try {
      const examData = await examApi.getById(examId);
      setExam(examData);
      
      // Ensure courseId is a string
      let courseId: string;
      if (typeof examData.courseId === 'string') {
        courseId = examData.courseId;
      } else if (examData.courseId && typeof examData.courseId === 'object' && '_id' in examData.courseId) {
        courseId = String((examData.courseId as any)._id);
      } else {
        courseId = String(examData.courseId || '');
      }
      
      if (!courseId || courseId === 'undefined' || courseId === 'null' || courseId === '[object Object]') {
        throw new Error('Geçersiz ders ID');
      }
      
      const courseData = await courseApi.getById(courseId);
      setCourse(courseData);
      if (courseData?.students?.length) {
        setStudentNumber(courseData.students[0].studentNumber);
      }
    } catch (error: any) {
      console.error('Error loading exam:', error);
      toast.error(error?.message || "Sınav bilgisi alınamadı");
    }
  };

  const students = useMemo(() => course?.students || [], [course]);

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Lütfen PDF yükleyin");
      return;
    }
    if (!studentNumber) {
      toast.error("Lütfen bir öğrenci seçin");
      return;
    }
    setIsSubmitting(true);
    setFallbackMessage(null);
    setStatus("pdf");
    try {
      // Tek çağrı, ilerleme UI'da gösteriliyor
      const result = await examApi.submitScore(examId, studentNumber, file);
      // Backend adımlarını tek istekte yapıyor; biz statüleri kullanıcıya bilgi amaçlı güncelliyoruz
      setStatus("gemini");
      if (result?.markers && result.markers.success === false) {
        setFallbackMessage("Marker bulunamadı, şablon modunda kesildi.");
      }
      setStatus("save");
      setScores(result?.scores || []);
      setTotalScore(result?.totalScore ?? null);
      setMaxTotalScore(result?.maxTotalScore ?? null);
      setPercentage(result?.percentage ?? null);
      setStatus("done");
      toast.success("AI puanlama tamamlandı");
    } catch (error: any) {
      setStatus("error");
      const msg =
        error?.response?.data?.message ||
        "Puanlama başarısız. PDF kalitesini ve şablonu kontrol edin.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/exams")} className="px-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Geri
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Sınav Puanlama</h1>
            <p className="text-muted-foreground">
              PDF yükleyin, AI otomatik olarak soruları puanlayıp ÖÇ eşlemesi yapacak.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Öğrenci ve PDF</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Öğrenci</Label>
              <Select
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                disabled={isSubmitting || students.length === 0}
              >
                <option value="">Öğrenci seçin</option>
                {students.map((s) => (
                  <option key={s.studentNumber} value={s.studentNumber}>
                    {s.studentNumber} - {s.fullName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>PDF Yükle</Label>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={isSubmitting} className="h-11 px-6">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Puanlanıyor...
              </>
            ) : (
              "AI Puanlamayı Başlat"
            )}
          </Button>

          <div className="space-y-2">
            <StatusLine label="PDF dönüştürülüyor" active={status === "pdf"} done={status !== "idle" && status !== "error" && status !== "pdf"} />
            <StatusLine label="Marker tespiti / şablon" active={status === "markers"} done={status !== "idle" && status !== "error" && status !== "markers"} />
            <StatusLine label="Soru kırpma" active={status === "crop"} done={status !== "idle" && status !== "error" && status !== "crop"} />
            <StatusLine label="Gemini ile skor okuma" active={status === "gemini"} done={status === "save" || status === "done"} />
            <StatusLine label="Sonuç kaydediliyor" active={status === "save"} done={status === "done"} />
          </div>

          {fallbackMessage && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {fallbackMessage}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sonuç Önizleme</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {scores.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Henüz sonuç yok. PDF yükleyip puanlama başlatın.
            </p>
          ) : (
            <div className="space-y-4">
              <table className="w-full border text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 border">Soru</th>
                    <th className="p-2 border">ÖÇ</th>
                    <th className="p-2 border">Skor</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s) => (
                    <tr key={s.questionNumber} className="text-center">
                      <td className="border p-2">{s.questionNumber}</td>
                      <td className="border p-2">{s.learningOutcomeCode || "-"}</td>
                      <td className="border p-2">{s.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Toplam Sonuç */}
              {(totalScore !== null || maxTotalScore !== null || percentage !== null) && (
                <div className="mt-4 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border-2 border-slate-200">
                  <h3 className="font-semibold text-lg mb-3 text-slate-900">Toplam Sonuç</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Toplam Puan</p>
                      <p className="text-2xl font-bold text-slate-900">{totalScore ?? 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Maksimum Puan</p>
                      <p className="text-2xl font-bold text-slate-700">{maxTotalScore ?? 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Başarı Yüzdesi</p>
                      <p className={`text-2xl font-bold ${
                        (percentage ?? 0) >= 70 
                          ? "text-green-600" 
                          : (percentage ?? 0) >= 50 
                          ? "text-yellow-600" 
                          : "text-red-600"
                      }`}>
                        {percentage ?? 0}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusLine({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : active ? (
        <Loader2 className="h-4 w-4 animate-spin text-[#0a294e]" />
      ) : (
        <div className="h-4 w-4 rounded-full border border-gray-300" />
      )}
      <span className={active ? "text-[#0a294e]" : "text-gray-700"}>{label}</span>
    </div>
  );
}

