"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  examApi,
  type Exam,
  type CreateExamDto,
  type UpdateExamDto,
} from "@/lib/api/examApi";
import { courseApi, type Course } from "@/lib/api/courseApi";

interface ExamFormProps {
  mode: "create" | "edit";
  examId?: string;
  initialData?: Exam;
  onSuccess?: () => void;
}

type QuestionRow = {
  questionNumber: number;
  learningOutcomeCode: string;
};

export function ExamForm({ mode, examId, initialData, onSuccess }: ExamFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState(() => {
    if (initialData?.courseId) {
      // Handle both string and populated object
      if (typeof initialData.courseId === 'string') {
        return initialData.courseId;
      } else if (typeof initialData.courseId === 'object' && initialData.courseId !== null) {
        return initialData.courseId._id;
      }
    }
    return "";
  });
  const [examType, setExamType] = useState<"midterm" | "final">(
    initialData?.examType || "midterm"
  );
  const [examCode, setExamCode] = useState(initialData?.examCode || "");
  const [maxScore, setMaxScore] = useState<number>(
    initialData?.maxScore || 100
  );
  const [existingExams, setExistingExams] = useState<Exam[]>([]);
  const [examCodeError, setExamCodeError] = useState("");

  useEffect(() => {
    fetchCourses();
  }, []);

  // Düzenleme modunda initialData'dan course bilgisini al ve courses array'ine ekle
  useEffect(() => {
    if (mode === "edit" && initialData?.courseId) {
      const courseIdValue = typeof initialData.courseId === 'string' 
        ? initialData.courseId 
        : initialData.courseId._id;
      
      // Eğer populate edilmiş course objesi varsa, courses array'ine ekle
      if (typeof initialData.courseId === 'object' && initialData.courseId !== null) {
        const populatedCourse = initialData.courseId as any;
        setCourses(prev => {
          const exists = prev.find(c => c._id === populatedCourse._id);
          if (!exists) {
            return [...prev, {
              _id: populatedCourse._id,
              name: populatedCourse.name,
              code: populatedCourse.code,
              learningOutcomes: populatedCourse.learningOutcomes || [],
            } as Course];
          }
          return prev;
        });
      }
    }
  }, [mode, initialData]);

  // Soru bazlı işlem kaldırıldı - artık genel puan kullanılıyor

  const fetchCourses = async () => {
    try {
      const data = await courseApi.getAll();
      setCourses(data);
    } catch (error) {
      toast.error("Dersler yüklenemedi");
    }
  };

  const checkExamCode = async () => {
    if (!courseId || !examCode.trim()) {
      setExamCodeError("");
      return;
    }

    try {
      const courseExams = await examApi.getByCourse(courseId);
      setExistingExams(courseExams);
      const duplicate = courseExams.find(
        (exam) => 
          exam.examCode.trim().toLowerCase() === examCode.trim().toLowerCase() &&
          (mode === "create" || (mode === "edit" && exam._id !== examId))
      );
      if (duplicate) {
        setExamCodeError(`"${examCode.trim()}" sınav kodu bu ders için zaten mevcut. Aynı ders içinde aynı sınav kodu kullanılamaz.`);
      } else {
        setExamCodeError("");
      }
    } catch (error) {
      console.error("Sınav kontrolü yapılamadı:", error);
      setExamCodeError("");
    }
  };

  useEffect(() => {
    if (courseId && examCode.trim()) {
      checkExamCode();
    } else {
      setExamCodeError("");
      setExistingExams([]);
    }
  }, [courseId, examCode, mode, examId]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c._id === courseId),
    [courses, courseId]
  );

  const learningOutcomeOptions =
    selectedCourse?.learningOutcomes?.map((lo) => ({
      code: lo.code,
      label: `${lo.code} – ${lo.description}`,
    })) || [];

  const handleQuestionLoChange = (index: number, loCode: string) => {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === index
          ? {
              ...q,
              learningOutcomeCode: loCode,
            }
          : q
      )
    );
  };

  const validateForm = () => {
    if (!courseId) {
      toast.error("Ders seçimi zorunludur");
      return false;
    }
    if (!examCode.trim()) {
      toast.error("Sınav kodu zorunludur");
      return false;
    }
    if (examCodeError) {
      toast.error(examCodeError);
      return false;
    }
    if (!maxScore || maxScore <= 0) {
      toast.error("Maksimum puan 1 veya daha büyük olmalıdır");
      return false;
    }
    for (const q of questions) {
      if (!q.learningOutcomeCode) {
        toast.error(`Soru ${q.questionNumber} için ÖÇ seçmelisiniz`);
        return false;
      }
    }
    if (learningOutcomeOptions.length === 0) {
      toast.error("Bu ders için tanımlı öğrenme çıktısı yok");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const payload: CreateExamDto | UpdateExamDto = {
        courseId,
        examType,
        examCode: examCode.trim(),
        maxScore: Number(maxScore),
      };

      if (mode === "create") {
        await examApi.create(payload as CreateExamDto);
        toast.success("Sınav başarıyla oluşturuldu");
        
        // Dispatch event to notify other components (e.g., courses page)
        window.dispatchEvent(new CustomEvent('examCreated', { 
          detail: { courseId, examType: examType } 
        }));
        
        router.push("/exams");
      } else if (mode === "edit" && examId) {
        await examApi.update(examId, payload as UpdateExamDto);
        toast.success("Sınav başarıyla güncellendi");
        
        // Dispatch event to notify other components (e.g., courses page)
        window.dispatchEvent(new CustomEvent('examUpdated', { 
          detail: { courseId, examId } 
        }));
      }
      onSuccess?.();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Sınav kaydedilemedi";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="courseId">
            Ders <span className="text-red-500">*</span>
          </Label>
          <Select
            id="courseId"
            value={courseId}
            disabled={isSubmitting || mode === "edit"}
            onChange={(e) => setCourseId(e.target.value)}
            className="h-12 text-base"
          >
            <option value="">Bir ders seçin</option>
            {courses.map((course) => (
              <option key={course._id} value={course._id}>
                {course.code} - {course.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="examType">
            Sınav Türü <span className="text-red-500">*</span>
          </Label>
          <Select
            id="examType"
            value={examType}
            onChange={(e) => setExamType(e.target.value as "midterm" | "final")}
            disabled={isSubmitting}
            className="h-12 text-base"
          >
            <option value="midterm">Vize</option>
            <option value="final">Final</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="examCode">
            Sınav Kodu <span className="text-red-500">*</span>
          </Label>
          <Input
            id="examCode"
            value={examCode}
            onChange={(e) => setExamCode(e.target.value)}
            disabled={isSubmitting}
            placeholder="Örn: VIZE-2025-1"
            className={`h-12 text-base ${examCodeError ? "border-red-500 focus:border-red-500" : ""}`}
          />
          {examCodeError && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
              {examCodeError}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxScore">
            Maksimum Puan <span className="text-red-500">*</span>
          </Label>
          <Input
            id="maxScore"
            type="number"
            min={1}
            value={maxScore}
            onChange={(e) => setMaxScore(Number(e.target.value))}
            disabled={isSubmitting}
            className="h-12 text-base"
          />
          <p className="text-sm text-muted-foreground">
            Sınav için maksimum toplam puan
          </p>
        </div>
      </div>

      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle>Sorular → ÖÇ Seçimi</CardTitle>
          {!courseId && (
            <p className="text-sm text-amber-600 mt-2">
              ⚠️ ÖÇ seçmek için önce bir ders seçmelisiniz.
            </p>
          )}
          {courseId && learningOutcomeOptions.length === 0 && (
            <p className="text-sm text-amber-600 mt-2">
              ⚠️ Bu ders için henüz öğrenme çıktısı (ÖÇ) tanımlanmamış. Lütfen önce ders için ÖÇ ekleyin.
            </p>
          )}
          {courseId && learningOutcomeOptions.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              Her soruyu ilgili öğrenme çıktısına (ÖÇ) eşleyin. MEDEK değerlendirmesi için zorunludur.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {questionCount === 0 && (
            <p className="text-muted-foreground">Soru sayısı girildiğinde satırlar oluşacak.</p>
          )}
          {questions.map((q, idx) => (
            <div
              key={q.questionNumber}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg border bg-white"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-600">
                  Soru {q.questionNumber}
                </span>
                {!q.learningOutcomeCode && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                    ÖÇ seçilmedi
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                <Label>Öğrenme Çıktısı (ÖÇ) <span className="text-red-500">*</span></Label>
                <Select
                  value={q.learningOutcomeCode}
                  onChange={(e) => handleQuestionLoChange(idx, e.target.value)}
                  disabled={isSubmitting || learningOutcomeOptions.length === 0 || !courseId}
                  className={`h-11 ${!q.learningOutcomeCode ? "border-amber-300" : ""}`}
                >
                  <option value="">ÖÇ seçin</option>
                  {learningOutcomeOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                {!courseId && (
                  <p className="text-xs text-amber-600 mt-1">
                    Ders seçilmediği için ÖÇ seçilemiyor
                  </p>
                )}
                {courseId && learningOutcomeOptions.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Bu ders için ÖÇ tanımlanmamış
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting} className="h-12 px-6">
          {isSubmitting
            ? "Kaydediliyor..."
            : mode === "create"
            ? "Sınav Oluştur"
            : "Sınavı Güncelle"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="h-12 px-6"
        >
          İptal
        </Button>
      </div>
    </form>
  );
}

